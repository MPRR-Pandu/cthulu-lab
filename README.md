# Cthulu Lab

A desktop AI agent lab built with Tauri, React, and Rust. 5 autonomous agents with context switching, swarm visualization, and task assignment from GitHub/Notion/Linear.

```
┌─────────────┬──────────────────┬─────────────────┐
│  CTHULU LAB │                  │ ── MISSION ──── │
│             │  Chat with any   │ Auth v1  80%    │
│ [SESSIONS]  │  agent. Switch   ├─ QUEUE ─────── │
│ [INBOX]     │  context freely. │ ▸ Build login   │
│             │                  ├─ ACTIVITY ───── │
│ ▸ Builder ● │                  │ 14:20 responded │
│   Fixer     │                  ├─ SWARM ──────── │
│             │  > ____________  │    ○   ○        │
│── CRAFT ────│  | enter to send ├─ WORKFORCE ──── │
│ what:       │                  │ Doc Brown [assign]│
│ context:    │                  │ Marty   ● [chat] │
│ [GENERATE]  │                  │ Rick      [assign]│
└─────────────┴──────────────────┴─────────────────┘
```

## Quick Start

```bash
cd cthulu-lab && npm install

# Start MongoDB
docker run -d --name cthulu-mongo -p 27017:27017 \
  -e MONGO_INITDB_ROOT_USERNAME=root \
  -e MONGO_INITDB_ROOT_PASSWORD=checkOne mongo:7

# Setup API
cd services/api && npm install
echo 'PORT=4000
DATABASE_URL="mongodb://root:checkOne@localhost:27017/cthulu_lab?authSource=admin"
JWT_SECRET="cthulu-lab-jwt-secret-dev-only-32chars!!"
JWT_REFRESH_SECRET="cthulu-lab-refresh-secret-dev-only-32ch!!"' > .env

# Run everything
cd ../.. && npm start
```

## Agents (5)

| Agent | Character | Role |
|-------|-----------|------|
| **Lead** | Doc Brown | Orchestrator — plans, specs, delegates |
| **Builder** | Marty McFly | Full-stack — frontend, backend, database |
| **Reviewer** | Birdperson | Quality gate — review, test, security audit |
| **Fixer** | Rick C-137 | Debug + ops — fixes, deploys, docs |
| **Analyst** | Professor Brown | Research — data, costs, trade-offs |

### 3-Layer Prompt Architecture

```
Layer 1: System Prompt (.claude/system-prompt.md)     — shared rules for ALL agents
Layer 2: Agent Prompt  (.claude/agents/<id>.md)        — role-specific behavior
Layer 3: User Prompt   (your message or CRAFT output)  — the task
```

Inspired by [ParaHelp](https://elifuzz.github.io/awesome-system-prompts/parahelp), [Codex](https://elifuzz.github.io/awesome-system-prompts/codex), and [Devin](https://elifuzz.github.io/awesome-system-prompts/devin) patterns.

## CRAFT Panel

Type a short task → auto-generates a detailed prompt → review/edit → assign to the right agent.

**Examples:**

| Task | Context | Agent |
|------|---------|-------|
| `create todo app on android` | `Jetpack Compose, Material 3, Room DB. Target API 26+.` | Builder |
| `fix login auth bug` | `error after token expires. See AuthLayout.tsx line 45.` | Fixer |
| `review PR #42` | `changes in services/api/src/. Focus on SQL injection.` | Reviewer |
| `plan user notifications` | `3 channels: email, push, in-app. Using SendGrid. Deadline April 15.` | Lead |
| `compare React Native vs Flutter` | `team knows TypeScript, no Dart. Ship MVP in 6 weeks.` | Analyst |
| `deploy auth API to production` | `AWS ECS, Docker. Need zero-downtime. MongoDB Atlas.` | Fixer |

The CRAFT panel detects keywords and adds relevant requirements automatically:
- "android" + "design" → adds Material guidelines, responsive layout, latest SDK check
- "auth" + "fix" → adds error handling, security, root cause analysis
- "deploy" → adds health checks, version pinning, rollback strategy

### `/` Command Palette

Type `/` in the chat input for quick templates:

| Command | Agent | Action |
|---------|-------|--------|
| `/summarize` | Lead | Meeting summary |
| `/rewrite` | Fixer | Email rewrite |
| `/plan` | Lead | Task planner |
| `/report` | Analyst | Report maker |
| `/compare` | Analyst | Idea comparison |
| `/clarify` | Fixer | Clarity rewrite |

## Assign Modal

Click `[assign]` on any agent in the WORKFORCE panel to open the task picker:

| Tab | Source | Auth |
|-----|--------|------|
| **Manual** | Free text | None |
| **GitHub** | `gh issue list` | gh CLI auth |
| **Notion** | Notion API | Integration token |
| **Linear** | Linear GraphQL | API key |

## Features

- **Swarm Visualization** — canvas node graph, elastic physics, glowing agent nodes
- **Sessions Tab** — active conversations per agent with message count and preview
- **Inbox** — agent-to-agent messages, loop detection (3 failures → alert), auto-approve mode
- **Workforce Panel** — agent status, assigned tasks, [chat] [stop] [assign] buttons
- **Sound Effects** — blip (switch), two-tone (send), ding (respond), hallelujah (complete)
- **Terminal UI** — monospace, box-drawing borders, WCAG AAA contrast

## Architecture

```
cthulu-lab/
├── src/                     React frontend
│   ├── components/          UI (ChatArea, Sidebar, WorkforcePanel, CraftPanel, AssignModal...)
│   ├── store/               Zustand (app + auth)
│   ├── hooks/               useChat, useStreamListener, useAgents
│   └── lib/                 IPC, colors, sounds
├── src-tauri/               Rust backend
│   └── src/
│       ├── agent/           Parser (reads .claude/agents/*.md)
│       ├── chat/            Session manager
│       ├── claude/          CLI bridge (headless mode, stream batching)
│       ├── inbox/           Inbox + loop detection
│       └── commands/        Tauri IPC (chat, agent, workspace, issues)
├── services/api/            Express auth API (MongoDB, JWT)
├── .claude/
│   ├── system-prompt.md     Shared system rules (Layer 1)
│   ├── agents/              5 agent definitions (Layer 2)
│   ├── commands/            Slash commands
│   └── skills/              10 skills
└── public/sounds/           Audio files
```

## How It Works

1. **You type** a task (or use CRAFT to generate a prompt)
2. **Rust backend** spawns `claude -p --agent <id> --append-system-prompt-file system-prompt.md`
3. **3-layer context**: system rules + agent role + your message
4. **Streaming** response with 50ms batching + rAF debouncing
5. **Session persists** via `--resume` for conversation continuity
6. **Request cancellation** — new message kills previous in-flight process

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop | Tauri v2 |
| Frontend | React 18, TypeScript, Tailwind v4, Zustand |
| Backend | Rust, tokio, serde, reqwest |
| Auth API | Express, MongoDB, JWT |
| CLI Bridge | Claude Code headless (`claude -p`, Max Pro subscription) |
| Integrations | GitHub (gh CLI), Notion API, Linear GraphQL |
| Monorepo | Nx |

## License

MIT
