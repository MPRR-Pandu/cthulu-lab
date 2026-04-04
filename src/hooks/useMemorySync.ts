import { useEffect, useRef, useCallback } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { useAppStore } from "../store/useAppStore";
import { loadMemories, loadSessions, saveSession } from "../lib/memoryApi";
import type { ChatMessage } from "../types/chat";

const DEBOUNCE_MS = 3000;

export function useMemorySync() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const sessions = useAppStore((s) => s.sessions);
  const prevSessionsRef = useRef<Record<string, ChatMessage[]>>({});
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    if (!isAuthenticated || !user?.email) return;

    const email = user.email;

    loadMemories(email).then((memories) => {
      const store = useAppStore.getState();
      for (const [agentId, entries] of Object.entries(memories)) {
        for (const entry of entries) {
          store.addMemory(agentId, entry.task, entry.result);
        }
      }
    });

    loadSessions(email).then((sessionEntries) => {
      const store = useAppStore.getState();
      for (const entry of sessionEntries) {
        if (entry.messages.length > 0) {
          const msgs: ChatMessage[] = entry.messages.map((m) => ({
            id: m.id,
            role: m.role as "User" | "Agent",
            content: m.content,
            timestamp: m.timestamp,
            agent_id: entry.agentId,
            is_streaming: false,
          }));
          store.setSessionMessages(entry.agentId, msgs);
        }
      }
    });
  }, [isAuthenticated, user?.email]);

  const debouncedSave = useCallback(
    (agentId: string, messages: ChatMessage[]) => {
      if (!user?.email) return;

      if (debounceTimers.current[agentId]) {
        clearTimeout(debounceTimers.current[agentId]);
      }

      debounceTimers.current[agentId] = setTimeout(() => {
        const serializable = messages.map((m) => ({
          role: m.role,
          content: m.content,
          id: m.id,
          timestamp: typeof m.timestamp === "string" ? m.timestamp : new Date().toISOString(),
        }));
        saveSession(user.email, agentId, serializable);
      }, DEBOUNCE_MS);
    },
    [user?.email],
  );

  useEffect(() => {
    if (!isAuthenticated || !user?.email) return;

    for (const [agentId, msgs] of Object.entries(sessions)) {
      const prev = prevSessionsRef.current[agentId];
      if (!prev || prev.length !== msgs.length) {
        const hasStreaming = msgs.some((m) => m.is_streaming);
        if (!hasStreaming && msgs.length > 0) {
          debouncedSave(agentId, msgs);
        }
      }
    }

    prevSessionsRef.current = sessions;
  }, [sessions, isAuthenticated, user?.email, debouncedSave]);

  useEffect(() => {
    return () => {
      for (const timer of Object.values(debounceTimers.current)) {
        clearTimeout(timer);
      }
    };
  }, []);
}
