use tauri::Emitter;
use tokio::io::{AsyncBufReadExt, BufReader};

use crate::chat::manager::ChatManager;
use crate::chat::types::StreamChunk;

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
                eprintln!("[claude stderr] {}", line);
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

    while let Ok(Some(line)) = lines.next_line().await {
        // Try to capture session_id from init event
        if session_id.is_none() {
            if let Some(sid) = extract_session_id(&line) {
                session_id = Some(sid);
            }
        }

        if let Some(tool_event) = extract_tool_use(&line, agent_id) {
            let _ = app_handle.emit("permission-request", &tool_event);
        }

        if let Some(text) = extract_text_from_stream_json(&line) {
            // Update in-memory
            chat_manager
                .append_to_streaming(agent_id, message_id, &text)
                .await;

            // Emit to frontend
            let _ = app_handle.emit(
                "chat-stream",
                StreamChunk {
                    agent_id: agent_id.to_string(),
                    message_id: message_id.to_string(),
                    chunk: text,
                    done: false,
                },
            );
        }
    }

    // Wait for process to finish
    let _ = child.wait().await;

    // Finalize
    chat_manager.finalize_message(agent_id, message_id).await;

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
            // Skip — result repeats the same text already received from "assistant"
            None
        }
        _ => None,
    }
}
