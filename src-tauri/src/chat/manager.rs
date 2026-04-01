use std::collections::HashMap;
use tokio::sync::RwLock;

use super::types::ChatMessage;

pub struct ChatManager {
    sessions: RwLock<HashMap<String, Vec<ChatMessage>>>,
}

impl ChatManager {
    pub fn new() -> Self {
        Self {
            sessions: RwLock::new(HashMap::new()),
        }
    }

    pub async fn add_message(&self, agent_id: &str, message: ChatMessage) {
        let mut sessions = self.sessions.write().await;
        sessions
            .entry(agent_id.to_string())
            .or_default()
            .push(message);
    }

    pub async fn get_messages(&self, agent_id: &str) -> Vec<ChatMessage> {
        let sessions = self.sessions.read().await;
        sessions.get(agent_id).cloned().unwrap_or_default()
    }

    pub async fn append_to_streaming(&self, agent_id: &str, message_id: &str, chunk: &str) {
        let mut sessions = self.sessions.write().await;
        if let Some(messages) = sessions.get_mut(agent_id) {
            if let Some(msg) = messages.iter_mut().rev().find(|m| m.id == message_id) {
                msg.content.push_str(chunk);
            }
        }
    }

    pub async fn finalize_message(&self, agent_id: &str, message_id: &str) {
        let mut sessions = self.sessions.write().await;
        if let Some(messages) = sessions.get_mut(agent_id) {
            if let Some(msg) = messages.iter_mut().rev().find(|m| m.id == message_id) {
                msg.is_streaming = false;
            }
        }
    }
}
