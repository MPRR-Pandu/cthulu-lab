import { describe, it, expect, beforeEach } from "vitest";
import { useAppStore } from "../store/useAppStore";
import type { AgentConfig } from "../types/agent";
import type { InboxMessage } from "../types/inbox";

const mockAgent = (id: string, color = "blue"): AgentConfig => ({
  id,
  name: id,
  display_name: `Test ${id}`,
  description: `Test agent ${id}`,
  color,
  disallowed_tools: [],
  personality: "",
  voice_style: "",
  species: "blob",
  catchphrase: "test",
});

describe("AppStore", () => {
  beforeEach(() => {
    useAppStore.setState({
      agents: [],
      activeAgentId: null,
      sessions: {},
      isSending: false,
      voiceEnabled: false,
      heartbeatMessages: [],
      agentStatuses: {},
      repoName: "test-repo",
      orchStatus: "idle",
      inboxMessages: [],
      mission: null,
      queue: [],
      activityLog: [],
    });
  });

  // ─── AGENTS ───
  describe("Agents", () => {
    it("sets agents and initializes statuses", () => {
      const agents = [mockAgent("planner"), mockAgent("builder", "green")];
      useAppStore.getState().setAgents(agents);

      expect(useAppStore.getState().agents).toHaveLength(2);
      expect(useAppStore.getState().agentStatuses.planner).toBe("idle");
      expect(useAppStore.getState().agentStatuses.builder).toBe("idle");
    });

    it("sets active agent", () => {
      useAppStore.getState().setActiveAgent("planner");
      expect(useAppStore.getState().activeAgentId).toBe("planner");
    });

    it("switches active agent", () => {
      useAppStore.getState().setActiveAgent("planner");
      useAppStore.getState().setActiveAgent("builder");
      expect(useAppStore.getState().activeAgentId).toBe("builder");
    });

    it("sets agent status", () => {
      useAppStore.getState().setAgentStatus("planner", "active");
      expect(useAppStore.getState().agentStatuses.planner).toBe("active");
    });
  });

  // ─── CHAT SESSIONS ───
  describe("Chat Sessions", () => {
    it("adds message to session", () => {
      const msg = {
        id: "msg-1",
        role: "User" as const,
        content: "hello",
        timestamp: "2026-01-01",
        agent_id: "planner",
        is_streaming: false,
      };
      useAppStore.getState().addMessage("planner", msg);

      const msgs = useAppStore.getState().sessions.planner;
      expect(msgs).toHaveLength(1);
      expect(msgs[0].content).toBe("hello");
    });

    it("creates session on first message", () => {
      expect(useAppStore.getState().sessions.builder).toBeUndefined();

      useAppStore.getState().addMessage("builder", {
        id: "msg-1",
        role: "User" as const,
        content: "test",
        timestamp: "2026-01-01",
        agent_id: "builder",
        is_streaming: false,
      });

      expect(useAppStore.getState().sessions.builder).toHaveLength(1);
    });

    it("preserves sessions across agent switches", () => {
      useAppStore.getState().addMessage("planner", {
        id: "msg-1",
        role: "User" as const,
        content: "plan something",
        timestamp: "2026-01-01",
        agent_id: "planner",
        is_streaming: false,
      });

      useAppStore.getState().addMessage("builder", {
        id: "msg-2",
        role: "User" as const,
        content: "build something",
        timestamp: "2026-01-01",
        agent_id: "builder",
        is_streaming: false,
      });

      useAppStore.getState().setActiveAgent("builder");
      expect(useAppStore.getState().sessions.planner).toHaveLength(1);
      expect(useAppStore.getState().sessions.builder).toHaveLength(1);
    });

    it("appends to streaming message", () => {
      useAppStore.getState().addMessage("planner", {
        id: "stream-1",
        role: "Agent" as const,
        content: "",
        timestamp: "2026-01-01",
        agent_id: "planner",
        is_streaming: true,
      });

      useAppStore.getState().appendToStreaming("planner", "stream-1", "Hello ");
      useAppStore.getState().appendToStreaming("planner", "stream-1", "world");

      expect(useAppStore.getState().sessions.planner[0].content).toBe("Hello world");
      expect(useAppStore.getState().sessions.planner[0].is_streaming).toBe(true);
    });

    it("finalizes streaming message", () => {
      useAppStore.getState().addMessage("planner", {
        id: "stream-1",
        role: "Agent" as const,
        content: "done",
        timestamp: "2026-01-01",
        agent_id: "planner",
        is_streaming: true,
      });

      useAppStore.getState().finalizeMessage("planner", "stream-1");
      expect(useAppStore.getState().sessions.planner[0].is_streaming).toBe(false);
    });

    it("ignores append for non-existent message", () => {
      useAppStore.getState().appendToStreaming("planner", "fake-id", "data");
      expect(useAppStore.getState().sessions.planner).toBeUndefined();
    });
  });

  // ─── HEARTBEAT ───
  describe("Heartbeat", () => {
    it("adds heartbeat message", () => {
      useAppStore.getState().addHeartbeat({
        from: "user",
        to: "planner",
        message: "test task",
        timestamp: "2026-01-01",
      });

      expect(useAppStore.getState().heartbeatMessages).toHaveLength(1);
      expect(useAppStore.getState().heartbeatMessages[0].from).toBe("user");
    });

    it("caps heartbeat at 20 messages", () => {
      for (let i = 0; i < 25; i++) {
        useAppStore.getState().addHeartbeat({
          from: "user",
          to: "planner",
          message: `msg ${i}`,
          timestamp: "2026-01-01",
        });
      }

      expect(useAppStore.getState().heartbeatMessages.length).toBeLessThanOrEqual(20);
    });
  });

  // ─── SWARM ───
  describe("Swarm Control", () => {
    it("tracks orchestrator status", () => {
      useAppStore.getState().setOrchStatus("planner");
      expect(useAppStore.getState().orchStatus).toBe("planner");
    });

    it("resets to idle", () => {
      useAppStore.getState().setOrchStatus("planner");
      useAppStore.getState().setOrchStatus("idle");
      expect(useAppStore.getState().orchStatus).toBe("idle");
    });

    it("has repo name", () => {
      expect(useAppStore.getState().repoName).toBe("test-repo");
    });
  });

  // ─── INBOX ───
  describe("Inbox", () => {
    const mockInboxMsg = (type: InboxMessage["message_type"]): InboxMessage => ({
      id: "inbox-" + Math.random(),
      from: "user",
      to: "planner",
      message_type: type,
      content: "test message",
      timestamp: "2026-01-01",
      read: false,
    });

    it("adds inbox message", () => {
      useAppStore.getState().addInboxMessage(mockInboxMsg("Delegation"));
      expect(useAppStore.getState().inboxMessages).toHaveLength(1);
    });

    it("stores all message types", () => {
      useAppStore.getState().addInboxMessage(mockInboxMsg("Delegation"));
      useAppStore.getState().addInboxMessage(mockInboxMsg("Report"));
      useAppStore.getState().addInboxMessage(mockInboxMsg("Question"));
      useAppStore.getState().addInboxMessage(mockInboxMsg("Alert"));

      const types = useAppStore.getState().inboxMessages.map((m) => m.message_type);
      expect(types).toEqual(["Delegation", "Report", "Question", "Alert"]);
    });

    it("sets inbox messages (bulk)", () => {
      useAppStore.getState().setInboxMessages([
        mockInboxMsg("Delegation"),
        mockInboxMsg("Report"),
      ]);
      expect(useAppStore.getState().inboxMessages).toHaveLength(2);
    });
  });

  // ─── MISSION ───
  describe("Mission", () => {
    it("starts with no mission", () => {
      expect(useAppStore.getState().mission).toBeNull();
    });

    it("sets a mission", () => {
      useAppStore.getState().setMission({ name: "Auth System", total: 10, done: 3 });
      expect(useAppStore.getState().mission?.name).toBe("Auth System");
      expect(useAppStore.getState().mission?.done).toBe(3);
    });

    it("bumps mission progress", () => {
      useAppStore.getState().setMission({ name: "Auth", total: 5, done: 2 });
      useAppStore.getState().bumpMissionDone();
      expect(useAppStore.getState().mission?.done).toBe(3);
    });

    it("caps mission progress at total", () => {
      useAppStore.getState().setMission({ name: "Auth", total: 3, done: 3 });
      useAppStore.getState().bumpMissionDone();
      expect(useAppStore.getState().mission?.done).toBe(3);
    });

    it("clears mission", () => {
      useAppStore.getState().setMission({ name: "Auth", total: 5, done: 2 });
      useAppStore.getState().setMission(null);
      expect(useAppStore.getState().mission).toBeNull();
    });
  });

  // ─── QUEUE ───
  describe("Queue", () => {
    it("adds task to queue", () => {
      useAppStore.getState().addToQueue({ id: "t1", title: "Build login", agent: "builder" });
      expect(useAppStore.getState().queue).toHaveLength(1);
      expect(useAppStore.getState().queue[0].title).toBe("Build login");
    });

    it("removes task from queue", () => {
      useAppStore.getState().addToQueue({ id: "t1", title: "Build login", agent: "builder" });
      useAppStore.getState().addToQueue({ id: "t2", title: "Fix bug", agent: "fixer" });
      useAppStore.getState().removeFromQueue("t1");

      expect(useAppStore.getState().queue).toHaveLength(1);
      expect(useAppStore.getState().queue[0].id).toBe("t2");
    });

    it("sets queue (bulk)", () => {
      useAppStore.getState().setQueue([
        { id: "t1", title: "A", agent: "planner" },
        { id: "t2", title: "B", agent: "builder" },
        { id: "t3", title: "C", agent: "fixer" },
      ]);
      expect(useAppStore.getState().queue).toHaveLength(3);
    });
  });

  // ─── ACTIVITY LOG ───
  describe("Activity Log", () => {
    it("adds activity entry with timestamp", () => {
      useAppStore.getState().addActivity({ agent: "planner", event: "responded" });

      const log = useAppStore.getState().activityLog;
      expect(log).toHaveLength(1);
      expect(log[0].agent).toBe("planner");
      expect(log[0].event).toBe("responded");
      expect(log[0].time).toBeTruthy();
    });

    it("prepends new entries (newest first)", () => {
      useAppStore.getState().addActivity({ agent: "planner", event: "first" });
      useAppStore.getState().addActivity({ agent: "builder", event: "second" });

      const log = useAppStore.getState().activityLog;
      expect(log[0].event).toBe("second");
      expect(log[1].event).toBe("first");
    });

    it("caps at 50 entries", () => {
      for (let i = 0; i < 60; i++) {
        useAppStore.getState().addActivity({ agent: "planner", event: `event ${i}` });
      }
      expect(useAppStore.getState().activityLog.length).toBeLessThanOrEqual(50);
    });
  });

  // ─── VOICE ───
  describe("Voice", () => {
    it("toggles voice", () => {
      expect(useAppStore.getState().voiceEnabled).toBe(false);
      useAppStore.getState().setVoiceEnabled(true);
      expect(useAppStore.getState().voiceEnabled).toBe(true);
    });
  });

  // ─── SENDING STATE ───
  describe("Sending State", () => {
    it("tracks sending state", () => {
      expect(useAppStore.getState().isSending).toBe(false);
      useAppStore.getState().setIsSending(true);
      expect(useAppStore.getState().isSending).toBe(true);
    });
  });
});
