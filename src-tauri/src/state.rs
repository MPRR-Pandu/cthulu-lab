use std::collections::HashMap;
use std::sync::Arc;
use tokio::process::ChildStdin;
use tokio::sync::{Mutex, RwLock};
use tokio::task::JoinHandle;

use crate::agent::types::AgentConfig;
use crate::chat::manager::ChatManager;
use crate::inbox::Inbox;

pub struct AppState {
    pub agents: Arc<RwLock<Vec<AgentConfig>>>,
    pub chat_manager: Arc<ChatManager>,
    pub active_agent_id: Arc<RwLock<Option<String>>>,
    pub agents_dir: Arc<String>,
    pub voice_enabled: Arc<RwLock<bool>>,
    /// Tracks CLI session IDs per agent so conversations continue across messages
    pub agent_sessions: Arc<RwLock<HashMap<String, String>>>,
    pub inbox: Arc<Inbox>,
    /// Tracks consecutive failure counts per agent for loop detection
    pub agent_failure_counts: Arc<RwLock<HashMap<String, u32>>>,
    /// Workspace: list of registered directories and the active one
    pub workspaces: Arc<RwLock<Vec<String>>>,
    pub active_workspace: Arc<RwLock<String>>,
    /// Speed mode: "fast" (sonnet) or "thorough" (opus/default)
    pub speed_mode: Arc<RwLock<String>>,
    /// Auto-approve all permissions within workspace
    pub auto_approve: Arc<RwLock<bool>>,
    /// Active CLI process stdin handles for sending permission responses
    pub active_processes: Arc<RwLock<HashMap<String, Arc<Mutex<ChildStdin>>>>>,
    /// Active stream-task join handles per agent. Aborting drops the owned
    /// Child (spawned with `kill_on_drop(true)`) so the OS process is killed.
    pub active_streams: Arc<RwLock<HashMap<String, JoinHandle<()>>>>,
    /// Budget cap in USD for --max-budget-usd flag
    pub budget_cap: Arc<RwLock<f64>>,
    /// Tracks delegation depth per agent chain to prevent infinite loops (max depth 2)
    pub delegation_depth: Arc<RwLock<HashMap<String, u32>>>,
}
