use std::process::Stdio;
use tokio::process::Command;

/// macOS .app bundles launched from Finder inherit a minimal PATH from launchd
/// (no `~/.local/bin`, no Homebrew, no nvm). The claude CLI is most often
/// installed in one of these dirs, so we both extend PATH and resolve the
/// binary by absolute path before spawning.
fn locate_claude_binary() -> String {
    let home = std::env::var("HOME").unwrap_or_default();
    let candidates = [
        format!("{}/.local/bin/claude", home),
        format!("{}/.claude/local/claude", home),
        format!("{}/.npm-global/bin/claude", home),
        "/opt/homebrew/bin/claude".to_string(),
        "/usr/local/bin/claude".to_string(),
        "/usr/bin/claude".to_string(),
    ];
    for c in &candidates {
        if std::path::Path::new(c).is_file() {
            return c.clone();
        }
    }
    // Fall back to bare name and let PATH resolution take over.
    "claude".to_string()
}

fn augmented_path() -> String {
    let home = std::env::var("HOME").unwrap_or_default();
    let extras = [
        format!("{}/.local/bin", home),
        format!("{}/.claude/local", home),
        format!("{}/.npm-global/bin", home),
        "/opt/homebrew/bin".to_string(),
        "/usr/local/bin".to_string(),
    ];
    let current = std::env::var("PATH").unwrap_or_default();
    let mut parts: Vec<String> = extras.into_iter().collect();
    if !current.is_empty() {
        parts.push(current);
    }
    parts.join(":")
}

/// Spawn the claude CLI for a chat turn.
/// No agent personas, no system prompt injection — plain claude.
/// User-defined skills and memory are loaded by the CLI itself from
/// ~/.claude/ and the workspace .claude/ dir.
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

    let workspace_path = std::path::Path::new(working_dir);
    if !workspace_path.is_dir() {
        return Err(format!("Workspace directory not found: {}", working_dir));
    }

    // Drop a `.claude/` marker so claude CLI treats the workspace as the
    // project root instead of walking up to a parent dir or $HOME.
    let marker = workspace_path.join(".claude");
    if !marker.exists() {
        let _ = std::fs::create_dir_all(&marker);
    }

    let claude_bin = locate_claude_binary();
    tracing::info!(agent = %agent_id, bin = %claude_bin, "resolved claude CLI path");
    let mut cmd = Command::new(&claude_bin);

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
    }

    cmd.arg("--include-partial-messages");

    // Pin claude CLI scope to the workspace dir.
    cmd.arg("--add-dir").arg(working_dir);

    cmd.arg("--max-turns").arg("10");

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
        .env("PATH", augmented_path())
        .env("TERM", std::env::var("TERM").unwrap_or_else(|_| "xterm-256color".to_string()))
        .env("WORKSPACE_ROOT", working_dir)
        // Tell claude CLI which dir is the project root so it doesn't walk up.
        .env("CLAUDE_PROJECT_DIR", working_dir)
        .env_remove("ANTHROPIC_API_KEY")
        // If the parent task is aborted (e.g. user sent a new message before
        // this turn finished), drop the Child to actually SIGKILL the CLI so
        // we don't accumulate orphan claude processes resuming the same
        // session — that gums up the next turn.
        //
        // NOTE: this is SIGKILL, not SIGTERM — claude has no chance to flush
        // cost telemetry or remove tmp files. That's acceptable for a user-
        // initiated cancel; if we ever need a graceful path, send SIGTERM
        // first and only escalate to drop after a short timeout.
        .kill_on_drop(true)
        .spawn()
        .map_err(|e| format!("Failed to spawn claude CLI: {}", e))?;

    tracing::info!(agent = %agent_id, pid = ?child.id(), "claude CLI spawned");

    Ok(child)
}
