import { useEffect } from "react";
import { useAppStore } from "../store/useAppStore";
import { inboxIpc } from "../lib/inboxIpc";
import { invoke } from "@tauri-apps/api/core";
import type { InboxMessage } from "../types/inbox";

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

function MessageRow({ msg }: { msg: InboxMessage }) {
  const markRead = async () => {
    if (msg.read) return;
    await inboxIpc.markRead(msg.id);
    const updated = await inboxIpc.getInbox();
    useAppStore.getState().setInboxMessages(updated);
  };

  const colorClass = TYPE_COLORS[msg.message_type] ?? "text-[#808080]";
  const readClass = msg.read ? "text-[#555555]" : "text-[#e0e0e0]";

  if (msg.message_type === "Alert") {
    return (
      <div
        className={`px-2 py-0.5 cursor-pointer hover:bg-[#1a1a1a] ${readClass}`}
        onClick={markRead}
      >
        <span className="text-[#808080]">[{formatTime(msg.timestamp)}] </span>
        <span className="text-[#f06060]">⚠ </span>
        <span>{msg.content.length > 40 ? msg.content.slice(0, 40) + "..." : msg.content}</span>
      </div>
    );
  }

  const truncated = msg.content.length > 30 ? msg.content.slice(0, 30) + "..." : msg.content;

  return (
    <div
      className={`px-2 py-0.5 cursor-pointer hover:bg-[#1a1a1a] ${readClass}`}
      onClick={markRead}
    >
      <span className="text-[#808080]">[{formatTime(msg.timestamp)}] </span>
      <span className={colorClass}>{msg.from}</span>
      <span className="text-[#808080]">→</span>
      <span className={colorClass}>{msg.to}</span>
      <span className="text-[#808080]"> {truncated}</span>
    </div>
  );
}

export function InboxPanel() {
  const inboxMessages = useAppStore((s) => s.inboxMessages);
  const setInboxMessages = useAppStore((s) => s.setInboxMessages);
  const autoApprove = useAppStore((s) => s.autoApprove);
  const setAutoApprove = useAppStore((s) => s.setAutoApprove);

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
        otherMessages.map((msg) => <MessageRow key={msg.id} msg={msg} />)
      )}
    </div>
  );
}
