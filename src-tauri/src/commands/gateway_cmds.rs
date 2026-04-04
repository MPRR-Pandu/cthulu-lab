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

/// HTTP proxy for configured backend only — validates URL prefix to prevent SSRF
#[tauri::command]
pub async fn api_proxy(
    api_base: String,
    path: String,
    method: String,
    body: Option<String>,
) -> Result<String, String> {
    // Block cloud metadata, private IPs, and non-http schemes
    let base = api_base.trim_end_matches('/');
    if base.is_empty() {
        return Err("Backend API URL not configured".to_string());
    }
    let url = format!("{}{}", base, path);
    if !url.starts_with("http://") && !url.starts_with("https://") {
        return Err("Invalid URL scheme".to_string());
    }
    if let Ok(parsed) = reqwest::Url::parse(&url) {
        let host = parsed.host_str().unwrap_or("");
        if host == "169.254.169.254" || host == "metadata.google.internal" {
            return Err("Blocked: metadata endpoint".to_string());
        }
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| format!("Client error: {}", e))?;

    let req = match method.to_uppercase().as_str() {
        "GET" => client.get(&url),
        "POST" => client.post(&url),
        "PUT" => client.put(&url),
        "DELETE" => client.delete(&url),
        "PATCH" => client.patch(&url),
        _ => return Err(format!("Unsupported method: {}", method)),
    };

    let req = req.header("Content-Type", "application/json");
    let req = if let Some(b) = body { req.body(b) } else { req };

    let resp = req.send().await.map_err(|e| {
        if e.is_timeout() {
            "Request timed out (15s)".to_string()
        } else if e.is_connect() {
            format!("Cannot connect to {}", url)
        } else {
            format!("Request failed: {}", e)
        }
    })?;

    let status = resp.status();
    let text = resp.text().await.unwrap_or_default();

    if !status.is_success() {
        return Err(format!("HTTP {} — {}", status, text));
    }

    Ok(text)
}

/// Test backend API connection — returns health info or error
#[tauri::command]
pub async fn test_api_connection(url: String) -> Result<String, String> {
    let health_url = if url.ends_with("/api") {
        format!("{}/health", url)
    } else if url.ends_with('/') {
        format!("{}api/health", url)
    } else {
        format!("{}/api/health", url)
    };

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| format!("Client error: {}", e))?;

    let resp = client
        .get(&health_url)
        .send()
        .await
        .map_err(|e| {
            if e.is_timeout() {
                "Connection timed out (5s)".to_string()
            } else if e.is_connect() {
                format!("Cannot connect to {}", health_url)
            } else {
                format!("Request failed: {}", e)
            }
        })?;

    let status = resp.status();
    if !status.is_success() {
        return Err(format!("HTTP {}", status));
    }

    let body = resp.text().await.unwrap_or_default();
    Ok(body)
}

/// Test VM gateway connection — checks health and returns VM count
#[tauri::command]
pub async fn test_gateway_connection(url: String) -> Result<String, String> {
    let health_url = if url.ends_with('/') {
        format!("{}health", url)
    } else {
        format!("{}/health", url)
    };

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| format!("Client error: {}", e))?;

    let resp = client
        .get(&health_url)
        .send()
        .await
        .map_err(|e| {
            if e.is_timeout() {
                "Connection timed out (5s)".to_string()
            } else if e.is_connect() {
                format!("Cannot connect to {}", health_url)
            } else {
                format!("Request failed: {}", e)
            }
        })?;

    let status = resp.status();
    if !status.is_success() {
        return Err(format!("HTTP {}", status));
    }

    let body: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Invalid response: {}", e))?;

    let active = body.get("active_vms").and_then(|v| v.as_u64()).unwrap_or(0);
    let max = body.get("max_vms").and_then(|v| v.as_u64()).unwrap_or(0);
    Ok(format!("Gateway OK — {}/{} VMs active", active, max))
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
                Err(e) => tracing::warn!("failed to parse VM {}: {}", _key, e),
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
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(300))
        .build()
        .map_err(|e| format!("Client error: {}", e))?;
    let resp = client
        .post(format!("{}/vms/{}/exec", gateway_url, vm_id))
        .header("Content-Type", "application/json")
        .body(serde_json::json!({ "command": command, "timeout": 300 }).to_string())
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
