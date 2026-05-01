use chrono::Utc;
use std::sync::Arc;
use tauri::Emitter;
use tokio::io::AsyncWriteExt;
use uuid::Uuid;

use crate::chat::types::{ChatMessage, Role, StreamChunk};
use crate::claude;
use crate::inbox::types::{InboxMessage, InboxMessageType};
use crate::state::{ActiveTurn, AppState};

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

    // The agent message stub is added AFTER we successfully spawn the CLI
    // (see below). Adding it earlier means an early-return on a spawn error
    // leaves an orphan `is_streaming: true` stub in `ChatManager` forever.
    let agent_msg_id = Uuid::new_v4().to_string();

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

    // Per-agent serialization. Holding this lock across cancel-prev +
    // spawn-new + insert prevents two callers for the same agent from
    // racing. Other agents have independent mutexes and proceed in
    // parallel.
    let agent_lock = state.agent_send_lock(&agent_id).await;
    let _send_guard = agent_lock.lock().await;

    // Snapshot the resume session id INSIDE the lock — otherwise a stale
    // sid that the previous turn's loop-detection path has just dropped
    // could be re-used here.
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

    // Cancel any previous turn for this agent. We `take` the entry out of
    // the map (releasing the map's write lock immediately) and then await
    // the aborted task so its destructor drops the owned `Child` and
    // `kill_on_drop(true)` finishes SIGKILLing the previous claude before
    // we spawn the next one. Otherwise two CLI processes can briefly race
    // on the same `--resume <sid>`.
    let prev_turn = state.active_turns.write().await.remove(&agent_id);
    if let Some(prev) = prev_turn {
        prev.handle.abort();
        if let Err(e) = prev.handle.await {
            if e.is_panic() {
                tracing::error!(agent = %agent_id, "previous turn panicked: {:?}", e);
            }
            // is_cancelled() is the expected path after abort(); ignore.
        }
    }

    // Spawn claude CLI — resume session if we have one. Note: this runs
    // before we add the agent stub to ChatManager, so an Err here returns
    // without leaving an orphan `is_streaming: true` message behind.
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

    // Now that the CLI is alive, register the agent stub.
    let agent_msg = ChatMessage {
        id: agent_msg_id.clone(),
        role: Role::Agent,
        content: String::new(),
        timestamp: Utc::now(),
        agent_id: agent_id.clone(),
        is_streaming: true,
    };
    chat_manager.add_message(&agent_id, agent_msg).await;

    let stdin_arc = child
        .stdin
        .take()
        .map(|s| Arc::new(tokio::sync::Mutex::new(s)));

    // Stream in background
    let msg_id = agent_msg_id.clone();
    let aid = agent_id.clone();
    let cm = chat_manager.clone();
    let ah = app_handle.clone();
    let agent_sessions = state.agent_sessions.clone();
    let failure_counts = state.agent_failure_counts.clone();
    let inbox = state.inbox.clone();

    let handle = tokio::spawn(async move {
        let result = claude::stream::stream_response(&ah, child, &aid, &msg_id, &cm).await;

        match result {
            Ok(summary) => {
                if let Some(session_id) = summary.session_id {
                    let mut sessions = agent_sessions.write().await;
                    sessions.insert(aid.clone(), session_id);
                }

                if summary.had_text {
                    // Successful turn — clear failure counter, post inbox preview.
                    {
                        let mut counts = failure_counts.write().await;
                        counts.remove(&aid);
                    }
                    let last_agent_content = {
                        let msgs = cm.get_messages(&aid).await;
                        msgs.iter()
                            .rev()
                            .find(|m| m.id == msg_id)
                            .map(|m| m.content.clone())
                            .unwrap_or_default()
                    };
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
                    // CLI exited cleanly but never emitted a text delta.
                    // Surface as an error so the user isn't staring at a
                    // blank bubble, and count it toward loop detection.
                    //
                    // `stream::stream_response` already emitted `done: true`
                    // before returning, so the frontend has finalized the
                    // bubble. We append the error to ChatManager AND emit a
                    // matching pair of `chat-stream` events (a chunk with
                    // the error text + a fresh `done: true`) so the
                    // frontend's chunk handler appends and re-finalizes
                    // even though the bubble is no longer streaming. The
                    // double-done is benign — finalize is idempotent.
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
                    let _ = ah.emit("chat-stream", StreamChunk {
                        agent_id: aid.clone(),
                        message_id: msg_id.clone(),
                        chunk: String::new(),
                        done: true,
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

        // Intentionally don't remove our own active_turns entry here:
        // racing with a fast-follow send_message can delete the *next*
        // turn's entry. Next send_message overwrites under the per-agent
        // lock; known-leak: stale finished entries linger until then,
        // bounded by agent count.
    });

    // Insert the new turn under the active_turns write lock. Per-agent send
    // mutex above guarantees no concurrent insert for this agent.
    if stdin_arc.is_none() {
        tracing::warn!(agent = %agent_id, "child stdin missing — permission responses will fail");
    }
    state.active_turns.write().await.insert(
        agent_id.clone(),
        ActiveTurn { stdin: stdin_arc, handle },
    );

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
    // Clone the stdin Arc out from under the read lock so we don't hold
    // the active_turns lock across an await on stdin write.
    let stdin_arc = {
        let turns = state.active_turns.read().await;
        turns.get(&agent_id).and_then(|t| t.stdin.clone())
    };
    if let Some(stdin_handle) = stdin_arc {
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
