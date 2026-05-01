use std::collections::HashMap;
use std::sync::Arc;
use tokio::process::ChildStdin;
use tokio::sync::{Mutex, RwLock};
use tokio::task::JoinHandle;

use crate::agent::types::AgentConfig;
use crate::chat::manager::ChatManager;
use crate::inbox::Inbox;

/// One in-flight chat turn per agent. The stdin handle is used for
/// permission responses (writing y/n to the running CLI). The join
/// handle is aborted when a new turn starts; because the spawned child
/// uses `kill_on_drop(true)`, dropping the task drops the `Child` and
/// SIGKILLs the CLI.
///
/// `stdin` is `Option` because `Child::stdin.take()` can return `None`
/// (already taken / not piped). We still want to track the handle for
/// cancellation in that case; permission responses fail cleanly.
pub struct ActiveTurn {
    pub stdin: Option<Arc<Mutex<ChildStdin>>>,
    pub handle: JoinHandle<()>,
}

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
    /// In-flight CLI turns keyed by agent_id. Stores stdin (for permission
    /// responses) + the stream task handle (for cancellation). Folded into
    /// one map so cancel + insert is atomic by construction.
    pub active_turns: Arc<RwLock<HashMap<String, ActiveTurn>>>,
    /// Per-agent serialization mutex. `send_message` holds the agent's lock
    /// for the duration of cancel-prev + spawn-new + insert so two callers
    /// for the same agent can't race. Different agents have independent
    /// mutexes and proceed in parallel. Lazily populated.
    pub agent_send_locks: Arc<RwLock<HashMap<String, Arc<Mutex<()>>>>>,
    /// Budget cap in USD for --max-budget-usd flag
    pub budget_cap: Arc<RwLock<f64>>,
    /// Tracks delegation depth per agent chain to prevent infinite loops (max depth 2)
    pub delegation_depth: Arc<RwLock<HashMap<String, u32>>>,
}

impl AppState {
    /// Get-or-insert the per-agent send mutex. Use this in `send_message`
    /// to serialize same-agent calls without blocking other agents.
    pub async fn agent_send_lock(&self, agent_id: &str) -> Arc<Mutex<()>> {
        {
            let map = self.agent_send_locks.read().await;
            if let Some(lock) = map.get(agent_id) {
                return lock.clone();
            }
        }
        let mut map = self.agent_send_locks.write().await;
        map.entry(agent_id.to_string())
            .or_insert_with(|| Arc::new(Mutex::new(())))
            .clone()
    }
}
