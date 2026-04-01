import { useCallback } from "react";
import { ipc } from "../lib/ipc";
import { useAppStore } from "../store/useAppStore";

export function useChat() {
  const activeAgentId = useAppStore((s) => s.activeAgentId);
  const addMessage = useAppStore((s) => s.addMessage);
  const setSendingAgent = useAppStore((s) => s.setSendingAgent);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!activeAgentId || !content.trim()) return;

      const userMsg = {
        id: crypto.randomUUID(),
        role: "User" as const,
        content,
        timestamp: new Date().toISOString(),
        agent_id: activeAgentId,
        is_streaming: false,
      };
      addMessage(activeAgentId, userMsg);
      setSendingAgent(activeAgentId, true);

      try {
        const agentMsgId = await ipc.sendMessage(activeAgentId, content);
        const agentMsg = {
          id: agentMsgId,
          role: "Agent" as const,
          content: "",
          timestamp: new Date().toISOString(),
          agent_id: activeAgentId,
          is_streaming: true,
        };
        addMessage(activeAgentId, agentMsg);
      } catch (err) {
        console.error("Failed to send:", err);
        setSendingAgent(activeAgentId, false);
      }
    },
    [activeAgentId, addMessage, setSendingAgent]
  );

  return { sendMessage };
}
