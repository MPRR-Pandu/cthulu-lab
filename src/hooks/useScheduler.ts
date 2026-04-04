import { useEffect, useRef } from "react";
import { useAppStore } from "../store/useAppStore";
import { ipc } from "../lib/ipc";

export function useScheduler() {
  const scheduledTasks = useAppStore((s) => s.scheduledTasks);
  const updateLastRun = useAppStore((s) => s.updateLastRun);
  const addActivity = useAppStore((s) => s.addActivity);
  const hasWorkspace = useAppStore((s) => s.hasWorkspace);
  const intervalsRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  useEffect(() => {
    // Don't run scheduled tasks without a workspace — prevents accidental claude spawns
    if (!hasWorkspace) {
      intervalsRef.current.forEach((interval) => clearInterval(interval));
      intervalsRef.current.clear();
      return;
    }

    const currentIds = new Set(
      scheduledTasks.filter((t) => t.active).map((t) => t.id)
    );

    intervalsRef.current.forEach((interval, id) => {
      if (!currentIds.has(id)) {
        clearInterval(interval);
        intervalsRef.current.delete(id);
      }
    });

    scheduledTasks.forEach((task) => {
      if (!task.active) {
        const existing = intervalsRef.current.get(task.id);
        if (existing) {
          clearInterval(existing);
          intervalsRef.current.delete(task.id);
        }
        return;
      }

      if (intervalsRef.current.has(task.id)) return;

      const interval = setInterval(async () => {
        const state = useAppStore.getState();
        const agent = state.agents.find((a) => a.id === task.agent);
        if (agent) {
          // Add to background sessions — NOT visible in main chat
          const userMsg = {
            id: crypto.randomUUID(),
            role: "User" as const,
            content: task.task,
            timestamp: new Date().toISOString(),
            agent_id: agent.id,
            is_streaming: false,
          };
          state.addBgMessage(agent.id, userMsg);

          try {
            const msgId = await ipc.sendMessage(agent.id, task.task);
            state.addBgMessage(agent.id, {
              id: msgId,
              role: "Agent" as const,
              content: "",
              timestamp: new Date().toISOString(),
              agent_id: agent.id,
              is_streaming: true,
            });
            state.addBackgroundMessageId(msgId);
            state.setBgMessageTaskId(msgId, task.id);
          } catch { /* silent */ }
          updateLastRun(task.id);
          addActivity({ agent: task.agent, event: `[bg] scheduled: ${task.task.slice(0, 30)}` });
        }
      }, task.intervalMs);

      intervalsRef.current.set(task.id, interval);
    });

    return () => {
      intervalsRef.current.forEach((interval) => clearInterval(interval));
      intervalsRef.current.clear();
    };
  }, [scheduledTasks, updateLastRun, addActivity, hasWorkspace]);
}
