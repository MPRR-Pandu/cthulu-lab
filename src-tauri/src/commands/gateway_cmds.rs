use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GatewayHealth {
    pub status: String,
    pub active_vms: u32,
    pub max_vms: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GatewayVM {
    pub vm_id: u32,
    pub tier: String,
    #[serde(default)]
    pub guest_ip: String,
    pub ssh_port: u32,
    pub web_port: u32,
    #[serde(default)]
    pub ssh_command: String,
    #[serde(default)]
    pub web_terminal: String,
    #[serde(default)]
    pub pid: u64,
    #[serde(default)]
    pub socket: String,
    #[serde(default)]
    pub rootfs: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecResult {
    pub vm_id: u32,
    pub exit_code: i32,
    pub stdout: String,
    pub stderr: String,
}

#[tauri::command]
pub async fn gateway_health(gateway_url: String) -> Result<GatewayHealth, String> {
    let resp = reqwest::get(format!("{}/health", gateway_url))
        .await
        .map_err(|e| format!("Gateway offline: {}", e))?;
    resp.json::<GatewayHealth>()
        .await
        .map_err(|e| format!("Parse error: {}", e))
}

#[tauri::command]
pub async fn gateway_list_vms(gateway_url: String) -> Result<Vec<GatewayVM>, String> {
    let resp = reqwest::get(format!("{}/vms", gateway_url))
        .await
        .map_err(|e| format!("Gateway offline: {}", e))?;
    let data: serde_json::Value = resp.json()
        .await
        .map_err(|e| format!("Parse error: {}", e))?;

    let vms_obj = data.get("vms").and_then(|v| v.as_object());
    let mut vms = Vec::new();
    if let Some(obj) = vms_obj {
        for (_key, val) in obj {
            match serde_json::from_value::<GatewayVM>(val.clone()) {
                Ok(vm) => vms.push(vm),
                Err(e) => eprintln!("Failed to parse VM {}: {}", _key, e),
            }
        }
    }
    Ok(vms)
}

#[tauri::command]
pub async fn gateway_create_vm(gateway_url: String, tier: String) -> Result<GatewayVM, String> {
    let client = reqwest::Client::new();
    let resp = client
        .post(format!("{}/vms", gateway_url))
        .header("Content-Type", "application/json")
        .body(serde_json::json!({ "tier": tier }).to_string())
        .send()
        .await
        .map_err(|e| format!("Create failed: {}", e))?;
    resp.json::<GatewayVM>()
        .await
        .map_err(|e| format!("Parse error: {}", e))
}

#[tauri::command]
pub async fn gateway_delete_vm(gateway_url: String, vm_id: u32) -> Result<(), String> {
    let client = reqwest::Client::new();
    let resp = client
        .delete(format!("{}/vms/{}", gateway_url, vm_id))
        .send()
        .await
        .map_err(|e| format!("Delete failed: {}", e))?;
    if resp.status().is_success() {
        Ok(())
    } else {
        Err("Delete failed".to_string())
    }
}

#[tauri::command]
pub async fn gateway_exec(gateway_url: String, vm_id: u32, command: String) -> Result<ExecResult, String> {
    let client = reqwest::Client::new();
    let resp = client
        .post(format!("{}/vms/{}/exec", gateway_url, vm_id))
        .header("Content-Type", "application/json")
        .body(serde_json::json!({ "command": command, "timeout": 30 }).to_string())
        .send()
        .await
        .map_err(|e| format!("Exec failed: {}", e))?;

    if !resp.status().is_success() {
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("Exec error: {}", text));
    }

    resp.json::<ExecResult>()
        .await
        .map_err(|e| format!("Parse error: {}", e))
}
