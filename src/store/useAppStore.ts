import { create } from "zustand";
import type { AgentConfig } from "../types/agent";
import type { ChatMessage } from "../types/chat";
import type { InboxMessage } from "../types/inbox";

export interface HeartbeatMessage {
  from: string;
  to: string;
  message: string;
  timestamp: string;
}

interface AppState {
  agents: AgentConfig[];
  activeAgentId: string | null;
  setAgents: (agents: AgentConfig[]) => void;
  setActiveAgent: (id: string) => void;

  sessions: Record<string, ChatMessage[]>;
  addMessage: (agentId: string, message: ChatMessage) => void;
  appendToStreaming: (agentId: string, messageId: string, chunk: string) => void;
  finalizeMessage: (agentId: string, messageId: string) => void;
  setSessionMessages: (agentId: string, messages: ChatMessage[]) => void;

  // Background sessions — scheduled task messages, hidden from main chat
  bgSessions: Record<string, ChatMessage[]>;
  addBgMessage: (agentId: string, message: ChatMessage) => void;
  appendToBgStreaming: (agentId: string, messageId: string, chunk: string) => void;
  finalizeBgMessage: (agentId: string, messageId: string) => void;

  isSending: boolean;
  setIsSending: (v: boolean) => void;
  sendingAgents: Record<string, boolean>;
  setSendingAgent: (agentId: string, v: boolean) => void;
  voiceEnabled: boolean;
  setVoiceEnabled: (v: boolean) => void;
  speedMode: "fast" | "thorough";
  setSpeedMode: (m: "fast" | "thorough") => void;

  // Heartbeat
  heartbeatMessages: HeartbeatMessage[];
  addHeartbeat: (msg: HeartbeatMessage) => void;

  // Swarm
  agentStatuses: Record<string, "idle" | "active" | "done">;
  setAgentStatus: (agentId: string, status: "idle" | "active" | "done") => void;
  repoName: string;
  orchStatus: string;
  setOrchStatus: (s: string) => void;

  // Debug
  debugMessages: Record<string, string>;
  setDebugMessage: (agentId: string, msg: string) => void;

  // Auto-approve mode
  autoApprove: boolean;
  setAutoApprove: (v: boolean) => void;

  // Budget cap
  budgetCap: number;
  setBudgetCap: (v: number) => void;

  // Settings panel
  settingsOpen: boolean;
  setSettingsOpen: (v: boolean) => void;

  // Workspace
  hasWorkspace: boolean;
  setHasWorkspace: (v: boolean) => void;

  // Inbox
  inboxMessages: InboxMessage[];
  addInboxMessage: (msg: InboxMessage) => void;
  setInboxMessages: (msgs: InboxMessage[]) => void;

  // Mission
  mission: { name: string; total: number; done: number } | null;
  setMission: (m: { name: string; total: number; done: number } | null) => void;
  bumpMissionDone: () => void;

  // Queue
  queue: { id: string; title: string; agent: string }[];
  addToQueue: (task: { id: string; title: string; agent: string }) => void;
  removeFromQueue: (id: string) => void;
  setQueue: (q: { id: string; title: string; agent: string }[]) => void;

  // Activity log
  activityLog: { time: string; agent: string; event: string }[];
  addActivity: (entry: { agent: string; event: string }) => void;

  // Permission requests
  permissionRequests: Record<string, { tool_name: string; tool_input: string }>;
  setPermissionRequest: (agentId: string, req: { tool_name: string; tool_input: string } | null) => void;

  // Tool activity log per agent
  toolActivity: Record<string, { time: string; tool: string; input: string }[]>;
  addToolActivity: (agentId: string, tool: string, input: string) => void;

  // Keyboard shortcut action bus
  shortcutAction: string | null;
  setShortcutAction: (action: string | null) => void;

  // Token/cost usage per agent
  tokenUsage: Record<string, { totalCost: number; totalInputTokens: number; totalOutputTokens: number }>;
  addTokenUsage: (agentId: string, cost: number, inputTokens: number, outputTokens: number) => void;

  // Agent memory — successful tasks saved for recall
  agentMemory: Record<string, { id: string; task: string; result: string; timestamp: string }[]>;
  addMemory: (agentId: string, task: string, result: string) => void;
  clearMemory: (agentId: string) => void;

