use crate::agent::parser;
use crate::agent::types::AgentConfig;
use crate::state::AppState;
use std::path::Path;

#[tauri::command]
pub async fn list_agents(state: tauri::State<'_, AppState>) -> Result<Vec<AgentConfig>, String> {
    let agents = state.agents.read().await;
    Ok(agents.clone())
}

#[tauri::command]
pub async fn switch_agent(
    state: tauri::State<'_, AppState>,
    agent_id: String,
) -> Result<AgentConfig, String> {
    // Update active agent
    {
        let mut active = state.active_agent_id.write().await;
        *active = Some(agent_id.clone());
    }

    // Find and return the agent config
    let agents = state.agents.read().await;
    agents
        .iter()
        .find(|a| a.id == agent_id)
        .cloned()
        .ok_or_else(|| format!("Agent '{}' not found", agent_id))
}

#[tauri::command]
pub async fn reload_agents(state: tauri::State<'_, AppState>) -> Result<Vec<AgentConfig>, String> {
    let agents_dir = state.agents_dir.as_str();
    let new_agents = parser::load_all_agents(Path::new(agents_dir));

    let mut agents = state.agents.write().await;
    *agents = new_agents.clone();

    Ok(new_agents)
}
