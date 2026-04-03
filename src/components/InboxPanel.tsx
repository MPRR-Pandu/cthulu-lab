import { useEffect, useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { inboxIpc } from "../lib/inboxIpc";
import { ipc } from "../lib/ipc";
import { invoke } from "@tauri-apps/api/core";
import { playClick } from "../lib/sounds";
import type { InboxMessage } from "../types/inbox";
import { getAllScheduledResponses } from "../lib/scheduledApi";

const TYPE_COLORS: Record<string, string> = {
  Delegation: "text-[#4de8e0]",
  Report: "text-[#5ddb6e]",
  Question: "text-[#e8d44d]",
  Alert: "text-[#f06060]",
};

function formatTime(timestamp: string): string {
  const d = new Date(timestamp);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

function PermissionRow({ msg }: { msg: InboxMessage }) {
  const addActivity = useAppStore((s) => s.addActivity);

  const handleApprove = async () => {
    await inboxIpc.markRead(msg.id);
    addActivity({ agent: msg.from, event: `approved: ${msg.content.slice(0, 30)}` });
    const updated = await inboxIpc.getInbox();
    useAppStore.getState().setInboxMessages(updated);
  };

  const handleDeny = async () => {
    await inboxIpc.markRead(msg.id);
    addActivity({ agent: msg.from, event: `denied: ${msg.content.slice(0, 30)}` });
    const updated = await inboxIpc.getInbox();
    useAppStore.getState().setInboxMessages(updated);
  };

  return (
    <div className="px-2 py-1 bg-[#1a1a00] border-l-2 border-[#e8d44d]">
      <div className="text-[#e8d44d] text-[10px]">
        [{formatTime(msg.timestamp)}] {msg.from} asks:
      </div>
      <div className="text-[#e0e0e0] mt-0.5 text-[11px]">{msg.content}</div>
      <div className="flex gap-2 mt-1">
        <button
          onClick={handleApprove}
          className="text-[#5ddb6e] hover:text-[#7fff7f] text-[10px] font-bold"
        >
          [YES]
        </button>
        <button
          onClick={handleDeny}
          className="text-[#f06060] hover:text-[#ff8080] text-[10px] font-bold"
        >
          [NO]
        </button>
        <button
          onClick={handleApprove}
          className="text-[#808080] hover:text-[#5ddb6e] text-[10px]"
        >
          [ALWAYS]
        </button>
      </div>
    </div>
  );
}

function ResponseViewer({ inboxMsg, onClose }: { inboxMsg: InboxMessage; onClose: () => void }) {
  const sessions = useAppStore((s) => s.sessions);
  const agents = useAppStore((s) => s.agents);
  const setActiveAgent = useAppStore((s) => s.setActiveAgent);
  const setSessionMessages = useAppStore((s) => s.setSessionMessages);
  const [backendLoaded, setBackendLoaded] = useState(false);

  const bgSessions = useAppStore((s) => s.bgSessions);

  const agentId = inboxMsg.message_type === "Report" ? inboxMsg.from : inboxMsg.to;
  const agent = agents.find((a) => a.id === agentId);
  // Check both foreground and background sessions
  const fgMsgs = sessions[agentId] ?? [];
  const bgMsgs = bgSessions[agentId] ?? [];
  const msgs = [...fgMsgs, ...bgMsgs];

  // If frontend store is empty for this agent, fetch from Rust backend
  useEffect(() => {
    if (msgs.length === 0 && !backendLoaded) {
      ipc.getChatHistory(agentId).then((history) => {
        if (history.length > 0) {
          setSessionMessages(agentId, history);
        }
        setBackendLoaded(true);
      }).catch(() => setBackendLoaded(true));
    }
  }, [agentId, msgs.length, backendLoaded, setSessionMessages]);

  let matchedAgent: typeof msgs[0] | undefined;
  let matchedUser: typeof msgs[0] | undefined;

  // Primary: match by ref_message_id (exact lookup)
  if (inboxMsg.ref_message_id) {
    matchedAgent = msgs.find((m) => m.id === inboxMsg.ref_message_id);
  }

  // Fallback: match by content preview
  if (!matchedAgent && inboxMsg.content) {
    const preview = inboxMsg.content.replace(/\.\.\.$/,"");
    matchedAgent = [...msgs].reverse().find(
      (m) => m.role === "Agent" && m.content.includes(preview)
    );
  }

  useEffect(() => {
    if (backendLoaded && !matchedAgent && agentId) {
      getAllScheduledResponses().then((responses) => {
        const preview = inboxMsg.content.replace(/\.\.\.$/,"");
        const match = responses.find((r) => r.agentId === agentId && r.response.includes(preview));
        if (match) {
          setSessionMessages(agentId, [
            { id: "bg-user", role: "User", content: match.task, timestamp: match.timestamp, agent_id: agentId, is_streaming: false },
            { id: "bg-agent", role: "Agent", content: match.response, timestamp: match.timestamp, agent_id: agentId, is_streaming: false },
          ]);
        }
      });
    }
  }, [backendLoaded, agentId, matchedAgent, inboxMsg.content, setSessionMessages]);

  // Last fallback: latest agent message
  if (!matchedAgent) {
    matchedAgent = [...msgs].reverse().find((m) => m.role === "Agent" && m.content.length > 0);
  }

  // Find the user message right before the matched agent response
  if (matchedAgent) {
    const idx = msgs.indexOf(matchedAgent);
    for (let i = idx - 1; i >= 0; i--) {
      if (msgs[i].role === "User") {
        matchedUser = msgs[i];
        break;
      }
    }
  }

  const handleGoToChat = () => {
    setActiveAgent(agentId);
    ipc.switchAgent(agentId);
    playClick();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div
        className="bg-black border border-[#333] w-[600px] max-h-[500px] flex flex-col font-mono text-xs glow-active"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-3 py-2 border-b border-[#333]">
          <span className="text-[#4de8e0] text-glow">
            ── {agent?.display_name || agentId} response ──
          </span>
          <div className="flex gap-2">
            <button
              onClick={handleGoToChat}
              className="text-[10px] text-[#4de8e0] hover:text-[#7ffff8] glow-hover px-1 border border-[#333]"
            >
              OPEN CHAT
            </button>
            <button
              onClick={onClose}
              className="text-[#808080] hover:text-[#e0e0e0]"
            >
              [x]
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {matchedUser && (
            <div className="mb-3">
              <div className="text-[#808080] text-[10px] mb-0.5">you:</div>
              <div className="text-[#e0e0e0] bg-[#0a0a0a] border border-[#222] p-2 whitespace-pre-wrap">
                {matchedUser.content}
              </div>
            </div>
          )}

          {matchedAgent && (
            <div>
              <div className="text-[#4de8e0] text-[10px] mb-0.5">{agentId}:</div>
              <div className="text-[#e0e0e0] bg-[#0a0a0a] border border-[#222] p-2 whitespace-pre-wrap max-h-[300px] overflow-y-auto">
                {matchedAgent.content || "(no response yet)"}
              </div>
            </div>
          )}

          {!matchedAgent && !matchedUser && (
            <div className="text-[#555]">
              {!backendLoaded && msgs.length === 0 ? "loading..." : "no response found for this message"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MessageRow({ msg, onViewResponse }: { msg: InboxMessage; onViewResponse: (msg: InboxMessage) => void }) {
  const handleClick = async () => {
    playClick();

    if (!msg.read) {
      await inboxIpc.markRead(msg.id);
      const updated = await inboxIpc.getInbox();
      useAppStore.getState().setInboxMessages(updated);
    }

    // Open popup with the matching response
    const agentId = msg.message_type === "Report" ? msg.from : msg.message_type === "Delegation" ? msg.to : null;
    if (agentId && agentId !== "user" && agentId !== "system") {
      onViewResponse(msg);
    }
  };

  const colorClass = TYPE_COLORS[msg.message_type] ?? "text-[#808080]";
  const readClass = msg.read ? "text-[#555555]" : "text-[#e0e0e0]";

  if (msg.message_type === "Alert") {
    return (
      <div
        className={`px-2 py-0.5 cursor-pointer hover:bg-[#1a1a1a] ${readClass}`}
        onClick={handleClick}
      >
        <span className="text-[#808080]">[{formatTime(msg.timestamp)}] </span>
        <span className="text-[#f06060]">⚠ </span>
        <span>{msg.content.length > 40 ? msg.content.slice(0, 40) + "..." : msg.content}</span>
      </div>
    );
  }

  const truncated = msg.content.length > 30 ? msg.content.slice(0, 30) + "..." : msg.content;
  const isReport = msg.message_type === "Report";

  return (
    <div
      className={`px-2 py-0.5 cursor-pointer hover:bg-[#1a1a1a] ${readClass}`}
      onClick={handleClick}
      title={isReport ? `Click to view full response` : undefined}
    >
      <span className="text-[#808080]">[{formatTime(msg.timestamp)}] </span>
      <span className={colorClass}>{msg.from}</span>
      <span className="text-[#808080]">→</span>
      <span className={colorClass}>{msg.to}</span>
      <span className="text-[#808080]"> {truncated}</span>
      {isReport && <span className="text-[#4de8e0] ml-1">⤴</span>}
    </div>
  );
}

export function InboxPanel() {
  const inboxMessages = useAppStore((s) => s.inboxMessages);
  const setInboxMessages = useAppStore((s) => s.setInboxMessages);
  const autoApprove = useAppStore((s) => s.autoApprove);
  const setAutoApprove = useAppStore((s) => s.setAutoApprove);
  const [viewingMsg, setViewingMsg] = useState<InboxMessage | null>(null);

  useEffect(() => {
    inboxIpc.getInbox().then(setInboxMessages).catch(console.error);
    const interval = setInterval(() => {
      inboxIpc.getInbox().then(setInboxMessages).catch(console.error);
    }, 5000);
    return () => clearInterval(interval);
  }, [setInboxMessages]);

  const toggleAutoApprove = async () => {
    const next = !autoApprove;
    setAutoApprove(next);
    try {
      await invoke("set_auto_approve", { enabled: next });
    } catch {}
  };

  const unreadCount = inboxMessages.filter((m) => !m.read).length;
  const recent = inboxMessages.slice(-25).reverse();

  // Separate permission requests (unread Questions) from regular messages
  const permissionRequests = recent.filter((m) => m.message_type === "Question" && !m.read);
  const otherMessages = recent.filter((m) => m.message_type !== "Question" || m.read);

  return (
    <div className="py-1">
      {/* Header with auto-approve toggle */}
      <div className="px-2 mb-1 flex items-center justify-between">
        <span className="text-[#808080]">
          ── INBOX {unreadCount > 0 ? `(${unreadCount})` : ""} ──
        </span>
        <button
          onClick={toggleAutoApprove}
          className={`text-[10px] ${autoApprove ? "text-[#5ddb6e]" : "text-[#808080]"} hover:text-[#e0e0e0]`}
          title={autoApprove ? "Auto-approving all permissions" : "Manual approval mode"}
        >
          [{autoApprove ? "AUTO ✓" : "MANUAL"}]
        </button>
      </div>

      {/* Permission requests at top — highlighted */}
      {permissionRequests.length > 0 && (
        <div className="mb-1">
          {permissionRequests.map((msg) => (
            <PermissionRow key={msg.id} msg={msg} />
          ))}
        </div>
      )}

      {/* Regular messages */}
      {recent.length === 0 ? (
        <div className="px-2 text-[#444444]">no messages</div>
      ) : (
        otherMessages.map((msg) => <MessageRow key={msg.id} msg={msg} onViewResponse={setViewingMsg} />)
      )}

      {viewingMsg && (
        <ResponseViewer inboxMsg={viewingMsg} onClose={() => setViewingMsg(null)} />
      )}
    </div>
  );
}
