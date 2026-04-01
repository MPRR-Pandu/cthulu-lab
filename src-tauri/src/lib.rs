mod agent;
mod chat;
mod claude;
mod commands;
mod inbox;
mod state;

use chat::manager::ChatManager;
use inbox::Inbox;
use state::AppState;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let cwd = std::env::current_dir().unwrap_or_default();
    let agents_dir = agent::parser::discover_agents_dir(&cwd)
        .unwrap_or_else(|| cwd.join(".claude").join("agents"));

    let agents = agent::parser::load_all_agents(&agents_dir);

    let initial_active = agents.first().map(|a| a.id.clone());

    let app_state = AppState {
        agents: Arc::new(RwLock::new(agents)),
        chat_manager: Arc::new(ChatManager::new()),
        active_agent_id: Arc::new(RwLock::new(initial_active)),
        agents_dir: Arc::new(agents_dir.to_string_lossy().to_string()),
        voice_enabled: Arc::new(RwLock::new(false)),
        agent_sessions: Arc::new(RwLock::new(HashMap::new())),
        inbox: Arc::new(Inbox::new()),
        agent_failure_counts: Arc::new(RwLock::new(HashMap::new())),
        workspaces: Arc::new(RwLock::new(vec![])),
        active_workspace: Arc::new(RwLock::new(String::new())),
        speed_mode: Arc::new(RwLock::new("fast".to_string())),
        auto_approve: Arc::new(RwLock::new(false)),
        active_processes: Arc::new(RwLock::new(HashMap::new())),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            commands::agent_cmds::list_agents,
            commands::agent_cmds::switch_agent,
            commands::agent_cmds::reload_agents,
            commands::chat_cmds::send_message,
            commands::chat_cmds::get_chat_history,
            commands::chat_cmds::toggle_voice,
            commands::chat_cmds::set_speed_mode,
            commands::chat_cmds::set_auto_approve,
            commands::chat_cmds::respond_permission,
            commands::inbox_cmds::get_inbox,
            commands::inbox_cmds::send_inbox_message,
            commands::inbox_cmds::mark_inbox_read,
            commands::workspace_cmds::list_workspaces,
            commands::workspace_cmds::switch_workspace,
            commands::workspace_cmds::add_workspace,
            commands::workspace_cmds::remove_workspace,
            commands::workspace_cmds::get_active_workspace,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Command Center");
}
