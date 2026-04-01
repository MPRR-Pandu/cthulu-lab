---
name: onboarding
description: Generate developer onboarding guides — setup instructions, architecture overview, key workflows. Use when onboarding new team members.
---

# Developer Onboarding

## When to Use
- New developer joining the team
- Setting up development environment
- Understanding project architecture

## Instructions

1. Scan the codebase for: package.json, Cargo.toml, Dockerfile, CI configs
2. Identify: language, framework, database, deployment target
3. Document setup steps (must be copy-pasteable)
4. Map the architecture (entry points, data flow, key modules)

## Output Format

### Quick Start
```bash
# 3 commands or less to get running
git clone <repo>
npm install
npm run dev
```

### Architecture
- **Frontend:** [framework] at `src/`
- **Backend:** [framework] at `src-tauri/`
- **Database:** [type] at [location]
- **Deploy:** [platform] via [method]

### Key Files
| File | Purpose |
|------|---------|
| `src/App.tsx` | Root component |
| `src/lib/ipc.ts` | Backend communication |

### Common Tasks
- **Add a page:** Create in `src/pages/`, add route in `src/router.ts`
- **Add an API:** Create in `src/api/`, register in `src/server.ts`
- **Run tests:** `npm test`
- **Deploy:** `npm run deploy`

## Rules
- Every command must be copy-pasteable
- Test the setup steps on a clean machine
- Include troubleshooting for common errors
- Keep under 200 lines
