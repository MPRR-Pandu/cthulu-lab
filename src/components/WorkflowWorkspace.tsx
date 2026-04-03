import { useState, useEffect, useCallback } from "react";
import {
  listWorkflows,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
  runWorkflow,
  getWorkflowRuns,
} from "../lib/workflowApi";
import type { Workflow, WorkflowStep, WorkflowRun } from "../lib/workflowApi";
import WorkflowCanvas from "./workflow/WorkflowCanvas";
import { playClick, playSuccess, playError } from "../lib/sounds";
import * as yaml from "js-yaml";

const TEMPLATES: { name: string; description: string; steps: WorkflowStep[]; schedule: string; sink: string }[] = [
  {
    name: "BTC Price Alert",
    description: "Fetch BTC price, analyze with Claude, post to Slack if threshold crossed",
    steps: [
      { type: "fetch", name: "BTC Price", command: "curl -s https://api.coindesk.com/v1/bpi/currentprice.json" },
      { type: "claude", name: "Price Analysis", prompt: "Analyze this BTC price data. Report current price, 24h trend. Alert if above $100k." },
    ],
    schedule: "*/5 * * * *",
    sink: "slack",
  },
  {
    name: "Crypto News Brief",
    description: "Aggregate crypto news from multiple RSS feeds, summarize and post to Slack",
    steps: [
      { type: "fetch", name: "Google News BTC", command: 'curl -s "https://news.google.com/rss/search?q=bitcoin+OR+btc&hl=en-US&gl=US&ceid=US:en"' },
      { type: "fetch", name: "Google News Regulation", command: 'curl -s "https://news.google.com/rss/search?q=SEC+crypto+OR+bitcoin+ETF&hl=en-US&gl=US&ceid=US:en"' },
      { type: "claude", name: "News Summary", prompt: "Summarize the top 5 crypto news stories from the data. Include: headline, source, why it matters. Keep it brief." },
    ],
    schedule: "0 */4 * * *",
    sink: "slack",
  },
  {
    name: "Morning Briefing",
    description: "Daily news summarized by Claude, posted to Slack every morning",
    steps: [
      { type: "fetch", name: "AI News", command: 'curl -s "https://news.google.com/rss/search?q=artificial+intelligence+2026&hl=en-US"' },
      { type: "fetch", name: "Tech News", command: 'curl -s "https://news.google.com/rss/search?q=technology+startups&hl=en-US"' },
      { type: "claude", name: "Daily Brief", prompt: "Create a morning briefing: 3 bullet points AI news, 3 bullet points tech news. Add an inspirational quote at the end." },
    ],
    schedule: "0 8 * * *",
    sink: "slack",
  },
  {
    name: "Competitor Monitor",
    description: "Track competitor websites, analyze changes, alert on Slack",
    steps: [
      { type: "fetch", name: "Competitor Page", command: "curl -s https://example.com/pricing" },
      { type: "claude", name: "Change Analysis", prompt: "Analyze this webpage content. Flag any pricing changes, new features, or notable updates compared to typical SaaS pricing pages." },
    ],
    schedule: "0 * * * *",
    sink: "slack",
  },
];

interface Props {
  email: string;
  globalWebhook?: string;
}

