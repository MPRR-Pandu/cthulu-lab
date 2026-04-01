use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentConfig {
    pub id: String,
    pub name: String,
    pub display_name: String,
    pub description: String,
    pub color: String,
    pub disallowed_tools: Vec<String>,
    pub personality: String,
    pub voice_style: String,
    pub species: String,
    pub catchphrase: String,
}
