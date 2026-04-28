use std::path::PathBuf;
use std::process::Stdio;
use tokio::process::Command;

/// Find the shared system-prompt.md — checks ~/.cthulu-lab/ first, then CWD
fn discover_system_prompt() -> Option<String> {
    // Check ~/.cthulu-lab/system-prompt.md (bundled)
    let bundled = crate::bundled::home_dir().join("system-prompt.md");
    if bundled.is_file() {
        return Some(bundled.to_string_lossy().to_string());
    }

    // Walk up from CWD (dev mode)
    let cwd = std::env::current_dir().ok()?;
    let mut dir = cwd.as_path();
    loop {
        let candidate = dir.join(".claude").join("system-prompt.md");
        if candidate.is_file() {
            return Some(candidate.to_string_lossy().to_string());
        }
        dir = dir.parent()?;
    }
}

/// Spawn the claude CLI with an agent and message.
/// Permission mode controlled by auto_approve flag.
pub async fn spawn_claude(
    agent_id: &str,
    message: &str,
    working_dir: &str,
    session_id: Option<&str>,
    speed_mode: &str,
    auto_approve: bool,
    budget_cap: f64,
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

    cmd.arg("--permission-mode")
        .arg(if auto_approve { "auto" } else { "acceptEdits" });

    if let Some(sid) = session_id {
        cmd.arg("--resume").arg(sid);
    } else {
        cmd.arg("--agent").arg(agent_id);
    }

    // Inject shared system prompt (Layer 1: system rules for ALL agents)
    let system_prompt_path = discover_system_prompt();
    if let Some(sp) = &system_prompt_path {
        cmd.arg("--append-system-prompt-file").arg(sp);
    }

    cmd.arg("--include-partial-messages");

    cmd.arg("--max-budget-usd").arg(format!("{:.1}", budget_cap));

    cmd.arg(message);

    let arg_summary: Vec<String> = cmd
        .as_std()
        .get_args()
        .map(|a| a.to_string_lossy().into_owned())
        .collect();
    tracing::info!(
        agent = %agent_id,
        workspace = %working_dir,
        speed = %speed_mode,
        resume = session_id.is_some(),
        args = ?arg_summary,
        "spawning claude CLI"
    );

    let child = cmd
        .current_dir(working_dir)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .env("HOME", std::env::var("HOME").unwrap_or_default())
        .env("PATH", std::env::var("PATH").unwrap_or_default())
        .env("TERM", std::env::var("TERM").unwrap_or_else(|_| "xterm-256color".to_string()))
        .env("WORKSPACE_ROOT", working_dir)
        .env_remove("ANTHROPIC_API_KEY")
        .spawn()
        .map_err(|e| format!("Failed to spawn claude CLI: {}", e))?;

    tracing::info!(agent = %agent_id, pid = ?child.id(), "claude CLI spawned");

    Ok(child)
}
