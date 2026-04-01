import { describe, it, expect, beforeEach } from "vitest";
import { useAppStore } from "../store/useAppStore";

/**
 * Integration tests — simulate full user workflows
 */
describe("Integration: Full Workflows", () => {
  beforeEach(() => {
    useAppStore.setState({
      agents: [
        { id: "planner", name: "planner", display_name: "Rick Sanchez", description: "Architect", color: "blue", disallowed_tools: [], personality: "", voice_style: "", species: "dragon", catchphrase: "Wubba lubba" },
        { id: "builder", name: "builder", display_name: "Marty McFly", description: "Builder", color: "green", disallowed_tools: [], personality: "", voice_style: "", species: "robot", catchphrase: "Heavy" },
        { id: "fixer", name: "fixer", display_name: "Rick C-137", description: "Debugger", color: "red", disallowed_tools: [], personality: "", voice_style: "", species: "dragon", catchphrase: "Pickle" },
      ],
      activeAgentId: null,
      sessions: {},
      isSending: false,
      heartbeatMessages: [],
      agentStatuses: { planner: "idle", builder: "idle", fixer: "idle" },
      orchStatus: "idle",
      inboxMessages: [],
      mission: null,
      queue: [],
      activityLog: [],
      voiceEnabled: false,
      repoName: "test-project",
    });
  });

  it("Workflow: select agent → send message → stream → finalize", () => {
    const s = useAppStore.getState;

    // 1. Select agent
    s().setActiveAgent("planner");
    expect(s().activeAgentId).toBe("planner");

    // 2. Add user message
    s().addMessage("planner", {
      id: "u1", role: "User", content: "plan auth", timestamp: "t", agent_id: "planner", is_streaming: false,
    });

    // 3. Create agent stub
    s().addMessage("planner", {
      id: "a1", role: "Agent", content: "", timestamp: "t", agent_id: "planner", is_streaming: true,
    });

    // 4. Stream chunks
    s().setIsSending(true);
    s().setAgentStatus("planner", "active");
    s().appendToStreaming("planner", "a1", "Step 1: ");
    s().appendToStreaming("planner", "a1", "Read auth module");

    expect(s().sessions.planner[1].content).toBe("Step 1: Read auth module");
    expect(s().sessions.planner[1].is_streaming).toBe(true);

    // 5. Finalize
    s().finalizeMessage("planner", "a1");
    s().setIsSending(false);
    s().setAgentStatus("planner", "idle");

    expect(s().sessions.planner[1].is_streaming).toBe(false);
    expect(s().isSending).toBe(false);
    expect(s().agentStatuses.planner).toBe("idle");
  });

  it("Workflow: context switch preserves all chats", () => {
    const s = useAppStore.getState;

    // Chat with planner
    s().setActiveAgent("planner");
    s().addMessage("planner", { id: "p1", role: "User", content: "plan", timestamp: "t", agent_id: "planner", is_streaming: false });
    s().addMessage("planner", { id: "p2", role: "Agent", content: "here's the plan", timestamp: "t", agent_id: "planner", is_streaming: false });

    // Switch to builder
    s().setActiveAgent("builder");
    s().addMessage("builder", { id: "b1", role: "User", content: "build", timestamp: "t", agent_id: "builder", is_streaming: false });

    // Switch to fixer
    s().setActiveAgent("fixer");
    s().addMessage("fixer", { id: "f1", role: "User", content: "fix", timestamp: "t", agent_id: "fixer", is_streaming: false });

    // All sessions preserved
    expect(s().sessions.planner).toHaveLength(2);
    expect(s().sessions.builder).toHaveLength(1);
    expect(s().sessions.fixer).toHaveLength(1);

    // Switch back — data intact
    s().setActiveAgent("planner");
    expect(s().sessions.planner[1].content).toBe("here's the plan");
  });

  it("Workflow: mission progress + queue drain", () => {
    const s = useAppStore.getState;

    // Start mission
    s().setMission({ name: "Auth System", total: 3, done: 0 });

    // Add tasks to queue
    s().addToQueue({ id: "t1", title: "Build login UI", agent: "builder" });
    s().addToQueue({ id: "t2", title: "Fix token bug", agent: "fixer" });
    s().addToQueue({ id: "t3", title: "Plan API", agent: "planner" });
    expect(s().queue).toHaveLength(3);

    // Complete task 1
    s().removeFromQueue("t1");
    s().bumpMissionDone();
    expect(s().queue).toHaveLength(2);
    expect(s().mission?.done).toBe(1);

    // Complete task 2
    s().removeFromQueue("t2");
    s().bumpMissionDone();
    expect(s().mission?.done).toBe(2);

    // Complete task 3
    s().removeFromQueue("t3");
    s().bumpMissionDone();
    expect(s().queue).toHaveLength(0);
    expect(s().mission?.done).toBe(3);
  });

  it("Workflow: inbox delegation → report → activity log", () => {
    const s = useAppStore.getState;

    // User delegates
    s().addInboxMessage({
      id: "i1", from: "user", to: "planner", message_type: "Delegation",
      content: "plan the auth", timestamp: "t1", read: false,
    });
    s().addActivity({ agent: "user", event: "delegated to planner" });

    // Agent reports
    s().addInboxMessage({
      id: "i2", from: "planner", to: "user", message_type: "Report",
      content: "Plan ready: 3 steps", timestamp: "t2", read: false,
    });
    s().addActivity({ agent: "planner", event: "responded" });

    expect(s().inboxMessages).toHaveLength(2);
    expect(s().inboxMessages[0].message_type).toBe("Delegation");
    expect(s().inboxMessages[1].message_type).toBe("Report");
    expect(s().activityLog).toHaveLength(2);
    expect(s().activityLog[0].event).toBe("responded"); // newest first
  });

  it("Workflow: loop detection alert", () => {
    const s = useAppStore.getState;

    // Simulate 3 failures
    s().addInboxMessage({
      id: "alert-1", from: "system", to: "user", message_type: "Alert",
      content: "builder stuck after 3 failures. Escalating to user.", timestamp: "t", read: false,
    });
    s().addActivity({ agent: "builder", event: "stuck after 3 failures" });

    expect(s().inboxMessages[0].message_type).toBe("Alert");
    expect(s().activityLog[0].event).toContain("stuck");
  });

  it("Workflow: swarm status tracks multiple agents", () => {
    const s = useAppStore.getState;

    s().setAgentStatus("planner", "active");
    s().setAgentStatus("builder", "active");
    s().setOrchStatus("planner");

    const active = Object.values(s().agentStatuses).filter((st) => st === "active");
    expect(active).toHaveLength(2);
    expect(s().orchStatus).toBe("planner");

    // One finishes
    s().setAgentStatus("planner", "idle");
    const activeAfter = Object.values(s().agentStatuses).filter((st) => st === "active");
    expect(activeAfter).toHaveLength(1);
  });
});
