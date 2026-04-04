use crate::state::AppState;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceInfo {
    pub path: String,
    pub name: String,
    pub active: bool,
}

#[derive(Debug, Serialize, Deserialize)]
struct PersistedWorkspaces {
    paths: Vec<String>,
    active: String,
}

/// Get the persistence file path (~/.cthulu-lab/workspaces.json)
fn persist_path() -> std::path::PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
    let dir = std::path::PathBuf::from(home).join(".cthulu-lab");
    let _ = std::fs::create_dir_all(&dir);
    dir.join("workspaces.json")
}

/// Save current workspaces + active to disk
fn save_to_disk(paths: &[String], active: &str) {
    let data = PersistedWorkspaces {
        paths: paths.to_vec(),
        active: active.to_string(),
    };
    if let Ok(json) = serde_json::to_string_pretty(&data) {
        let _ = std::fs::write(persist_path(), json);
    }
}

/// Load persisted workspaces from disk (called on startup)
pub fn load_from_disk() -> (Vec<String>, String) {
    let path = persist_path();
    if let Ok(contents) = std::fs::read_to_string(&path) {
        if let Ok(data) = serde_json::from_str::<PersistedWorkspaces>(&contents) {
            // Filter out paths that no longer exist
            let valid: Vec<String> = data
                .paths
                .into_iter()
                .filter(|p| std::path::Path::new(p).is_dir())
                .collect();
            let active = if valid.contains(&data.active) {
                data.active
            } else {
                valid.first().cloned().unwrap_or_default()
            };
            return (valid, active);
        }
    }
    (vec![], String::new())
}

fn build_info(paths: &[String], active: &str) -> Vec<WorkspaceInfo> {
    paths
        .iter()
        .map(|p| {
            let name = std::path::Path::new(p)
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| p.clone());
            WorkspaceInfo {
                path: p.clone(),
                name,
                active: *p == *active,
            }
        })
        .collect()
}

#[tauri::command]
pub async fn list_workspaces(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<WorkspaceInfo>, String> {
    let workspaces = state.workspaces.read().await;
    let active = state.active_workspace.read().await;
    Ok(build_info(&workspaces, &active))
}

#[tauri::command]
pub async fn switch_workspace(
    state: tauri::State<'_, AppState>,
    path: String,
) -> Result<String, String> {
    if !std::path::Path::new(&path).is_dir() {
        return Err(format!("Directory not found: {}", path));
    }

    let mut active = state.active_workspace.write().await;
    *active = path.clone();

    // Clear agent sessions — new workspace means fresh conversations
    let mut sessions = state.agent_sessions.write().await;
    sessions.clear();

    // Persist
    let workspaces = state.workspaces.read().await;
    save_to_disk(&workspaces, &path);

    Ok(path)
}

#[tauri::command]
pub async fn add_workspace(
    state: tauri::State<'_, AppState>,
    path: String,
) -> Result<Vec<WorkspaceInfo>, String> {
    let dir = std::path::Path::new(&path);
    if !dir.is_dir() {
        if let Some(parent) = dir.parent() {
            if parent.is_dir() {
                std::fs::create_dir(&path)
                    .map_err(|e| format!("Failed to create directory: {}", e))?;
            } else {
                return Err(format!("Parent directory not found: {}", parent.display()));
            }
        } else {
            return Err(format!("Invalid path: {}", path));
        }
    }

    let mut workspaces = state.workspaces.write().await;
    if !workspaces.contains(&path) {
        workspaces.push(path.clone());
    }

    // Set as active
    let mut active = state.active_workspace.write().await;
    *active = path.clone();

    // Persist
    save_to_disk(&workspaces, &path);

    Ok(build_info(&workspaces, &path))
}

#[tauri::command]
pub async fn remove_workspace(
    state: tauri::State<'_, AppState>,
    path: String,
) -> Result<Vec<WorkspaceInfo>, String> {
    let mut workspaces = state.workspaces.write().await;
    workspaces.retain(|p| *p != path);

    let mut active = state.active_workspace.write().await;
    if *active == path {
        *active = workspaces.first().cloned().unwrap_or_default();
    }

    save_to_disk(&workspaces, &active);

    Ok(build_info(&workspaces, &active))
}

#[tauri::command]
pub async fn get_active_workspace(
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    let active = state.active_workspace.read().await;
    Ok(active.clone())
}
