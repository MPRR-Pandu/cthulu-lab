import { useAppStore } from "../store/useAppStore";
import { getColor } from "../lib/colors";
import { ipc } from "../lib/ipc";
import { playSwitch } from "../lib/sounds";

export function SessionsPanel() {
  const agents = useAppStore((s) => s.agents);
  const sessions = useAppStore((s) => s.sessions);
  const activeAgentId = useAppStore((s) => s.activeAgentId);
  const setActiveAgent = useAppStore((s) => s.setActiveAgent);
  const sendingAgents = useAppStore((s) => s.sendingAgents);

  const activeSessions = agents.filter((a) => {
    const msgs = sessions[a.id];
    return msgs && msgs.length > 0;
  });

  const handleClick = (agentId: string) => {
    setActiveAgent(agentId);
    ipc.switchAgent(agentId);
    playSwitch();
  };

  if (activeSessions.length === 0) {
    return (
      <div className="px-2 py-2 text-[#444]">
        no active sessions
      </div>
    );
  }

  return (
    <div className="py-1">
      {activeSessions.map((agent) => {
        const colors = getColor(agent.color);
        const msgs = sessions[agent.id] ?? [];
        const lastMsg = msgs[msgs.length - 1];
        const isActive = activeAgentId === agent.id;
        const isBusy = sendingAgents[agent.id] ?? false;
        const msgCount = msgs.length;
        const preview = lastMsg
          ? lastMsg.content.slice(0, 35) + (lastMsg.content.length > 35 ? "..." : "")
          : "";

        return (
          <button
            key={agent.id}
            onClick={() => handleClick(agent.id)}
            className={`w-full text-left px-2 py-1 hover:bg-[#1a1a1a] ${
              isActive ? "bg-[#111] border-l-2 border-[#4de8e0] glow-border-left" : ""
            }`}
          >
            <div className="flex items-center gap-1">
              <span className={colors.text}>{agent.display_name || agent.id}</span>
              {isBusy && <span className="text-[#5ddb6e] animate-pulse glow-green">●</span>}
              <span className="ml-auto text-[#555]">{msgCount}</span>
            </div>
            {preview && (
              <div className="text-[#555] text-[10px] truncate mt-px">
                {lastMsg?.role === "User" ? "you: " : `${agent.id}: `}{preview}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
