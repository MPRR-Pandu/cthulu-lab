use tauri::Emitter;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::time::{Duration, Instant};

use crate::chat::manager::ChatManager;
use crate::chat::types::StreamChunk;

const STALL_WARN_SECS: u64 = 30;

#[derive(Debug, Clone, serde::Serialize)]
pub struct ToolUseEvent {
    pub agent_id: String,
    pub tool_name: String,
    pub tool_input: String,
    pub block_index: u64,
}

/// Stream claude CLI output to frontend via Tauri events.
/// Returns the session_id from the init event so we can resume later.
pub async fn stream_response(
    app_handle: &tauri::AppHandle,
    mut child: tokio::process::Child,
    agent_id: &str,
    message_id: &str,
    chat_manager: &ChatManager,
) -> Result<Option<String>, String> {
    // Capture stderr and emit as debug events to frontend
    let stderr = child.stderr.take();
    if let Some(stderr) = stderr {
        let ah_debug = app_handle.clone();
        let aid_debug = agent_id.to_string();
        tokio::spawn(async move {
            let reader = BufReader::new(stderr);
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                // Filter out noisy stdin wait warnings — harmless, caused by piped stdin
                if line.contains("no stdin data received") {
                    continue;
                }
                tracing::warn!(agent = %aid_debug, "{}", line);
                let _ = ah_debug.emit("agent-debug", serde_json::json!({
                    "agent_id": aid_debug,
                    "message": line,
                }));
            }
        });
    }

    let stdout = child
        .stdout
        .take()
        .ok_or("Failed to capture stdout")?;

    let reader = BufReader::new(stdout);
    let mut lines = reader.lines();
    let mut session_id: Option<String> = None;
    let mut buffer = String::new();
    let mut last_emit = Instant::now();
    let batch_interval = std::time::Duration::from_millis(50);
    let mut tool_call_count: u32 = 0;

    // Signal that the read loop has started so UI can show "waiting for first token".
    tracing::info!(agent = %agent_id, "stream loop started, awaiting first line from claude CLI");
    let _ = app_handle.emit(
        "agent-debug",
        serde_json::json!({
            "agent_id": agent_id,
            "message": "stream started, waiting for first token...",
        }),
    );

    let stall_timeout = Duration::from_secs(STALL_WARN_SECS);
    let mut first_line_seen = false;
    let mut stall_ticks: u32 = 0;

    loop {
        let next = tokio::time::timeout(stall_timeout, lines.next_line()).await;

        let line = match next {
            Ok(Ok(Some(line))) => line,
            Ok(Ok(None)) => break, // EOF — claude CLI exited
            Ok(Err(e)) => {
                tracing::error!(agent = %agent_id, "stdout read error: {}", e);
                return Err(format!("stdout read error: {}", e));
            }
            Err(_) => {
                stall_ticks += 1;
                let waited = STALL_WARN_SECS * stall_ticks as u64;
                let stage = if first_line_seen { "after first token" } else { "before first token" };
                tracing::warn!(
                    agent = %agent_id,
                    "claude CLI stalled {}s {} — still waiting",
                    waited, stage
                );
                let _ = app_handle.emit(
                    "chat-stream-stalled",
                    serde_json::json!({
                        "agent_id": agent_id,
                        "message_id": message_id,
                        "waited_secs": waited,
                        "first_line_seen": first_line_seen,
                    }),
                );
                let _ = app_handle.emit(
                    "agent-debug",
                    serde_json::json!({
                        "agent_id": agent_id,
                        "message": format!("stalled {}s {} — still waiting", waited, stage),
                    }),
                );
                continue;
            }
        };

        if !first_line_seen {
            first_line_seen = true;
            stall_ticks = 0;
            tracing::info!(agent = %agent_id, "first line received from claude CLI");
        } else {
            // Reset stall counter on any progress
            stall_ticks = 0;
        }
        if session_id.is_none() {
            if let Some(sid) = extract_session_id(&line) {
                session_id = Some(sid);
            }
        }

        if let Some(tool_event) = extract_tool_use(&line, agent_id) {
            tool_call_count += 1;
            let _ = app_handle.emit("permission-request", &tool_event);
        }

        if let Some(cost_data) = extract_cost_data(&line) {
            let _ = app_handle.emit("chat-cost", serde_json::json!({
                "agent_id": agent_id,
                "message_id": message_id,
                "cost_usd": cost_data.0,
                "input_tokens": cost_data.1,
                "output_tokens": cost_data.2,
            }));
        }

        if let Some(text) = extract_text_from_stream_json(&line) {
            chat_manager
                .append_to_streaming(agent_id, message_id, &text)
                .await;

            buffer.push_str(&text);

            if last_emit.elapsed() >= batch_interval {
                let _ = app_handle.emit(
                    "chat-stream",
                    StreamChunk {
                        agent_id: agent_id.to_string(),
                        message_id: message_id.to_string(),
                        chunk: buffer.clone(),
                        done: false,
                    },
                );
                buffer.clear();
                last_emit = Instant::now();
            }
        }
    }

    if !buffer.is_empty() {
        let _ = app_handle.emit(
            "chat-stream",
            StreamChunk {
                agent_id: agent_id.to_string(),
                message_id: message_id.to_string(),
                chunk: buffer,
                done: false,
            },
        );
    }

    let _ = child.wait().await;

    chat_manager.finalize_message(agent_id, message_id).await;

    let _ = app_handle.emit(
        "chat-stats",
        serde_json::json!({
            "agent_id": agent_id,
            "message_id": message_id,
            "tool_calls": tool_call_count,
        }),
    );

    let _ = app_handle.emit(
        "chat-stream",
        StreamChunk {
            agent_id: agent_id.to_string(),
            message_id: message_id.to_string(),
            chunk: String::new(),
            done: true,
        },
    );

    Ok(session_id)
}

