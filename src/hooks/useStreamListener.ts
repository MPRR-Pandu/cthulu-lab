import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { onChatStream } from "../lib/ipc";
import { useAppStore } from "../store/useAppStore";
import type { InboxMessage } from "../types/inbox";
import type { PermissionRequest } from "../types/chat";
import { playReceive, playAlert, playProgress } from "../lib/sounds";

interface AgentStuckPayload {
  agent_id: string;
  failure_count: number;
  message: string;
}

/**
 * Parse lead agent response for TASK lines and auto-populate mission + queue.
 * Looks for patterns like:
 *   TASK 1: Build login UI
 *     → Agent: builder
 *   or
 *   TASK 1: [description]
 *     → Assign: [agent]
 */
function parseTasks(content: string): { title: string; agent: string }[] {
  const tasks: { title: string; agent: string }[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Match "TASK N: description" or "N. description"
    const taskMatch = line.match(/^(?:TASK\s+\d+[:.]\s*|(\d+)\.\s+)(.+)/i);
    if (!taskMatch) continue;

    const title = (taskMatch[2] || "").trim();
    if (!title) continue;

    // Look ahead for agent assignment in next 3 lines
    let agent = "builder"; // default
    for (let j = 1; j <= 3 && i + j < lines.length; j++) {
      const nextLine = lines[i + j].trim();
      const agentMatch = nextLine.match(/(?:→\s*(?:Agent|Assign)[:\s]*|assigned?\s*(?:to)?[:\s]*)(\w+)/i);
      if (agentMatch) {
        agent = agentMatch[1].toLowerCase();
        break;
      }
    }

    tasks.push({ title, agent });
  }

  return tasks;
}

export function useStreamListener() {
  const appendToStreaming = useAppStore((s) => s.appendToStreaming);
  const finalizeMessage = useAppStore((s) => s.finalizeMessage);
  const setSendingAgent = useAppStore((s) => s.setSendingAgent);
  const setAgentStatus = useAppStore((s) => s.setAgentStatus);
  const setOrchStatus = useAppStore((s) => s.setOrchStatus);
  const addInboxMessage = useAppStore((s) => s.addInboxMessage);
  const addActivity = useAppStore((s) => s.addActivity);
  const setDebugMessage = useAppStore((s) => s.setDebugMessage);
  const setPermissionRequest = useAppStore((s) => s.setPermissionRequest);

  useEffect(() => {
    const unlisten = onChatStream((chunk) => {
      if (chunk.done) {
        finalizeMessage(chunk.agent_id, chunk.message_id);
        setSendingAgent(chunk.agent_id, false);
        setAgentStatus(chunk.agent_id, "idle");
        setOrchStatus("idle");
        addActivity({ agent: chunk.agent_id, event: "responded" });
        setPermissionRequest(chunk.agent_id, null);
        playReceive();

        // Auto-populate mission + queue from lead agent response
        if (chunk.agent_id === "lead") {
          const sessions = useAppStore.getState().sessions;
          const leadMessages = sessions.lead ?? [];
          const lastMsg = leadMessages[leadMessages.length - 1];
          if (lastMsg && lastMsg.role === "Agent" && lastMsg.content) {
            const tasks = parseTasks(lastMsg.content);
            if (tasks.length > 0) {
              // Extract mission name from user's request to lead
              const userMsg = leadMessages.find((m) => m.role === "User");
              const missionName = userMsg
                ? userMsg.content.slice(0, 40) + (userMsg.content.length > 40 ? "..." : "")
                : "Sprint";

              // Set mission
              useAppStore.getState().setMission({
                name: missionName,
                total: tasks.length,
                done: 0,
              });

              // Set queue
              useAppStore.getState().setQueue(
                tasks.map((t, i) => ({
                  id: `task-${Date.now()}-${i}`,
                  title: t.title,
                  agent: t.agent,
                }))
              );

              addActivity({ agent: "lead", event: `created ${tasks.length} tasks` });
              playProgress();
            }
          }
        }
      } else {
        appendToStreaming(chunk.agent_id, chunk.message_id, chunk.chunk);
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [appendToStreaming, finalizeMessage, setSendingAgent, setAgentStatus, setOrchStatus]);

  // Listen for permission-request events from CLI tool_use
  useEffect(() => {
    const unlisten = listen<PermissionRequest>("permission-request", (event) => {
      const payload = event.payload;
      setPermissionRequest(payload.agent_id, {
        tool_name: payload.tool_name,
        tool_input: payload.tool_input,
      });
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [setPermissionRequest]);

  // Listen for agent-stuck loop detection events
  useEffect(() => {
    const unlisten = listen<AgentStuckPayload>("agent-stuck", (event) => {
      const payload = event.payload;
      const alertMsg: InboxMessage = {
        id: crypto.randomUUID(),
        from: "system",
        to: "user",
        message_type: "Alert",
        content: payload.message,
        timestamp: new Date().toISOString(),
        read: false,
      };
      addInboxMessage(alertMsg);
      addActivity({ agent: payload.agent_id, event: `stuck after ${payload.failure_count} failures` });
      setSendingAgent(payload.agent_id, false);
      playAlert();
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [addInboxMessage, addActivity, setSendingAgent]);

  // Listen for debug messages from CLI stderr
  useEffect(() => {
    const unlisten = listen<{ agent_id: string; message: string }>("agent-debug", (event) => {
      setDebugMessage(event.payload.agent_id, event.payload.message);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [setDebugMessage]);
}
