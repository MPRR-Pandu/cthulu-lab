import { useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { getColor } from "../lib/colors";
import { ipc } from "../lib/ipc";
import { playSwitch, playSend, playClick } from "../lib/sounds";
import { AssignModal } from "./AssignModal";

export function WorkforcePanel() {
  const agents = useAppStore((s) => s.agents);
  const activeAgentId = useAppStore((s) => s.activeAgentId);
  const setActiveAgent = useAppStore((s) => s.setActiveAgent);
  const agentStatuses = useAppStore((s) => s.agentStatuses);
  const sendingAgents = useAppStore((s) => s.sendingAgents);
  const queue = useAppStore((s) => s.queue);
  const sessions = useAppStore((s) => s.sessions);
  const addMessage = useAppStore((s) => s.addMessage);
  const setSendingAgent = useAppStore((s) => s.setSendingAgent);

  const [assignModalAgent, setAssignModalAgent] = useState<string | null>(null);
  const [parallelMode, setParallelMode] = useState(false);
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set());
  const [dispatchModalOpen, setDispatchModalOpen] = useState(false);

  const switchTo = (agentId: string) => {
    setActiveAgent(agentId);
    ipc.switchAgent(agentId);
    playSwitch();
  };

  const handleAssign = (agentId: string) => {
    setAssignModalAgent(agentId);
  };

  const handleViewChat = (agentId: string) => {
    switchTo(agentId);
  };

  const handleInterrupt = async (agentId: string) => {
    switchTo(agentId);
  };

  const toggleAgentSelection = (agentId: string) => {
    setSelectedAgents((prev) => {
      const next = new Set(prev);
      if (next.has(agentId)) next.delete(agentId);
      else next.add(agentId);
      return next;
    });
  };

  const handleParallelDispatch = () => {
    if (selectedAgents.size === 0) return;
    setDispatchModalOpen(true);
  };

  const dispatchToAll = async (content: string) => {
    setDispatchModalOpen(false);
    playSend();
    await Promise.all(
      Array.from(selectedAgents).map(async (agentId) => {
        const userMsg = {
          id: crypto.randomUUID(),
          role: "User" as const,
          content,
          timestamp: new Date().toISOString(),
          agent_id: agentId,
          is_streaming: false,
        };
        addMessage(agentId, userMsg);
        setSendingAgent(agentId, true);
        try {
          const agentMsgId = await ipc.sendMessage(agentId, content);
          addMessage(agentId, {
            id: agentMsgId,
            role: "Agent" as const,
            content: "",
            timestamp: new Date().toISOString(),
            agent_id: agentId,
            is_streaming: true,
          });
        } catch {
          setSendingAgent(agentId, false);
        }
      })
    );
    setSelectedAgents(new Set());
    setParallelMode(false);
  };

  return (
    <div className="font-mono text-[10px]">
      <div className="px-2 py-1 text-[#808080] flex items-center justify-between">
        <span>── WORKFORCE ──</span>
        <button
          onClick={() => { setParallelMode((p) => !p); setSelectedAgents(new Set()); }}
          className={`px-1 py-px text-[9px] border ${
            parallelMode
              ? "text-[#4de8e0] border-[#4de8e0]/40 bg-[#4de8e0]/10"
              : "text-[#808080] border-[#333] hover:text-[#4de8e0] hover:border-[#4de8e0]/40"
          }`}
        >
          PARALLEL
        </button>
      </div>
      <div className="py-0.5">
        {agents.map((agent) => {
          const isActive = activeAgentId === agent.id;
          const colors = getColor(agent.color);
          const status = agentStatuses[agent.id] ?? "idle";
          const isBusy = sendingAgents[agent.id] ?? false;

          const assignedTask = queue.find((t) => t.agent === agent.id);

          const agentMessages = sessions[agent.id];
          const lastUserMsg = agentMessages
            ?.filter((m) => m.role === "User")
            .at(-1);

          const hasWork = isBusy || assignedTask || (lastUserMsg && status === "active");
          const taskLabel = isBusy && lastUserMsg
            ? lastUserMsg.content.slice(0, 35) + (lastUserMsg.content.length > 35 ? "..." : "")
            : assignedTask
              ? assignedTask.title.slice(0, 35) + (assignedTask.title.length > 35 ? "..." : "")
              : null;

          return (
            <div
              key={agent.id}
              className={`px-2 py-1 border-b border-[#1a1a1a] ${
                isActive ? "bg-[#111] glow-border-left" : ""
              } ${isBusy ? "glow-green" : ""}`}
            >
              <div className="flex items-center gap-1">
                {parallelMode ? (
                  <button
                    onClick={() => toggleAgentSelection(agent.id)}
                    className={`shrink-0 w-4 text-center ${
                      selectedAgents.has(agent.id) ? "text-[#4de8e0]" : "text-[#555]"
                    }`}
                  >
                    {selectedAgents.has(agent.id) ? "[x]" : "[ ]"}
                  </button>
                ) : (
                  <span className="shrink-0 w-2">{isActive ? "\u25B8" : " "}</span>
                )}
                <button
                  onClick={() => parallelMode ? toggleAgentSelection(agent.id) : switchTo(agent.id)}
                  className={`flex items-center gap-1 min-w-0 ${
                    isActive ? colors.text : "text-[#808080] hover:text-[#e0e0e0]"
                  }`}
                >
                  <span className={`truncate ${isActive ? "font-bold" : ""}`}>
                    {agent.display_name || agent.id}
                  </span>
                  <span className={`shrink-0 ${colors.text}`}>[{colors.letter}]</span>
                </button>

                {isBusy && (
                  <span className="shrink-0 text-[#5ddb6e] animate-pulse">●</span>
                )}
                {status === "done" && !isBusy && (
                  <span className="shrink-0 text-[#808080]">{"\u2713"}</span>
                )}

                {!parallelMode && (
                  <div className="ml-auto flex items-center gap-1 shrink-0">
                    {hasWork ? (
                      <>
                        <button
                          onClick={() => { playClick(); handleViewChat(agent.id); }}
                          className="px-1 py-px text-[9px] text-[#4de8e0] hover:bg-[#4de8e0]/10 border border-[#333] hover:border-[#4de8e0]/40 glow-hover glow-click"
                        >
                          chat
                        </button>
                        {isBusy && (
                          <button
                            onClick={() => { playClick(); handleInterrupt(agent.id); }}
                            className="px-1 py-px text-[9px] text-[#ff6b6b] hover:bg-[#ff6b6b]/10 border border-[#333] hover:border-[#ff6b6b]/40 glow-red"
                          >
                            stop
                          </button>
                        )}
                      </>
                    ) : (
                      <button
                        onClick={() => { playClick(); handleAssign(agent.id); }}
                        className="px-1 py-px text-[9px] text-[#808080] hover:text-[#e8d44d] hover:bg-[#e8d44d]/10 border border-[#333] hover:border-[#e8d44d]/40 glow-hover glow-click"
                      >
                        assign
                      </button>
                    )}
                  </div>
                )}
              </div>

              {taskLabel && (
                <div className={`ml-3 mt-px truncate ${isBusy ? "text-[#e8d44d]" : "text-[#555]"}`}>
                  {isBusy ? "⟳ " : "◇ "}{taskLabel}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {parallelMode && selectedAgents.size > 0 && (
        <div className="px-2 py-1 border-t border-[#333]">
          <button
            onClick={handleParallelDispatch}
            className="w-full py-1 border border-[#4de8e0] text-[#4de8e0] hover:bg-[#4de8e0]/10 text-[10px]"
          >
            DISPATCH TO {selectedAgents.size} AGENTS
          </button>
        </div>
      )}

      {dispatchModalOpen && (
        <DispatchModal
          count={selectedAgents.size}
          onClose={() => setDispatchModalOpen(false)}
          onDispatch={dispatchToAll}
        />
      )}

      {assignModalAgent && (
        <AssignModal
          agentId={assignModalAgent}
          agentName={agents.find((a) => a.id === assignModalAgent)?.display_name || assignModalAgent}
          onClose={() => setAssignModalAgent(null)}
          onAssign={async (content) => {
            const agentId = assignModalAgent;
            setAssignModalAgent(null);
            switchTo(agentId);
            const userMsg = {
              id: crypto.randomUUID(),
              role: "User" as const,
              content,
              timestamp: new Date().toISOString(),
              agent_id: agentId,
              is_streaming: false,
            };
            addMessage(agentId, userMsg);
            setSendingAgent(agentId, true);
            try {
              const agentMsgId = await ipc.sendMessage(agentId, content);
              addMessage(agentId, {
                id: agentMsgId,
                role: "Agent" as const,
                content: "",
                timestamp: new Date().toISOString(),
                agent_id: agentId,
                is_streaming: true,
              });
            } catch {
              setSendingAgent(agentId, false);
            }
          }}
        />
      )}
    </div>
  );
}

function DispatchModal({
  count,
  onClose,
  onDispatch,
}: {
  count: number;
  onClose: () => void;
  onDispatch: (content: string) => void;
}) {
  const [text, setText] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-[400px] bg-black border border-[#333] font-mono flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#333] text-[10px]">
          <span className="text-[#808080]">
            ── PARALLEL DISPATCH ─── <span className="text-[#4de8e0]">{count} agents</span>
          </span>
          <button onClick={onClose} className="text-[#808080] hover:text-[#e0e0e0] px-1">[x]</button>
        </div>
        <div className="px-3 py-3 space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="task to dispatch to all selected agents..."
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && text.trim()) {
                e.preventDefault();
                onDispatch(text.trim());
              }
            }}
            className="w-full h-[120px] bg-[#0a0a0a] border border-[#333] text-[#e0e0e0] font-mono text-xs px-2 py-1.5 outline-none focus:border-[#4de8e0] resize-none"
          />
          <button
            onClick={() => { if (text.trim()) onDispatch(text.trim()); }}
            disabled={!text.trim()}
            className="px-3 py-1 text-[10px] font-mono border border-[#333] text-[#4de8e0] hover:border-[#4de8e0] disabled:opacity-30 disabled:cursor-not-allowed"
          >
            dispatch
          </button>
        </div>
      </div>
    </div>
  );
}
