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
        budget_cap: Arc::new(RwLock::new(5.0)),
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
            commands::chat_cmds::set_budget_cap,
            commands::inbox_cmds::get_inbox,
            commands::inbox_cmds::send_inbox_message,
            commands::inbox_cmds::mark_inbox_read,
            commands::workspace_cmds::list_workspaces,
            commands::workspace_cmds::switch_workspace,
            commands::workspace_cmds::add_workspace,
            commands::workspace_cmds::remove_workspace,
            commands::workspace_cmds::get_active_workspace,
            commands::issue_cmds::list_issues,
            commands::issue_cmds::set_integration_token,
            commands::issue_cmds::get_integration_status,
            commands::issue_cmds::fetch_notion_tasks,
            commands::issue_cmds::fetch_linear_issues,
            commands::skill_cmds::list_skills,
            commands::skill_cmds::create_skill,
            commands::skill_cmds::delete_skill,
            commands::auth_cmds::claude_auth_status,
            commands::auth_cmds::read_keychain_token,
            commands::auth_cmds::claude_login,
            commands::gateway_cmds::gateway_health,
            commands::gateway_cmds::gateway_list_vms,
            commands::gateway_cmds::gateway_create_vm,
            commands::gateway_cmds::gateway_delete_vm,
            commands::gateway_cmds::gateway_exec,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Cthulu Lab");
}
