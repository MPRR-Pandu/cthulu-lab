import { useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { onChatStream } from "../lib/ipc";
import { useAppStore } from "../store/useAppStore";
import type { InboxMessage } from "../types/inbox";
import type { PermissionRequest } from "../types/chat";
import { playReceive, playAlert, playProgress } from "../lib/sounds";
import { saveScheduledResponse } from "../lib/scheduledApi";
import { saveMemory } from "../lib/memoryApi";
import { useAuthStore } from "../store/useAuthStore";
import { ipc } from "../lib/ipc";

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
  const addToolActivity = useAppStore((s) => s.addToolActivity);
  const addTokenUsage = useAppStore((s) => s.addTokenUsage);
  const addMemory = useAppStore((s) => s.addMemory);
  const addLesson = useAppStore((s) => s.addLesson);
  const setMessageToolCalls = useAppStore((s) => s.setMessageToolCalls);

  const bufferRef = useRef<Map<string, { agentId: string; messageId: string; text: string }>>(new Map());
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const unlisten = onChatStream((chunk) => {
      const isBackground = useAppStore.getState().backgroundMessageIds.has(chunk.message_id);

      if (chunk.done) {
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = 0;
          bufferRef.current.forEach(({ agentId, messageId, text }) => {
            if (isBackground) {
              useAppStore.getState().appendToBgStreaming(agentId, messageId, text);
            } else {
              appendToStreaming(agentId, messageId, text);
            }
          });
          bufferRef.current.clear();
        }

        if (isBackground) {
          useAppStore.getState().finalizeBgMessage(chunk.agent_id, chunk.message_id);
          addActivity({ agent: chunk.agent_id, event: "[bg] completed" });

          const bgState = useAppStore.getState();
          const scheduledTaskId = bgState.bgMessageToTaskId[chunk.message_id];
          if (scheduledTaskId) {
            const bgMsgs = bgState.bgSessions[chunk.agent_id] ?? [];
            const agentMsg = bgMsgs.find((m) => m.id === chunk.message_id);
            const userMsg = [...bgMsgs].reverse().find((m) => m.role === "User");
            if (agentMsg && agentMsg.content) {
              saveScheduledResponse(
                scheduledTaskId,
                chunk.agent_id,
                userMsg?.content ?? "",
                agentMsg.content
              );
            }
          }
        } else {
          finalizeMessage(chunk.agent_id, chunk.message_id);
          setSendingAgent(chunk.agent_id, false);
          setAgentStatus(chunk.agent_id, "idle");
          setOrchStatus("idle");
          addActivity({ agent: chunk.agent_id, event: "responded" });
          setPermissionRequest(chunk.agent_id, null);
          playReceive();
        }

        {
          const state = useAppStore.getState();
          const store = isBackground ? state.bgSessions : state.sessions;
          const msgs = store[chunk.agent_id] ?? [];
          const lastAgent = [...msgs].reverse().find((m) => m.role === "Agent");
          const lastUser = [...msgs].reverse().find((m) => m.role === "User");
          if (lastAgent && lastUser && lastAgent.content && lastAgent.content.length > 0) {
            if (lastAgent.content.includes("[Error")) {
              // Failure → save as lesson
              addLesson(
                chunk.agent_id,
                lastUser.content,
                lastAgent.content.slice(0, 300)
              );
            } else {
              // Success → save to memory
              addMemory(
                chunk.agent_id,
                lastUser.content,
                lastAgent.content.slice(0, 100)
              );

              // Persist to backend if authenticated
              if (!isBackground) {
                const email = useAuthStore.getState().user?.email;
                if (email) {
                  saveMemory(email, chunk.agent_id, lastUser.content, lastAgent.content.slice(0, 100));
                }
              }

              // Check if this success resolves a previous lesson
              const lessons = useAppStore.getState().lessons;
              const taskLower = lastUser.content.toLowerCase();
              const matchingLesson = lessons.find(
                (l) => l.agentId === chunk.agent_id && !l.fix && taskLower.includes(l.task.slice(0, 30).toLowerCase())
              );
              if (matchingLesson) {
                useAppStore.getState().resolveLesson(
                  matchingLesson.id,
                  lastAgent.content.slice(0, 200)
                );
              }
            }
          }
        }

        if (chunk.agent_id === "lead") {
          const sessions = useAppStore.getState().sessions;
          const leadMessages = sessions.lead ?? [];
          const lastMsg = leadMessages[leadMessages.length - 1];
          if (lastMsg && lastMsg.role === "Agent" && lastMsg.content) {
            const tasks = parseTasks(lastMsg.content);
            if (tasks.length > 0) {
              const userMsg = leadMessages.find((m) => m.role === "User");
              const missionName = userMsg
                ? userMsg.content.slice(0, 40) + (userMsg.content.length > 40 ? "..." : "")
                : "Sprint";

              useAppStore.getState().setMission({
                name: missionName,
                total: tasks.length,
                done: 0,
              });

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
        if (isBackground) {
          // Background: append directly to bgSessions, no rAF needed
          useAppStore.getState().appendToBgStreaming(chunk.agent_id, chunk.message_id, chunk.chunk);
        } else {
          // Foreground: buffer and debounce with rAF
          const key = `${chunk.agent_id}:${chunk.message_id}`;
          const existing = bufferRef.current.get(key);
          if (existing) {
            existing.text += chunk.chunk;
          } else {
            bufferRef.current.set(key, { agentId: chunk.agent_id, messageId: chunk.message_id, text: chunk.chunk });
          }

          if (!rafRef.current) {
            rafRef.current = requestAnimationFrame(() => {
              bufferRef.current.forEach(({ agentId, messageId, text }) => {
                appendToStreaming(agentId, messageId, text);
              });
              bufferRef.current.clear();
              rafRef.current = 0;
            });
          }
        }
      }
    });

    return () => {
      unlisten.then((fn) => fn());
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
    };
  }, [appendToStreaming, finalizeMessage, setSendingAgent, setAgentStatus, setOrchStatus, addMemory]);

  // Listen for permission-request events from CLI tool_use
  useEffect(() => {
    const unlisten = listen<PermissionRequest>("permission-request", (event) => {
      const payload = event.payload;
      setPermissionRequest(payload.agent_id, {
        tool_name: payload.tool_name,
        tool_input: payload.tool_input,
      });
      addToolActivity(payload.agent_id, payload.tool_name, payload.tool_input);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [setPermissionRequest, addToolActivity]);

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

  // Listen for chat-cost events from CLI result
  useEffect(() => {
    const unlisten = listen<{ agent_id: string; cost_usd: number; input_tokens: number; output_tokens: number }>("chat-cost", (event) => {
      const { agent_id, cost_usd, input_tokens, output_tokens } = event.payload;
      addTokenUsage(agent_id, cost_usd, input_tokens, output_tokens);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [addTokenUsage]);

  // Listen for chat-stats to detect complex tasks
  useEffect(() => {
    const unlisten = listen<{
      agent_id: string;
      message_id: string;
      tool_calls: number;
    }>("chat-stats", (event) => {
      const { agent_id, message_id, tool_calls } = event.payload;
      setMessageToolCalls(message_id, tool_calls);

      const msgs = useAppStore.getState().sessions[agent_id] ?? [];
      const userMsgs = msgs.filter((m) => m.role === "User");
      const lastUserMsg = userMsgs[userMsgs.length - 1];

      if (tool_calls >= 8 && lastUserMsg) {
        const agentMsgs = msgs.filter((m) => m.role === "Agent");
        const lastAgentMsg = agentMsgs[agentMsgs.length - 1];
        const agentResponse = lastAgentMsg?.content?.slice(0, 200) ?? "";
        const skillName = lastUserMsg.content
          .slice(0, 40)
          .replace(/[^a-zA-Z0-9 ]/g, "")
          .trim();

        ipc
          .createSkill(
            skillName,
            lastUserMsg.content.slice(0, 100),
            "When you need to: " + lastUserMsg.content.slice(0, 100),
            "1. " + agentResponse,
            "Check for common issues with this type of task",
            "Verify by running tests or checking output",
          )
          .then(() => {
            addActivity({ agent: agent_id, event: `auto-skill: ${skillName}` });
          })
          .catch((err) => {
            console.error("Failed to auto-create skill:", err);
          });
      } else if (tool_calls >= 5 && lastUserMsg) {
        useAppStore.getState().setSkillSuggestion({
          agentId: agent_id,
          messageId: message_id,
          task: lastUserMsg.content.slice(0, 100),
          toolCalls: tool_calls,
        });
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [setMessageToolCalls, addActivity]);
}
