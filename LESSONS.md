# Cthulu Lab — Lessons Learned

## Tauri Desktop App

### HTTP Iframes in Tauri (Web Terminal, etc.)
- Tauri uses WKWebView on macOS which blocks HTTP content by default (mixed content)
- CSP `frame-src http: https:` alone is NOT enough — WKWebView blocks at the OS level
- `window.open()` is silently blocked in Tauri webview — does nothing
- `@tauri-apps/plugin-shell` `open()` works but opens in system browser (not embedded)
- `WebviewWindow` opens a separate Tauri window — works but not embedded in the app

**THE FIX: Info.plist + iframe**

Add `NSAllowsArbitraryLoadsInWebContent: true` to the macOS Info.plist. This tells WKWebView to allow HTTP content in web views. Then a normal `<iframe src="http://...">` works.

In `src-tauri/Info.plist`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>NSAppTransportSecurity</key>
  <dict>
    <key>NSAllowsArbitraryLoadsInWebContent</key>
    <true/>
    <key>NSAllowsLocalNetworking</key>
    <true/>
  </dict>
</dict>
</plist>
```

In `src-tauri/tauri.conf.json` under `bundle`:
```json
"macOS": {
  "infoPlist": "Info.plist"
}
```

CSP still needed in `tauri.conf.json`:
```
frame-src http: https:
connect-src 'self' ipc: tauri: ws: wss: http: https:
```

All three pieces required: **Info.plist ATS** + **CSP frame-src** + **CSP connect-src with ws/wss** (for WebSocket terminals like ttyd).

### CSP General Rules

### Shell Plugin & `window.open`
- `window.open()` does NOT work in Tauri's webview — it's blocked silently (no error, no popup)
- Must use Tauri's shell plugin: `import { open } from "@tauri-apps/plugin-shell"; await open(url);`
- This opens the URL in the system default browser (Safari/Chrome)

### Shell Execution & PATH
- Tauri apps run with a minimal PATH — `claude` CLI won't be found
- `/bin/sh -l -c "command"` (login shell) doesn't work with Tauri shell plugin's arg validation
- **Fix:** Use `/bin/sh -c "export PATH=/opt/homebrew/bin:/usr/local/bin:$PATH; command"` — expand PATH inside the command string
- Shell plugin capabilities (`default.json`) args must match exactly: `["-c", { "validator": ".*" }]`

### Claude CLI stdin Warning
- `claude --print` with `stdin(Stdio::piped())` causes: `Warning: no stdin data received in 3s`
- This is because claude detects piped stdin and waits for input, but the prompt is passed as a CLI arg
- stdin pipe is needed for permission responses (`respond_permission` writes `y\n`/`n\n` to stdin)
- **Fix:** Filter the warning in stderr handler: `if line.contains("no stdin data received") { continue; }`

### DMG Code Signing
- Local `npm run tauri build` produces a working .app — no Gatekeeper issues because macOS trusts locally-built apps (no quarantine xattr)
- Downloaded DMGs get a quarantine flag → "damaged and can't be opened"
- **Fix for users:** `xattr -cr ~/Downloads/CthluLab-0.1.0-mac.dmg` before opening
- **Permanent fix:** Apple Developer ID certificate ($99/year) + Tauri signing config

### Agent Bundling
- Agent `.md` files live in `.claude/agents/` relative to project root
- In dev mode, `discover_agents_dir()` walks up from CWD and finds them
- In production DMG, CWD is `/` or the app bundle — agents not found
- **Fix:** Use `include_str!("../../../.claude/agents/lead.md")` to embed agents in the binary at compile time
- On first run, writes them to `~/.cthulu-lab/agents/` — user can edit without recompiling
- Path from `src-tauri/src/agent/parser.rs` to `.claude/agents/` is `../../../.claude/agents/`

### Workspace Persistence
- Tauri `AppState` is in-memory only — workspaces lost on restart
- **Fix:** Persist to `~/.cthulu-lab/workspaces.json` via Rust, load on startup
- Frontend uses Tauri IPC as source of truth, backend sync is fire-and-forget

## CORS & API Calls

### Browser Fetch Doesn't Work
- Tauri webview runs on `tauri://` (prod) or `localhost:1420` (dev)
- Browser `fetch()` to `localhost:3000` or any external API is blocked by CORS
- All `catch { return []; }` patterns silently swallow these failures — user sees nothing
- **Fix:** Route ALL HTTP calls through Rust `reqwest` via Tauri commands (no CORS in server-side HTTP)
- Added generic `api_proxy` command for workflow/scheduled APIs
- Added specific Tauri commands for user-vm, gateway operations

