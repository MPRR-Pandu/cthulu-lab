import { useEffect, useRef } from "react";
import { useAppStore } from "../store/useAppStore";

const TOOL_COLORS: Record<string, string> = {
  Read: "text-[#4de8e0]",
  Edit: "text-[#e8d44d]",
  Write: "text-[#5ddb6e]",
  Bash: "text-[#e88c4d]",
  Grep: "text-[#b48eed]",
  Glob: "text-[#b48eed]",
  WebSearch: "text-[#5dadec]",
  WebFetch: "text-[#5dadec]",
};

function getToolColor(tool: string): string {
  return TOOL_COLORS[tool] ?? "text-[#4de8e0]";
}

export function AgentActivityLog() {
  const activeAgentId = useAppStore((s) => s.activeAgentId);
  const toolActivity = useAppStore((s) => s.toolActivity);
  const bottomRef = useRef<HTMLDivElement>(null);

  const entries = activeAgentId ? toolActivity[activeAgentId] ?? [] : [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries.length]);

  if (entries.length === 0) return null;

  return (
    <div className="border-t border-[#333333] bg-[#050505] max-h-[120px] overflow-y-auto px-3 py-1 font-mono text-[10px]">
      {entries.map((entry, i) => (
        <div key={i} className="flex gap-2 leading-4">
          <span className="text-[#555555] shrink-0">{entry.time}</span>
          <span className={`${getToolColor(entry.tool)} shrink-0 font-bold`}>{entry.tool}</span>
          <span className="text-[#808080] truncate">{entry.input}</span>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
