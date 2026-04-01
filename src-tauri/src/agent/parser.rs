use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

use super::types::AgentConfig;

/// Find the .claude/agents/ directory
pub fn discover_agents_dir(cwd: &Path) -> Option<PathBuf> {
    // Try relative to cwd first, then parent dirs, then home
    let mut dir = cwd.to_path_buf();
    loop {
        let agents_dir = dir.join(".claude").join("agents");
        if agents_dir.is_dir() {
            return Some(agents_dir);
        }
        if !dir.pop() {
            break;
        }
    }
    // Try home directory
    if let Some(home) = dirs::home_dir() {
        let agents_dir = home.join(".claude").join("agents");
        if agents_dir.is_dir() {
            return Some(agents_dir);
        }
    }
    None
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
        ("planner", 0),
        ("builder", 1),
        ("fixer", 2),
        ("reviewer", 3),
        ("tester", 4),
        ("specwriter", 5),
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
        "lead" => ("owl", "Great Scott! Orchestrating the timeline"),
        "planner" => ("dragon", "Wubba lubba dub dub — sees all dimensions"),
        "specwriter" => ("snail", "Aw jeez, translating genius to human"),
        "builder" => ("robot", "This is heavy — shipping at 88mph"),
        "frontend" => ("cat", "Like, literally pixel-perfect UI"),
        "backend" => ("turtle", "Make like a tree and build this API"),
        "dba" => ("ghost", "Look at me! Solving your DB problem"),
        "devops" => ("octopus", "You can't hide from deployment"),
        "security" => ("axolotl", "Trusts nothing. Sees everything."),
        "evaluator" => ("capybara", "Challenging mating season for this code"),
        "tester" => ("mushroom", "I squanch your test suite!"),
        "reviewer" => ("penguin", "Fascinating — and also has a bug"),
        "fixer" => ("dragon", "I turned myself into a debugger, Morty!"),
        "writer" => ("rabbit", "Surgical precision documentation"),
        "analyst" => ("cactus", "1.21 gigawatts of calculations"),
        _ => ("blob", "Wubba lubba dub dub"),
    }
}
