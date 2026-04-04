import { useEffect } from "react";
import { useAppStore } from "../store/useAppStore";
import { getColor } from "../lib/colors";
import { VoiceToggle } from "./VoiceToggle";
import { invoke } from "@tauri-apps/api/core";
import { playClick } from "../lib/sounds";

function formatTokens(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

export function TopBar() {
  const agents = useAppStore((s) => s.agents);
  const activeAgentId = useAppStore((s) => s.activeAgentId);
  const sessions = useAppStore((s) => s.sessions);
  const sendingAgents = useAppStore((s) => s.sendingAgents);
  const speedMode = useAppStore((s) => s.speedMode);
  const setSpeedMode = useAppStore((s) => s.setSpeedMode);
  const tokenUsage = useAppStore((s) => s.tokenUsage);
  const shortcutAction = useAppStore((s) => s.shortcutAction);

  const activeAgent = agents.find((a) => a.id === activeAgentId);

  const busyAgents = Object.entries(sendingAgents)
    .filter(([_, v]) => v)
    .map(([k]) => k);

  const handleExport = () => {
    if (!activeAgentId) return;
    const messages = sessions[activeAgentId] ?? [];
    if (messages.length === 0) return;

    const agentName = activeAgent?.display_name || activeAgentId;
    const dateStr = new Date().toISOString().split("T")[0];
    const lines = [`# Chat: ${agentName}`, `Exported: ${new Date().toLocaleString()}`, ""];

    for (const msg of messages) {
      const role = msg.role === "User" ? "User" : agentName;
      lines.push(`## ${role}`, "", msg.content, "");
    }

    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cthulu-lab-${activeAgentId}-${dateStr}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (shortcutAction === "export-chat") {
      handleExport();
    }
  }, [shortcutAction]);

  const toggleSpeed = () => {
    const next = speedMode === "fast" ? "thorough" : "fast";
    setSpeedMode(next);
    invoke("set_speed_mode", { mode: next }).catch(console.error);
  };

  if (!activeAgent) {
    return <span className="text-[#808080] text-xs">no agent selected</span>;
  }

  const colors = getColor(activeAgent.color);
  const isBusy = sendingAgents[activeAgent.id] ?? false;
  const usage = activeAgentId ? tokenUsage[activeAgentId] : undefined;

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={isBusy ? "cursor-blink" : ""}>
        <span className={colors.text}>●</span>
      </span>
      <span className={`${colors.text} font-bold`}>{activeAgent.display_name || activeAgent.id}</span>
      <span className={isBusy ? "text-[#e8d44d]" : "text-[#808080]"}>
        ({isBusy ? "working..." : "idle"})
      </span>
      {usage && (usage.totalInputTokens > 0 || usage.totalOutputTokens > 0) && (
        <>
          <span className="text-[#333333]">│</span>
          <span className="text-[10px] text-[#555]">
            {formatTokens(usage.totalInputTokens)} in / {formatTokens(usage.totalOutputTokens)} out
          </span>
          <span className={`text-[10px] ${usage.totalCost >= 1 ? "text-[#e8d44d]" : "text-[#5ddb6e]"}`}>
            ${usage.totalCost.toFixed(2)}
          </span>
        </>
      )}
      {busyAgents.length > 1 && (
        <>
          <span className="text-[#333333]">│</span>
          <span className="text-[#e8d44d]">{busyAgents.length} agents working</span>
        </>
      )}
      <div className="ml-auto flex items-center gap-1">
        <button
          onClick={() => { playClick(); handleExport(); }}
          className="text-[#808080] hover:text-[#e0e0e0] glow-hover glow-click"
          title="Export chat (Cmd+E)"
        >
          [EXPORT<span className="text-[#333] ml-0.5">&#8984;E</span>]
        </button>
        <button
          onClick={() => { playClick(); toggleSpeed(); }}
          className={`${speedMode === "fast" ? "text-[#5ddb6e]" : "text-[#e8d44d]"} hover:text-[#e0e0e0] glow-hover glow-click`}
        >
          [{speedMode === "fast" ? "FAST" : "DEEP"}]
        </button>
        <VoiceToggle />
      </div>
    </div>
  );
}