  // Lessons learned — failures saved to avoid repeating mistakes
  lessons: { id: string; agentId: string; task: string; error: string; fix: string; timestamp: string }[];
  addLesson: (agentId: string, task: string, error: string) => void;
  resolveLesson: (lessonId: string, fix: string) => void;
  removeLesson: (lessonId: string) => void;

  // Scheduled tasks
  scheduledTasks: { id: string; task: string; agent: string; intervalMs: number; active: boolean; lastRun: string | null }[];
  addScheduledTask: (task: string, agent: string, intervalMs: number) => void;
  removeScheduledTask: (id: string) => void;
  toggleScheduledTask: (id: string) => void;
  updateLastRun: (id: string) => void;

  // Saved prompts (CRAFT skills)
  savedPrompts: { id: string; name: string; task: string; prompt: string; agent: string; createdAt: string }[];
  addSavedPrompt: (name: string, task: string, prompt: string, agent: string) => void;
  removeSavedPrompt: (id: string) => void;

  // Background message IDs — scheduled tasks that shouldn't affect UI status
  backgroundMessageIds: Set<string>;
  addBackgroundMessageId: (messageId: string) => void;

  // Maps message IDs to scheduled task IDs for persistence
  bgMessageToTaskId: Record<string, string>;
  setBgMessageTaskId: (messageId: string, taskId: string) => void;

  // Tool call counts per message for skill generation trigger
  messageToolCalls: Record<string, number>;
  setMessageToolCalls: (messageId: string, count: number) => void;

  // Skill suggestion state
  skillSuggestion: {
    agentId: string;
    messageId: string;
    task: string;
    toolCalls: number;
  } | null;
  setSkillSuggestion: (
    suggestion: {
      agentId: string;
      messageId: string;
      task: string;
      toolCalls: number;
    } | null
  ) => void;
}

