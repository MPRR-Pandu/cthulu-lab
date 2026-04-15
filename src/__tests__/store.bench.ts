import { bench, describe, beforeEach } from "vitest";
import { useAppStore } from "../store/useAppStore";
import type { ChatMessage } from "../types/chat";

/* ────────────────────────────────────────────────────────────
 * Benchmarks for useAppStore — the main Zustand state store
 *
 * Focus areas:
 *  1. appendToStreaming  — called per-chunk during AI streaming (hot path)
 *  2. addMessage         — called per user/agent message
 *  3. addActivity        — called on every agent event
 *  4. addToolActivity    — called on every tool invocation
 *  5. addLesson          — localStorage serialization on every call
 *  6. addScheduledTask   — localStorage serialization on every call
 *  7. addBackgroundMessageId — Set recreation on every call
 *  8. addHeartbeat       — array slice on every heartbeat
 *  9. setAgents          — reduce + spread on agent list change
 * 10. addTokenUsage      — spread nested record per agent
 * ──────────────────────────────────────────────────────────── */

const makeMsg = (id: string, streaming = false): ChatMessage => ({
  id,
  role: "Agent",
  content: "",
  timestamp: "2026-01-01",
  agent_id: "planner",
  is_streaming: streaming,
});

// ─── STREAMING: The #1 hot path ───────────────────────────

describe("appendToStreaming", () => {
  beforeEach(() => {
    // Seed 1 agent with 1 streaming message
    const msgs = [makeMsg("stream-1", true)];
    useAppStore.setState({ sessions: { planner: msgs } });
  });

  bench("1 message in session", () => {
    useAppStore.getState().appendToStreaming("planner", "stream-1", "x");
  });
});

describe("appendToStreaming — 100 messages in session", () => {
  beforeEach(() => {
    const msgs: ChatMessage[] = [];
    for (let i = 0; i < 99; i++) msgs.push(makeMsg(`msg-${i}`));
    msgs.push(makeMsg("stream-1", true));
    useAppStore.setState({ sessions: { planner: msgs } });
  });

  bench("100 messages — find + clone last", () => {
    useAppStore.getState().appendToStreaming("planner", "stream-1", "x");
  });
});

describe("appendToStreaming — 500 messages in session", () => {
  beforeEach(() => {
    const msgs: ChatMessage[] = [];
    for (let i = 0; i < 499; i++) msgs.push(makeMsg(`msg-${i}`));
    msgs.push(makeMsg("stream-1", true));
    useAppStore.setState({ sessions: { planner: msgs } });
  });

  bench("500 messages — find + clone last", () => {
    useAppStore.getState().appendToStreaming("planner", "stream-1", "x");
  });
});

describe("appendToStreaming — 1000 messages in session", () => {
  beforeEach(() => {
    const msgs: ChatMessage[] = [];
    for (let i = 0; i < 999; i++) msgs.push(makeMsg(`msg-${i}`));
    msgs.push(makeMsg("stream-1", true));
    useAppStore.setState({ sessions: { planner: msgs } });
  });

  bench("1000 messages — find + clone last", () => {
    useAppStore.getState().appendToStreaming("planner", "stream-1", "x");
  });
});

describe("appendToStreaming — 5 agents × 200 messages", () => {
  beforeEach(() => {
    const sessions: Record<string, ChatMessage[]> = {};
    for (const agent of ["a1", "a2", "a3", "a4", "a5"]) {
      const msgs: ChatMessage[] = [];
      for (let i = 0; i < 199; i++) msgs.push(makeMsg(`msg-${agent}-${i}`));
      msgs.push(makeMsg(`stream-${agent}`, true));
      sessions[agent] = msgs;
    }
    useAppStore.setState({ sessions });
  });

  bench("5 agents — spread sessions + map 200", () => {
    useAppStore.getState().appendToStreaming("a3", "stream-a3", "x");
  });
});

// ─── addMessage ───────────────────────────────────────────

describe("addMessage", () => {
  beforeEach(() => {
    useAppStore.setState({ sessions: {} });
  });

  bench("first message (empty session)", () => {
    useAppStore.getState().addMessage("planner", makeMsg("m1"));
  });
});

describe("addMessage — 500 existing messages", () => {
  beforeEach(() => {
    const msgs: ChatMessage[] = [];
    for (let i = 0; i < 500; i++) msgs.push(makeMsg(`msg-${i}`));
    useAppStore.setState({ sessions: { planner: msgs } });
  });

  bench("append to 500-message session", () => {
    useAppStore.getState().addMessage("planner", makeMsg("new"));
  });
});

// ─── addActivity ──────────────────────────────────────────

describe("addActivity", () => {
  beforeEach(() => {
    useAppStore.setState({ activityLog: [] });
  });

  bench("empty log", () => {
    useAppStore.getState().addActivity({ agent: "planner", event: "responded" });
  });
});

describe("addActivity — 50 entries (at cap)", () => {
  beforeEach(() => {
    const log = Array.from({ length: 50 }, (_, i) => ({
      time: "12:00",
      agent: "planner",
      event: `event-${i}`,
    }));
    useAppStore.setState({ activityLog: log });
  });

  bench("prepend + slice at cap", () => {
    useAppStore.getState().addActivity({ agent: "planner", event: "new" });
  });
});

