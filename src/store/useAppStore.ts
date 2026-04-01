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
}));
