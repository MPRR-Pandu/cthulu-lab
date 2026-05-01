use chrono::Utc;
use std::sync::Arc;
use tauri::Emitter;
use tokio::io::AsyncWriteExt;
use uuid::Uuid;

use crate::chat::types::{ChatMessage, Role, StreamChunk};
use crate::claude;
use crate::inbox::types::{InboxMessage, InboxMessageType};
use crate::state::AppState;

#[tauri::command]
pub async fn send_message(
    state: tauri::State<'_, AppState>,
    app_handle: tauri::AppHandle,
    agent_id: String,
    content: String,
) -> Result<String, String> {
    let chat_manager = state.chat_manager.clone();

    // Add user message
    let user_msg = ChatMessage {
        id: Uuid::new_v4().to_string(),
        role: Role::User,
        content: content.clone(),
        timestamp: Utc::now(),
        agent_id: agent_id.clone(),
        is_streaming: false,
    };
    chat_manager.add_message(&agent_id, user_msg).await;

    // Create agent message stub
    let agent_msg_id = Uuid::new_v4().to_string();
    let agent_msg = ChatMessage {
        id: agent_msg_id.clone(),
        role: Role::Agent,
        content: String::new(),
        timestamp: Utc::now(),
        agent_id: agent_id.clone(),
        is_streaming: true,
    };
    chat_manager.add_message(&agent_id, agent_msg).await;

    // Use active workspace as working directory — must be set
    let working_dir = state.active_workspace.read().await.clone();
    if working_dir.is_empty() {
        return Err("No workspace set. Add a workspace first.".to_string());
    }

    // Detect if workspace is empty and prepend context
    let is_empty = std::fs::read_dir(&working_dir)
        .map(|mut d| d.next().is_none())
        .unwrap_or(false);

    let final_content = if is_empty {
        format!(
            "[WORKSPACE CONTEXT: This is an EMPTY workspace directory at {}. There is no existing code. Do NOT try to explore or read files — there are none. Create new files from scratch. Start by scaffolding the project.]\n\n{}",
            working_dir, content
        )
    } else {
        content.clone()
    };

    // Get speed mode, auto-approve, and budget cap
    let speed = state.speed_mode.read().await.clone();
    let auto_approve = *state.auto_approve.read().await;
    let budget_cap = *state.budget_cap.read().await;

    // Check if we have an existing session for this agent
    let existing_session = {
        let sessions = state.agent_sessions.read().await;
        sessions.get(&agent_id).cloned()
    };

    tracing::info!(
        agent = %agent_id,
        workspace = %working_dir,
        speed = %speed,
        resume = existing_session.is_some(),
        "sending message"
    );

    // Cancel-prev + spawn-new is held under a single write lock on
    // `active_streams` so concurrent send_message calls for the same agent
    // serialize. Without this guard, two callers could each take the
    // previous handle, both spawn fresh claude processes, and the loser's
    // handle would be evicted from the map — leaking an un-killable child.
    //
    // Lock acquisition is brief: `spawn_claude` only validates paths and
    // calls `Command::spawn` (sync fork+exec under the hood); the stream
    // loop itself runs inside the spawned task and doesn't hold this lock.
    let mut streams = state.active_streams.write().await;
    if let Some(prev) = streams.remove(&agent_id) {
        prev.abort();
        // Await the aborted task so its destructor drops the owned `Child`
        // and `kill_on_drop(true)` finishes SIGKILLing the previous claude
        // before we spawn the next one. Otherwise two CLI processes can
        // briefly race on the same `--resume <sid>`.
        let _ = prev.await;
    }
    state.active_processes.write().await.remove(&agent_id);

    // Spawn claude CLI — resume session if we have one
    let mut child = claude::cli::spawn_claude(
        &agent_id,
        &final_content,
        &working_dir,
        existing_session.as_deref(),
        &speed,
        auto_approve,
        budget_cap,
    )
    .await?;

    // Store stdin handle for permission responses
    if let Some(stdin_handle) = child.stdin.take() {
        let mut procs = state.active_processes.write().await;
        procs.insert(agent_id.clone(), Arc::new(tokio::sync::Mutex::new(stdin_handle)));
    }

    // Stream in background
    let msg_id = agent_msg_id.clone();
    let aid = agent_id.clone();
    let cm = chat_manager.clone();
    let ah = app_handle.clone();
    let agent_sessions = state.agent_sessions.clone();
    let failure_counts = state.agent_failure_counts.clone();
    let inbox = state.inbox.clone();
    let active_procs = state.active_processes.clone();

    let handle = tokio::spawn(async move {
        let result = claude::stream::stream_response(&ah, child, &aid, &msg_id, &cm).await;

        // Read what (if anything) the agent actually produced for this turn.
        let last_agent_content = {
            let msgs = cm.get_messages(&aid).await;
            msgs.iter()
                .rev()
                .find(|m| m.id == msg_id)
                .map(|m| m.content.clone())
                .unwrap_or_default()
        };
        let produced_output = !last_agent_content.trim().is_empty();

        match result {
            Ok(session_id_opt) => {
                if let Some(session_id) = session_id_opt {
                    let mut sessions = agent_sessions.write().await;
                    sessions.insert(aid.clone(), session_id);
                }

                if produced_output {
                    // Successful turn — clear failure counter, post inbox preview.
                    {
                        let mut counts = failure_counts.write().await;
                        counts.remove(&aid);
                    }
                    let response_preview = truncate_chars(&last_agent_content, 80);
                    let report = InboxMessage {
                        id: Uuid::new_v4().to_string(),
                        from: aid.clone(),
                        to: "user".to_string(),
                        message_type: InboxMessageType::Report,
                        content: response_preview,
                        timestamp: Utc::now(),
                        read: false,
                        ref_message_id: Some(msg_id.clone()),
                    };
                    inbox.add(report).await;
                } else {
                    // CLI exited cleanly but produced no assistant text.
                    // Surface as an error so the user isn't staring at a
                    // blank bubble, and count it toward the loop-detection
                    // threshold like any other failure.
                    //
                    // `stream::stream_response` already emitted `done: true`
                    // before returning, so the frontend has finalized the
                    // message stub. We now backfill the bubble by emitting
                    // a fresh `chat-stream` chunk with the error text — the
                    // frontend's chunk handler will append it to the same
                    // message_id even though the bubble is no longer
                    // streaming.
                    let err_text =
                        "claude CLI exited without producing any output (session may be stale or rate-limited)";
                    let err_line = format!("[Error: {}]", err_text);
                    tracing::warn!(agent = %aid, "{}", err_text);
                    cm.append_to_streaming(&aid, &msg_id, &err_line).await;
                    cm.finalize_message(&aid, &msg_id).await;
                    let _ = ah.emit("chat-stream", StreamChunk {
                        agent_id: aid.clone(),
                        message_id: msg_id.clone(),
                        chunk: err_line,
                        done: false,
                    });

                    let count = {
                        let mut counts = failure_counts.write().await;
                        let count = counts.entry(aid.clone()).or_insert(0);
                        *count += 1;
                        *count
                    };

                    if count >= 3 {
                        // Stale session is the most likely cause after
                        // repeated empty turns — drop it so the next send
                        // starts fresh instead of resuming a dead one.
                        agent_sessions.write().await.remove(&aid);

                        let alert_content = format!(
                            "{} produced empty replies {} times in a row. Cleared session — try again.",
                            aid, count
                        );
                        let alert_msg = InboxMessage {
                            id: Uuid::new_v4().to_string(),
                            from: "system".to_string(),
                            to: "user".to_string(),
                            message_type: InboxMessageType::Alert,
                            content: alert_content.clone(),
                            timestamp: Utc::now(),
                            read: false,
                            ref_message_id: None,
                        };
                        inbox.add(alert_msg).await;
                        let _ = ah.emit("agent-stuck", serde_json::json!({
                            "agent_id": aid,
                            "failure_count": count,
                            "message": alert_content,
                        }));
                        failure_counts.write().await.remove(&aid);
                    }
                }
            }
            Err(e) => {
                tracing::error!(agent = %aid, "stream error: {}", e);
                cm.append_to_streaming(&aid, &msg_id, &format!("\n\n[Error: {}]", e))
                    .await;
                cm.finalize_message(&aid, &msg_id).await;

                let count = {
                    let mut counts = failure_counts.write().await;
                    let count = counts.entry(aid.clone()).or_insert(0);
                    *count += 1;
                    *count
                };

                if count >= 3 {
                    let alert_content = format!(
                        "{} stuck after {} failures. Escalating to user.",
                        aid, count
                    );
                    let alert_msg = InboxMessage {
                        id: Uuid::new_v4().to_string(),
                        from: "system".to_string(),
                        to: "user".to_string(),
                        message_type: InboxMessageType::Alert,
                        content: alert_content.clone(),
                        timestamp: Utc::now(),
                        read: false,
                        ref_message_id: None,
                    };
                    inbox.add(alert_msg).await;

                    let _ = ah.emit("agent-stuck", serde_json::json!({
                        "agent_id": aid,
                        "failure_count": count,
                        "message": alert_content,
                    }));

                    failure_counts.write().await.remove(&aid);
                }
            }
        }

        // Clean up the stdin handle. Don't touch active_streams here — the
        // next send_message removes/aborts the previous entry, and removing
        // a completed handle here would race with that insert and orphan a
        // live task. A finished JoinHandle in the map is harmless (abort()
        // is a no-op on completed tasks).
        active_procs.write().await.remove(&aid);
    });

    streams.insert(agent_id.clone(), handle);
    drop(streams);

    Ok(agent_msg_id)
}

