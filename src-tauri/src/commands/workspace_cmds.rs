use crate::state::AppState;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceInfo {
    pub path: String,
    pub name: String,
    pub active: bool,
}

#[tauri::command]
pub async fn list_workspaces(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<WorkspaceInfo>, String> {
    let workspaces = state.workspaces.read().await;
    let active = state.active_workspace.read().await;

    Ok(workspaces
        .iter()
        .map(|path| {
            let name = std::path::Path::new(path)
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| path.clone());
            WorkspaceInfo {
                path: path.clone(),
                name,
                active: *path == *active,
            }
        })
        .collect())
}

#[tauri::command]
pub async fn switch_workspace(
    state: tauri::State<'_, AppState>,
    path: String,
) -> Result<String, String> {
    // Verify directory exists
    if !std::path::Path::new(&path).is_dir() {
        return Err(format!("Directory not found: {}", path));
    }

    let mut active = state.active_workspace.write().await;
    *active = path.clone();

    // Clear agent sessions — new workspace means fresh conversations
    let mut sessions = state.agent_sessions.write().await;
    sessions.clear();

    Ok(path)
}

#[tauri::command]
pub async fn add_workspace(
    state: tauri::State<'_, AppState>,
    path: String,
) -> Result<Vec<WorkspaceInfo>, String> {
    let dir = std::path::Path::new(&path);
    if !dir.is_dir() {
        // If parent exists, create the child directory
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

    // Don't add duplicates
    if !workspaces.contains(&path) {
        workspaces.push(path);
    }

    let active = state.active_workspace.read().await;
    Ok(workspaces
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
        .collect())
}

#[tauri::command]
pub async fn remove_workspace(
    state: tauri::State<'_, AppState>,
    path: String,
) -> Result<Vec<WorkspaceInfo>, String> {
    let mut workspaces = state.workspaces.write().await;
    workspaces.retain(|p| *p != path);

    let active = state.active_workspace.read().await;
    Ok(workspaces
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
        .collect())
}

#[tauri::command]
pub async fn get_active_workspace(
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    let active = state.active_workspace.read().await;
    Ok(active.clone())
}
