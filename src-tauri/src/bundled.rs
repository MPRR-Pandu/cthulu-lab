use std::fs;
use std::path::PathBuf;

/// All .claude/ files embedded in the binary at compile time.
/// Agent files are minimal UI stubs (frontmatter for color/name/sprite) —
/// the claude CLI itself runs plain (no persona injection). Users add
/// behavior via skills, commands, and per-workspace CLAUDE.md.
const BUNDLED_FILES: &[(&str, &str)] = &[
    ("agents/analyst.md", include_str!("../../.claude/agents/analyst.md")),
    ("agents/builder.md", include_str!("../../.claude/agents/builder.md")),
    ("agents/fixer.md", include_str!("../../.claude/agents/fixer.md")),
    ("agents/lead.md", include_str!("../../.claude/agents/lead.md")),
    ("agents/reviewer.md", include_str!("../../.claude/agents/reviewer.md")),
    ("commands/brainstorm.md", include_str!("../../.claude/commands/brainstorm.md")),
    ("commands/build.md", include_str!("../../.claude/commands/build.md")),
    ("commands/fix.md", include_str!("../../.claude/commands/fix.md")),
    ("commands/inbox.md", include_str!("../../.claude/commands/inbox.md")),
    ("commands/lead.md", include_str!("../../.claude/commands/lead.md")),
    ("commands/review.md", include_str!("../../.claude/commands/review.md")),
    ("commands/ship.md", include_str!("../../.claude/commands/ship.md")),
    ("commands/standup.md", include_str!("../../.claude/commands/standup.md")),
    ("commands/weekly.md", include_str!("../../.claude/commands/weekly.md")),
    ("skills/activity-log/SKILL.md", include_str!("../../.claude/skills/activity-log/SKILL.md")),
    ("skills/api-design/SKILL.md", include_str!("../../.claude/skills/api-design/SKILL.md")),
    ("skills/changelog/SKILL.md", include_str!("../../.claude/skills/changelog/SKILL.md")),
    ("skills/code-review/SKILL.md", include_str!("../../.claude/skills/code-review/SKILL.md")),
    ("skills/db-migrate/SKILL.md", include_str!("../../.claude/skills/db-migrate/SKILL.md")),
    ("skills/deploy/SKILL.md", include_str!("../../.claude/skills/deploy/SKILL.md")),
    ("skills/perf-optimize/SKILL.md", include_str!("../../.claude/skills/perf-optimize/SKILL.md")),
    ("skills/pr-manager/SKILL.md", include_str!("../../.claude/skills/pr-manager/SKILL.md")),
    ("skills/security-audit/SKILL.md", include_str!("../../.claude/skills/security-audit/SKILL.md")),
    ("skills/sprint-planner/SKILL.md", include_str!("../../.claude/skills/sprint-planner/SKILL.md")),
    ("skills/vm-gateway/SKILL.md", include_str!("../../.claude/skills/vm-gateway/SKILL.md")),
];

/// Returns ~/.cthulu-lab path
pub fn home_dir() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
    PathBuf::from(home).join(".cthulu-lab")
}

/// Extract all bundled files to ~/.cthulu-lab/ on first run.
/// Only writes files that don't already exist (user edits are preserved).
pub fn extract_bundled_assets() {
    let base = home_dir();
    let mut written = 0;

    for (rel_path, content) in BUNDLED_FILES {
        let target = base.join(rel_path);
        if !target.exists() {
            if let Some(parent) = target.parent() {
                let _ = fs::create_dir_all(parent);
            }
            if fs::write(&target, content).is_ok() {
                written += 1;
            }
        }
    }

    if written > 0 {
        tracing::info!(count = written, "extracted bundled assets to ~/.cthulu-lab");
    }
}

/// Get the path to a bundled directory (agents, skills, commands)
/// Prefers ~/.cthulu-lab/<dir> if it exists, otherwise falls back to .claude/<dir> from CWD
pub fn resolve_dir(name: &str) -> Option<PathBuf> {
    // Check ~/.cthulu-lab first
    let bundled = home_dir().join(name);
    if bundled.is_dir() {
        return Some(bundled);
    }

    // Fall back to .claude/<name> relative to CWD (dev mode)
    let cwd = std::env::current_dir().ok()?;
    let mut dir: &std::path::Path = cwd.as_path();
    loop {
        let candidate = dir.join(".claude").join(name);
        if candidate.is_dir() {
            return Some(candidate);
        }
        match dir.parent() {
            Some(p) => dir = p,
            None => break,
        }
    }

    None
}