export function WorkflowWorkspace({ email, globalWebhook }: Props) {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorFormat, setEditorFormat] = useState<"json" | "yaml">("json");
  const [editorContent, setEditorContent] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const [name, setName] = useState("");
  const [steps, setSteps] = useState<WorkflowStep[]>([{ type: "fetch", name: "", command: "" }]);
  const [schedule, setSchedule] = useState("manual");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState("");
  const [showJson, setShowJson] = useState(false);
  const [showCronRef, setShowCronRef] = useState(false);
  const [bottomTab, setBottomTab] = useState<"json" | "yaml" | "logs" | "nodes">("json");
  const [editorError, setEditorError] = useState<string | null>(null);
  const [runMessage, setRunMessage] = useState<string | null>(null);
  const [editorSaved, setEditorSaved] = useState(false);

  const [logs, setLogs] = useState<WorkflowRun[]>([]);

  const selected = workflows.find(w => w.id === selectedId) || null;

  const refresh = useCallback(async () => {
    if (!email) return;
    const data = await listWorkflows(email);
    setWorkflows(data);
  }, [email]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (selected) {
      const data = { name: selected.name, steps: selected.steps, schedule: selected.schedule, sink: selected.sink };
      setEditorContent(editorFormat === "json" ? JSON.stringify(data, null, 2) : yaml.dump(data));
    }
  }, [selected, editorFormat]);

  useEffect(() => {
    if (selectedId) {
      getWorkflowRuns(selectedId).then(setLogs).catch(() => setLogs([]));
    } else {
      setLogs([]);
    }
  }, [selectedId]);

  const handleCreate = async () => {
    if (!name.trim() || steps.length === 0) return;
    playClick();
    const customWebhook = webhookUrl.trim();
    const ok = await createWorkflow({
      email,
      name: name.trim(),
      steps,
      schedule,
      sink: "slack",
      sinkConfig: { type: "slack", webhookUrl: customWebhook || "$SLACK_WEBHOOK_URL" },
      active: true,
    });
    if (ok) {
      playSuccess();
      setName("");
      setSteps([{ type: "fetch", name: "", command: "" }]);
      setSchedule("manual");
      setWebhookUrl("");
      setShowCreate(false);
      await refresh();
    } else {
      playError();
    }
  };

  const handleToggleCron = async (wf: Workflow) => {
    playClick();
    try {
      const res = await fetch(`http://localhost:4000/workflows/${encodeURIComponent(wf.id)}/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !wf.active }),
      });
      const data = await res.json();
      if (data.success) {
        playSuccess();
        await refresh();
      } else {
        playError();
      }
    } catch {
      playError();
    }
  };

  const handleSave = async (wf: Workflow) => {
    playClick();
    const ok = await updateWorkflow(wf.id, {
      name: wf.name,
      steps: wf.steps,
      schedule: wf.schedule,
      sink: wf.sink,
      sinkConfig: wf.sinkConfig,
    });
    if (ok) {
      playSuccess();
      setEditorSaved(true);
      setTimeout(() => setEditorSaved(false), 2000);
      await refresh();
    } else {
      playError();
    }
  };

  const handleDelete = async (id: string) => {
    playClick();
    if (await deleteWorkflow(id)) { playSuccess(); setSelectedId(null); await refresh(); } else { playError(); }
  };

  const handleRun = async (id: string) => {
    playClick();

    // Check if already running or queued
    const wf = workflows.find(w => w.id === id);
    if (wf) {
      const lastRun = wf.runs[wf.runs.length - 1];
      if (lastRun?.status === "running") {
        setRunMessage("Already running. Wait for it to complete.");
        setTimeout(() => setRunMessage(null), 3000);
        return;
      }
    }

    if (await runWorkflow(id)) {
      playSuccess();
      setBottomTab("logs");
      // Poll for completion
      const poll = setInterval(async () => {
        await refresh();
        const updated = (await listWorkflows(email)).find(w => w.id === id);
        if (updated) {
          const last = updated.runs[updated.runs.length - 1];
          if (last && last.status !== "running") {
            clearInterval(poll);
            setLogs(updated.runs);
            setWorkflows(prev => prev.map(w => w.id === id ? updated : w));
            if (last.status === "success") playSuccess();
            else playError();
          }
        }
      }, 3000);
      // Stop polling after 5 minutes
      setTimeout(() => clearInterval(poll), 300000);
    } else { playError(); }
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
    <div className="flex h-full font-mono text-xs">
      <div className="w-[220px] shrink-0 border-r border-[#333] flex flex-col overflow-hidden">
        <div className="p-2 border-b border-[#333] flex items-center justify-between">
          <span className="text-[#808080]">{"\u2500\u2500"} WORKFLOWS {"\u2500\u2500"}</span>
          <div className="flex gap-1">
            <button onClick={() => { playClick(); setShowTemplates(!showTemplates); setShowImport(false); setShowCreate(false); setSelectedId(null); }} className="text-[10px] text-[#a78bfa] hover:text-[#c4b5fd]">[TPL]</button>
            <button onClick={() => { playClick(); setShowImport(!showImport); setShowTemplates(false); setShowCreate(false); setSelectedId(null); }} className="text-[10px] text-[#e8d44d] hover:text-[#fff06a]">[IMP]</button>
            <button onClick={() => { playClick(); setShowCreate(!showCreate); setShowTemplates(false); setShowImport(false); setSelectedId(null); }} className="text-[10px] text-[#4de8e0] hover:text-[#7ffff8]">[+]</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {workflows.length === 0 && (
            <div className="p-2 text-[10px] text-[#555]">no workflows</div>
          )}
          {workflows.map(wf => {
            const isSelected = wf.id === selectedId;
            const lastRun = wf.runs[wf.runs.length - 1];
            const running = lastRun?.status === "running";
            const hasCron = wf.schedule !== "manual";
            return (
              <div
                key={wf.id}
                className={`border-b border-[#1a1a1a] ${isSelected ? "bg-[#111] border-l-2 border-l-[#4de8e0]" : "hover:bg-[#0a0a0a]"}`}
              >
                <button
                  onClick={() => { playClick(); setSelectedId(wf.id); setShowCreate(false); setShowTemplates(false); setShowImport(false); }}
                  className="w-full text-left p-2 pb-0"
                >
                  <div className="flex items-center justify-between">
                    <span className={isSelected ? "text-[#4de8e0]" : "text-[#e0e0e0]"}>{wf.name}</span>
                    <span className={running ? "text-[#5ddb6e]" : "text-[#555]"} style={{ fontSize: "8px" }}>
                      {running ? "\u25CF" : "\u25CB"}
                    </span>
                  </div>
                </button>
                <div className="px-2 pb-2 flex items-center justify-between">
                  <span className="text-[9px] text-[#555]">
                    {wf.steps.length} steps {"\u00B7"} {wf.schedule}
                  </span>
                  {hasCron && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleToggleCron(wf); }}
                      className="flex items-center gap-1 px-1 py-0.5 hover:bg-[#1a1a1a]"
                      title={wf.active ? "Click to disable cron" : "Click to enable cron"}
                    >
                      <div className={`w-6 h-3 rounded-full relative transition-colors ${wf.active ? "bg-[#5ddb6e]/30" : "bg-[#333]"}`}>
                        <div className={`absolute top-0.5 w-2 h-2 rounded-full transition-all ${wf.active ? "right-0.5 bg-[#5ddb6e]" : "left-0.5 bg-[#555]"}`} />
                      </div>
                      <span className={`text-[8px] ${wf.active ? "text-[#5ddb6e]" : "text-[#555]"}`}>
                        {wf.active ? "on" : "off"}
                      </span>
                    </button>
                  )}
                  {!hasCron && (
                    <span className="text-[8px] text-[#333]">manual</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {selected && (
          <div className="border-t border-[#333] p-2 max-h-[200px] overflow-y-auto">
            <div className="text-[10px] text-[#808080] mb-1">{"\u2500\u2500"} NODES ({selected.steps.length + 2}) {"\u2500\u2500"}</div>
            <div className="text-[9px] text-[#5ddb6e]">{"\u23F0"} trigger: {selected.schedule}</div>
            {selected.steps.map((s, i) => (
              <div key={i} className={`text-[9px] ${s.type === "fetch" ? "text-[#4de8e0]" : "text-[#a78bfa]"}`}>
                {s.type === "fetch" ? "\uD83D\uDD17" : "\uD83E\uDD16"} {s.name || s.type}: {(s.type === "fetch" ? s.command : s.prompt)?.slice(0, 25)}...
              </div>
            ))}
            <div className="text-[9px] text-[#e8d44d]">{"\uD83D\uDCE4"} sink: {selected.sink}</div>

            <div className="text-[10px] text-[#808080] mt-2 mb-1">{"\u2500\u2500"} EDGES ({selected.steps.length + 1}) {"\u2500\u2500"}</div>
            <div className="text-[9px] text-[#555]">trigger {"\u2192"} {selected.steps.filter(s => s.type === "fetch").map(s => s.name || "fetch").join(", ")}</div>
            <div className="text-[9px] text-[#555]">{selected.steps.filter(s => s.type === "fetch").map(s => s.name || "fetch").join(", ")} {"\u2192"} {selected.steps.filter(s => s.type === "claude").map(s => s.name || "claude").join(", ")}</div>
            <div className="text-[9px] text-[#555]">{selected.steps.filter(s => s.type === "claude").map(s => s.name || "claude").join(", ")} {"\u2192"} {selected.sink}</div>
          </div>
        )}

        {/* README */}
        <div className="border-t border-[#333] p-2 text-[9px] text-[#555]">
          <div className="text-[10px] text-[#808080] mb-1">{"\u2500\u2500"} README {"\u2500\u2500"}</div>
          <div className="leading-relaxed">
            <div className="text-[#4de8e0]">cron schedule</div>
            <div>min hour day month weekday</div>
            <div><span className="text-[#808080]">*/5 * * * *</span> every 5m</div>
            <div><span className="text-[#808080]">0 * * * *</span> hourly</div>
            <div><span className="text-[#808080]">0 8 * * *</span> daily 8am</div>
            <div><span className="text-[#808080]">0 8 * * 1-5</span> weekdays</div>
            <div className="mt-1 text-[#4de8e0]">canvas</div>
            <div>drag nodes to move</div>
            <div>scroll to zoom</div>
            <div>drag bg to pan</div>
            <div className="mt-1 text-[#4de8e0]">editor</div>
            <div>edit JSON/YAML {"\u2192"} live canvas</div>
            <div>[SAVE] deploys to VM + cron</div>
            <div className="mt-1 text-[#4de8e0]">shortcuts</div>
            <div>[RUN] execute now</div>
            <div>[SAVE] save + deploy</div>
            <div>[EXPORT] download JSON</div>
            <div>toggle switch = cron on/off</div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        {selected ? (
          <>
            <div className="flex-1 min-h-[200px]">
              <WorkflowCanvas workflow={selected} />
            </div>

            <div className="border-y border-[#333] px-2 py-1 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[#4de8e0]">{selected.name}</span>
                <span className="text-[#555] text-[10px]">{selected.schedule}</span>
                {runMessage && <span className="text-[10px] text-[#e8d44d]">{runMessage}</span>}
                {selected.runs[selected.runs.length - 1]?.status === "running" && (
                  <span className="text-[10px] text-[#4de8e0] animate-pulse">running...</span>
                )}
              </div>
              <div className="flex gap-1">
                <button onClick={() => handleSave(selected)} className="text-[10px] text-[#a78bfa] hover:text-[#c4b5fd] glow-hover">[SAVE]</button>
                <button onClick={() => handleRun(selected.id)} className="text-[10px] text-[#5ddb6e] hover:text-[#7ffff8] glow-hover">[RUN]</button>
                <button onClick={() => handleExport(selected)} className="text-[10px] text-[#e8d44d] hover:text-[#fff06a] glow-hover">[EXPORT]</button>
                <button onClick={() => handleDelete(selected.id)} className="text-[10px] text-[#f06060] hover:text-[#ff8080] glow-hover">[DELETE]</button>
              </div>
            </div>

            <div className="h-[250px] shrink-0 flex flex-col">
              <div className="flex items-center gap-1 px-2 py-1 border-b border-[#333] bg-[#0a0a0a]">
                <button
                  onClick={() => { playClick(); setBottomTab("json"); setEditorFormat("json"); }}
                  className={`text-[10px] px-2 py-0.5 ${bottomTab === "json" ? "text-[#4de8e0] border-b border-[#4de8e0]" : "text-[#808080]"}`}
                >
                  JSON
                </button>
                <button
                  onClick={() => { playClick(); setBottomTab("yaml"); setEditorFormat("yaml"); }}
                  className={`text-[10px] px-2 py-0.5 ${bottomTab === "yaml" ? "text-[#4de8e0] border-b border-[#4de8e0]" : "text-[#808080]"}`}
                >
                  YAML
                </button>
                <button
                  onClick={() => { playClick(); setBottomTab("logs"); }}
                  className={`text-[10px] px-2 py-0.5 ${bottomTab === "logs" ? "text-[#4de8e0] border-b border-[#4de8e0]" : "text-[#808080]"}`}
                >
                  LOGS {logs.length > 0 ? `(${logs.length})` : ""}
                </button>
                <button
                  onClick={() => { playClick(); setBottomTab("nodes"); }}
                  className={`text-[10px] px-2 py-0.5 ${bottomTab === "nodes" ? "text-[#4de8e0] border-b border-[#4de8e0]" : "text-[#808080]"}`}
                >
                  NODES
                </button>
                {editorError && <span className="ml-2 text-[10px] text-[#f06060]">{editorError}</span>}
                {editorSaved && <span className="ml-2 text-[10px] text-[#5ddb6e]">saved</span>}
              </div>

              {(bottomTab === "json" || bottomTab === "yaml") && (
                <textarea
                  value={editorContent}
                  onChange={(e) => {
                    setEditorContent(e.target.value);
                    setEditorError(null);
                    setEditorSaved(false);

                    // Live parse and update workflow
                    try {
                      const parsed = bottomTab === "yaml"
                        ? (yaml.load(e.target.value) as Record<string, unknown>)
                        : JSON.parse(e.target.value);

                      if (parsed && parsed.steps && Array.isArray(parsed.steps)) {
                        // Update the workflow in-memory for live canvas preview
                        setWorkflows(prev => prev.map(w =>
                          w.id === selectedId
                            ? { ...w, name: String(parsed.name || w.name), steps: parsed.steps as WorkflowStep[], schedule: String(parsed.schedule || w.schedule), sink: String(parsed.sink || w.sink) }
                            : w
                        ));
                        setEditorSaved(true);
                        setTimeout(() => setEditorSaved(false), 1500);
                      }
                    } catch {
                      // Invalid syntax — don't update, user is still typing
                    }
                  }}
                  className="flex-1 bg-[#050505] text-[#e0e0e0] px-3 py-2 text-[10px] font-mono resize-none outline-none border-none"
                  spellCheck={false}
                />
              )}

              {bottomTab === "logs" && (
                <div className="flex-1 overflow-y-auto bg-[#050505] px-3 py-2">
                  {logs.length === 0 ? (
                    <div className="text-[10px] text-[#555]">no runs yet — click [RUN]</div>
                  ) : (
                    logs.map((run) => (
                      <div key={run.id} className="mb-2 border-b border-[#1a1a1a] pb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-[#555]">
                            [{new Date(run.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}]
                          </span>
                          <span className={`text-[10px] ${run.status === "success" ? "text-[#5ddb6e]" : run.status === "failed" ? "text-[#f06060]" : "text-[#e8d44d] animate-pulse"}`}>
                            {run.status === "success" ? "\u2713 success" : run.status === "failed" ? "\u2717 failed" : "\u25CF running"}
                          </span>
                          {run.completedAt && (
                            <span className="text-[10px] text-[#333]">
                              {Math.round((new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / 1000)}s
                            </span>
                          )}
                        </div>
                        {run.stepResults.map((sr, j) => (
                          <div key={j} className="ml-3 mt-0.5 text-[10px]">
                            <span className="text-[#808080]">{sr.type}:</span>
                            <span className="text-[#555] ml-1">{sr.output.slice(0, 80)}{sr.output.length > 80 ? "..." : ""}</span>
                            <span className="text-[#333] ml-1">({sr.durationMs}ms)</span>
                          </div>
                        ))}
                        {run.finalOutput && (
                          <div className="ml-3 mt-1 text-[10px] text-[#e0e0e0] bg-[#0a0a0a] border border-[#222] p-1.5">
                            {run.finalOutput}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {bottomTab === "nodes" && (
                <div className="flex-1 overflow-y-auto bg-[#050505] px-3 py-2">
                  <div className="text-[10px] text-[#808080] mb-2">Drag nodes onto the canvas to add them</div>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { type: "trigger", label: "CRON", badge: "wf-badge-trigger", desc: "Schedule trigger" },
                      { type: "fetch", label: "FETCH", badge: "wf-badge-fetch", desc: "HTTP fetch / curl" },
                      { type: "claude", label: "CLAUDE", badge: "wf-badge-claude", desc: "AI analysis" },
                      { type: "sink", label: "SLACK", badge: "wf-badge-sink", desc: "Output to Slack" },
                    ].map((n) => (
                      <div
                        key={n.type}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("application/reactflow-type", n.type);
                          e.dataTransfer.setData("application/reactflow-label", n.label);
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        className="wf-node cursor-grab active:cursor-grabbing hover:border-[#4de8e0] transition-colors"
                        style={{ minWidth: "100px" }}
                      >
                        <div className="wf-header">
                          <span className={`wf-badge ${n.badge}`}>{n.label}</span>
                        </div>
                        <div className="wf-kind">{n.desc}</div>
                      </div>
                    ))}
                  </div>
                  <div className="text-[9px] text-[#555] mt-3">
                    <div className="text-[#808080] mb-1">wiring</div>
                    <div>drag from handle (dot) on right side of a node to left side of another</div>
                    <div>click an edge to select it, press Delete to remove</div>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : showCreate ? (
          <div className="flex-1 overflow-y-auto p-4">
            <div className="text-[#808080] mb-2">{"\u2500\u2500"} new workflow {"\u2500\u2500"}</div>

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

            <div className="mt-2">
              <div className="text-[10px] text-[#808080] mb-1">
                Slack Webhook URL
                {globalWebhook && !webhookUrl && <span className="text-[#5ddb6e] ml-1">(using global)</span>}
                {webhookUrl && webhookUrl !== globalWebhook && <span className="text-[#e8d44d] ml-1">(custom override)</span>}
              </div>
              <input
                type="text"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder={globalWebhook || "https://hooks.slack.com/services/..."}
                className="w-full bg-[#0a0a0a] border border-[#333] px-2 py-1 text-[10px] text-[#e0e0e0] outline-none focus:border-[#e8d44d] mb-2"
              />
            </div>

            <div className="flex gap-1 mt-1 items-center">
              <input
                type="text"
                value={schedule}
                onChange={(e) => setSchedule(e.target.value)}
                placeholder="manual or cron: */5 * * * *"
                className="w-[180px] bg-[#0a0a0a] border border-[#333] px-2 py-0.5 text-[10px] text-[#e0e0e0] outline-none focus:border-[#4de8e0] font-mono"
              />
              <button onClick={handleCreate} className="text-[10px] text-[#5ddb6e] hover:text-[#7ffff8] glow-hover">[CREATE WORKFLOW]</button>
              <button onClick={() => { playClick(); setShowJson(!showJson); }} className="text-[10px] text-[#808080] hover:text-[#e8d44d] glow-hover">[JSON]</button>
              <button onClick={() => { playClick(); setShowCronRef(!showCronRef); }} className="text-[10px] text-[#808080] hover:text-[#4de8e0] glow-hover">[?]</button>
            </div>

            {showCronRef && (
              <div className="mt-1 border border-[#333] bg-[#050505] p-2 text-[9px] text-[#808080]">
                <div className="text-[#4de8e0] mb-1">cron format: min hour day month weekday</div>
                <pre className="text-[#555] leading-relaxed">{`*  *  *  *  *
│  │  │  │  └─ weekday (0-7, 0=Sun)
│  │  │  └──── month (1-12)
│  │  └─────── day (1-31)
│  └────────── hour (0-23)
└───────────── minute (0-59)`}</pre>
                <div className="mt-1 text-[#808080]">examples:</div>
                <div className="text-[#555]">
                  <span className="text-[#4de8e0]">* * * * *</span> — every minute{"\n"}
                  <span className="text-[#4de8e0]">*/5 * * * *</span> — every 5 min{"\n"}
                  <span className="text-[#4de8e0]">*/30 * * * *</span> — every 30 min{"\n"}
                  <span className="text-[#4de8e0]">0 * * * *</span> — every hour{"\n"}
                  <span className="text-[#4de8e0]">0 */4 * * *</span> — every 4 hours{"\n"}
                  <span className="text-[#4de8e0]">0 8 * * *</span> — daily at 8am{"\n"}
                  <span className="text-[#4de8e0]">0 8 * * 1-5</span> — weekdays 8am{"\n"}
                  <span className="text-[#4de8e0]">0 0 * * 0</span> — weekly Sunday midnight{"\n"}
                  <span className="text-[#4de8e0]">manual</span> — no cron, run manually
                </div>
              </div>
            )}

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
                    } catch { /* ignore parse errors while typing */ }
                  }}
                  rows={10}
                  className="w-full bg-[#0a0a0a] border border-[#333] px-2 py-1 text-[10px] text-[#e0e0e0] outline-none focus:border-[#4de8e0] font-mono resize-none"
                />
              </div>
            )}
          </div>
        ) : showTemplates ? (
          <div className="flex-1 overflow-y-auto p-4">
            <div className="text-[10px] text-[#a78bfa] mb-2">{"\u2500\u2500"} templates {"\u2500\u2500"}</div>
            {TEMPLATES.map((t, i) => (
              <button
                key={i}
                onClick={() => loadTemplate(t)}
                className="block w-full text-left py-1 px-1 hover:bg-[#1a1a1a] mb-0.5"
              >
                <div className="text-[#4de8e0] text-[10px]">{t.name}</div>
                <div className="text-[#555] text-[10px]">{t.description}</div>
                <pre className="text-[9px] text-[#333] mt-0.5">
                  {t.steps.map((s) => `${s.type === "fetch" ? "\uD83D\uDD17" : "\uD83E\uDD16"} ${s.name}`).join(" \u2500\u25B8 ")} {"\u2500\u25B8"} Slack
                </pre>
              </button>
            ))}
          </div>
        ) : showImport ? (
          <div className="flex-1 overflow-y-auto p-4">
            <div className="text-[10px] text-[#e8d44d] mb-2">
              Paste JSON (our format or cthulu flow format)
            </div>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder='{"name":"...","steps":[...]} or {"nodes":[...],"edges":[...]}'
              rows={8}
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
        ) : (
          <div className="flex-1 flex items-center justify-center text-[#333]">
            select a workflow or create one
          </div>
        )}
      </div>
    </div>
  );
}
