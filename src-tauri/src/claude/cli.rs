use std::process::Stdio;
use tokio::process::Command;

/// Spawn the claude CLI with an agent and message.
/// Permission mode controlled by auto_approve flag.
pub async fn spawn_claude(
    agent_id: &str,
    message: &str,
    working_dir: &str,
    session_id: Option<&str>,
    speed_mode: &str,
    auto_approve: bool,
) -> Result<tokio::process::Child, String> {
    if working_dir.is_empty() {
        return Err("No workspace set. Add a workspace first.".to_string());
    }

    if !std::path::Path::new(working_dir).is_dir() {
        return Err(format!("Workspace directory not found: {}", working_dir));
    }

    let mut cmd = Command::new("claude");

    cmd.arg("--verbose")
        .arg("--print")
        .arg("--output-format")
        .arg("stream-json");

    if speed_mode == "fast" {
        cmd.arg("--model").arg("sonnet");
    }

    // Permission mode:
    // auto = approve everything (fastest, no blocking)
    // acceptEdits = auto-approve file ops, ask for bash
    cmd.arg("--permission-mode")
        .arg(if auto_approve { "auto" } else { "acceptEdits" });

    if let Some(sid) = session_id {
        cmd.arg("--resume").arg(sid);
    } else {
        cmd.arg("--agent").arg(agent_id);
    }

    cmd.arg(message);

    let child = cmd
        .current_dir(working_dir)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .env("HOME", std::env::var("HOME").unwrap_or_default())
        .env("PATH", std::env::var("PATH").unwrap_or_default())
        .env("TERM", std::env::var("TERM").unwrap_or_else(|_| "xterm-256color".to_string()))
        .env("WORKSPACE_ROOT", working_dir)
        .spawn()
        .map_err(|e| format!("Failed to spawn claude CLI: {}", e))?;

    Ok(child)
}
