import { useCallback } from "react";
import { ipc } from "../lib/ipc";
import { useAppStore } from "../store/useAppStore";

/**
 * Build a lessons context block from past failures for this agent.
 * Injected before the user's message so the agent sees past mistakes.
 */
function buildLessonsContext(agentId: string): string {
  const lessons = useAppStore.getState().lessons;
  const agentLessons = lessons.filter((l) => l.agentId === agentId).slice(-5);
  if (agentLessons.length === 0) return "";

  const lines = agentLessons.map((l) => {
    const status = l.fix ? `RESOLVED: ${l.fix.slice(0, 80)}` : "UNRESOLVED";
    return `- Task: "${l.task.slice(0, 60)}" → Error: ${l.error.slice(0, 80)} [${status}]`;
  });

  return `[LESSONS FROM PAST MISTAKES — avoid repeating these errors]\n${lines.join("\n")}\n[END LESSONS]\n\n`;
}

export function useChat() {
  const activeAgentId = useAppStore((s) => s.activeAgentId);
  const addMessage = useAppStore((s) => s.addMessage);
  const setSendingAgent = useAppStore((s) => s.setSendingAgent);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!activeAgentId || !content.trim()) return;

      // Show user's original message in chat (without lessons prefix)
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

      // Prepend lessons context to the actual CLI message
      const lessonsContext = buildLessonsContext(activeAgentId);
      const messageWithLessons = lessonsContext + content;

      try {
        const agentMsgId = await ipc.sendMessage(activeAgentId, messageWithLessons);
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
