# Cthulu Lab

**AI-Powered Workflow Automation Platform** — Desktop app + Cloud backend for orchestrating autonomous AI agents with sandboxed VM execution.

Built by [bitcoin.com](https://bitcoin.com) engineering.

---

## What It Is

A native macOS desktop app (Tauri + React) that lets you:
- Run **5 autonomous AI agents** (Lead, Builder, Reviewer, Fixer, Analyst) powered by Claude Code
- Build **visual workflow pipelines** (fetch data → AI analysis → Slack alerts)
- Execute workflows inside **isolated Firecracker microVMs**
- Schedule with cron, monitor with run logs, sync to Slack

```
┌─────────────┬──────────────────┬─────────────────┐
│  CTHULU LAB │                  │ ── MISSION ──── │
│             │  Chat with any   │ Auth v1  80%    │
│ [SESSIONS]  │  agent. Switch   ├─ QUEUE ─────── │
│ [INBOX]     │  context freely. │ ▸ Build login   │
│ [MEMORY]    │                  ├─ ACTIVITY ───── │
│             │                  │ 14:20 responded │
│ ▸ Builder ● │  > ____________  ├─ SWARM ──────── │
│   Fixer     │  | enter to send │    ○   ○        │
│             │                  ├─ WORKFORCE ──── │
│── CRAFT ────│  [CHAT] [SWARM]  │ Doc Brown [chat] │
│ [GENERATE]  │  [SPLIT] [GW]   │ Marty   ● [chat] │
└─────────────┴──────────────────┴─────────────────┘
```

---

## What Makes It Different

| Feature | Cthulu Lab | OpenClaw | Hermes Agent | AutoAgent |
|---|:---:|:---:|:---:|:---:|
| Native desktop app | **Tauri** | No | No | No |
| Visual workflow canvas | **React Flow** | No | No | No |
| Firecracker VM sandbox | **Yes** | No | No | Docker |
| Embedded web terminal | **In-app** | No | CLI only | No |
| One-click VM provisioning | **Yes** | No | No | No |
| Agent-to-agent delegation | **Depth-limited** | agentToAgent tool | Sub-agents | Meta-agent |
| Persistent memory | **MongoDB** | Memory.md | 4-level hierarchy | No |
| Auto-skill generation | **8+ tool calls** | ClawHub | Runtime skills | Score-driven |
| Workflow scheduling | **Cron on VM** | Cron + webhooks | NL cron | Batch |
| All API via native HTTP | **Rust reqwest** | Node.js | Python | Python |

**Unique combination:** Desktop-native + VM sandbox + visual workflows + multi-agent orchestration. No other platform has all four.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Cthulu Lab (macOS Tauri App — 5MB DMG)                     │
│                                                             │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────────┐ │
│  │ 5 Agents │  │ Workflow      │  │ Gateway to Heaven     │ │
│  │          │  │ Canvas        │  │                       │ │
│  │ Lead ────┤  │ ┌───┐ ┌───┐  │  │ ┌───────────────────┐ │ │
│  │ Builder  │  │ │FET│→│CLA│  │  │ │ Firecracker VM    │ │ │
│  │ Reviewer │  │ └───┘ └─┬─┘  │  │ │ ┌───────────────┐ │ │ │
│  │ Fixer    │  │     ┌───▼──┐ │  │ │ │ cron + bash   │ │ │ │
│  │ Analyst  │  │     │SLACK │ │  │ │ │ curl + claude  │ │ │ │
│  │          │  │     └──────┘ │  │ │ └───────────────┘ │ │ │
│  └──────────┘  └──────────────┘  │ └───────────────────┘ │ │
│                                  │ [TERMINAL] [SYNC AUTH] │ │
│                                  └───────────────────────┘ │
│                                                             │
│  Rust Backend: all HTTP via reqwest (zero CORS issues)      │
│  26 bundled assets extracted to ~/.cthulu-lab/ on first run │
└──────────────────────┬──────────────────────────────────────┘
                       │ api_proxy (SSRF-protected)
┌──────────────────────▼──────────────────────────────────────┐
│  Cloud Backend (Next.js 16 on K8s)                          │
│                                                             │
│  MongoDB Collections:                                       │
│  ├── workflows        (pipeline definitions + run history)  │
│  ├── workspaces       (project directories per user)        │
│  ├── user_vms         (VM assignments per user)             │
│  ├── agent_memory     (persistent task memories)            │
│  ├── agent_sessions   (chat sessions survive restarts)      │
│  └── scheduled_responses (background task results)          │
│                                                             │
│  Auth: Google OAuth (@bitcoin.com restricted)               │
│  Secrets: HashiCorp Vault injection                         │
│  Infra: ECR → K8s → ALB ingress → TLS                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop | Tauri v2 (Rust + React 18 + TypeScript) |
| UI | Terminal dark theme, React Flow, Tailwind v4, Zustand |
| Backend | Next.js 16 (App Router) on K8s |
| Database | MongoDB |
| VM | Firecracker microVMs via HTTP exec API |
| Auth | Claude Code CLI (macOS Keychain) + Google OAuth (NextAuth v5) |
| CI/CD | Docker → ECR → K8s with Vault secret injection |
| Agents | Claude Code headless (`--print --output-format stream-json`) |

---

## Features

### Multi-Agent System

| Agent | Character | Role |
|---|---|---|
| **Lead** | Doc Brown | Orchestrator — plans, delegates, tracks |
| **Builder** | Marty McFly | Full-stack — frontend, backend, database |
| **Reviewer** | Birdperson | Quality gate — review, test, security audit |
| **Fixer** | Rick C-137 | Debug + ops — traces root cause, fixes |
| **Analyst** | Professor Brown | Research — data, costs, trade-offs |

- **3-layer prompt architecture**: system-prompt.md → agent .md → user message
- **Agent-to-agent delegation** with context forwarding (depth limit 2)
- **Persistent memory** in MongoDB (survives app restarts)
- **Auto-skill generation** at 8+ tool calls
- **Session continuity** via `--resume` across messages
- **Loop detection**: 3 failures → inbox alert → auto-escalation

### Workflow Engine

- **Visual canvas**: React Flow with drag, zoom, pan, rewire nodes
- **Shell script generation**: workflows compile to bash, deployed to VMs
- **Cron scheduling** on the VM itself
- **Color-coded run logs** with timestamped step trace
- **Lifecycle**: create (disabled) → enable (deploys + cron) → run → disable

### Gateway to Heaven

- **One-click VM creation** (nano: 1 vCPU/512MB, micro: 2 vCPU/1GB)
- **Embedded web terminal** in-app
- **Claude auth sync**: macOS Keychain → VM
- **Slack alert cron** for token expiry
- **Auto-provisioning**: installs cron, curl, python3, jq, git on VM creation

### Desktop App

- **5MB DMG** with 26 bundled assets (agents, commands, skills, system-prompt)
- **All API via Rust reqwest** — zero CORS issues
- **First-run extraction** to `~/.cthulu-lab/`
- **Connection testing** with [TEST] buttons in Settings
- **@bitcoin.com** email restriction

### Cloud Backend

- **Swagger API docs** at `/docs`
- **Google OAuth** restricted to @bitcoin.com
- **7 MongoDB collections** with lazy initialization
- **K8s + Vault** deployment with health checks

---

## Getting Started

### Prerequisites
- macOS 12+
- Claude Code CLI: `npm i -g @anthropic-ai/claude-code`
- Claude Pro or Max subscription
- `claude auth login` completed

### Install
1. Login at `https://cthulu-lab.capybara.systems`
2. Download DMG → `xattr -cr ~/Downloads/CthluLab-0.1.0-mac.dmg`
3. Install → Launch → [TAKE ME IN]

### Development
```bash
git clone https://github.com/MPRR-Pandu/cmd-center.git
cd cmd-center && npm install
npm run tauri dev
```

### Deploy
```bash
./deploy/build-and-push.sh cthulu-lab-v1.3
kubectl apply -f deploy/k8s.yml
```

---

## API

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Health check |
| GET | `/api/workflows/list/{email}` | List workflows |
| POST | `/api/workflows` | Create workflow |
| POST | `/api/workflows/{id}/run` | Trigger run |
| GET | `/api/workflows/{id}/script` | Get bash script |
| GET | `/api/agent-memory/{email}` | List memories |
| PUT | `/api/agent-sessions/{email}` | Upsert session |
| POST | `/api/user-vm` | Create VM mapping |

Full docs at `/docs` (auth required).

---

## Roadmap

**Phase 2** — Webhook triggers (GitHub/Slack HMAC-signed), MCP support, NL → cron conversion

**Phase 3** — Multi-channel sinks, skill marketplace, voice input

---

## License

Proprietary — bitcoin.com internal use only.
