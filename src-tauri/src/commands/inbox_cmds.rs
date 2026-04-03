use chrono::Utc;
use uuid::Uuid;

use crate::inbox::types::{InboxMessage, InboxMessageType};
use crate::state::AppState;

#[tauri::command]
pub async fn get_inbox(state: tauri::State<'_, AppState>) -> Result<Vec<InboxMessage>, String> {
    Ok(state.inbox.get_all().await)
}

#[tauri::command]
pub async fn send_inbox_message(
    state: tauri::State<'_, AppState>,
    from: String,
    to: String,
    message_type: String,
    content: String,
) -> Result<InboxMessage, String> {
    let msg_type = match message_type.as_str() {
        "Delegation" => InboxMessageType::Delegation,
        "Report" => InboxMessageType::Report,
        "Question" => InboxMessageType::Question,
        "Alert" => InboxMessageType::Alert,
        _ => return Err(format!("Unknown message type: {}", message_type)),
    };

    let msg = InboxMessage {
        id: Uuid::new_v4().to_string(),
        from,
        to,
        message_type: msg_type,
        content,
        timestamp: Utc::now(),
        read: false,
        ref_message_id: None,
    };

    state.inbox.add(msg.clone()).await;
    Ok(msg)
}

#[tauri::command]
pub async fn mark_inbox_read(
    state: tauri::State<'_, AppState>,
    message_id: String,
) -> Result<(), String> {
    state.inbox.mark_read(&message_id).await;
    Ok(())
}
