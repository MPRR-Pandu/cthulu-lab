import { useState, useRef, useEffect } from "react";
import { useAppStore } from "../store/useAppStore";
import { ipc } from "../lib/ipc";
import { playSwitch, playSend, playClick, playSuccess } from "../lib/sounds";

const VERB_MAP: Record<string, string> = {
  build: "builder", create: "builder", add: "builder", implement: "builder", make: "builder",
  fix: "fixer", debug: "fixer", error: "fixer", bug: "fixer", broken: "fixer", deploy: "fixer",
  review: "reviewer", test: "reviewer", check: "reviewer", audit: "reviewer", verify: "reviewer",
  plan: "lead", spec: "lead", design: "lead", organize: "lead", break: "lead", delegate: "lead",
  analyze: "analyst", compare: "analyst", cost: "analyst", report: "analyst", research: "analyst", price: "analyst",
};

function detectAgent(text: string): string {
  const lower = text.toLowerCase();
  for (const [verb, agent] of Object.entries(VERB_MAP)) {
    if (lower.includes(verb)) return agent;
  }
  return "builder";
}

// Keyword-based concern detection — adds relevant requirements based on what the task mentions
const CONCERNS: { keywords: string[]; lines: string[] }[] = [
  { keywords: ["ui", "page", "screen", "component", "layout", "design", "attractive", "beautiful", "modern"],
    lines: ["- Modern, clean UI with smooth animations and transitions", "- Responsive layout that works across screen sizes", "- Search online for latest UI/UX trends and design patterns before starting"] },
  { keywords: ["auth", "login", "signup", "register", "oauth", "password", "session"],
    lines: ["- Secure authentication flow with proper error states", "- Handle: invalid credentials, expired tokens, network errors", "- Never store secrets in frontend code"] },
  { keywords: ["api", "endpoint", "rest", "graphql", "fetch", "request"],
    lines: ["- Input validation on every endpoint", "- Proper error responses with status codes", "- Handle loading, error, and empty states"] },
  { keywords: ["database", "db", "schema", "migration", "query", "store", "persist"],
    lines: ["- Include schema design with proper indexes", "- Write both UP and DOWN migrations", "- Handle data validation at the boundary"] },
  { keywords: ["test", "testing", "spec", "coverage"],
    lines: ["- Cover happy path, edge cases, and error cases", "- Use existing test patterns in the codebase", "- Run tests after writing to verify they pass"] },
  { keywords: ["fix", "bug", "error", "broken", "crash", "fail"],
    lines: ["- Reproduce the issue first", "- Find root cause — don't fix symptoms", "- Verify fix by rerunning the failing scenario"] },
  { keywords: ["deploy", "ci", "cd", "docker", "pipeline", "production"],
    lines: ["- Include health check endpoint", "- Pin all dependency versions", "- Include rollback strategy"] },
  { keywords: ["android", "ios", "mobile", "app", "react native", "flutter", "kotlin", "swift"],
    lines: ["- Follow platform design guidelines (Material/HIG)", "- Handle offline state and poor network gracefully", "- Search online for latest mobile SDK versions and best practices"] },
  { keywords: ["todo", "task", "list", "crud", "manage"],
    lines: ["- Create, read, update, delete operations", "- Filter and sort functionality", "- Persist data locally or to backend"] },
  { keywords: ["analyze", "compare", "cost", "price", "metric", "report", "research"],
    lines: ["- Fetch latest data from reliable sources", "- Present comparison in a table with numbers", "- Include sources and assumptions"] },
  { keywords: ["plan", "spec", "architect", "design system", "break down"],
    lines: ["- Break into numbered tasks with acceptance criteria", "- Identify dependencies between tasks", "- Assign each task to the right agent/team"] },
];

function generatePrompt(task: string, context: string, _agentId: string): string {
  const t = task.trim();
  const c = context.trim();
  const lower = t.toLowerCase();

  // Collect relevant concerns based on keywords in the task
  const matched = new Set<string>();
  for (const concern of CONCERNS) {
    if (concern.keywords.some((kw) => lower.includes(kw))) {
      concern.lines.forEach((line) => matched.add(line));
    }
  }

  // Build the prompt
  let prompt = t + "\n";

  if (matched.size > 0) {
    prompt += "\nRequirements:\n";
    prompt += Array.from(matched).join("\n");
  }

  if (c) {
    prompt += `\n\nContext: ${c}`;
  }

  return prompt;
}

