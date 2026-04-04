import { useState, useEffect } from "react";
import { gatewayHealth, listVMs, createVM, deleteVM, execInVm } from "../lib/gatewayApi";
import { getUserVm, saveUserVm, deleteUserVm, updateSlackWebhook } from "../lib/userVmApi";
import type { VM, GatewayHealth } from "../lib/gatewayApi";
import type { UserVm } from "../lib/userVmApi";
import { useAuthStore } from "../store/useAuthStore";
import { getGatewayUrl } from "../lib/config";
import { playClick, playSuccess, playError } from "../lib/sounds";
import { WorkflowWorkspace } from "./WorkflowWorkspace";

/** Build terminal URL from gateway host (settings) + VM web port — never use private IP */
function resolveTerminalUrl(vm: UserVm): string {
  const gw = getGatewayUrl();
  if (!gw || !vm.webPort) return "";
  try {
    const u = new URL(gw);
    return `${u.protocol}//${u.hostname}:${vm.webPort}`;
  } catch { return ""; }
}

type AuthState = "unknown" | "syncing" | "authed" | "not_authed" | "error";

export function GatewayPanel() {
  const user = useAuthStore((s) => s.user);
  const email = user?.email ?? "";

  const [health, setHealth] = useState<GatewayHealth | null>(null);
  const [myVm, setMyVm] = useState<UserVm | null>(null);
  const [liveVm, setLiveVm] = useState<VM | null>(null);
  const [tier, setTier] = useState("nano");
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [vmError, setVmError] = useState<string | null>(null);

  const [showTerminal, setShowTerminal] = useState(false);
  const [authState, setAuthState] = useState<AuthState>("unknown");
  const [authError, setAuthError] = useState<string | null>(null);

  // Slack alert setup
  const [slackWebhook, setSlackWebhook] = useState("");
  const [showSlackSetup, setShowSlackSetup] = useState(false);

  const refresh = async () => {
    const h = await gatewayHealth();
    setHealth(h);

    if (email) {
      const mapping = await getUserVm(email);
      setMyVm(mapping);

      if (mapping) {
        const vms = await listVMs();
        const live = vms.find((v) => v.vm_id === mapping.vmId);
        setLiveVm(live || null);
      } else {
        setLiveVm(null);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 15000);
    return () => clearInterval(interval);
  }, [email]);

  const handleCreate = async () => {
    if (!email) return;
    setCreating(true);
    setVmError(null);
    playClick();
    try {
      const vm = await createVM(tier);

      // Init VM with essential tools
      try {
        await execInVm(vm.vm_id, [
          "apt-get update -qq",
          "apt-get install -y -qq cron curl python3 jq git ca-certificates >/dev/null 2>&1",
          "service cron start 2>/dev/null",
          "mkdir -p /root/workflows",
          "echo VM_INIT_OK",
        ].join(" && "));
      } catch {
        // Non-fatal — tools might already exist
      }

      try {
        const saved = await saveUserVm({
          email, vmId: vm.vm_id, tier: vm.tier,
          sshPort: vm.ssh_port, webPort: vm.web_port,
          sshCommand: "", webTerminal: vm.web_terminal,
        });
        if (saved) {
          playSuccess();
          await refresh();
        } else {
          setVmError("VM created but failed to save mapping. Check backend connection.");
          await deleteVM(vm.vm_id).catch(() => {});
          playError();
        }
      } catch (saveErr) {
        setVmError(`VM created but save failed: ${saveErr}`);
        await deleteVM(vm.vm_id).catch(() => {});
        playError();
      }
    } catch (err) {
      setVmError(String(err));
      playError();
    }
    setCreating(false);
  };

  const handleDelete = async () => {
    if (!myVm) return;
    playClick();
    setVmError(null);
    try {
      await deleteVM(myVm.vmId);
      await deleteUserVm(email);
      playSuccess();
      setMyVm(null); setLiveVm(null); setAuthState("unknown");
      await refresh();
    } catch (err) {
      setVmError(`Delete failed: ${err}`);
      playError();
    }
  };

  // ── SYNC AUTH: Keychain → exec → VM ──
  const handleSyncAuth = async () => {
    if (!myVm) return;
    playClick();
    setAuthState("syncing");
    setAuthError(null);

    try {
      // Step 1: Read token from macOS Keychain via Rust
      const { invoke } = await import("@tauri-apps/api/core");
      const keychainResult = await invoke<string>("read_keychain_token");

      if (!keychainResult) {
        setAuthError("No Claude token in Keychain. Run 'claude auth login' on your Mac first.");
        setAuthState("error");
        playError();
        return;
      }

      // Step 2: Base64 encode the token to avoid shell escaping issues
      const b64 = btoa(keychainResult);

      // Step 3: Write token to VM via exec — two calls to keep commands simple
      const writeCmd = `TOKEN=$(echo '${b64}' | base64 -d) && mkdir -p ~/.ssh && echo "CLAUDE_CODE_OAUTH_TOKEN=$TOKEN" > ~/.ssh/environment && sed -i '/CLAUDE_CODE_OAUTH_TOKEN/d' ~/.bashrc 2>/dev/null && echo "export CLAUDE_CODE_OAUTH_TOKEN=$TOKEN" >> ~/.bashrc`;

      await execInVm(myVm.vmId, writeCmd);

      // Step 4: Verify — separate exec so env is loaded fresh
      const verifyCmd = `export CLAUDE_CODE_OAUTH_TOKEN=$(cat ~/.ssh/environment | cut -d= -f2-) && claude auth status`;
      const result = await execInVm(myVm.vmId, verifyCmd);

      if (result.stdout.includes('"loggedIn": true') || result.stdout.includes('"loggedIn":true')) {
        setAuthState("authed");
        playSuccess();
      } else {
        setAuthError(`Token written but verification failed. Try CHECK button.`);
        setAuthState("not_authed");
        playError();
      }
    } catch (err) {
      setAuthError(String(err));
      setAuthState("error");
      playError();
    }
  };

  // ── CHECK AUTH via exec ──
  const handleCheckAuth = async () => {
    if (!myVm) return;
    playClick();
    setAuthState("syncing");
    try {
      const result = await execInVm(myVm.vmId, "claude auth status");
      if (result.stdout.includes('"loggedIn": true')) {
        setAuthState("authed");
        playSuccess();
      } else {
        setAuthState("not_authed");
      }
    } catch {
      setAuthState("not_authed");
    }
  };

  // ── SLACK ALERT CRON ──
  const handleSetupSlack = async () => {
    if (!myVm || !slackWebhook.trim()) return;
    playClick();

    // Ensure cron is installed on VM
    await execInVm(myVm.vmId, "which crontab >/dev/null 2>&1 || (apt-get update -qq && apt-get install -y -qq cron >/dev/null 2>&1 && service cron start 2>/dev/null; echo OK)");

    const webhook = slackWebhook.trim();

    // Save webhook to MongoDB
    await updateSlackWebhook(email, webhook);

    // Set SLACK_WEBHOOK_URL env var in VM + install cron
    const setupScript = [
      // Set env var persistently
      `sed -i '/SLACK_WEBHOOK_URL/d' ~/.bashrc 2>/dev/null`,
      `echo "export SLACK_WEBHOOK_URL='${webhook}'" >> ~/.bashrc`,
      `sed -i '/SLACK_WEBHOOK_URL/d' ~/.ssh/environment 2>/dev/null`,
      `mkdir -p ~/.ssh`,
      `echo "SLACK_WEBHOOK_URL=${webhook}" >> ~/.ssh/environment`,
      // Install token expiry cron
      `cat > /root/check-token-expiry.sh << 'CRONEOF'`,
      `#!/bin/bash`,
      `WEBHOOK=\${SLACK_WEBHOOK_URL:-""}`,
      `[ -z "$WEBHOOK" ] && source ~/.bashrc 2>/dev/null && WEBHOOK=$SLACK_WEBHOOK_URL`,
      `[ -z "$WEBHOOK" ] && exit 0`,
      `STATUS=$(claude auth status 2>/dev/null)`,
      `LOGGED_IN=$(echo "$STATUS" | python3 -c "import sys,json; print(json.loads(sys.stdin.read()).get('loggedIn',False))" 2>/dev/null)`,
      `if [ "$LOGGED_IN" = "False" ]; then`,
      `  curl -s -X POST "$WEBHOOK" -H 'Content-Type: application/json' \\`,
      `    -d '{"text":"⚠️ Cthulu Lab — Claude token expiring soon\\nVM: port ${myVm.webPort}\\nLogin manually from web terminal: http://<YOUR_HOST>:${myVm.webPort}"}'`,
      `fi`,
      `CRONEOF`,
      `chmod +x /root/check-token-expiry.sh`,
      `(crontab -l 2>/dev/null | grep -v check-token-expiry; echo "*/15 * * * * /root/check-token-expiry.sh") | crontab -`,
      `echo "INSTALLED"`,
    ].join("\n");

    try {
      const result = await execInVm(myVm.vmId, setupScript);
      if (result.stdout.includes("INSTALLED")) {
        setShowSlackSetup(false);
        playSuccess();
      } else {
        playError();
      }
    } catch { playError(); }
  };

  const isOnline = health?.status === "ok";

  return (
    <div className="py-2 px-4 font-mono text-xs overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className={isOnline ? "text-[#5ddb6e]" : "text-[#f06060]"}>
            {isOnline ? "\u25cf" : "\u25cb"}
          </span>
          <span className="text-[#808080] text-sm">{"\u2500\u2500"} GATEWAY TO HEAVEN {"\u2500\u2500"}</span>
        </div>
        <div className="flex items-center gap-2 text-[10px]">
          {health && <span className="text-[#555]">{health.active_vms}/{health.max_vms} VMs</span>}
          <button onClick={refresh} className="text-[#4de8e0] hover:text-[#7ffff8]">[REFRESH]</button>
        </div>
      </div>

      {email && (
        <div className="text-[10px] text-[#555] mb-3">
          logged in as <span className="text-[#4de8e0]">{email}</span>
        </div>
      )}

      {loading ? (
        <div className="text-[#555] animate-pulse">loading...</div>
      ) : myVm ? (
        <div className="border border-[#333] p-2 bg-[#0a0a0a] glow-active">
          {/* VM info */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-[#4de8e0] text-sm font-bold">VM-{myVm.vmId}</span>
              <span className="text-[8px] px-1 border border-[#333] text-[#808080]">{myVm.tier}</span>
              {liveVm ? (
                <span className="text-[#5ddb6e] text-[10px]">{"\u25cf"} running</span>
              ) : (
                <span className="text-[#f06060] text-[10px]">{"\u25cb"} offline</span>
              )}
            </div>
            <button onClick={handleDelete} className="px-2 py-0.5 text-[10px] text-[#f06060] border border-[#333] hover:bg-[#f06060]/10">
              DELETE VM
            </button>
          </div>

          <div className="text-[10px] text-[#555] mt-1">
            port: {myVm.sshPort} · web: {myVm.webPort}
          </div>

          {liveVm && (
            <>
              {/* Action buttons — compact inline */}
              <div className="mt-2 flex gap-1 flex-wrap">
                <button
                  onClick={() => { playClick(); setShowTerminal(!showTerminal); }}
                  className={`px-2 py-0.5 border text-[10px] glow-hover glow-click ${
                    showTerminal ? "border-[#5ddb6e] text-[#5ddb6e]" : "border-[#4de8e0] text-[#4de8e0] hover:bg-[#4de8e0]/10"
                  }`}
                >
                  {showTerminal ? "HIDE TERM" : "TERMINAL"}
                </button>
                {authState === "authed" ? (
                  <button onClick={handleSyncAuth} className="px-2 py-0.5 border border-[#5ddb6e] text-[#5ddb6e] hover:bg-[#5ddb6e]/10 text-[10px] glow-green" title="Click to re-sync">
                    {"\u2713"} CLAUDE AUTHED
                  </button>
                ) : authState === "syncing" ? (
                  <span className="px-2 py-0.5 border border-[#e8d44d] text-[#e8d44d] text-[10px] glow-yellow animate-pulse">
                    SYNCING...
                  </span>
                ) : (
                  <button onClick={handleSyncAuth} className="px-2 py-0.5 border border-[#a78bfa] text-[#a78bfa] hover:bg-[#a78bfa]/10 text-[10px] glow-hover glow-click">
                    SYNC AUTH
                  </button>
                )}
                <button onClick={handleCheckAuth} className="px-2 py-0.5 border border-[#333] text-[#808080] hover:text-[#4de8e0] text-[10px] glow-hover">
                  CHECK
                </button>
              </div>

              {authError && (
                <div className="mt-1 text-[10px] text-[#f06060]">{authError}</div>
              )}

              {/* Slack alert setup */}
              <div className="mt-2">
                <button
                  onClick={() => { playClick(); setShowSlackSetup(!showSlackSetup); }}
                  className="text-[10px] text-[#808080] hover:text-[#e8d44d]"
                >
                  [{showSlackSetup ? "HIDE" : "SETUP SLACK ALERT"}]
                </button>
                {showSlackSetup && (
                  <div className="mt-1">
                    <div className="flex gap-1">
                      <input
                        value={slackWebhook}
                        onChange={(e) => setSlackWebhook(e.target.value)}
                        placeholder="https://hooks.slack.com/services/..."
                        className="flex-1 bg-[#0a0a0a] border border-[#333] px-2 py-1 text-[10px] text-[#e0e0e0] outline-none focus:border-[#e8d44d]"
                      />
                      <button onClick={handleSetupSlack} className="px-2 py-1 text-[10px] border border-[#e8d44d] text-[#e8d44d] hover:bg-[#e8d44d]/10">
                        INSTALL
                      </button>
                    </div>
                    <div className="text-[9px] text-[#555] mt-0.5">
                      sets SLACK_WEBHOOK_URL in VM · used as default for all workflows
                    </div>
                  </div>
                )}
              </div>

              {/* Embedded terminal */}
              {showTerminal && (() => {
                const termUrl = resolveTerminalUrl(myVm!);
                return termUrl ? (
                  <div className="mt-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-[#555]">
                        run <span className="text-[#4de8e0]">claude auth status</span> to verify
                      </span>
                      <button
                        onClick={async () => {
                          const { open } = await import("@tauri-apps/plugin-shell");
                          await open(termUrl);
                        }}
                        className="text-[10px] text-[#4de8e0] hover:text-[#7ffff8]"
                      >
                        [OPEN IN BROWSER]
                      </button>
                    </div>
                    <iframe
                      src={termUrl}
                      className="w-full border border-[#333] bg-black"
                      style={{ height: "300px" }}
                      title="VM Terminal"
                    />
                  </div>
                ) : (
                  <div className="mt-2 text-[#f06060] text-[10px]">
                    Terminal URL unavailable. Set Gateway URL in Settings.
                  </div>
                );
              })()}
            </>
          )}
        </div>
      ) : (
        <div className="border border-[#333] p-3 bg-[#0a0a0a]">
          <div className="text-[#808080] text-xs mb-3">
            You don't have a VM yet. Create one to get a sandboxed environment.
          </div>
          <div className="text-[#555] text-[10px] mb-3">
            Each user gets one VM. Choose your tier:
          </div>
          <div className="flex items-center gap-2">
            <select value={tier} onChange={(e) => setTier(e.target.value)} className="flex-1 bg-[#111] border border-[#333] text-[#808080] px-2 py-1.5 text-xs outline-none">
              <option value="nano">nano — 1 vCPU, 512 MB RAM</option>
              <option value="micro">micro — 2 vCPU, 1 GB RAM</option>
            </select>
            <button onClick={handleCreate} disabled={creating || !isOnline} className="px-2 py-0.5 border border-[#5ddb6e] text-[#5ddb6e] hover:bg-[#5ddb6e]/10 disabled:opacity-30 text-[10px] glow-hover">
              {creating ? "CREATING..." : "CREATE MY VM"}
            </button>
          </div>
          {!isOnline && (
            <div className="text-[#f06060] text-[10px] mt-2">
              Gateway offline. Set your VM Gateway URL in Settings &gt; Connection first.
            </div>
          )}
          {vmError && (
            <div className="text-[#f06060] text-[10px] mt-2 border border-[#f06060]/30 px-2 py-1 break-all">
              {vmError}
            </div>
          )}
        </div>
      )}

      {/* Workflows */}
      {myVm && liveVm && (
        <div className="mt-4 border border-[#333] bg-[#0a0a0a]" style={{ height: "600px" }}>
          <WorkflowWorkspace email={email} globalWebhook={slackWebhook} vmId={myVm.vmId} />
        </div>
      )}
    </div>
  );
}
