use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum InboxMessageType {
    Delegation,
    Report,
    Question,
    Alert,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InboxMessage {
    pub id: String,
    pub from: String,
    pub to: String,
    pub message_type: InboxMessageType,
    pub content: String,
    pub timestamp: DateTime<Utc>,
    pub read: bool,
}
