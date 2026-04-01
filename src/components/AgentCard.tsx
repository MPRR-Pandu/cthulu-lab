import type { AgentConfig } from "../types/agent";
import { getColor } from "../lib/colors";
import { useAppStore } from "../store/useAppStore";
import { ipc } from "../lib/ipc";
import { playSwitch } from "../lib/sounds";

interface Props {
  agent: AgentConfig;
}

export function AgentCard({ agent }: Props) {
  const activeAgentId = useAppStore((s) => s.activeAgentId);
  const setActiveAgent = useAppStore((s) => s.setActiveAgent);
  const agentStatuses = useAppStore((s) => s.agentStatuses);
  const isActive = activeAgentId === agent.id;
  const colors = getColor(agent.color);
  const status = agentStatuses[agent.id] ?? "idle";

  const handleClick = () => {
    setActiveAgent(agent.id);
    ipc.switchAgent(agent.id);
    playSwitch();
  };

  return (
    <button
      onClick={handleClick}
      className={`w-full text-left px-2 py-0.5 font-mono text-xs ${
        isActive ? colors.text : "text-[#808080] hover:text-[#e0e0e0]"
      }`}
    >
      <span className="inline-block w-3">{isActive ? "▸" : " "}</span>
      <span className={`inline-block w-28 truncate ${isActive ? "font-bold" : ""}`}>
        {agent.display_name || agent.id}
      </span>
      <span className={`${colors.text}`}>[{colors.letter}]</span>
      {status === "active" && (
        <span className="text-[#5ddb6e] ml-1">●</span>
      )}
    </button>
  );
}
