import { useEffect, useRef, useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { getColor } from "../lib/colors";
import { getSprite } from "../lib/sprites";
import { MessageBubble } from "./MessageBubble";

const THINKING_FRAMES = [
  "thinking",
  "thinking.",
  "thinking..",
  "thinking...",
];

const THINKING_DETAILS = [
  "spawning claude CLI...",
  "reading workspace...",
  "loading agent context...",
  "processing request...",
  "generating response...",
  "exploring codebase...",
  "analyzing files...",
  "writing code...",
];

function ThinkingIndicator({ agentId }: { agentId: string }) {
  const [frame, setFrame] = useState(0);
  const [detailIdx, setDetailIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const agents = useAppStore((s) => s.agents);
  const debugMessages = useAppStore((s) => s.debugMessages);
  const agent = agents.find((a) => a.id === agentId);
  const colors = agent ? getColor(agent.color) : getColor("blue");
  const debugMsg = debugMessages[agentId];

  useEffect(() => {
    const dotInterval = setInterval(() => setFrame((f) => (f + 1) % THINKING_FRAMES.length), 500);
    const detailInterval = setInterval(() => setDetailIdx((d) => (d + 1) % THINKING_DETAILS.length), 3000);
    const timerInterval = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => {
      clearInterval(dotInterval);
      clearInterval(detailInterval);
      clearInterval(timerInterval);
    };
  }, []);

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

  return (
    <div className="py-2 font-mono text-xs">
      <div className={`${colors.text} font-bold mb-1`}>{agent?.display_name || agentId}:</div>
      <div className="pl-2">
        <div className={`${colors.text}`}>
          <span className="cursor-blink">▊</span> {THINKING_FRAMES[frame]}
        </div>
        <div className="text-[#555555] mt-0.5">
          ├─ {debugMsg || THINKING_DETAILS[detailIdx]}
        </div>
        <div className="text-[#333333] mt-0.5">
          └─ elapsed: {timeStr}
        </div>
      </div>
    </div>
  );
}

export function ChatArea() {
  const activeAgentId = useAppStore((s) => s.activeAgentId);
  const sessions = useAppStore((s) => s.sessions);
  const agents = useAppStore((s) => s.agents);
  const sendingAgents = useAppStore((s) => s.sendingAgents);
  const bottomRef = useRef<HTMLDivElement>(null);

  const messages = activeAgentId ? sessions[activeAgentId] ?? [] : [];
  const activeAgent = agents.find((a) => a.id === activeAgentId);
  const colors = activeAgent ? getColor(activeAgent.color) : getColor("blue");
  const isThinking = activeAgentId ? sendingAgents[activeAgentId] ?? false : false;

  // Check if last message is streaming with no content yet (waiting for first chunk)
  const lastMsg = messages[messages.length - 1];
  const isWaitingForFirstChunk = lastMsg?.is_streaming && lastMsg.content === "";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  if (!activeAgent) {
    return (
      <div className="flex-1 flex items-center justify-center text-[#808080] font-mono text-xs">
        select an agent
      </div>
    );
  }

  if (messages.length === 0 && !isThinking) {
    const sprite = getSprite(activeAgent.species);
    return (
      <div className="flex-1 flex flex-col items-center justify-center font-mono text-xs">
        <pre className={`${colors.text} text-xs leading-tight mb-2`}>
          {sprite.join("\n")}
        </pre>
        <div className={`${colors.text} font-bold`}>{activeAgent.id}</div>
        <div className="text-[#808080] mt-1">{activeAgent.catchphrase}</div>
        <div className="text-[#333333] mt-3">type a message below</div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-3 py-2 font-mono text-xs">
      {messages.map((msg, i) => {
        const prevMsg = i > 0 ? messages[i - 1] : null;
        const showAgentName =
          msg.role !== "User" && (!prevMsg || prevMsg.role === "User");

        return (
          <MessageBubble
            key={msg.id}
            message={msg}
            showAgentName={showAgentName}
          />
        );
      })}

      {/* Show thinking indicator when waiting for response */}
      {isThinking && isWaitingForFirstChunk && activeAgentId && (
        <ThinkingIndicator agentId={activeAgentId} />
      )}

      <div ref={bottomRef} />
    </div>
  );
}
