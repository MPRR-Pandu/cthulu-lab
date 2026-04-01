use std::path::Path;

/// Validate that a given path is inside the workspace directory.
/// Prevents agents from reading/writing files outside the sandbox.
pub fn is_within_workspace(workspace: &str, target_path: &str) -> bool {
    if workspace.is_empty() {
        return false;
    }

    let workspace_canonical = match Path::new(workspace).canonicalize() {
        Ok(p) => p,
        Err(_) => return false,
    };

    let target_canonical = match Path::new(target_path).canonicalize() {
        Ok(p) => p,
        Err(_) => {
            // File might not exist yet (creating new file) — check parent
            match Path::new(target_path).parent().and_then(|p| p.canonicalize().ok()) {
                Some(p) => p,
                None => return false,
            }
        }
    };

    target_canonical.starts_with(&workspace_canonical)
}

/// Validate a path and return an error message if it's outside the workspace.
pub fn validate_workspace_path(workspace: &str, target_path: &str) -> Result<(), String> {
    if !is_within_workspace(workspace, target_path) {
        return Err(format!(
            "Access denied: {} is outside workspace {}",
            target_path, workspace
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_within_workspace() {
        let workspace = env!("CARGO_MANIFEST_DIR");
        let inside = format!("{}/src/main.rs", workspace);
        assert!(is_within_workspace(workspace, &inside));
    }

    #[test]
    fn test_outside_workspace() {
        let workspace = env!("CARGO_MANIFEST_DIR");
        assert!(!is_within_workspace(workspace, "/etc/passwd"));
    }

    #[test]
    fn test_empty_workspace() {
        assert!(!is_within_workspace("", "/any/path"));
    }
}