// ─── addToolActivity ──────────────────────────────────────

describe("addToolActivity", () => {
  beforeEach(() => {
    useAppStore.setState({ toolActivity: {} });
  });

  bench("empty", () => {
    useAppStore.getState().addToolActivity("planner", "Read", "/src/main.rs");
  });
});

describe("addToolActivity — 100 entries (at cap)", () => {
  beforeEach(() => {
    const entries = Array.from({ length: 100 }, (_, i) => ({
      time: "12:00:00",
      tool: "Read",
      input: `/src/file-${i}.rs`,
    }));
    useAppStore.setState({ toolActivity: { planner: entries } });
  });

  bench("append + slice at 100 cap", () => {
    useAppStore.getState().addToolActivity("planner", "Read", "/src/new.rs");
  });
});

// ─── addLesson (localStorage serialization) ───────────────

describe("addLesson — localStorage on every call", () => {
  beforeEach(() => {
    useAppStore.setState({ lessons: [] });
  });

  bench("empty", () => {
    useAppStore.getState().addLesson("planner", "fix auth", "token expired");
  });
});

describe("addLesson — 100 existing lessons (at cap)", () => {
  beforeEach(() => {
    const lessons = Array.from({ length: 100 }, (_, i) => ({
      id: `l-${i}`,
      agentId: "planner",
      task: `task-${i}`,
      error: `error-${i}`,
      fix: "",
      timestamp: "2026-01-01",
    }));
    useAppStore.setState({ lessons });
  });

  bench("serialize 100 lessons to localStorage", () => {
    useAppStore.getState().addLesson("planner", "fix auth", "token expired");
  });
});

// ─── addScheduledTask (localStorage) ──────────────────────

describe("addScheduledTask — localStorage", () => {
  beforeEach(() => {
    useAppStore.setState({ scheduledTasks: [] });
  });

  bench("empty", () => {
    useAppStore.getState().addScheduledTask("check health", "planner", 60000);
  });
});

// ─── addBackgroundMessageId (Set recreation) ──────────────

describe("addBackgroundMessageId", () => {
  beforeEach(() => {
    useAppStore.setState({ backgroundMessageIds: {} });
  });

  bench("empty record", () => {
    useAppStore.getState().addBackgroundMessageId("msg-1");
  });
});

describe("addBackgroundMessageId — 500 entries", () => {
  beforeEach(() => {
    const r: Record<string, true> = {};
    for (let i = 0; i < 500; i++) r[`msg-${i}`] = true;
    useAppStore.setState({ backgroundMessageIds: r });
  });

  bench("spread 500-entry Record + add", () => {
    useAppStore.getState().addBackgroundMessageId("msg-new");
  });
});

describe("addBackgroundMessageId — 2000 entries", () => {
  beforeEach(() => {
    const r: Record<string, true> = {};
    for (let i = 0; i < 2000; i++) r[`msg-${i}`] = true;
    useAppStore.setState({ backgroundMessageIds: r });
  });

  bench("spread 2000-entry Record + add", () => {
    useAppStore.getState().addBackgroundMessageId("msg-new");
  });
});

// ─── addHeartbeat ─────────────────────────────────────────

describe("addHeartbeat", () => {
  beforeEach(() => {
    const msgs = Array.from({ length: 20 }, (_, i) => ({
      from: "user",
      to: "planner",
      message: `msg-${i}`,
      timestamp: "2026-01-01",
    }));
    useAppStore.setState({ heartbeatMessages: msgs });
  });

  bench("at 20 cap — slice + spread", () => {
    useAppStore.getState().addHeartbeat({
      from: "user",
      to: "planner",
      message: "new",
      timestamp: "2026-01-01",
    });
  });
});

// ─── addTokenUsage ────────────────────────────────────────

describe("addTokenUsage — 10 agents", () => {
  beforeEach(() => {
    const usage: Record<string, { totalCost: number; totalInputTokens: number; totalOutputTokens: number }> = {};
    for (let i = 0; i < 10; i++) {
      usage[`agent-${i}`] = { totalCost: i * 0.01, totalInputTokens: i * 1000, totalOutputTokens: i * 500 };
    }
    useAppStore.setState({ tokenUsage: usage });
  });

  bench("spread 10-agent record + update one", () => {
    useAppStore.getState().addTokenUsage("agent-5", 0.01, 500, 200);
  });
});

// ─── addMemory ────────────────────────────────────────────

describe("addMemory — 50 entries (at cap)", () => {
  beforeEach(() => {
    const memories = Array.from({ length: 50 }, (_, i) => ({
      id: `mem-${i}`,
      task: `task-${i}`,
      result: `result-${i}`,
      timestamp: "2026-01-01",
    }));
    useAppStore.setState({ agentMemory: { planner: memories } });
  });

  bench("append + slice at 50 cap", () => {
    useAppStore.getState().addMemory("planner", "new task", "new result");
  });
});
