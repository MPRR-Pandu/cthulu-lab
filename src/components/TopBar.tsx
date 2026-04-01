import { useAppStore } from "../store/useAppStore";
import { getColor } from "../lib/colors";
import { VoiceToggle } from "./VoiceToggle";
import { invoke } from "@tauri-apps/api/core";

export function TopBar() {
  const agents = useAppStore((s) => s.agents);
  const activeAgentId = useAppStore((s) => s.activeAgentId);
  const sendingAgents = useAppStore((s) => s.sendingAgents);
  const speedMode = useAppStore((s) => s.speedMode);
  const setSpeedMode = useAppStore((s) => s.setSpeedMode);

  const activeAgent = agents.find((a) => a.id === activeAgentId);

  const busyAgents = Object.entries(sendingAgents)
    .filter(([_, v]) => v)
    .map(([k]) => k);

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

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={isBusy ? "cursor-blink" : ""}>
        <span className={colors.text}>●</span>
      </span>
      <span className={`${colors.text} font-bold`}>{activeAgent.display_name || activeAgent.id}</span>
      <span className={isBusy ? "text-[#e8d44d]" : "text-[#808080]"}>
        ({isBusy ? "working..." : "idle"})
      </span>
      {busyAgents.length > 1 && (
        <>
          <span className="text-[#333333]">│</span>
          <span className="text-[#e8d44d]">{busyAgents.length} agents working</span>
        </>
      )}
      <div className="ml-auto flex items-center gap-1">
        <button
          onClick={toggleSpeed}
          className={`${speedMode === "fast" ? "text-[#5ddb6e]" : "text-[#e8d44d]"} hover:text-[#e0e0e0]`}
        >
          [{speedMode === "fast" ? "FAST" : "DEEP"}]
        </button>
        <VoiceToggle />
      </div>
    </div>
  );
}
