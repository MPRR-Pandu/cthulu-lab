import { bench, describe } from "vitest";

/**
 * Micro-benchmarks isolating specific bottlenecks found in store.bench.ts
 */

// ─── Date formatting: the addActivity bottleneck ──────────

describe("Date formatting (addActivity / addToolActivity bottleneck)", () => {
  bench("toLocaleTimeString — current impl", () => {
    new Date().toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    });
  });

  bench("toLocaleTimeString with seconds — addToolActivity impl", () => {
    new Date().toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  });

  bench("manual HH:MM format — proposed fix", () => {
    const d = new Date();
    const h = d.getHours();
    const m = d.getMinutes();
    `${h < 10 ? "0" : ""}${h}:${m < 10 ? "0" : ""}${m}`;
  });

  bench("manual HH:MM:SS format — proposed fix", () => {
    const d = new Date();
    const h = d.getHours();
    const m = d.getMinutes();
    const s = d.getSeconds();
    `${h < 10 ? "0" : ""}${h}:${m < 10 ? "0" : ""}${m}:${s < 10 ? "0" : ""}${s}`;
  });

  bench("Date.now() only — baseline", () => {
    Date.now();
  });
});

// ─── Array update strategies (appendToStreaming / addMessage) ──

describe("Array update strategies — 500 messages", () => {
  const msgs = Array.from({ length: 500 }, (_, i) => ({
    id: `msg-${i}`,
    content: `content-${i}`,
    streaming: i === 499,
  }));

  bench("map() to find + clone one — current impl", () => {
    msgs.map((m) =>
      m.id === "msg-499" ? { ...m, content: m.content + "x" } : m
    );
  });

  bench("findIndex + slice + spread — proposed fix", () => {
    const idx = msgs.findIndex((m) => m.id === "msg-499");
    if (idx !== -1) {
      const updated = [...msgs];
      updated[idx] = { ...msgs[idx], content: msgs[idx].content + "x" };
    }
  });

  bench("slice concat — proposed addMessage fix", () => {
    const newMsg = { id: "new", content: "hi", streaming: false };
    msgs.concat(newMsg);
  });

  bench("spread — current addMessage impl", () => {
    const newMsg = { id: "new", content: "hi", streaming: false };
    [...msgs, newMsg];
  });
});

// ─── localStorage serialization ───────────────────────────

describe("localStorage serialization", () => {
  const small = Array.from({ length: 10 }, (_, i) => ({
    id: `task-${i}`,
    task: "check health",
    agent: "planner",
    intervalMs: 60000,
    active: true,
    lastRun: null,
  }));

  const large = Array.from({ length: 100 }, (_, i) => ({
    id: `task-${i}`,
    task: `task ${i} with some longer description text here`,
    agent: "planner",
    intervalMs: 60000,
    active: true,
    lastRun: "2026-01-01T00:00:00.000Z",
  }));

  bench("JSON.stringify — 10 items", () => {
    JSON.stringify(small);
  });

  bench("JSON.stringify — 100 items", () => {
    JSON.stringify(large);
  });

  bench("localStorage.setItem — 10 items", () => {
    localStorage.setItem("bench-test", JSON.stringify(small));
  });

  bench("localStorage.setItem — 100 items", () => {
    localStorage.setItem("bench-test", JSON.stringify(large));
  });
});

// ─── crypto.randomUUID ────────────────────────────────────

describe("UUID generation", () => {
  bench("crypto.randomUUID()", () => {
    crypto.randomUUID();
  });

  bench("Math.random hex — fast alternative", () => {
    Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  });
});

// ─── Set copy vs mutate ───────────────────────────────────

describe("Set operations — 1000 entries", () => {
  const s = new Set(Array.from({ length: 1000 }, (_, i) => `msg-${i}`));

  bench("new Set(existing) + add — current impl", () => {
    const next = new Set(s);
    next.add("msg-new");
  });

  bench("Set.has() check only — if we skip copy", () => {
    s.has("msg-new");
  });
});

// ─── Object spread with many keys ─────────────────────────

describe("Object spread — sessions with 10 agents", () => {
  const sessions: Record<string, unknown[]> = {};
  for (let i = 0; i < 10; i++) {
    sessions[`agent-${i}`] = Array.from({ length: 100 }, (_, j) => ({ id: j }));
  }

  bench("spread all sessions to update one agent", () => {
    ({ ...sessions, "agent-5": [...sessions["agent-5"], { id: 999 }] });
  });
});