interface RecentTask {
  text: string;
  agent: string;
  time: string;
}

export function CraftPanel() {
  const [task, setTask] = useState("");
  const [context, setContext] = useState("");
  const [agent, setAgent] = useState("builder");
  const [prompt, setPrompt] = useState("");
  const [step, setStep] = useState<"input" | "preview">("input");
  const [recent, setRecent] = useState<RecentTask[]>([]);
  const craftRef = useRef<HTMLTextAreaElement>(null);

  const agents = useAppStore((s) => s.agents);
  const setActiveAgent = useAppStore((s) => s.setActiveAgent);
  const addMessage = useAppStore((s) => s.addMessage);
  const setSendingAgent = useAppStore((s) => s.setSendingAgent);
  const shortcutAction = useAppStore((s) => s.shortcutAction);
  const savedPrompts = useAppStore((s) => s.savedPrompts);
  const addSavedPrompt = useAppStore((s) => s.addSavedPrompt);
  const removeSavedPrompt = useAppStore((s) => s.removeSavedPrompt);

  useEffect(() => {
    if (shortcutAction === "focus-craft") {
      craftRef.current?.focus();
    }
  }, [shortcutAction]);

  const handleTaskChange = (val: string) => {
    setTask(val);
    if (val.trim()) {
      setAgent(detectAgent(val));
    }
  };

  const handleGenerate = () => {
    if (!task.trim()) return;
    const generated = generatePrompt(task, context, agent);
    setPrompt(generated);
    setStep("preview");
  };

  const handleBack = () => {
    setStep("input");
  };

  const handleAssign = async () => {
    if (!prompt.trim()) return;

    setActiveAgent(agent);
    ipc.switchAgent(agent);
    playSwitch();

    setRecent((prev) => [
      { text: task.trim(), agent, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }) },
      ...prev.slice(0, 4),
    ]);

    const userMsg = {
      id: crypto.randomUUID(),
      role: "User" as const,
      content: prompt,
      timestamp: new Date().toISOString(),
      agent_id: agent,
      is_streaming: false,
    };
    addMessage(agent, userMsg);
    setSendingAgent(agent, true);
    playSend();

    try {
      const agentMsgId = await ipc.sendMessage(agent, prompt);
      addMessage(agent, {
        id: agentMsgId,
        role: "Agent" as const,
        content: "",
        timestamp: new Date().toISOString(),
        agent_id: agent,
        is_streaming: true,
      });
    } catch {
      setSendingAgent(agent, false);
    }

    setTask("");
    setContext("");
    setPrompt("");
    setStep("input");
  };

  const handleReassign = (r: RecentTask) => {
    setTask(r.text);
    setAgent(r.agent);
    setStep("input");
  };

  const handleSave = () => {
    const name = window.prompt("Name this skill:");
    if (!name?.trim()) return;
    addSavedPrompt(name.trim(), task, prompt, agent);
  };

  const handleUseSaved = (saved: { task: string; prompt: string; agent: string }) => {
    setTask(saved.task);
    setPrompt(saved.prompt);
    setAgent(saved.agent);
    setStep("preview");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (step === "input") handleGenerate();
      else handleAssign();
    }
  };

  return (
    <div className="py-2 px-2 font-mono text-xs">
      <div className="text-[#808080] mb-2">── CRAFT ──</div>

      {step === "input" && (
        <>
          <div className="mb-2">
            <div className="text-[#555] text-[10px] mb-0.5">what do you need?</div>
            <textarea
              ref={craftRef}
              value={task}
              onChange={(e) => handleTaskChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="login page with oauth..."
              rows={2}
              className="w-full bg-[#0a0a0a] border border-[#333] text-[#e0e0e0] placeholder-[#333] p-1.5 resize-none focus:border-[#555] outline-none text-xs"
            />
          </div>

          <div className="mb-2">
            <div className="text-[#555] text-[10px] mb-0.5">context (optional)</div>
            <input
              value={context}
              onChange={(e) => setContext(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="use existing AuthLayout..."
              className="w-full bg-[#0a0a0a] border border-[#333] text-[#e0e0e0] placeholder-[#333] p-1.5 outline-none focus:border-[#555] text-xs"
            />
          </div>

          <div className="flex items-center gap-2 mb-2">
            <select
              value={agent}
              onChange={(e) => setAgent(e.target.value)}
              className="flex-1 bg-[#0a0a0a] border border-[#333] text-[#e0e0e0] p-1 text-xs outline-none focus:border-[#555]"
            >
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.display_name || a.id}
                </option>
              ))}
            </select>
            <button
              onClick={() => { playClick(); handleGenerate(); }}
              disabled={!task.trim()}
              className={`px-3 py-1 border border-[#333] text-[#e8d44d] hover:bg-[#e8d44d]/10 hover:border-[#e8d44d]/40 disabled:opacity-30 text-xs ${task.trim() ? "glow-hover glow-click glow-yellow" : ""}`}
            >
              GENERATE
            </button>
          </div>
        </>
      )}

      {step === "preview" && (
        <>
          <div className="mb-1">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[#555] text-[10px]">review & edit prompt</span>
              <button onClick={handleBack} className="text-[10px] text-[#808080] hover:text-[#e0e0e0]">
                ← back
              </button>
            </div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={6}
              className="w-full bg-[#0a0a0a] border border-[#4de8e0]/30 text-[#e0e0e0] p-1.5 resize-none focus:border-[#4de8e0] outline-none text-xs"
            />
          </div>

          <div className="flex items-center gap-2 mb-2">
            <select
              value={agent}
              onChange={(e) => setAgent(e.target.value)}
              className="flex-1 bg-[#0a0a0a] border border-[#333] text-[#e0e0e0] p-1 text-xs outline-none focus:border-[#555]"
            >
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.display_name || a.id}
                </option>
              ))}
            </select>
            <button
              onClick={() => { playSuccess(); handleSave(); }}
              disabled={!prompt.trim()}
              className="px-3 py-1 border border-[#333] text-[#e8d44d] hover:bg-[#e8d44d]/10 hover:border-[#e8d44d]/40 disabled:opacity-30 text-xs glow-hover glow-click"
            >
              SAVE
            </button>
            <button
              onClick={() => { playClick(); handleAssign(); }}
              disabled={!prompt.trim()}
              className={`px-3 py-1 border border-[#333] text-[#4de8e0] hover:bg-[#4de8e0]/10 hover:border-[#4de8e0]/40 disabled:opacity-30 text-xs ${prompt.trim() ? "glow-hover glow-click glow-active-pulse" : ""}`}
            >
              ASSIGN
            </button>
          </div>
        </>
      )}

      {recent.length > 0 && (
        <>
          <div className="text-[#555] text-[10px] mt-1 mb-0.5">── recent ──</div>
          {recent.map((r, i) => (
            <button
              key={i}
              onClick={() => handleReassign(r)}
              className="block w-full text-left py-0.5 text-[10px] hover:text-[#e0e0e0] text-[#808080] truncate"
            >
              <span className="text-[#555]">{r.time}</span>{" "}
              <span>{r.text}</span>{" "}
              <span className="text-[#4de8e0]">→{r.agent}</span>
            </button>
          ))}
        </>
      )}

      {savedPrompts.length > 0 && (
        <>
          <div className="text-[#555] text-[10px] mt-2 mb-0.5">── saved ──</div>
          {savedPrompts.map((sp) => (
            <div
              key={sp.id}
              className="flex items-center gap-1 py-0.5 text-[10px] text-[#808080]"
            >
              <span className="truncate flex-1">
                {sp.name} <span className="text-[#4de8e0]">{"\u2192"}{sp.agent}</span>
              </span>
              <button
                onClick={() => handleUseSaved(sp)}
                className="shrink-0 px-1 text-[#e8d44d] hover:bg-[#e8d44d]/10 border border-[#333] hover:border-[#e8d44d]/40"
              >
                use
              </button>
              <button
                onClick={() => removeSavedPrompt(sp.id)}
                className="shrink-0 px-1 text-[#ff6b6b] hover:bg-[#ff6b6b]/10 border border-[#333] hover:border-[#ff6b6b]/40"
              >
                x
              </button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
