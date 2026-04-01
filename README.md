# Command Center

A desktop AI agent command center built with Tauri, React, and Rust. Manage a team of AI agents with context switching, swarm visualization, and real-time collaboration.

```
┌─────────────┬──────────────────┬─────────────────┐
│  ╭─────╮    │                  │ ◆ SWARM CONTROL │
│  │ ·  · │   │  Chat with any   │    ○   ○        │
│  │  ◡   │   │  agent. Switch   │   / \ / \       │
│  ╰──┬──╯   │  context freely.  │  ○──●──○        │
│  CMD CENTER │  History saved.   │   \ / \ /       │
│             │                  │    ○   ○        │
│ ── AGENTS ──│                  ├─ MISSION ───────┤
│ ▸ Doc Brown │                  │ Auth v1          │
│   Rick      │                  │ ████████░░ 80%   │
│   Morty     │                  ├─ QUEUE ─────────┤
│   Marty     │                  │ ▸ Build login    │
│   ...       │                  │   Fix bug        │
│             │  > ____________  ├─ ACTIVITY ──────┤
│ ── INBOX ── │  | ____________  │ 14:20 Rick resp  │
│ ── SWARM ── │  | enter to send │ 14:18 user deleg │
└─────────────┴──────────────────┴─────────────────┘
```

## Quick Start

```bash
# 1. Clone and install
cd command-center
npm install

# 2. Start MongoDB (Docker)
docker compose up -d mongo

# 3. Setup API
cd services/api
npm install
echo 'PORT=4000
DATABASE_URL="mongodb://root:checkOne@localhost:27017/command_center?authSource=admin"
JWT_SECRET="command-center-jwt-secret-dev-only-32chars!"
JWT_REFRESH_SECRET="command-center-refresh-secret-dev-only-32ch!"' > .env

# 4. Run everything (Nx runs API + Tauri in parallel)
cd ../..
npm start
```

Register → Login → You're in.

## Features

### Agent Team (15 agents, Back to the Future × Rick and Morty)

| Agent | Character | Role |
|-------|-----------|------|
| `/lead` | Doc Brown | Orchestrator — sprint contracts, delegation |
| `/plan` | Rick Sanchez | Architect — explores code, designs plans |
| `/spec` | Morty Smith | Spec writer — translates ideas to specs |
| `/build` | Marty McFly | Full-stack dev — ships at 88mph |
| `/fix` | Rick C-137 | Debugger — finds root cause across dimensions |
| `/review` | Young Doc Brown | Code reviewer — fresh eyes, catches everything |
| `/test` | Squanchy | Test engineer — squanches through your code |
| `/ship` | — | Pipeline — lint → test → commit |
| `/eval` | Birdperson | QA evaluator — honest, independent judgment |
| `/deploy` | Scary Terry | DevOps — deploys relentlessly |
| `/secure` | Evil Morty | Security — trusts nothing |
| `/frontend` | Summer Smith | Frontend — pixel-perfect UI |
| `/backend` | Biff Tannen | Backend — brute force APIs |
| `/write` | Beth Smith | Technical writer — surgical precision |
| `/standup` | — | Daily standup from git + Slack + Notion |

### Swarm Visualization
- Canvas-based node graph with elastic physics
- Glowing agent nodes in their team colors
- Animated connection particles when agents communicate
- Mouse-interactive — nodes repel on hover
- HUD overlay: workforce count, repo, merge status

### Animated Morty Mascot
- Idle: eyes look around, slow sway
- Working: panicked face, arms flailing — "AW JEEZ!"
- Dancing: happy face, arms waving — "WUBBA!"

### Sound Effects
- **Switch agent** — short blip
- **Send message** — two-tone up
- **Agent responds** — soft ding
- **Loop detection alert** — warning buzz
- **Mission progress** — rising chime
- **Mission complete** — hallelujah 🎵

### Inbox System
- Agent-to-agent messages (delegation, reports, questions, alerts)
- Auto-posts when you send a message (delegation) and when agent responds (report)
- Loop detection: 3 consecutive failures → alert to user
- Color-coded by type: cyan/green/yellow/red

### Right Panel
- **Mission** — current goal with progress bar
- **Queue** — pending tasks, click to assign
- **Activity** — timestamped event log

### Terminal UI
- Monospace font, box-drawing borders, no rounded corners
- High contrast (WCAG AAA — 7:1+ ratio)
- View modes: [CHAT] [SWARM] [SPLIT]

### Auth
- JWT-based login/register
- MongoDB backend
- Session persistence with token refresh

## Architecture

```
command-center/
├── src/                     React frontend (terminal UI)
│   ├── components/          UI components (30+)
│   ├── store/               Zustand stores (app + auth)
│   ├── hooks/               React hooks (agents, chat, stream)
│   ├── lib/                 IPC, colors, sprites, sounds
│   └── __tests__/           Vitest test suite (58 tests)
├── src-tauri/               Rust backend
│   └── src/
│       ├── agent/           Agent parser (reads .claude/agents/*.md)
│       ├── chat/            Chat session manager
│       ├── claude/          CLI bridge (spawns claude, streams responses)
│       ├── inbox/           Inbox system + loop detection
│       └── commands/        Tauri IPC commands
├── services/api/            Express auth API (MongoDB)
├── .claude/
│   ├── agents/              15 agent definitions (markdown)
│   ├── commands/            18 slash commands
│   └── skills/              18 skills (SKILL.md files)
└── public/sounds/           Audio files
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop | Tauri v2 |
| Frontend | React 18, TypeScript, Tailwind v4, Zustand |
| Backend (Tauri) | Rust, tokio, serde |
| Backend (Auth) | Express, MongoDB, JWT, bcrypt |
| Monorepo | Nx |
| Testing | Vitest (58 tests) |
| CLI Bridge | Claude Code CLI (`--agent`, `--resume`) |

## Commands

```bash
npm start           # Run API + Tauri app (via Nx)
npm test            # Run 58 tests
npm run test:watch  # Watch mode
npm run start:api   # API only
npm run start:app   # Tauri only
```

## Skills (18)

sprint-planner · code-review · deploy · pr-manager · db-migrate · api-design · security-audit · perf-optimize · docs-gen · marketing-copy · seo-optimize · changelog · onboarding · incident-response · cost-estimate · monitor-setup · activity-log · data-analysis

## How It Works

1. **You type** a message to any agent
2. **Rust backend** spawns `claude` CLI with `--agent <name>`
3. **Streaming** response appears in terminal-style chat
4. **Session persists** via `--resume` for conversation continuity
5. **Inbox** logs delegation + report messages
6. **Swarm** shows which agents are active
7. **Sounds** play on key events
8. **Morty** panics when agents are working

## License

MIT
