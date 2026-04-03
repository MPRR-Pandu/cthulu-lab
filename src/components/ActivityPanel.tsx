import { useAppStore } from "../store/useAppStore";
import { getColor } from "../lib/colors";

export function ActivityPanel() {
  const activityLog = useAppStore((s) => s.activityLog);
  const agents = useAppStore((s) => s.agents);

  return (
    <div className="px-2 py-1 font-mono text-[10px]">
      <div className="text-[#808080]">── ACTIVITY ──</div>
      <div className="mt-0.5 overflow-y-auto">
        {activityLog.slice(0, 4).map((entry, i) => {
          const agent = agents.find((a) => a.id === entry.agent);
          const colors = agent ? getColor(agent.color) : getColor("blue");
          return (
            <div key={i} className="py-0.5 flex items-center gap-1 truncate">
              <span className="text-[#555555]">{entry.time}</span>
              <span className={`${colors.text}`}>{entry.agent}</span>
              <span className="text-[#808080] truncate">{entry.event}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
