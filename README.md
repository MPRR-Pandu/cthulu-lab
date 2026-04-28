# Cthulu Lab

**AI-Powered Workflow Automation Platform** — desktop app that orchestrates autonomous AI agents on top of the Claude Code CLI, with optional sandboxed VM execution.

This README covers **local development only**. There are no built-in deployment scripts — wire it into your own infra if/when you want to host it.

---

## What It Is

Native macOS desktop app (Tauri + React) that lets you:

- Run autonomous AI agents (Lead, Builder, Reviewer, Fixer, Analyst) powered by the Claude Code CLI
- Build visual workflow pipelines (fetch data → AI analysis → Slack alerts)
- Execute workflows inside isolated Firecracker microVMs (optional)
- Schedule with cron, monitor with run logs

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
│── CRAFT ────│  [CHAT] [SWARM]  │ Doc Brown [chat]│
│ [GENERATE]  │  [SPLIT] [GW]    │ Marty   ● [chat]│
└─────────────┴──────────────────┴─────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop | Tauri v2 (Rust + React 18 + TypeScript) |
| UI | Tailwind v4, React Flow, Zustand |
| Backend (optional) | Next.js (App Router) |
| Database (optional) | MongoDB |
| VM (optional) | Firecracker microVMs via HTTP exec API |
| Auth | Claude Code CLI (macOS Keychain) + optional Google OAuth |
| Agents | Claude Code headless (`--print --output-format stream-json`) |

The chat itself only needs the Claude Code CLI. Backend / Mongo / VMs are optional and only required for workflow persistence and Gateway features.

---

## Prerequisites

- macOS 12+
- Node.js 20+
- Rust stable: `rustup install stable`
- Claude Code CLI: `npm install -g @anthropic-ai/claude-code`
- A Claude subscription, signed in via `claude auth login`
- (Optional, for backend features) MongoDB running locally — `docker run -d -p 27017:27017 mongo:7`

---

## 1. Run the desktop app

```bash
git clone https://github.com/MPRR-Pandu/cthulu-lab.git
cd cthulu-lab
npm install
npm run tauri dev
```

The app launches. Pick a workspace dir on first run, type "hi" — claude replies in the workspace context.

That's enough for chat. Skip the rest unless you want workflows / memory / VMs.

---

## 2. (Optional) Run the backend for persistence

The backend stores workflows, agent memory, and chat sessions in MongoDB.

```bash
# In a second terminal
cd services/web
cp .env.example .env.local      # see "Env vars" below
npm install
npm run dev                     # listens on http://localhost:3001
```

Verify: `curl http://localhost:3001/api/health` → `{"ok":true}`.

In the app, open **Settings → Connection** and set **Backend API URL** to `http://localhost:3001/api`. Click `[TEST]`. Should turn green.

### Backend env vars (`services/web/.env.local`)

```
MONGODB_URI=mongodb://localhost:27017/cthulu-lab
NEXTAUTH_URL=http://localhost:3001
AUTH_URL=http://localhost:3001
AUTH_TRUST_HOST=true
AUTH_SECRET=change-me-to-a-random-string
NEXTAUTH_SECRET=change-me-to-a-random-string
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXT_TELEMETRY_DISABLED=1
```

`AUTH_SECRET` / `NEXTAUTH_SECRET`: any random string. Generate one:

```bash
openssl rand -base64 32
```

Google OAuth client ID/secret are only needed if you want sign-in. Leave blank otherwise.

---

## 3. (Optional) Run the VM Gateway

Only needed for the in-app "Gateway to Heaven" feature (Firecracker microVMs).

```bash
# Third terminal
cd services/api
npm install
npm run dev                     # listens on http://localhost:8080
```

In the app, **Settings → Connection** → **VM Gateway URL** → `http://localhost:8080`.

---

## Connection settings (in-app)

The app stores backend URLs in `localStorage`. Defaults come from the build (Vite env vars below) and can be overridden at runtime in **Settings → Connection**.

| Field | Purpose | Default |
|---|---|---|
| Backend API URL | REST API (workflows, memory, sessions) | `http://localhost:3001/api` |
| VM Gateway URL | VM Manager | `http://localhost:8080` |

Compile-in different defaults via Vite env vars at build time:

```bash
export VITE_API_URL="https://your-backend.example.com/api"
export VITE_GATEWAY_URL="https://your-gateway.example.com"
export VITE_ALLOWED_EMAIL_DOMAIN="your-org.com"   # empty = no email gate
```

---

## Building a release DMG

Local:

```bash
npm run tauri build -- --bundles dmg
# DMG appears at src-tauri/target/release/bundle/dmg/
```

CI: push a `v*` tag. The release workflow reads the tag, syncs the version into `tauri.conf.json` / `Cargo.toml` / `package.json`, builds a universal-arch DMG, and uploads it as a draft GitHub Release.

```bash
git tag v0.2.0
git push origin v0.2.0
```

---

## Repo layout

```
cthulu-lab/
├── src/                  Tauri React frontend (TypeScript)
├── src-tauri/            Tauri Rust backend (claude CLI integration)
├── services/
│   ├── api/              VM Gateway (Express + Firecracker) — optional
│   └── web/              Next.js backend (MongoDB + auth) — optional
├── .claude/              Bundled agent stubs / commands / skills
└── .github/workflows/    Release workflow (DMG on tag push)
```

---

## License

See `LICENSE`.
