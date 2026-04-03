use serde::{Deserialize, Serialize};
use std::sync::OnceLock;
use tokio::process::Command;

static CLAUDE_PATH: OnceLock<String> = OnceLock::new();

/// Find the absolute path to the claude binary once, cache it.
fn get_claude_path() -> &'static str {
    CLAUDE_PATH.get_or_init(|| {
        // Try `which claude` to find the binary
        let output = std::process::Command::new("/bin/sh")
            .args(["-c", "which claude"])
            .output();

        if let Ok(out) = output {
            let path = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if !path.is_empty() && std::path::Path::new(&path).exists() {
                return path;
            }
        }

        // Common locations as fallback
        let candidates = [
            "/opt/homebrew/bin/claude",
            "/usr/local/bin/claude",
            "/usr/bin/claude",
        ];
        for c in candidates {
            if std::path::Path::new(c).exists() {
                return c.to_string();
            }
        }

        "claude".to_string()
    })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeAuthStatus {
    #[serde(rename = "loggedIn")]
    pub logged_in: bool,
    #[serde(rename = "authMethod", default)]
    pub auth_method: String,
    #[serde(default)]
    pub email: String,
    #[serde(rename = "orgName", default)]
    pub org_name: String,
    #[serde(rename = "subscriptionType", default)]
    pub subscription_type: String,
}

#[tauri::command]
pub async fn claude_auth_status() -> Result<ClaudeAuthStatus, String> {
    let claude = get_claude_path();

    let output = Command::new(claude)
        .args(["auth", "status"])
        .env("HOME", std::env::var("HOME").unwrap_or_default())
        .env("PATH", std::env::var("PATH").unwrap_or_else(|_|
            "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/opt/homebrew/sbin".to_string()
        ))
        .output()
        .await
        .map_err(|e| format!("Claude CLI not found at {}: {}", claude, e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Auth check failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    serde_json::from_str(&stdout)
        .map_err(|e| format!("Parse error: {}. Output: {}", e, stdout))
}

/// Read the Claude OAuth access token from macOS Keychain.
#[tauri::command]
pub async fn read_keychain_token() -> Result<String, String> {
    let output = Command::new("/usr/bin/security")
        .args(["find-generic-password", "-s", "Claude Code-credentials", "-w"])
        .output()
        .await
        .map_err(|e| format!("Keychain access failed: {}", e))?;

    if !output.status.success() {
        return Err("No Claude credentials in Keychain. Run 'claude auth login' first.".to_string());
    }

    let creds_json = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let creds: serde_json::Value = serde_json::from_str(&creds_json)
        .map_err(|e| format!("Failed to parse credentials: {}", e))?;

    creds
        .pointer("/claudeAiOauth/accessToken")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| "No accessToken found in Keychain credentials".to_string())
}

#[tauri::command]
pub async fn claude_login() -> Result<(), String> {
    let claude = get_claude_path();

    let status = Command::new(claude)
        .args(["auth", "login"])
        .env("HOME", std::env::var("HOME").unwrap_or_default())
        .env("PATH", std::env::var("PATH").unwrap_or_else(|_|
            "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/opt/homebrew/sbin".to_string()
        ))
        .status()
        .await
        .map_err(|e| format!("Failed to run claude auth login: {}", e))?;

    if status.success() {
        Ok(())
    } else {
        Err("Login failed or was cancelled".to_string())
    }
}