export const useAppStore = create<AppState>((set) => ({
  agents: [],
  activeAgentId: null,
  sessions: {},
  isSending: false,
  voiceEnabled: false,
  heartbeatMessages: [],
  agentStatuses: {},
  repoName: "context_switching",
  orchStatus: "idle",
  autoApprove: false,
  setAutoApprove: (v) => set({ autoApprove: v }),

  budgetCap: 5.0,
  setBudgetCap: (v) => set({ budgetCap: v }),

  settingsOpen: false,
  setSettingsOpen: (v) => set({ settingsOpen: v }),

  hasWorkspace: false,
  setHasWorkspace: (v) => set({ hasWorkspace: v }),

  setAgents: (agents) =>
    set((state) => ({
      agents,
      agentStatuses: agents.reduce(
        (acc, a) => ({ ...acc, [a.id]: state.agentStatuses[a.id] ?? "idle" }),
        {} as Record<string, "idle" | "active" | "done">
      ),
    })),

  setActiveAgent: (id) => set({ activeAgentId: id }),

  addMessage: (agentId, message) =>
    set((state) => ({
      sessions: {
        ...state.sessions,
        [agentId]: [...(state.sessions[agentId] ?? []), message],
      },
    })),

  appendToStreaming: (agentId, messageId, chunk) =>
    set((state) => {
      const messages = state.sessions[agentId];
      if (!messages) return state;
      const updated = messages.map((m) =>
        m.id === messageId ? { ...m, content: m.content + chunk } : m
      );
      return { sessions: { ...state.sessions, [agentId]: updated } };
    }),

  finalizeMessage: (agentId, messageId) =>
    set((state) => {
      const messages = state.sessions[agentId];
      if (!messages) return state;
      const updated = messages.map((m) =>
        m.id === messageId ? { ...m, is_streaming: false } : m
      );
      return { sessions: { ...state.sessions, [agentId]: updated } };
    }),

  setSessionMessages: (agentId, messages) =>
    set((state) => ({
      sessions: { ...state.sessions, [agentId]: messages },
    })),

  bgSessions: {},
  addBgMessage: (agentId, message) =>
    set((state) => ({
      bgSessions: {
        ...state.bgSessions,
        [agentId]: [...(state.bgSessions[agentId] ?? []), message],
      },
    })),
  appendToBgStreaming: (agentId, messageId, chunk) =>
    set((state) => {
      const messages = state.bgSessions[agentId];
      if (!messages) return state;
      const updated = messages.map((m) =>
        m.id === messageId ? { ...m, content: m.content + chunk } : m
      );
      return { bgSessions: { ...state.bgSessions, [agentId]: updated } };
    }),
  finalizeBgMessage: (agentId, messageId) =>
    set((state) => {
      const messages = state.bgSessions[agentId];
      if (!messages) return state;
      const updated = messages.map((m) =>
        m.id === messageId ? { ...m, is_streaming: false } : m
      );
      return { bgSessions: { ...state.bgSessions, [agentId]: updated } };
    }),

  debugMessages: {},
  setDebugMessage: (agentId, msg) =>
    set((state) => ({
      debugMessages: { ...state.debugMessages, [agentId]: msg },
    })),

  setIsSending: (v) => set({ isSending: v }),
  sendingAgents: {},
  setSendingAgent: (agentId, v) =>
    set((state) => ({
      sendingAgents: { ...state.sendingAgents, [agentId]: v },
    })),
  setVoiceEnabled: (v) => set({ voiceEnabled: v }),
  speedMode: "fast",
  setSpeedMode: (m) => set({ speedMode: m }),

  addHeartbeat: (msg) =>
    set((state) => ({
      heartbeatMessages: [...state.heartbeatMessages.slice(-19), msg],
    })),

  setAgentStatus: (agentId, status) =>
    set((state) => ({
      agentStatuses: { ...state.agentStatuses, [agentId]: status },
    })),

  setOrchStatus: (s) => set({ orchStatus: s }),

  inboxMessages: [],
  addInboxMessage: (msg) =>
    set((state) => ({
      inboxMessages: [...state.inboxMessages, msg],
    })),
  setInboxMessages: (msgs) => set({ inboxMessages: msgs }),

  // Mission
  mission: null,
  setMission: (m) => set({ mission: m }),
  bumpMissionDone: () =>
    set((state) => {
      if (!state.mission) return state;
      return {
        mission: { ...state.mission, done: Math.min(state.mission.done + 1, state.mission.total) },
      };
    }),

  // Queue
  queue: [],
  addToQueue: (task) =>
    set((state) => ({
      queue: [...state.queue, task],
    })),
  removeFromQueue: (id) =>
    set((state) => ({
      queue: state.queue.filter((t) => t.id !== id),
    })),
  setQueue: (q) => set({ queue: q }),

  // Activity log
  activityLog: [],
  addActivity: (entry) =>
    set((state) => ({
      activityLog: [
        { time: new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" }), ...entry },
        ...state.activityLog,
      ].slice(0, 50),
    })),

  // Permission requests
  permissionRequests: {},
  setPermissionRequest: (agentId, req) =>
    set((state) => {
      if (req === null) {
        const { [agentId]: _, ...rest } = state.permissionRequests;
        return { permissionRequests: rest };
      }
      return { permissionRequests: { ...state.permissionRequests, [agentId]: req } };
    }),

  // Tool activity log per agent
  toolActivity: {},
  addToolActivity: (agentId, tool, input) =>
    set((state) => {
      const existing = state.toolActivity[agentId] ?? [];
      const entry = {
        time: new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        tool,
        input,
      };
      return {
        toolActivity: {
          ...state.toolActivity,
          [agentId]: [...existing, entry].slice(-100),
        },
      };
    }),

  // Keyboard shortcut action bus
  shortcutAction: null,
  setShortcutAction: (action) => set({ shortcutAction: action }),

  // Token/cost usage per agent
  tokenUsage: {},
  addTokenUsage: (agentId, cost, inputTokens, outputTokens) =>
    set((state) => {
      const existing = state.tokenUsage[agentId] ?? { totalCost: 0, totalInputTokens: 0, totalOutputTokens: 0 };
      return {
        tokenUsage: {
          ...state.tokenUsage,
          [agentId]: {
            totalCost: existing.totalCost + cost,
            totalInputTokens: existing.totalInputTokens + inputTokens,
            totalOutputTokens: existing.totalOutputTokens + outputTokens,
          },
        },
      };
    }),
  // Agent memory
  agentMemory: {},
  addMemory: (agentId, task, result) =>
    set((state) => {
      const existing = state.agentMemory[agentId] ?? [];
      const entry = {
        id: crypto.randomUUID(),
        task,
        result,
        timestamp: new Date().toISOString(),
      };
      return {
        agentMemory: {
          ...state.agentMemory,
          [agentId]: [...existing, entry].slice(-50),
        },
      };
    }),
  clearMemory: (agentId) =>
    set((state) => {
      const { [agentId]: _, ...rest } = state.agentMemory;
      return { agentMemory: rest };
    }),

  // Lessons learned from failures
  lessons: JSON.parse(localStorage.getItem("cthulu-lessons") ?? "[]"),
  addLesson: (agentId, task, error) =>
    set((state) => {
      const entry = {
        id: crypto.randomUUID(),
        agentId,
        task: task.slice(0, 200),
        error: error.slice(0, 300),
        fix: "",
        timestamp: new Date().toISOString(),
      };
      const updated = [...state.lessons, entry].slice(-100);
      localStorage.setItem("cthulu-lessons", JSON.stringify(updated));
      return { lessons: updated };
    }),
  resolveLesson: (lessonId, fix) =>
    set((state) => {
      const updated = state.lessons.map((l) =>
        l.id === lessonId ? { ...l, fix } : l
      );
      localStorage.setItem("cthulu-lessons", JSON.stringify(updated));
      return { lessons: updated };
    }),
  removeLesson: (lessonId) =>
    set((state) => {
      const updated = state.lessons.filter((l) => l.id !== lessonId);
      localStorage.setItem("cthulu-lessons", JSON.stringify(updated));
      return { lessons: updated };
    }),

  // Scheduled tasks
  scheduledTasks: JSON.parse(localStorage.getItem("cthulu-scheduled-tasks") ?? "[]"),
  addScheduledTask: (task, agent, intervalMs) =>
    set((state) => {
      const updated = [
        ...state.scheduledTasks,
        { id: crypto.randomUUID(), task, agent, intervalMs, active: true, lastRun: null },
      ];
      localStorage.setItem("cthulu-scheduled-tasks", JSON.stringify(updated));
      return { scheduledTasks: updated };
    }),
  removeScheduledTask: (id) =>
    set((state) => {
      const updated = state.scheduledTasks.filter((t) => t.id !== id);
      localStorage.setItem("cthulu-scheduled-tasks", JSON.stringify(updated));
      return { scheduledTasks: updated };
    }),
  toggleScheduledTask: (id) =>
    set((state) => {
      const updated = state.scheduledTasks.map((t) =>
        t.id === id ? { ...t, active: !t.active } : t
      );
      localStorage.setItem("cthulu-scheduled-tasks", JSON.stringify(updated));
      return { scheduledTasks: updated };
    }),
  updateLastRun: (id) =>
    set((state) => {
      const updated = state.scheduledTasks.map((t) =>
        t.id === id ? { ...t, lastRun: new Date().toISOString() } : t
      );
      localStorage.setItem("cthulu-scheduled-tasks", JSON.stringify(updated));
      return { scheduledTasks: updated };
    }),

  // Saved prompts
  savedPrompts: JSON.parse(localStorage.getItem("cthulu_saved_prompts") || "[]"),
  addSavedPrompt: (name, task, prompt, agent) =>
    set((state) => {
      const updated = [
        ...state.savedPrompts,
        { id: crypto.randomUUID(), name, task, prompt, agent, createdAt: new Date().toISOString() },
      ];
      localStorage.setItem("cthulu_saved_prompts", JSON.stringify(updated));
      return { savedPrompts: updated };
    }),
  removeSavedPrompt: (id) =>
    set((state) => {
      const updated = state.savedPrompts.filter((p) => p.id !== id);
      localStorage.setItem("cthulu_saved_prompts", JSON.stringify(updated));
      return { savedPrompts: updated };
    }),

  backgroundMessageIds: new Set<string>(),
  addBackgroundMessageId: (messageId) =>
    set((state) => {
      const next = new Set(state.backgroundMessageIds);
      next.add(messageId);
      return { backgroundMessageIds: next };
    }),

  bgMessageToTaskId: {},
  setBgMessageTaskId: (messageId, taskId) =>
    set((state) => ({
      bgMessageToTaskId: { ...state.bgMessageToTaskId, [messageId]: taskId },
    })),

  messageToolCalls: {},
  setMessageToolCalls: (messageId, count) =>
    set((state) => ({
      messageToolCalls: { ...state.messageToolCalls, [messageId]: count },
    })),

  skillSuggestion: null,
  setSkillSuggestion: (suggestion) => set({ skillSuggestion: suggestion }),
}));