#[tauri::command]
pub async fn get_chat_history(
    state: tauri::State<'_, AppState>,
    agent_id: String,
) -> Result<Vec<ChatMessage>, String> {
    let messages = state.chat_manager.get_messages(&agent_id).await;
    Ok(messages)
}

#[tauri::command]
pub async fn toggle_voice(state: tauri::State<'_, AppState>) -> Result<bool, String> {
    let mut enabled = state.voice_enabled.write().await;
    *enabled = !*enabled;
    Ok(*enabled)
}

#[tauri::command]
pub async fn set_speed_mode(state: tauri::State<'_, AppState>, mode: String) -> Result<String, String> {
    let mut speed = state.speed_mode.write().await;
    *speed = mode.clone();
    Ok(mode)
}

#[tauri::command]
pub async fn set_auto_approve(state: tauri::State<'_, AppState>, enabled: bool) -> Result<bool, String> {
    let mut auto = state.auto_approve.write().await;
    *auto = enabled;
    Ok(enabled)
}

#[tauri::command]
pub async fn set_budget_cap(state: tauri::State<'_, AppState>, cap: f64) -> Result<f64, String> {
    let mut budget = state.budget_cap.write().await;
    *budget = cap;
    Ok(cap)
}

#[tauri::command]
pub async fn delegate_to_agent(
    state: tauri::State<'_, AppState>,
    app_handle: tauri::AppHandle,
    from_agent: String,
    to_agent: String,
    task: String,
    context: String,
) -> Result<String, String> {
    // Check delegation depth — max 2
    {
        let depths = state.delegation_depth.read().await;
        let current_depth = depths.get(&from_agent).copied().unwrap_or(0);
        if current_depth >= 2 {
            return Err(format!(
                "Delegation depth exceeded (max 2). {} cannot delegate further.",
                from_agent
            ));
        }
    }

    // Increment depth for the target agent
    {
        let mut depths = state.delegation_depth.write().await;
        let from_depth = depths.get(&from_agent).copied().unwrap_or(0);
        depths.insert(to_agent.clone(), from_depth + 1);
    }

    let delegated_content = format!(
        "[Delegated from {}] Context: {}\n\nTask: {}",
        from_agent, context, task
    );

    // Post delegation message to inbox
    let inbox_msg = InboxMessage {
        id: Uuid::new_v4().to_string(),
        from: from_agent.clone(),
        to: to_agent.clone(),
        message_type: InboxMessageType::Delegation,
        content: format!("Delegated task: {}", task),
        timestamp: Utc::now(),
        read: false,
        ref_message_id: None,
    };
    state.inbox.add(inbox_msg).await;

    let _ = app_handle.emit("inbox-update", serde_json::json!({
        "from": from_agent,
        "to": to_agent,
        "type": "delegation",
    }));

    // Reuse send_message logic
    let result = send_message(
        state.clone(),
        app_handle,
        to_agent.clone(),
        delegated_content,
    )
    .await;

    // Clean up delegation depth on completion
    {
        let mut depths = state.delegation_depth.write().await;
        depths.remove(&to_agent);
    }

    result
}

/// Truncate `s` to at most `max` Unicode chars, appending `...` if truncated.
/// Compares char count (not byte length) so multi-byte content isn't sliced
/// mid-codepoint and the `...` marker stays accurate.
fn truncate_chars(s: &str, max: usize) -> String {
    let mut chars = s.chars();
    let head: String = chars.by_ref().take(max).collect();
    if chars.next().is_some() {
        format!("{}...", head)
    } else {
        head
    }
}

#[tauri::command]
pub async fn respond_permission(
    state: tauri::State<'_, AppState>,
    agent_id: String,
    allow: bool,
) -> Result<(), String> {
    let procs = state.active_processes.read().await;
    if let Some(stdin_handle) = procs.get(&agent_id) {
        let mut stdin = stdin_handle.lock().await;
        let response = if allow { "y\n" } else { "n\n" };
        stdin.write_all(response.as_bytes()).await
            .map_err(|e| format!("Failed to write to stdin: {}", e))?;
        stdin.flush().await
            .map_err(|e| format!("Failed to flush stdin: {}", e))?;
        Ok(())
    } else {
        Err("No active process for this agent".to_string())
    }
}