### SSRF Prevention
- `api_proxy` originally took a full URL from frontend — open SSRF relay
- **Fix:** Takes `apiBase` + `path` separately, blocks `169.254.169.254` and `metadata.google.internal`

## Kubernetes / Deployment

### NextAuth v5 (beta)
- Uses `AUTH_SECRET` not `NEXTAUTH_SECRET` (though both work)
- Behind a load balancer/ingress, requires `trustHost: true` in NextAuth config OR `AUTH_TRUST_HOST=true` env var
- Setting env var alone isn't enough — edge routes read config at build time. Must set `trustHost: true` in `auth.ts`

### MongoDB URI at Build Time
- `throw new Error("MONGODB_URI required")` at module top-level crashes `next build` (page data collection imports db.ts)
- **Fix:** Make the check lazy — only throw inside `getDb()` when actually connecting, not at import time

### npm Peer Dependency Conflicts
- `@auth/mongodb-adapter@3` wants `mongodb@^6`, project uses `mongodb@^7`
- Don't use `--legacy-peer-deps` in Dockerfile — use `overrides` in package.json:
  ```json
  "overrides": { "@auth/mongodb-adapter": { "mongodb": "$mongodb" } }
  ```
- Regenerate lockfile with `npm install` after adding overrides

### Vault Secret Injection
- Vault agent writes secrets to `/vault/secrets/env-vars` as shell export statements
- Container command must `source` before running the app:
  ```
  set -a && source /vault/secrets/env-vars && set +a && exec node server.js
  ```

## VM & Workflow Execution

### Crontab Not Installed
- Firecracker microVMs are minimal — no cron by default
- **Fix:** Install essential tools at VM creation time:
  ```
  apt-get install -y cron curl python3 jq git ca-certificates
  service cron start
  ```
- Also run `ensureCron()` before any crontab usage as a safety net

### Script Deployment to VM
- Chaining commands with `&&` and heredocs in a single `exec` call breaks — the exec API runs everything as one shell string, `\n` doesn't become real newlines
- **Fix:** Split into separate exec calls:
  1. `mkdir -p /path/to/dir`
  2. `printf '%s' "BASE64" | base64 -d > run.sh`
  3. `chmod +x run.sh && wc -c < run.sh` (verify non-empty)
- Always verify the file was written — deploy failures were silent

### Exec Timeout
- Default 30s timeout on gateway exec is too short for Claude workflow steps
- **Fix:** 300s (5 min) timeout on both reqwest client and the VM exec API payload

### Workflow Lifecycle
- Create → `active: false` (disabled). No deploy, no cron. Just metadata in MongoDB
- Enable (toggle on) → deploy script to VM + set crontab
- Disable (toggle off) → remove crontab entry. Script stays on disk
- Run (manual) → re-deploy script (safety net) + `bash run.sh` via exec API
- Save (edit) → re-deploy updated script + update cron if active

### Terminal URL
- Gateway API returns `web_terminal` with private IP (e.g., `10.x.x.x:port`)
- **Fix:** Always construct URL from gateway host in settings + VM web_port: `resolveTerminalUrl()` ignores `webTerminal` field, uses `getGatewayUrl()` hostname
