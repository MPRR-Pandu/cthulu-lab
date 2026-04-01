use chrono::Utc;
use std::sync::Arc;
use tauri::Emitter;
use tokio::io::AsyncWriteExt;
use uuid::Uuid;

use crate::chat::types::{ChatMessage, Role};
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

    // Get speed mode and auto-approve
    let speed = state.speed_mode.read().await.clone();
    let auto_approve = *state.auto_approve.read().await;

    // Check if we have an existing session for this agent
    let existing_session = {
        let sessions = state.agent_sessions.read().await;
        sessions.get(&agent_id).cloned()
    };

    // Spawn claude CLI — resume session if we have one
    let mut child = claude::cli::spawn_claude(
        &agent_id,
        &final_content,
        &working_dir,
        existing_session.as_deref(),
        &speed,
        auto_approve,
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

    tokio::spawn(async move {
        match claude::stream::stream_response(&ah, child, &aid, &msg_id, &cm).await {
            Ok(Some(session_id)) => {
                let mut sessions = agent_sessions.write().await;
                sessions.insert(aid.clone(), session_id);
                let mut counts = failure_counts.write().await;
                counts.remove(&aid);

                // Post completion report to inbox
                let response_preview = {
                    let msgs = cm.get_messages(&aid).await;
                    msgs.last()
                        .map(|m| {
                            let text = m.content.chars().take(80).collect::<String>();
                            if m.content.len() > 80 { format!("{}...", text) } else { text }
                        })
                        .unwrap_or_default()
                };
                if !response_preview.is_empty() {
                    let report = InboxMessage {
                        id: Uuid::new_v4().to_string(),
                        from: aid.clone(),
                        to: "user".to_string(),
                        message_type: InboxMessageType::Report,
                        content: response_preview,
                        timestamp: Utc::now(),
                        read: false,
                    };
                    inbox.add(report).await;
                }
            }
            Ok(None) => {
                let mut counts = failure_counts.write().await;
                counts.remove(&aid);

                // Post completion report to inbox
                let response_preview = {
                    let msgs = cm.get_messages(&aid).await;
                    msgs.last()
                        .map(|m| {
                            let text = m.content.chars().take(80).collect::<String>();
                            if m.content.len() > 80 { format!("{}...", text) } else { text }
                        })
                        .unwrap_or_default()
                };
                if !response_preview.is_empty() {
                    let report = InboxMessage {
                        id: Uuid::new_v4().to_string(),
                        from: aid.clone(),
                        to: "user".to_string(),
                        message_type: InboxMessageType::Report,
                        content: response_preview,
                        timestamp: Utc::now(),
                        read: false,
                    };
                    inbox.add(report).await;
                }
            }
            Err(e) => {
                eprintln!("Stream error: {}", e);
                cm.append_to_streaming(&aid, &msg_id, &format!("\n\n[Error: {}]", e))
                    .await;
                cm.finalize_message(&aid, &msg_id).await;

                // Loop detection: increment failure count
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
                    };
                    inbox.add(alert_msg).await;

                    // Emit event so frontend can react
                    let _ = ah.emit("agent-stuck", serde_json::json!({
                        "agent_id": aid,
                        "failure_count": count,
                        "message": alert_content,
                    }));

                    // Reset count after alerting
                    let mut counts = failure_counts.write().await;
                    counts.remove(&aid);
                }
            }
        }

        // Clean up stdin handle
        let mut procs = active_procs.write().await;
        procs.remove(&aid);
    });

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
