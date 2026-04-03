import { useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { ipc } from "../lib/ipc";
import { playClick, playSuccess } from "../lib/sounds";
import { getConfig, setConfig } from "../lib/config";

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
  const [configSaved, setConfigSaved] = useState(false);

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60"
        onClick={() => setSettingsOpen(false)}
      />
      <div className="relative z-10 w-[400px] bg-black border border-[#333] font-mono text-xs">
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

          <div className="border-t border-[#333] pt-3 mt-3">
            <div className="text-[#808080] mb-2">── CONNECTION ──</div>

            <div className="mb-2">
              <div className="text-[#555] text-[10px] mb-0.5">Backend API URL</div>
              <input
                type="text"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="http://localhost:4000"
                className="w-full bg-black border border-[#333] text-[#e0e0e0] px-2 py-0.5 font-mono text-[10px] focus:outline-none focus:border-[#4de8e0]"
              />
            </div>

            <div className="mb-2">
              <div className="text-[#555] text-[10px] mb-0.5">VM Gateway URL</div>
              <input
                type="text"
                value={gatewayUrl}
                onChange={(e) => setGatewayUrl(e.target.value)}
                placeholder="https://your-host:8080"
                className="w-full bg-black border border-[#333] text-[#e0e0e0] px-2 py-0.5 font-mono text-[10px] focus:outline-none focus:border-[#4de8e0]"
              />
            </div>

            <div className="flex items-center justify-between">
              <button
                onClick={() => {
                  playClick();
                  setConfig({ apiUrl: apiUrl.trim(), gatewayUrl: gatewayUrl.trim() });
                  setConfigSaved(true);
                  setTimeout(() => setConfigSaved(false), 2000);
                  playSuccess();
                }}
                className="text-[10px] text-[#4de8e0] hover:text-[#7ffff8] glow-hover"
              >
                [SAVE CONNECTION]
              </button>
              {configSaved && <span className="text-[10px] text-[#5ddb6e]">saved — restart app to apply</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
