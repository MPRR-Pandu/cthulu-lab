import { useAppStore } from "../store/useAppStore";
import { AgentCard } from "./AgentCard";
import { InboxPanel } from "./InboxPanel";
import { LogoMascot } from "./LogoMascot";
import { WorkspacePicker } from "./WorkspacePicker";

export function Sidebar() {
  const agents = useAppStore((s) => s.agents);

  return (
    <div className="w-56 shrink-0 border-r border-[#333333] flex flex-col font-mono text-xs overflow-y-auto">
      <LogoMascot />

      <div className="border-b border-[#333333]">
        <WorkspacePicker />
      </div>

      <div className="px-2 py-1 border-b border-[#333333]">
        <span className="text-[#808080]">── AGENTS ──</span>
      </div>

      <div className="py-1">
        {agents.map((agent) => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
      </div>

      <div className="border-t border-[#333333] flex-1 overflow-y-auto min-h-[200px]">
        <InboxPanel />
      </div>
    </div>
  );
}
