mod agent;
mod bundled;
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
    // Pretty structured logs with timestamps
    tracing_subscriber::fmt()
        .with_target(false)
        .with_thread_ids(false)
        .with_level(true)
        .with_timer(tracing_subscriber::fmt::time::time())
        .init();
    tracing::info!("starting Cthulu Lab v0.1.0");

    // Extract bundled agents, skills, commands, system-prompt to ~/.cthulu-lab/
    bundled::extract_bundled_assets();

    let cwd = std::env::current_dir().unwrap_or_default();
    let agents_dir = agent::parser::discover_agents_dir(&cwd)
        .unwrap_or_else(|| cwd.join(".claude").join("agents"));

    let agents = agent::parser::load_all_agents(&agents_dir);
    tracing::info!(count = agents.len(), "loaded agents");

    let initial_active = agents.first().map(|a| a.id.clone());

    let (ws_paths, ws_active) = commands::workspace_cmds::load_from_disk();
    if !ws_paths.is_empty() {
        tracing::info!(count = ws_paths.len(), active = %ws_active, "restored workspaces");
    }

    let app_state = AppState {
        agents: Arc::new(RwLock::new(agents)),
        chat_manager: Arc::new(ChatManager::new()),
        active_agent_id: Arc::new(RwLock::new(initial_active)),
        agents_dir: Arc::new(agents_dir.to_string_lossy().to_string()),
        voice_enabled: Arc::new(RwLock::new(false)),
        agent_sessions: Arc::new(RwLock::new(HashMap::new())),
        inbox: Arc::new(Inbox::new()),
        agent_failure_counts: Arc::new(RwLock::new(HashMap::new())),
        workspaces: Arc::new(RwLock::new(ws_paths)),
        active_workspace: Arc::new(RwLock::new(ws_active)),
        speed_mode: Arc::new(RwLock::new("fast".to_string())),
        auto_approve: Arc::new(RwLock::new(false)),
        active_processes: Arc::new(RwLock::new(HashMap::new())),
        budget_cap: Arc::new(RwLock::new(5.0)),
        delegation_depth: Arc::new(RwLock::new(HashMap::new())),
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
            commands::chat_cmds::delegate_to_agent,
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
            commands::gateway_cmds::api_proxy,
            commands::gateway_cmds::test_api_connection,
            commands::gateway_cmds::test_gateway_connection,
            commands::gateway_cmds::gateway_health,
            commands::gateway_cmds::gateway_list_vms,
            commands::gateway_cmds::gateway_create_vm,
            commands::gateway_cmds::gateway_delete_vm,
            commands::gateway_cmds::gateway_exec,
            commands::user_vm_cmds::get_user_vm,
            commands::user_vm_cmds::save_user_vm,
            commands::user_vm_cmds::delete_user_vm,
            commands::user_vm_cmds::update_slack_webhook,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Cthulu Lab");
}
