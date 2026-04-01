import { useAppStore } from "../store/useAppStore";
import { getColor } from "../lib/colors";

export function Heartbeat() {
  const heartbeatMessages = useAppStore((s) => s.heartbeatMessages);
  const agents = useAppStore((s) => s.agents);
  const agentStatuses = useAppStore((s) => s.agentStatuses);

  return (
    <div className="px-2 py-1">
      <div className="text-[#808080] text-xs mb-1">── HEARTBEAT ──</div>

      {heartbeatMessages.length === 0 && agents.length > 0 && (
        <div className="text-[#808080] text-xs italic">no activity</div>
      )}

      {heartbeatMessages.slice(-3).map((msg, i) => (
        <div key={i} className="text-xs truncate">
          <span className={getColor(agents.find((a) => a.id === msg.from)?.color ?? "blue").text}>
            {msg.from}
          </span>
          <span className="text-[#808080]"> → </span>
          <span className={getColor(agents.find((a) => a.id === msg.to)?.color ?? "green").text}>
            {msg.to}
          </span>
          <span className="text-[#808080] ml-1">"{msg.message}"</span>
        </div>
      ))}

      <div className="mt-1">
        {agents.map((a) => {
          const status = agentStatuses[a.id] ?? "idle";
          const colors = getColor(a.color);
          return (
            <div key={a.id} className="text-xs">
              <span className={status === "active" ? "text-[#f06060]" : "text-[#808080]"}>
                ♥
              </span>
              <span className={`${colors.text} ml-1 inline-block w-20`}>{a.id}</span>
              <span className="text-[#808080]">[{status}]</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
