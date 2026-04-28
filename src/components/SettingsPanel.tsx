import { useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { ipc } from "../lib/ipc";
import { playClick, playSuccess } from "../lib/sounds";
import { getConfig, setConfig } from "../lib/config";

type ConnStatus = "idle" | "testing" | "connected" | "failed";

export function SettingsPanel() {
  const settingsOpen = useAppStore((s) => s.settingsOpen);
  const setSettingsOpen = useAppStore((s) => s.setSettingsOpen);
  const speedMode = useAppStore((s) => s.speedMode);
  const setSpeedMode = useAppStore((s) => s.setSpeedMode);
  const autoApprove = useAppStore((s) => s.autoApprove);
  const setAutoApprove = useAppStore((s) => s.setAutoApprove);
  const voiceEnabled = useAppStore((s) => s.voiceEnabled);
  const setVoiceEnabled = useAppStore((s) => s.setVoiceEnabled);
  const budgetCap = useAppStore((s) => s.budgetCap);
  const setBudgetCap = useAppStore((s) => s.setBudgetCap);

  const [budgetInput, setBudgetInput] = useState(String(budgetCap));
  const config = getConfig();
  const [apiUrl, setApiUrl] = useState(config.apiUrl);
  const [gatewayUrl, setGatewayUrl] = useState(config.gatewayUrl);
  const [apiStatus, setApiStatus] = useState<ConnStatus>("idle");
  const [gwStatus, setGwStatus] = useState<ConnStatus>("idle");
  const [apiError, setApiError] = useState("");
  const [gwError, setGwError] = useState("");
  const [apiInfo, setApiInfo] = useState("");
  const [gwInfo, setGwInfo] = useState("");

  if (!settingsOpen) return null;

  const toggleSpeed = () => {
    const next = speedMode === "fast" ? "thorough" : "fast";
    setSpeedMode(next);
    ipc.setSpeedMode(next).catch(console.error);
  };

  const toggleAutoApprove = () => {
    const next = !autoApprove;
    setAutoApprove(next);
    ipc.setAutoApprove(next).catch(console.error);
  };

  const toggleVoice = () => {
    const next = !voiceEnabled;
    setVoiceEnabled(next);
    ipc.toggleVoice().catch(console.error);
  };

  const handleBudgetChange = (val: string) => {
    setBudgetInput(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0) {
      setBudgetCap(num);
      ipc.setBudgetCap(num).catch(console.error);
      playSuccess();
    }
  };

  const testAndSaveApi = async () => {
    const url = apiUrl.trim();
    if (!url) { setApiError("URL required"); return; }
    setApiStatus("testing");
    setApiError("");
    setApiInfo("");
    playClick();
    try {
      const result = await ipc.testApiConnection(url);
      setApiStatus("connected");
      setApiInfo(result);
      setConfig({ apiUrl: url });
      playSuccess();
    } catch (err) {
      setApiStatus("failed");
      setApiError(String(err));
    }
  };

  const testAndSaveGateway = async () => {
    const url = gatewayUrl.trim();
    if (!url) {
      setGwStatus("idle");
      setConfig({ gatewayUrl: "" });
      playClick();
      return;
    }
    setGwStatus("testing");
    setGwError("");
    setGwInfo("");
    playClick();
    try {
      const result = await ipc.testGatewayConnection(url);
      setGwStatus("connected");
      setGwInfo(result);
      setConfig({ gatewayUrl: url });
      playSuccess();
    } catch (err) {
      setGwStatus("failed");
      setGwError(String(err));
    }
  };

  const statusIcon = (s: ConnStatus) => {
    switch (s) {
      case "testing": return <span className="text-[#e8d44d] animate-pulse">[ ... ]</span>;
      case "connected": return <span className="text-[#5ddb6e]">[CONNECTED]</span>;
      case "failed": return <span className="text-[#f06060]">[FAILED]</span>;
      default: return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60"
        onClick={() => setSettingsOpen(false)}
      />
      <div className="relative z-10 w-[420px] bg-black border border-[#333] font-mono text-xs">
        <div className="flex items-center justify-between px-3 py-2 border-b border-[#333]">
          <span className="text-[#808080]">── SETTINGS ──</span>
          <button
            onClick={() => setSettingsOpen(false)}
            className="text-[#808080] hover:text-[#e0e0e0]"
          >
            [x]
          </button>
        </div>

        <div className="p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[#808080]">Speed Mode</span>
            <button
              onClick={() => { playClick(); toggleSpeed(); }}
              className={`${speedMode === "fast" ? "text-[#5ddb6e] glow-green" : "text-[#e8d44d]"} hover:text-[#e0e0e0]`}
            >
              [{speedMode === "fast" ? "FAST" : "DEEP"}]
            </button>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[#808080]">Auto-Approve</span>
            <button
              onClick={() => { playClick(); toggleAutoApprove(); }}
              className={`${autoApprove ? "text-[#5ddb6e] glow-green" : "text-[#e05252]"} hover:text-[#e0e0e0]`}
            >
              [{autoApprove ? "ON" : "OFF"}]
            </button>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[#808080]">Budget Cap (USD)</span>
            <input
              type="number"
              min="0.1"
              step="0.5"
              value={budgetInput}
              onChange={(e) => handleBudgetChange(e.target.value)}
              className="w-20 bg-black border border-[#333] text-[#e0e0e0] text-right px-1 py-0.5 font-mono text-xs focus:outline-none focus:border-[#5ddb6e]"
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[#808080]">Voice / Sound</span>
            <button
              onClick={() => { playClick(); toggleVoice(); }}
              className={`${voiceEnabled ? "text-[#5ddb6e] glow-green" : "text-[#e05252]"} hover:text-[#e0e0e0]`}
            >
              [{voiceEnabled ? "ON" : "OFF"}]
            </button>
          </div>

          {/* CONNECTION */}
          <div className="border-t border-[#333] pt-3 mt-3">
            <div className="text-[#808080] mb-2">── CONNECTION ──</div>

            <div className="mb-3">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[#555] text-[10px]">Backend API URL</span>
                {statusIcon(apiStatus)}
              </div>
              <div className="flex gap-1">
                <input
                  type="text"
                  value={apiUrl}
                  onChange={(e) => { setApiUrl(e.target.value); setApiStatus("idle"); setApiError(""); setApiInfo(""); }}
                  placeholder="http://localhost:3001/api"
                  className="flex-1 bg-black border border-[#333] text-[#e0e0e0] px-2 py-1 font-mono text-[10px] focus:outline-none focus:border-[#4de8e0]"
                />
                <button
                  onClick={testAndSaveApi}
                  disabled={apiStatus === "testing"}
                  className="px-2 py-1 border border-[#333] text-[10px] text-[#4de8e0] hover:border-[#4de8e0]/50 disabled:opacity-40"
                >
                  TEST
                </button>
              </div>
              {apiError && <div className="text-[#f06060] text-[10px] mt-0.5">{apiError}</div>}
              {apiInfo && <div className="text-[#5ddb6e] text-[10px] mt-0.5">{apiInfo}</div>}
            </div>

            <div className="mb-2">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[#555] text-[10px]">VM Gateway URL</span>
                {statusIcon(gwStatus)}
              </div>
              <div className="flex gap-1">
                <input
                  type="text"
                  value={gatewayUrl}
                  onChange={(e) => { setGatewayUrl(e.target.value); setGwStatus("idle"); setGwError(""); setGwInfo(""); }}
                  placeholder="http://localhost:8080"
                  className="flex-1 bg-black border border-[#333] text-[#e0e0e0] px-2 py-1 font-mono text-[10px] focus:outline-none focus:border-[#4de8e0]"
                />
                <button
                  onClick={testAndSaveGateway}
                  disabled={gwStatus === "testing"}
                  className="px-2 py-1 border border-[#333] text-[10px] text-[#4de8e0] hover:border-[#4de8e0]/50 disabled:opacity-40"
                >
                  TEST
                </button>
              </div>
              {gwError && <div className="text-[#f06060] text-[10px] mt-0.5">{gwError}</div>}
              {gwInfo && <div className="text-[#5ddb6e] text-[10px] mt-0.5">{gwInfo}</div>}
            </div>

            <div className="text-[#333] text-[10px] mt-1">
              saved after successful connection test
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
