import type { ChatMessage } from "../types/chat";
import { getColor } from "../lib/colors";
import { useAppStore } from "../store/useAppStore";

interface Props {
  message: ChatMessage;
  showAgentName: boolean;
}

export function MessageBubble({ message, showAgentName }: Props) {
  const agents = useAppStore((s) => s.agents);
  const agent = agents.find((a) => a.id === message.agent_id);
  const colors = agent ? getColor(agent.color) : getColor("blue");
  const isUser = message.role === "User";

  if (isUser) {
    return (
      <div className="py-0.5 font-mono text-xs">
        <span className="text-[#ffffff] font-bold">You: </span>
        <span className="text-[#e0e0e0]">{message.content}</span>
      </div>
    );
  }

  return (
    <div className="py-0.5 font-mono text-xs">
      {showAgentName && agent && (
        <div className={`${colors.text} font-bold mb-0.5`}>{agent.id}:</div>
      )}
      <div className={`${colors.text} pl-2`}>
        {message.content ? (
          <span className="whitespace-pre-wrap">{message.content}</span>
        ) : message.is_streaming ? (
          <span className="text-[#808080] cursor-blink">▊</span>
        ) : null}
      </div>
    </div>
  );
}
