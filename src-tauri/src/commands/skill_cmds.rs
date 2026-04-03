use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tokio::fs;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillInfo {
    pub name: String,
    pub description: String,
    pub path: String,
    pub auto_generated: bool,
}

fn discover_skills_dir() -> Option<PathBuf> {
    let cwd = std::env::current_dir().ok()?;
    let mut dir = cwd.as_path();
    loop {
        let candidate = dir.join(".claude").join("skills");
        if candidate.is_dir() {
            return Some(candidate);
        }
        dir = dir.parent()?;
    }
}

#[tauri::command]
pub async fn list_skills() -> Result<Vec<SkillInfo>, String> {
    let skills_dir = discover_skills_dir().ok_or("Skills directory not found")?;
    let mut skills = Vec::new();

    let mut entries = fs::read_dir(&skills_dir)
        .await
        .map_err(|e| format!("Failed to read skills dir: {}", e))?;

    while let Ok(Some(entry)) = entries.next_entry().await {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        let skill_md = path.join("SKILL.md");
        if !skill_md.exists() {
            continue;
        }

        let content = fs::read_to_string(&skill_md).await.unwrap_or_default();

        let mut name = entry.file_name().to_string_lossy().to_string();
        let mut description = String::new();
        let mut auto_generated = false;

        if let Some(fm) = content.strip_prefix("---") {
            if let Some(end) = fm.find("---") {
                let yaml_str = &fm[..end];
                for line in yaml_str.lines() {
                    let line = line.trim();
                    if line.starts_with("name:") {
                        name = line.trim_start_matches("name:").trim().to_string();
                    } else if line.starts_with("description:") {
                        description =
                            line.trim_start_matches("description:").trim().to_string();
                    } else if line.starts_with("auto_generated:") {
                        auto_generated = line.contains("true");
                    }
                }
            }
        }

        skills.push(SkillInfo {
            name,
            description,
            path: path.to_string_lossy().to_string(),
            auto_generated,
        });
    }

    Ok(skills)
}

#[tauri::command]
pub async fn create_skill(
    name: String,
    description: String,
    when_to_use: String,
    procedure: String,
    pitfalls: String,
    verification: String,
) -> Result<String, String> {
    let skills_dir = discover_skills_dir().ok_or("Skills directory not found")?;

    let dir_name = name
        .to_lowercase()
        .replace(' ', "-")
        .replace(|c: char| !c.is_alphanumeric() && c != '-', "");
    let skill_dir = skills_dir.join(&dir_name);

    fs::create_dir_all(&skill_dir)
        .await
        .map_err(|e| format!("Failed to create skill dir: {}", e))?;

    let content = format!(
        r#"---
name: {name}
description: {description}
auto_generated: true
---

## When to Use
{when_to_use}

## Procedure
{procedure}

## Pitfalls
{pitfalls}

## Verification
{verification}
"#,
        name = name,
        description = description,
        when_to_use = when_to_use,
        procedure = procedure,
        pitfalls = pitfalls,
        verification = verification,
    );

    let skill_path = skill_dir.join("SKILL.md");
    fs::write(&skill_path, content)
        .await
        .map_err(|e| format!("Failed to write skill: {}", e))?;

    Ok(skill_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn delete_skill(name: String) -> Result<(), String> {
    let skills_dir = discover_skills_dir().ok_or("Skills directory not found")?;
    let dir_name = name
        .to_lowercase()
        .replace(' ', "-")
        .replace(|c: char| !c.is_alphanumeric() && c != '-', "");
    let skill_dir = skills_dir.join(&dir_name);

    if skill_dir.exists() {
        fs::remove_dir_all(&skill_dir)
            .await
            .map_err(|e| format!("Failed to delete skill: {}", e))?;
    }
    Ok(())
}
