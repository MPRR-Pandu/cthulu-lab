import { useState, useEffect, useCallback } from "react";
import {
  listWorkflows,
  createWorkflow,
  deleteWorkflow,
  runWorkflow,
  getWorkflowRuns,
} from "../lib/workflowApi";
import type { Workflow, WorkflowStep, WorkflowRun } from "../lib/workflowApi";
import { playClick, playSuccess, playError } from "../lib/sounds";
import WorkflowCanvas from "./workflow/WorkflowCanvas";

// ── Templates from cthulu project ──
const TEMPLATES: { name: string; description: string; steps: WorkflowStep[]; schedule: string }[] = [
  {
    name: "BTC Price Alert",
    description: "Fetch BTC price, analyze with Claude, alert if threshold crossed",
    steps: [
      { type: "fetch", name: "BTC Price", command: "curl -s https://api.coindesk.com/v1/bpi/currentprice.json" },
      { type: "claude", name: "Price Analysis", prompt: "Analyze this BTC price data. Report current price, 24h trend. Alert if above $100k." },
    ],
    schedule: "5m",
  },
  {
    name: "Crypto News Brief",
    description: "Aggregate crypto news from multiple RSS feeds, summarize with Claude",
    steps: [
      { type: "fetch", name: "Google News BTC", command: 'curl -s "https://news.google.com/rss/search?q=bitcoin+OR+btc&hl=en-US&gl=US&ceid=US:en"' },
      { type: "fetch", name: "Google News Regulation", command: 'curl -s "https://news.google.com/rss/search?q=SEC+crypto+OR+bitcoin+ETF&hl=en-US&gl=US&ceid=US:en"' },
      { type: "claude", name: "News Summary", prompt: "Summarize the top 5 crypto news stories from the data. Include: headline, source, why it matters. Keep it brief." },
    ],
    schedule: "4h",
  },
  {
    name: "Morning Briefing",
    description: "Daily news + GitHub notifications summarized by Claude",
    steps: [
      { type: "fetch", name: "AI News", command: 'curl -s "https://news.google.com/rss/search?q=artificial+intelligence+2026&hl=en-US"' },
      { type: "fetch", name: "Tech News", command: 'curl -s "https://news.google.com/rss/search?q=technology+startups&hl=en-US"' },
      { type: "claude", name: "Daily Brief", prompt: "Create a morning briefing: 3 bullet points AI news, 3 bullet points tech news. Add an inspirational quote at the end." },
    ],
    schedule: "24h",
  },
  {
    name: "Competitor Monitor",
    description: "Track competitor websites for changes, analyze with Claude",
    steps: [
      { type: "fetch", name: "Competitor Page", command: "curl -s https://example.com/pricing" },
      { type: "claude", name: "Change Analysis", prompt: "Analyze this webpage content. Flag any pricing changes, new features, or notable updates compared to typical SaaS pricing pages." },
    ],
    schedule: "1h",
  },
];

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function WorkflowPanel({ email }: { email: string }) {
  const [wfs, setWfs] = useState<Workflow[]>([]);
  const [expandedLogs, setExpandedLogs] = useState<Record<string, WorkflowRun[]>>({});
  const [showCreate, setShowCreate] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState("");

  const [name, setName] = useState("");
  const [steps, setSteps] = useState<WorkflowStep[]>([{ type: "fetch", name: "", command: "" }]);
  const [schedule, setSchedule] = useState("manual");
  const [showJson, setShowJson] = useState(false);

  const refresh = useCallback(async () => {
    if (!email) return;
    const data = await listWorkflows(email);
    setWfs(data);
  }, [email]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleCreate = async () => {
    if (!name.trim() || steps.length === 0) return;
    playClick();
    const ok = await createWorkflow({
      email,
      name: name.trim(),
      steps,
      schedule,
      sink: "ui",
      active: true,
    });
    if (ok) {
      playSuccess();
      setName("");
      setSteps([{ type: "fetch", name: "", command: "" }]);
      setSchedule("manual");
      setShowCreate(false);
      await refresh();
    } else {
      playError();
    }
  };

  const handleDelete = async (id: string) => {
    playClick();
    if (await deleteWorkflow(id)) { playSuccess(); await refresh(); } else { playError(); }
  };

  const handleRun = async (id: string) => {
    playClick();
    if (await runWorkflow(id)) { playSuccess(); await refresh(); } else { playError(); }
  };

  const handleToggleLogs = async (id: string) => {
    playClick();
    if (expandedLogs[id]) {
      setExpandedLogs((prev) => { const next = { ...prev }; delete next[id]; return next; });
    } else {
      const runs = await getWorkflowRuns(id);
      setExpandedLogs((prev) => ({ ...prev, [id]: runs }));
    }
  };

  const addStep = (type: "fetch" | "claude") => {
    playClick();
    setSteps((prev) => [
      ...prev,
      type === "fetch" ? { type, name: "", command: "" } : { type, name: "", prompt: "" },
    ]);
  };

  const removeStep = (idx: number) => {
    playClick();
    setSteps((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateStep = (idx: number, field: "name" | "value", val: string) => {
    setSteps((prev) =>
      prev.map((s, i) => {
        if (i !== idx) return s;
        if (field === "name") return { ...s, name: val };
        return s.type === "fetch" ? { ...s, command: val } : { ...s, prompt: val };
      })
    );
  };

  const updateStepType = (idx: number, type: "fetch" | "claude") => {
    setSteps((prev) =>
      prev.map((s, i) => {
        if (i !== idx) return s;
        return type === "fetch" ? { type, name: s.name, command: "" } : { type, name: s.name, prompt: "" };
      })
    );
  };

  const loadTemplate = (tmpl: typeof TEMPLATES[0]) => {
    playClick();
    setName(tmpl.name);
    setSteps([...tmpl.steps]);
    setSchedule(tmpl.schedule);
    setShowTemplates(false);
    setShowCreate(true);
  };

  const handleImport = () => {
    setImportError("");
    try {
      const data = JSON.parse(importText.trim());

      // Support cthulu flow format (nodes + edges)
      if (data.nodes && Array.isArray(data.nodes)) {
        const imported: WorkflowStep[] = [];
        for (const node of data.nodes) {
          if (node.node_type === "source" || node.node_type === "filter") {
            const cmd = node.kind === "rss"
              ? `curl -s "${node.config?.url || ""}"`
              : node.kind === "web-scraper"
                ? `curl -s "${node.config?.url || ""}"`
                : `# ${node.kind}: ${JSON.stringify(node.config || {})}`;
            imported.push({ type: "fetch", name: node.label || node.kind, command: cmd });
          } else if (node.node_type === "executor") {
            imported.push({
              type: "claude",
              name: node.label || "Claude",
              prompt: typeof node.config?.prompt === "string" ? node.config.prompt : "analyze the data",
            });
          }
        }
        if (imported.length > 0) {
          setName(data.name || "Imported Workflow");
          setSteps(imported);
          setSchedule("manual");
          setShowImport(false);
          setShowCreate(true);
          playSuccess();
          return;
        }
      }

      // Support our own format (steps array)
      if (data.steps && Array.isArray(data.steps)) {
        setName(data.name || "Imported Workflow");
        setSteps(data.steps);
        setSchedule(data.schedule || "manual");
        setShowImport(false);
        setShowCreate(true);
        playSuccess();
        return;
      }

      setImportError("Invalid format. Expected {nodes:[...]} or {steps:[...]}");
    } catch {
      setImportError("Invalid JSON");
    }
  };

  const handleExport = (wf: Workflow) => {
    playClick();
    const exported = { name: wf.name, steps: wf.steps, schedule: wf.schedule, sink: wf.sink };
    const blob = new Blob([JSON.stringify(exported, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `workflow-${wf.name.toLowerCase().replace(/\s+/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="font-mono text-xs">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[#808080] text-sm">{"\u2500\u2500"} WORKFLOWS {"\u2500\u2500"}</span>
        <div className="flex gap-1">
          <button
            onClick={() => { playClick(); setShowTemplates(!showTemplates); setShowImport(false); }}
            className="text-[10px] text-[#a78bfa] hover:text-[#c4b5fd] glow-hover"
          >
            [TEMPLATES]
          </button>
          <button
            onClick={() => { playClick(); setShowImport(!showImport); setShowTemplates(false); }}
            className="text-[10px] text-[#e8d44d] hover:text-[#fff06a] glow-hover"
          >
            [IMPORT]
          </button>
          <button
            onClick={() => { playClick(); setShowCreate(!showCreate); setShowTemplates(false); setShowImport(false); }}
            className="text-[10px] text-[#4de8e0] hover:text-[#7ffff8] glow-hover"
          >
            {showCreate ? "[CANCEL]" : "[+ NEW]"}
          </button>
        </div>
      </div>

      {/* Templates */}
      {showTemplates && (
        <div className="border border-[#a78bfa]/30 p-2 mb-2 bg-[#0a000a]">
          <div className="text-[10px] text-[#a78bfa] mb-1">{"\u2500\u2500"} templates {"\u2500\u2500"}</div>
          {TEMPLATES.map((t, i) => (
            <button
              key={i}
              onClick={() => loadTemplate(t)}
              className="block w-full text-left py-1 px-1 hover:bg-[#1a1a1a] mb-0.5"
            >
              <div className="text-[#4de8e0] text-[10px]">{t.name}</div>
              <div className="text-[#555] text-[10px]">{t.description}</div>
              <pre className="text-[9px] text-[#333] mt-0.5">
                {t.steps.map((s) => `${s.type === "fetch" ? "\u{1F517}" : "\u{1F916}"} ${s.name}`).join(" \u2500\u25B8 ")}
              </pre>
            </button>
          ))}
        </div>
      )}

      {/* Import */}
      {showImport && (
        <div className="border border-[#e8d44d]/30 p-2 mb-2 bg-[#0a0a00]">
          <div className="text-[10px] text-[#e8d44d] mb-1">
            Paste JSON (our format or cthulu flow format)
          </div>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder='{"name":"...","steps":[...]} or {"nodes":[...],"edges":[...]}'
            rows={5}
            className="w-full bg-[#0a0a0a] border border-[#333] px-2 py-1 text-[10px] text-[#e0e0e0] outline-none focus:border-[#e8d44d] resize-none font-mono"
          />
          {importError && <div className="text-[10px] text-[#f06060] mt-0.5">{importError}</div>}
          <button
            onClick={handleImport}
            className="mt-1 text-[10px] text-[#e8d44d] hover:text-[#fff06a] glow-hover"
          >
            [IMPORT WORKFLOW]
          </button>
        </div>
      )}

      {/* Workflow list */}
      {wfs.length === 0 && !showCreate && (
        <div className="text-[10px] text-[#555]">no workflows yet — use [+ NEW] or [TEMPLATES]</div>
      )}

      {wfs.map((wf) => {
        const lastRun = wf.runs.length > 0 ? wf.runs[wf.runs.length - 1] : null;
        const running = lastRun?.status === "running";
        const logs = expandedLogs[wf.id];

        return (
          <div key={wf.id} className="border border-[#222] p-2 mb-2 bg-[#0a0a0a]">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[#4de8e0]">{wf.name}</span>
              <div className="flex gap-1 text-[10px]">
                <span className="text-[#555]">{wf.schedule}</span>
                <span className={running ? "text-[#5ddb6e]" : "text-[#555]"}>
                  {running ? "\u25CF running" : "\u25CB idle"}
                </span>
              </div>
            </div>

            <WorkflowCanvas workflow={wf} height={180} />

            {lastRun && lastRun.finalOutput && (
              <div className="text-[10px] text-[#555] truncate">
                {lastRun.finalOutput.slice(0, 80)}{lastRun.finalOutput.length > 80 ? "..." : ""}
              </div>
            )}

            <div className="flex gap-1 mt-1">
              <button onClick={() => handleToggleLogs(wf.id)} className="text-[10px] text-[#808080] hover:text-[#4de8e0] glow-hover">[LOGS]</button>
              <button onClick={() => handleRun(wf.id)} className="text-[10px] text-[#808080] hover:text-[#5ddb6e] glow-hover">[RUN]</button>
              <button onClick={() => handleExport(wf)} className="text-[10px] text-[#808080] hover:text-[#e8d44d] glow-hover">[EXPORT]</button>
              <button onClick={() => handleDelete(wf.id)} className="text-[10px] text-[#808080] hover:text-[#f06060] glow-hover">[DELETE]</button>
            </div>

            {logs && (
              <div className="ml-2 border-l-2 border-[#333] pl-2 mt-1">
                {logs.length === 0 && <div className="text-[10px] text-[#555]">no runs yet</div>}
                {logs.map((run) => (
                  <div key={run.id} className="text-[10px] mb-1">
                    <span className="text-[#555]">[{formatTime(run.startedAt)}] </span>
                    <span className={run.status === "success" ? "text-[#5ddb6e]" : run.status === "failed" ? "text-[#f06060]" : "text-[#e8d44d]"}>
                      {run.status === "success" ? "\u2713" : run.status === "failed" ? "\u2717" : "\u25CF"}
                    </span>
                    {run.stepResults.map((sr, j) => (
                      <div key={j} className="ml-2 text-[#555]">
                        {sr.type}: {sr.output.slice(0, 60)}{sr.output.length > 60 ? "..." : ""} ({sr.durationMs}ms)
                      </div>
                    ))}
                    {run.finalOutput && (
                      <div className="text-[#e0e0e0] ml-2">{run.finalOutput.slice(0, 100)}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Create workflow form */}
      {showCreate && (
        <div className="border border-[#333] p-2 mt-2">
          <div className="text-[#808080] mb-1">{"\u2500\u2500"} new workflow {"\u2500\u2500"}</div>

          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="workflow name..."
            className="w-full bg-[#0a0a0a] border border-[#333] px-2 py-1 text-[10px] text-[#e0e0e0] outline-none focus:border-[#4de8e0] mb-1"
          />

          {steps.map((step, i) => (
            <div key={i} className="flex gap-1 mt-1 items-center">
              <span className="text-[10px] text-[#555] shrink-0">{i + 1}.</span>
              <select
                value={step.type}
                onChange={(e) => updateStepType(i, e.target.value as "fetch" | "claude")}
                className="bg-[#111] border border-[#333] text-[#808080] px-1 py-0.5 text-[10px] outline-none shrink-0"
              >
                <option value="fetch">FETCH</option>
                <option value="claude">CLAUDE</option>
              </select>
              <input
                type="text"
                value={step.name ?? ""}
                onChange={(e) => updateStep(i, "name", e.target.value)}
                placeholder="name..."
                className="w-[80px] shrink-0 bg-[#0a0a0a] border border-[#333] px-1 py-0.5 text-[10px] text-[#4de8e0] outline-none focus:border-[#4de8e0]"
              />
              <input
                type="text"
                value={step.type === "fetch" ? (step.command ?? "") : (step.prompt ?? "")}
                onChange={(e) => updateStep(i, "value", e.target.value)}
                placeholder={step.type === "fetch" ? "curl -s https://..." : "analyze this data..."}
                className="flex-1 bg-[#0a0a0a] border border-[#333] px-2 py-0.5 text-[10px] text-[#e0e0e0] outline-none focus:border-[#4de8e0]"
              />
              <button onClick={() => removeStep(i)} className="text-[10px] text-[#555] hover:text-[#f06060] shrink-0">[x]</button>
            </div>
          ))}

          <div className="flex gap-1 mt-1">
            <button onClick={() => addStep("fetch")} className="text-[10px] text-[#808080] hover:text-[#4de8e0] glow-hover">[+ FETCH]</button>
            <button onClick={() => addStep("claude")} className="text-[10px] text-[#808080] hover:text-[#4de8e0] glow-hover">[+ CLAUDE]</button>
          </div>

          <div className="flex gap-1 mt-2">
            <select
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
              className="bg-[#111] border border-[#333] text-[#808080] px-1 py-0.5 text-[10px] outline-none"
            >
              <option value="manual">manual</option>
              <option value="5m">every 5m</option>
              <option value="30m">every 30m</option>
              <option value="1h">every 1h</option>
              <option value="4h">every 4h</option>
              <option value="24h">every 24h</option>
            </select>
            <button onClick={handleCreate} className="text-[10px] text-[#5ddb6e] hover:text-[#7ffff8] glow-hover">[CREATE WORKFLOW]</button>
            <button onClick={() => { playClick(); setShowJson(!showJson); }} className="text-[10px] text-[#808080] hover:text-[#e8d44d] glow-hover">[JSON]</button>
          </div>

          {showJson && (
            <div className="mt-2">
              <textarea
                value={JSON.stringify({ name, steps, schedule, sink: "ui" }, null, 2)}
                onChange={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value);
                    if (parsed.name) setName(parsed.name);
                    if (parsed.steps) setSteps(parsed.steps);
                    if (parsed.schedule) setSchedule(parsed.schedule);
                  } catch {}
                }}
                rows={10}
                className="w-full bg-[#0a0a0a] border border-[#333] px-2 py-1 text-[10px] text-[#e0e0e0] outline-none focus:border-[#4de8e0] font-mono resize-none"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
