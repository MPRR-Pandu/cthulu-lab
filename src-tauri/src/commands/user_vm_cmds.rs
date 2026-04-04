use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserVm {
    pub email: String,
    #[serde(rename = "vmId")]
    pub vm_id: u32,
    pub tier: String,
    #[serde(rename = "sshPort")]
    pub ssh_port: u32,
    #[serde(rename = "webPort")]
    pub web_port: u32,
    #[serde(rename = "sshCommand", default)]
    pub ssh_command: String,
    #[serde(rename = "webTerminal", default)]
    pub web_terminal: String,
    #[serde(rename = "createdAt", default)]
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct ApiResponse<T> {
    success: bool,
    data: Option<T>,
    error: Option<String>,
}

#[tauri::command]
pub async fn get_user_vm(api_url: String, email: String) -> Result<Option<UserVm>, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client
        .get(format!("{}/user-vm/{}", api_url, email))
        .send()
        .await
        .map_err(|e| format!("Backend unreachable: {}", e))?;

    if !resp.status().is_success() {
        return Ok(None);
    }

    let body: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    if body.get("success").and_then(|v| v.as_bool()).unwrap_or(false) {
        if let Some(data) = body.get("data") {
            let vm: UserVm = serde_json::from_value(data.clone()).map_err(|e| e.to_string())?;
            return Ok(Some(vm));
        }
    }
    Ok(None)
}

#[tauri::command]
pub async fn save_user_vm(
    api_url: String,
    email: String,
    vm_id: u32,
    tier: String,
    ssh_port: u32,
    web_port: u32,
    web_terminal: String,
) -> Result<bool, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| e.to_string())?;

    let payload = serde_json::json!({
        "email": email,
        "vmId": vm_id,
        "tier": tier,
        "sshPort": ssh_port,
        "webPort": web_port,
        "sshCommand": "",
        "webTerminal": web_terminal,
    });

    let resp = client
        .post(format!("{}/user-vm", api_url))
        .header("Content-Type", "application/json")
        .body(payload.to_string())
        .send()
        .await
        .map_err(|e| format!("Backend unreachable: {}", e))?;

    let body: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    Ok(body.get("success").and_then(|v| v.as_bool()).unwrap_or(false))
}

#[tauri::command]
pub async fn delete_user_vm(api_url: String, email: String) -> Result<bool, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client
        .delete(format!("{}/user-vm/{}", api_url, email))
        .send()
        .await
        .map_err(|e| format!("Backend unreachable: {}", e))?;

    let body: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    Ok(body.get("success").and_then(|v| v.as_bool()).unwrap_or(false))
}

#[tauri::command]
pub async fn update_slack_webhook(api_url: String, email: String, slack_webhook: String) -> Result<bool, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client
        .put(format!("{}/user-vm/{}/slack-webhook", api_url, email))
        .header("Content-Type", "application/json")
        .body(serde_json::json!({ "slackWebhook": slack_webhook }).to_string())
        .send()
        .await
        .map_err(|e| format!("Backend unreachable: {}", e))?;

    let body: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    Ok(body.get("success").and_then(|v| v.as_bool()).unwrap_or(false))
}
