import { useAppStore } from "../store/useAppStore";
import { getColor } from "../lib/colors";
import { ipc } from "../lib/ipc";
import { playSwitch } from "../lib/sounds";

export function QueuePanel() {
  const queue = useAppStore((s) => s.queue);
  const agents = useAppStore((s) => s.agents);
  const setActiveAgent = useAppStore((s) => s.setActiveAgent);
  const removeFromQueue = useAppStore((s) => s.removeFromQueue);
  const bumpMissionDone = useAppStore((s) => s.bumpMissionDone);
  const addActivity = useAppStore((s) => s.addActivity);

  const handleClick = (task: { id: string; title: string; agent: string }) => {
    // Switch to the assigned agent
    const agent = agents.find((a) => a.id === task.agent);
    if (agent) {
      setActiveAgent(agent.id);
      ipc.switchAgent(agent.id);
      playSwitch();
    }
    // Remove from queue + bump mission progress
    removeFromQueue(task.id);
    bumpMissionDone();
    addActivity({ agent: task.agent, event: `picked up: ${task.title}` });
  };

  return (
    <div className="px-2 py-1 font-mono text-[10px]">
      <div className="text-[#808080]">
        ── QUEUE ({queue.length}) ──
      </div>
      <div className="mt-0.5 overflow-y-auto">
        {queue.map((task, i) => {
          const agent = agents.find((a) => a.id === task.agent);
          const colors = agent ? getColor(agent.color) : getColor("blue");
          return (
            <button
              key={task.id}
              onClick={() => handleClick(task)}
              className="w-full text-left py-0.5 hover:text-[#e0e0e0] flex items-center gap-1"
            >
              <span className="text-[#808080]">{i === 0 ? "▸" : " "}</span>
              <span className="text-[#e0e0e0] truncate flex-1">{task.title}</span>
              <span className={`${colors.text} text-[10px]`}>→{task.agent}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
