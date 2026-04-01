import { useState, useRef, type KeyboardEvent, type DragEvent } from "react";
import { useAppStore } from "../store/useAppStore";
import { useChat } from "../hooks/useChat";
import { inboxIpc } from "../lib/inboxIpc";
import { playSend } from "../lib/sounds";

interface Attachment {
  name: string;
  size: number;
  type: string;
  path: string;      // local file path
  preview?: string;   // data URL for images
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function getFileIcon(type: string): string {
  if (type.startsWith("image/")) return "◫";
  if (type.includes("pdf")) return "▤";
  if (type.includes("json") || type.includes("javascript") || type.includes("typescript")) return "◇";
  if (type.includes("text") || type.includes("markdown")) return "☰";
  if (type.includes("zip") || type.includes("tar") || type.includes("gz")) return "▨";
  return "□";
}

export function InputBar() {
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeAgentId = useAppStore((s) => s.activeAgentId);
  const sendingAgents = useAppStore((s) => s.sendingAgents);
  const isSendingToActiveAgent = activeAgentId ? sendingAgents[activeAgentId] ?? false : false;
  const agents = useAppStore((s) => s.agents);
  const setAgentStatus = useAppStore((s) => s.setAgentStatus);
  const setOrchStatus = useAppStore((s) => s.setOrchStatus);
  const addHeartbeat = useAppStore((s) => s.addHeartbeat);
  const addInboxMessage = useAppStore((s) => s.addInboxMessage);
  const addActivity = useAppStore((s) => s.addActivity);
  const { sendMessage } = useChat();

  const activeAgent = agents.find((a) => a.id === activeAgentId);

  const processFiles = (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    fileArray.forEach((file) => {
      const attachment: Attachment = {
        name: file.name,
        size: file.size,
        type: file.type || "application/octet-stream",
        path: (file as any).path || file.name,
      };

      // Generate preview for images
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (e) => {
          attachment.preview = e.target?.result as string;
          setAttachments((prev) => [...prev.filter((a) => a.name !== attachment.name), attachment]);
        };
        reader.readAsDataURL(file);
      } else {
        setAttachments((prev) => [...prev, attachment]);
      }
    });
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(e.target.files);
      e.target.value = "";
    }
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const removeAttachment = (name: string) => {
    setAttachments((prev) => prev.filter((a) => a.name !== name));
  };

  const handleSend = async () => {
    if ((!input.trim() && attachments.length === 0) || isSendingToActiveAgent || !activeAgentId) return;

    // Save to history
    if (input.trim()) {
      setHistory((prev) => [...prev.slice(-49), input.trim()]);
      setHistoryIdx(-1);
    }

    // Build message with attachment references
    let fullMessage = input;
    if (attachments.length > 0) {
      const fileRefs = attachments.map((a) => `[Attached: ${a.path}]`).join("\n");
      fullMessage = fullMessage ? `${fullMessage}\n\n${fileRefs}` : fileRefs;
    }

    setInput("");
    setAttachments([]);

    playSend();

    setAgentStatus(activeAgentId, "active");
    setOrchStatus(activeAgentId);
    addHeartbeat({
      from: "user",
      to: activeAgentId,
      message: fullMessage.slice(0, 30) + (fullMessage.length > 30 ? "..." : ""),
      timestamp: new Date().toISOString(),
    });

    addActivity({ agent: "user", event: `delegated to ${activeAgentId}` });

    inboxIpc
      .sendMessage("user", activeAgentId, "Delegation", fullMessage)
      .then((inboxMsg) => addInboxMessage(inboxMsg))
      .catch(console.error);

    await sendMessage(fullMessage);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    // Arrow up — previous history
    if (e.key === "ArrowUp" && history.length > 0) {
      e.preventDefault();
      const newIdx = historyIdx === -1 ? history.length - 1 : Math.max(0, historyIdx - 1);
      setHistoryIdx(newIdx);
      setInput(history[newIdx]);
    }
    // Arrow down — next history or clear
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIdx === -1) return;
      const newIdx = historyIdx + 1;
      if (newIdx >= history.length) {
        setHistoryIdx(-1);
        setInput("");
      } else {
        setHistoryIdx(newIdx);
        setInput(history[newIdx]);
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === "file") {
        const file = items[i].getAsFile();
        if (file) files.push(file);
      }
    }
    if (files.length > 0) {
      processFiles(files);
    }
  };

  return (
    <div
      className={`border-t px-3 py-2 font-mono text-xs ${
        isDragging ? "border-[#4de8e0] bg-[#4de8e0]/5" : "border-[#333333]"
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Attachment previews */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {attachments.map((a) => (
            <div
              key={a.name}
              className="flex items-center gap-1 bg-[#1a1a1a] border border-[#333333] px-1.5 py-0.5 group"
            >
              {a.preview ? (
                <img src={a.preview} alt={a.name} className="w-4 h-4 object-cover" />
              ) : (
                <span className="text-[#808080]">{getFileIcon(a.type)}</span>
              )}
              <span className="text-[#e0e0e0] max-w-[100px] truncate">{a.name}</span>
              <span className="text-[#555555]">{formatSize(a.size)}</span>
              <button
                onClick={() => removeAttachment(a.name)}
                className="text-[#555555] hover:text-[#f06060] ml-0.5"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-start gap-2">
        <div className="flex flex-col gap-1 mt-1">
          <button
            onClick={handleFileSelect}
            className="text-[#555555] hover:text-[#4de8e0]"
            title="Attach files"
          >
            ◫
          </button>
          <span className="text-[#808080]">&gt;</span>
        </div>
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={
            activeAgent
              ? isDragging
                ? "drop files here..."
                : `message ${activeAgent.id}... (shift+enter for newline)`
              : ""
          }
          disabled={isSendingToActiveAgent || !activeAgentId}
          rows={4}
          className="flex-1 bg-[#0a0a0a] border border-[#333333] text-[#e0e0e0] placeholder-[#333333] outline-none disabled:opacity-30 resize-none p-2 focus:border-[#555555]"
        />
        {isSendingToActiveAgent && <span className="text-[#808080] cursor-blink mt-1">▊</span>}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileChange}
        accept="image/*,.pdf,.txt,.md,.json,.js,.ts,.tsx,.jsx,.py,.rs,.go,.yaml,.yml,.toml,.csv,.html,.css,.sql,.sh,.env,.log"
      />

      <div className="text-[#333333] text-[10px] mt-1 flex justify-between">
        <span>◫ attach · paste · drag & drop</span>
        <span>enter to send · shift+enter for newline</span>
      </div>
    </div>
  );
}
