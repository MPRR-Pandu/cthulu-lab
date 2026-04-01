pub mod types;

use std::collections::VecDeque;
use tokio::sync::RwLock;
use types::InboxMessage;

pub struct Inbox {
    messages: RwLock<VecDeque<InboxMessage>>,
}

impl Inbox {
    pub fn new() -> Self {
        Self {
            messages: RwLock::new(VecDeque::new()),
        }
    }

    pub async fn add(&self, msg: InboxMessage) {
        let mut messages = self.messages.write().await;
        messages.push_back(msg);
        // Keep only the last 100 messages
        while messages.len() > 100 {
            messages.pop_front();
        }
    }

    pub async fn get_all(&self) -> Vec<InboxMessage> {
        let messages = self.messages.read().await;
        messages.iter().cloned().collect()
    }

    pub async fn get_unread(&self) -> Vec<InboxMessage> {
        let messages = self.messages.read().await;
        messages.iter().filter(|m| !m.read).cloned().collect()
    }

    pub async fn mark_read(&self, id: &str) {
        let mut messages = self.messages.write().await;
        if let Some(msg) = messages.iter_mut().find(|m| m.id == id) {
            msg.read = true;
        }
    }
}