fn extract_session_id(line: &str) -> Option<String> {
    let v: serde_json::Value = serde_json::from_str(line).ok()?;
    if v.get("type")?.as_str()? == "system" {
        return v.get("session_id")?.as_str().map(|s| s.to_string());
    }
    None
}

fn extract_tool_use(line: &str, agent_id: &str) -> Option<ToolUseEvent> {
    let v: serde_json::Value = serde_json::from_str(line).ok()?;

    if v.get("type")?.as_str()? == "content_block_start" {
        let block = v.get("content_block")?;
        if block.get("type")?.as_str()? == "tool_use" {
            let tool_name = block.get("name")?.as_str()?.to_string();
            return Some(ToolUseEvent {
                agent_id: agent_id.to_string(),
                tool_name,
                tool_input: String::new(),
                block_index: v.get("index")?.as_u64()?,
            });
        }
    }

    None
}

fn extract_text_from_stream_json(line: &str) -> Option<String> {
    let v: serde_json::Value = serde_json::from_str(line).ok()?;

    match v.get("type")?.as_str()? {
        "assistant" => {
            // Claude CLI stream-json: message.content[].text
            let content = v.get("message")?.get("content")?.as_array()?;
            let text: String = content
                .iter()
                .filter_map(|block| {
                    if block.get("type").and_then(|t| t.as_str()) == Some("text") {
                        block.get("text").and_then(|t| t.as_str())
                    } else {
                        None
                    }
                })
                .collect::<Vec<_>>()
                .join("");
            if text.is_empty() {
                None
            } else {
                Some(text)
            }
        }
        "content_block_delta" => {
            v.get("delta")?
                .get("text")
                .and_then(|t| t.as_str())
                .map(|s| s.to_string())
        }
        "result" => {
            None
        }
        _ => None,
    }
}

fn extract_cost_data(line: &str) -> Option<(f64, u64, u64)> {
    let v: serde_json::Value = serde_json::from_str(line).ok()?;
    if v.get("type")?.as_str()? != "result" {
        return None;
    }
    let cost = v.get("cost_usd").and_then(|c| c.as_f64()).unwrap_or(0.0);
    let input_tokens = v.pointer("/usage/input_tokens").and_then(|t| t.as_u64()).unwrap_or(0);
    let output_tokens = v.pointer("/usage/output_tokens").and_then(|t| t.as_u64()).unwrap_or(0);
    if cost > 0.0 || input_tokens > 0 || output_tokens > 0 {
        Some((cost, input_tokens, output_tokens))
    } else {
        None
    }
}
