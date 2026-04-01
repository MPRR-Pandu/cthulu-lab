import { useAppStore } from "../store/useAppStore";
import { ipc } from "../lib/ipc";

export function PermissionBanner() {
  const activeAgentId = useAppStore((s) => s.activeAgentId);
  const permissionRequests = useAppStore((s) => s.permissionRequests);
  const setPermissionRequest = useAppStore((s) => s.setPermissionRequest);
  const addActivity = useAppStore((s) => s.addActivity);

  const request = activeAgentId ? permissionRequests[activeAgentId] : null;

  if (!request || !activeAgentId) return null;

  const handleRespond = async (allow: boolean) => {
    try {
      await ipc.respondPermission(activeAgentId, allow);
      addActivity({
        agent: activeAgentId,
        event: allow ? `approved ${request.tool_name}` : `denied ${request.tool_name}`,
      });
      setPermissionRequest(activeAgentId, null);
    } catch (err) {
      console.error("Failed to respond to permission:", err);
    }
  };

  return (
    <div className="border-t border-[#333333] bg-[#1a1a0a] px-3 py-2 font-mono text-xs">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <span className="text-[#f0c040] font-bold">PERMISSION REQUEST</span>
          <span className="text-[#808080] ml-2">
            {activeAgentId} wants to use
          </span>
          <span className="text-[#e0e0e0] ml-1 font-bold">{request.tool_name}</span>
        </div>
        <div className="flex gap-2 ml-3">
          <button
            onClick={() => handleRespond(true)}
            className="px-3 py-1 bg-[#1a3a1a] border border-[#4de84d] text-[#4de84d] hover:bg-[#2a4a2a] font-bold"
          >
            ALLOW
          </button>
          <button
            onClick={() => handleRespond(false)}
            className="px-3 py-1 bg-[#3a1a1a] border border-[#e84d4d] text-[#e84d4d] hover:bg-[#4a2a2a] font-bold"
          >
            DENY
          </button>
        </div>
      </div>
      {request.tool_input && (
        <div className="mt-1 text-[#808080] truncate">
          {request.tool_input}
        </div>
      )}
    </div>
  );
}
