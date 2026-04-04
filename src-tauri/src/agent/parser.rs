use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

use super::types::AgentConfig;

/// Find the agents directory — uses bundled::resolve_dir which checks
/// ~/.cthulu-lab/agents first (extracted from binary), then .claude/agents from CWD
pub fn discover_agents_dir(cwd: &Path) -> Option<PathBuf> {
    // Try CWD first (dev mode)
    let mut dir: &Path = cwd;
    loop {
        let agents_dir = dir.join(".claude").join("agents");
        if agents_dir.is_dir() {
            return Some(agents_dir);
        }
        match dir.parent() {
            Some(p) => dir = p,
            None => break,
        }
    }

    // Fall back to ~/.cthulu-lab/agents (extracted from bundled assets)
    crate::bundled::resolve_dir("agents")
}

/// Load all agent markdown files from directory
pub fn load_all_agents(agents_dir: &Path) -> Vec<AgentConfig> {
    let mut agents = Vec::new();

    let entries = match fs::read_dir(agents_dir) {
        Ok(e) => e,
        Err(_) => return agents,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) == Some("md") {
            if let Some(agent) = parse_agent_file(&path) {
                agents.push(agent);
            }
        }
    }

    // Sort by a consistent order
    let order: HashMap<&str, usize> = [
        ("lead", 0),
        ("builder", 1),
        ("reviewer", 2),
        ("fixer", 3),
        ("analyst", 4),
    ]
    .into_iter()
    .collect();

    agents.sort_by_key(|a| order.get(a.id.as_str()).copied().unwrap_or(99));
    agents
}

/// Parse a single agent markdown file
fn parse_agent_file(path: &Path) -> Option<AgentConfig> {
    let content = fs::read_to_string(path).ok()?;
    let id = path.file_stem()?.to_str()?.to_string();

    // Split frontmatter
    let parts: Vec<&str> = content.splitn(3, "---").collect();
    if parts.len() < 3 {
        return None;
    }

    let frontmatter_str = parts[1].trim();
    let body = parts[2].trim();

    // Parse YAML frontmatter
    let frontmatter: HashMap<String, serde_yaml::Value> =
        serde_yaml::from_str(frontmatter_str).ok()?;

    let name = frontmatter
        .get("name")
        .and_then(|v| v.as_str())
        .unwrap_or(&id)
        .to_string();

    let description = frontmatter
        .get("description")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    let color = frontmatter
        .get("color")
        .and_then(|v| v.as_str())
        .unwrap_or("blue")
        .to_string();

    let disallowed_tools = frontmatter
        .get("disallowedTools")
        .and_then(|v| v.as_str())
        .map(|s| s.split(',').map(|t| t.trim().to_string()).collect())
        .unwrap_or_default();

    // Extract display name from body: "You are **Name**"
    let display_name = extract_bold_name(body).unwrap_or_else(|| name.clone());

    // Extract personality (first paragraph after display name line)
    let personality = extract_section(body, "Personality:");

    // Extract voice style
    let voice_style = extract_section(body, "Voice style:");

    // Map agent ID to species and catchphrase
    let (species, catchphrase) = get_agent_skin(&id);

    Some(AgentConfig {
        id,
        name,
        display_name,
        description,
        color,
        disallowed_tools,
        personality,
        voice_style,
        species: species.to_string(),
        catchphrase: catchphrase.to_string(),
    })
}

fn extract_bold_name(body: &str) -> Option<String> {
    for line in body.lines() {
        if let Some(start) = line.find("**") {
            let rest = &line[start + 2..];
            if let Some(end) = rest.find("**") {
                let full = &rest[..end];
                // Trim parenthetical suffixes: "Professor Brown (1985 Doc)" → "Professor Brown"
                let short = full.split('(').next().unwrap_or(full).trim();
                // Trim "reformed" etc: "Biff Tannen" stays as is
                return Some(short.to_string());
            }
        }
    }
    None
}

fn extract_section(body: &str, marker: &str) -> String {
    for line in body.lines() {
        if line.contains(marker) {
            let after = line.split(marker).nth(1).unwrap_or("").trim();
            return after.to_string();
        }
    }
    String::new()
}

fn get_agent_skin(id: &str) -> (&'static str, &'static str) {
    match id {
        "lead" => ("owl", "Orchestrating the sprint"),
        "builder" => ("robot", "Shipping full-stack code"),
        "reviewer" => ("penguin", "Quality gate — no bugs pass"),
        "fixer" => ("dragon", "Root cause found and fixed"),
        "analyst" => ("cactus", "Data-driven recommendations"),
        _ => ("blob", "Ready to work"),
    }
}
