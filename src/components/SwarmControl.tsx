import { useAppStore } from "../store/useAppStore";

export function SwarmControl() {
  const agentStatuses = useAppStore((s) => s.agentStatuses);
  const repoName = useAppStore((s) => s.repoName);
  const orchStatus = useAppStore((s) => s.orchStatus);

  const activeCount = Object.values(agentStatuses).filter((s) => s === "active").length;
  const totalCount = Object.keys(agentStatuses).length;

  return (
    <div className="px-2 py-1 font-mono text-[10px] flex items-center gap-2 text-[#808080] flex-wrap">
      <span>
        <span className={activeCount > 0 ? "text-[#5ddb6e]" : ""}>{activeCount}/{totalCount}</span> agents
      </span>
      <span className="text-[#333333]">·</span>
      <span className="text-[#4de8e0]">{repoName}</span>
      <span className="text-[#333333]">·</span>
      <span className={orchStatus === "idle" ? "" : "text-[#e8d44d]"}>{orchStatus}</span>
      <span className="text-[#333333]">·</span>
      <span className="text-[#5ddb6e]">clean</span>
    </div>
  );
}
