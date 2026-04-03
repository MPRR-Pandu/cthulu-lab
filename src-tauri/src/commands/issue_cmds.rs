use crate::state::AppState;
use serde::{Deserialize, Serialize};
use std::sync::OnceLock;

static NOTION_TOKEN: OnceLock<tokio::sync::RwLock<Option<String>>> = OnceLock::new();
static LINEAR_TOKEN: OnceLock<tokio::sync::RwLock<Option<String>>> = OnceLock::new();

fn notion_token_lock() -> &'static tokio::sync::RwLock<Option<String>> {
    NOTION_TOKEN.get_or_init(|| tokio::sync::RwLock::new(None))
}

fn linear_token_lock() -> &'static tokio::sync::RwLock<Option<String>> {
    LINEAR_TOKEN.get_or_init(|| tokio::sync::RwLock::new(None))
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Issue {
    pub number: u32,
    pub title: String,
    pub source: String,
    pub url: String,
    pub labels: Vec<String>,
}

#[tauri::command]
pub async fn list_issues(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<Issue>, String> {
    let working_dir = state.active_workspace.read().await.clone();
    if working_dir.is_empty() {
        return Ok(vec![]);
    }

    let output = tokio::process::Command::new("gh")
        .args(["issue", "list", "--state", "open", "--limit", "20", "--json", "number,title,url,labels"])
        .current_dir(&working_dir)
        .output()
        .await
        .map_err(|e| format!("Failed to run gh: {}", e))?;

    if !output.status.success() {
        return Ok(vec![]);
    }

    let json_str = String::from_utf8_lossy(&output.stdout);

    #[derive(Deserialize)]
    struct GhIssue {
        number: u32,
        title: String,
        url: String,
        labels: Vec<GhLabel>,
    }

    #[derive(Deserialize)]
    struct GhLabel {
        name: String,
    }

    let gh_issues: Vec<GhIssue> = serde_json::from_str(&json_str).unwrap_or_default();

    let issues = gh_issues
        .into_iter()
        .map(|i| Issue {
            number: i.number,
            title: i.title,
            source: "github".to_string(),
            url: i.url,
            labels: i.labels.into_iter().map(|l| l.name).collect(),
        })
        .collect();

    Ok(issues)
}

#[tauri::command]
pub async fn set_integration_token(service: String, token: String) -> Result<(), String> {
    match service.as_str() {
        "notion" => {
            let mut t = notion_token_lock().write().await;
            *t = Some(token);
        }
        "linear" => {
            let mut t = linear_token_lock().write().await;
            *t = Some(token);
        }
        _ => return Err(format!("Unknown service: {}", service)),
    }
    Ok(())
}

#[tauri::command]
pub async fn get_integration_status() -> Result<serde_json::Value, String> {
    let notion = notion_token_lock().read().await.is_some();
    let linear = linear_token_lock().read().await.is_some();

    let gh = tokio::process::Command::new("gh")
        .args(["auth", "status"])
        .output()
        .await
        .map(|o| o.status.success())
        .unwrap_or(false);

    Ok(serde_json::json!({
        "github": gh,
        "notion": notion,
        "linear": linear,
    }))
}

#[tauri::command]
pub async fn fetch_notion_tasks(database_id: String) -> Result<Vec<Issue>, String> {
    let token = {
        let t = notion_token_lock().read().await;
        t.clone().ok_or("Notion not connected. Paste your integration token.")?
    };

    let client = reqwest::Client::new();
    let resp = client
        .post(format!("https://api.notion.com/v1/databases/{}/query", database_id))
        .header("Authorization", format!("Bearer {}", token))
        .header("Notion-Version", "2022-06-28")
        .header("Content-Type", "application/json")
        .body(r#"{"filter":{"property":"Status","status":{"does_not_equal":"Done"}},"page_size":20}"#)
        .send()
        .await
        .map_err(|e| format!("Notion request failed: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Notion API error {}: {}", status, body));
    }

    let data: serde_json::Value = resp.json().await.map_err(|e| format!("Parse error: {}", e))?;

    let mut issues = Vec::new();
    if let Some(results) = data.get("results").and_then(|r| r.as_array()) {
        for (i, page) in results.iter().enumerate() {
            let title = page.pointer("/properties/Name/title/0/plain_text")
                .or_else(|| page.pointer("/properties/Title/title/0/plain_text"))
                .or_else(|| page.pointer("/properties/Task/title/0/plain_text"))
                .and_then(|t| t.as_str())
                .unwrap_or("Untitled")
                .to_string();

            let url = page.get("url")
                .and_then(|u| u.as_str())
                .unwrap_or("")
                .to_string();

            issues.push(Issue {
                number: (i + 1) as u32,
                title,
                source: "notion".to_string(),
                url,
                labels: vec![],
            });
        }
    }

    Ok(issues)
}

#[tauri::command]
pub async fn fetch_linear_issues(team_key: String) -> Result<Vec<Issue>, String> {
    let token = {
        let t = linear_token_lock().read().await;
        t.clone().ok_or("Linear not connected. Paste your API key.")?
    };

    let query = format!(r#"{{
        "query": "query {{ issues(filter: {{ team: {{ key: {{ eq: \"{}\" }} }}, state: {{ type: {{ nin: [\"completed\", \"canceled\"] }} }} }}, first: 20) {{ nodes {{ number title url labels {{ nodes {{ name }} }} }} }} }}"
    }}"#, team_key);

    let client = reqwest::Client::new();
    let resp = client
        .post("https://api.linear.app/graphql")
        .header("Authorization", token)
        .header("Content-Type", "application/json")
        .body(query)
        .send()
        .await
        .map_err(|e| format!("Linear request failed: {}", e))?;

    if !resp.status().is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Linear API error: {}", body));
    }

    let data: serde_json::Value = resp.json().await.map_err(|e| format!("Parse error: {}", e))?;

    let mut issues = Vec::new();
    if let Some(nodes) = data.pointer("/data/issues/nodes").and_then(|n| n.as_array()) {
        for node in nodes {
            let number = node.get("number").and_then(|n| n.as_u64()).unwrap_or(0) as u32;
            let title = node.get("title").and_then(|t| t.as_str()).unwrap_or("").to_string();
            let url = node.get("url").and_then(|u| u.as_str()).unwrap_or("").to_string();
            let labels = node.pointer("/labels/nodes")
                .and_then(|l| l.as_array())
                .map(|arr| arr.iter().filter_map(|l| l.get("name").and_then(|n| n.as_str()).map(String::from)).collect())
                .unwrap_or_default();

            issues.push(Issue { number, title, source: "linear".to_string(), url, labels });
        }
    }

    Ok(issues)
}
