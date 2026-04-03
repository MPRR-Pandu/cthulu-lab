import { useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { getColor } from "../lib/colors";
import { getScheduledResponses } from "../lib/scheduledApi";
import type { ScheduledResponse } from "../lib/scheduledApi";

const INTERVALS: { label: string; ms: number }[] = [
  { label: "30s", ms: 30 * 1000 },
  { label: "1m", ms: 60 * 1000 },
  { label: "2m", ms: 2 * 60 * 1000 },
  { label: "5m", ms: 5 * 60 * 1000 },
  { label: "10m", ms: 10 * 60 * 1000 },
  { label: "15m", ms: 15 * 60 * 1000 },
  { label: "30m", ms: 30 * 60 * 1000 },
  { label: "1h", ms: 60 * 60 * 1000 },
  { label: "2h", ms: 2 * 60 * 60 * 1000 },
  { label: "4h", ms: 4 * 60 * 60 * 1000 },
  { label: "8h", ms: 8 * 60 * 60 * 1000 },
  { label: "12h", ms: 12 * 60 * 60 * 1000 },
  { label: "24h", ms: 24 * 60 * 60 * 1000 },
];

function formatInterval(ms: number): string {
  const match = INTERVALS.find((i) => i.ms === ms);
  if (match) return match.label;
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  return `${Math.round(ms / 60000)}m`;
}

function formatTime(timestamp: string | null): string {
  if (!timestamp) return "never";
  const d = new Date(timestamp);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function SchedulerPanel() {
  const agents = useAppStore((s) => s.agents);
  const scheduledTasks = useAppStore((s) => s.scheduledTasks);
  const addScheduledTask = useAppStore((s) => s.addScheduledTask);
  const removeScheduledTask = useAppStore((s) => s.removeScheduledTask);
  const toggleScheduledTask = useAppStore((s) => s.toggleScheduledTask);

  const [task, setTask] = useState("");
  const [intervalMs, setIntervalMs] = useState(INTERVALS[0].ms);
  const [agentId, setAgentId] = useState(agents[0]?.id ?? "");
  const [viewingTaskId, setViewingTaskId] = useState<string | null>(null);
  const [taskResponses, setTaskResponses] = useState<ScheduledResponse[]>([]);

  const handleView = async (taskId: string) => {
    if (viewingTaskId === taskId) {
      setViewingTaskId(null);
      return;
    }
    const responses = await getScheduledResponses(taskId);
    setTaskResponses(responses);
    setViewingTaskId(taskId);
  };

  const handleAdd = () => {
    if (!task.trim() || !agentId) return;
    addScheduledTask(task.trim(), agentId, intervalMs);
    setTask("");
  };

  return (
    <div className="px-2 py-1 font-mono text-[10px]">
      <div className="text-[#808080]">-- SCHEDULER ({scheduledTasks.length}) --</div>
      <div className="mt-0.5 flex gap-1">
        <input
          value={task}
          onChange={(e) => setTask(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="task..."
          className="flex-1 bg-[#111111] border border-[#333333] text-[#e0e0e0] px-1 py-0.5 text-[10px] outline-none focus:border-[#4de8e0] min-w-0"
        />
        <select
          value={intervalMs}
          onChange={(e) => setIntervalMs(Number(e.target.value))}
          className="bg-[#111111] border border-[#333333] text-[#808080] px-0.5 text-[10px] outline-none"
        >
          {INTERVALS.map((i) => (
            <option key={i.ms} value={i.ms}>
              {i.label}
            </option>
          ))}
        </select>
        <select
          value={agentId}
          onChange={(e) => setAgentId(e.target.value)}
          className="bg-[#111111] border border-[#333333] text-[#808080] px-0.5 text-[10px] outline-none"
        >
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.id}
            </option>
          ))}
        </select>
        <button
          onClick={handleAdd}
          className="text-[#4de8e0] hover:text-[#7ffff8] text-[10px] font-bold shrink-0"
        >
          [SCHEDULE]
        </button>
      </div>
      <div className="mt-0.5 overflow-y-auto">
        {scheduledTasks.map((t) => {
          const agent = agents.find((a) => a.id === t.agent);
          const colors = agent ? getColor(agent.color) : getColor("blue");
          return (
            <div key={t.id}>
              <div className="py-0.5 flex items-center gap-1">
                <span className={`${t.active ? "text-[#5ddb6e]" : "text-[#555555]"}`}>
                  {t.active ? ">" : "||"}
                </span>
                <span className="text-[#e0e0e0] truncate flex-1">
                  {t.task.length > 20 ? t.task.slice(0, 20) + "..." : t.task}
                </span>
                <span className={`${colors.text}`}>{t.agent}</span>
                <span className="text-[#808080]">{formatInterval(t.intervalMs)}</span>
                <span className="text-[#555555]">{formatTime(t.lastRun)}</span>
                <button
                  onClick={() => handleView(t.id)}
                  className="text-[#4de8e0] hover:text-[#7ffff8]"
                >
                  [{viewingTaskId === t.id ? "HIDE" : "VIEW"}]
                </button>
                <button
                  onClick={() => toggleScheduledTask(t.id)}
                  className="text-[#e8d44d] hover:text-[#fff06a]"
                >
                  [{t.active ? "PAUSE" : "RUN"}]
                </button>
                <button
                  onClick={() => removeScheduledTask(t.id)}
                  className="text-[#f06060] hover:text-[#ff8080]"
                >
                  [X]
                </button>
              </div>
              {viewingTaskId === t.id && (
                <div className="ml-4 mt-0.5 border-l-2 border-[#333] pl-2">
                  {taskResponses.length === 0 ? (
                    <div className="text-[#555] text-[10px]">no responses yet</div>
                  ) : (
                    taskResponses.map((r) => (
                      <div key={r.id} className="py-0.5 text-[10px]">
                        <span className="text-[#555]">[{new Date(r.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}]</span>
                        <span className="text-[#e0e0e0] ml-1">{r.response.slice(0, 60)}{r.response.length > 60 ? "..." : ""}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
