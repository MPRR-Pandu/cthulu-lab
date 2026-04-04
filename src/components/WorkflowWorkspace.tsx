import { useState, useEffect, useCallback } from "react";
import {
  listWorkflows,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
  runWorkflow,
  getWorkflowRuns,
  getWorkflowScript,
  saveRunResult,
  toggleWorkflow,
} from "../lib/workflowApi";
import type { Workflow, WorkflowStep, WorkflowRun } from "../lib/workflowApi";
import { execInVm } from "../lib/gatewayApi";
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
  vmId: number;
}

export function WorkflowWorkspace({ email, globalWebhook, vmId }: Props) {
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

  const ensureCron = async () => {
    await execInVm(vmId, "which crontab >/dev/null 2>&1 || (apt-get update -qq && apt-get install -y -qq cron >/dev/null 2>&1 && service cron start 2>/dev/null; echo OK)");
  };

  const deployScriptToVm = async (workflowId: string, scriptPath: string, schedule?: string, wfName?: string) => {
    try {
      const scriptData = await getWorkflowScript(workflowId);
      if (!scriptData) return;
      const scriptB64 = btoa(scriptData.script);
      const dir = scriptData.scriptPath.replace('/run.sh', '');

      // Step 1: create directory
      await execInVm(vmId, `mkdir -p ${dir}`);

      // Step 2: write base64 to a temp file, decode to script
      // Use printf to avoid echo interpretation issues, pipe to base64 -d
      await execInVm(vmId, `printf '%s' "${scriptB64}" | base64 -d > ${scriptData.scriptPath}`);

      // Step 3: make executable and verify
      const verify = await execInVm(vmId, `chmod +x ${scriptData.scriptPath} && wc -c < ${scriptData.scriptPath}`);
      if (!verify.stdout.trim() || verify.stdout.trim() === '0') {
        throw new Error('Script file is empty after deploy');
      }

      if (schedule && schedule !== 'manual') {
        await ensureCron();
        const safeName = (wfName || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const safeEmail = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const cronCmd = `service cron start 2>/dev/null; (crontab -l 2>/dev/null | grep -v '${safeName}/run.sh'; echo "${schedule} ${scriptPath} >> /root/workflows/${safeEmail}/${safeName}/cron.log 2>&1") | crontab -`;
        await execInVm(vmId, cronCmd);
      }
    } catch (err) {
      console.error('[workflow] VM deploy failed:', err);
    }
  };

  const handleCreate = async () => {
    if (!name.trim() || steps.length === 0) return;
    playClick();
    const customWebhook = webhookUrl.trim();
    const result = await createWorkflow({
      email,
      name: name.trim(),
      steps,
      schedule,
      sink: "slack",
      sinkConfig: { type: "slack", webhookUrl: customWebhook || "$SLACK_WEBHOOK_URL" },
      active: false, // Created disabled — user enables to deploy + cron
    });
    if (result.success && result.id) {
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
      const newActive = !wf.active;
      const result = await toggleWorkflow(wf.id, newActive);
      if (!result.success) { playError(); return; }

      const sp = result.scriptPath || wf.scriptPath || '';
      const safeName = (result.name || wf.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const safeEmail = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

      if (newActive) {
        // ENABLE: deploy script to VM + set cron
        await deployScriptToVm(wf.id, sp, result.schedule || wf.schedule, result.name || wf.name);

        if (result.schedule && result.schedule !== 'manual') {
          await ensureCron();
          const cronCmd = `service cron start 2>/dev/null; (crontab -l 2>/dev/null | grep -v '${safeName}/run.sh'; echo "${result.schedule} ${sp} >> /root/workflows/${safeEmail}/${safeName}/cron.log 2>&1") | crontab -`;
          await execInVm(vmId, cronCmd);
        }
      } else {
        // DISABLE: remove cron entry
        const cronCmd = `(crontab -l 2>/dev/null | grep -v '${safeName}/run.sh') | crontab - 2>/dev/null; echo OK`;
        await execInVm(vmId, cronCmd);
      }

      playSuccess();
      await refresh();
    } catch {
      playError();
    }
  };

  const handleSave = async (wf: Workflow) => {
    playClick();
    const result = await updateWorkflow(wf.id, {
      name: wf.name,
      steps: wf.steps,
      schedule: wf.schedule,
      sink: wf.sink,
      sinkConfig: wf.sinkConfig,
    });
    if (result.success) {
      await deployScriptToVm(wf.id, result.scriptPath || wf.scriptPath || '', wf.schedule, wf.name);
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
    const result = await deleteWorkflow(id);
    if (result.success) {
      if (result.scriptPath) {
        const dir = result.scriptPath.replace('/run.sh', '');
        const safeName = (result.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        await execInVm(vmId, `rm -rf ${dir} && (crontab -l 2>/dev/null | grep -v '${safeName}/run.sh') | crontab - 2>/dev/null; echo OK`).catch(() => {});
      }
      playSuccess();
      setSelectedId(null);
      await refresh();
    } else {
      playError();
    }
  };

  const handleRun = async (id: string) => {
    playClick();

    const wf = workflows.find(w => w.id === id);
    if (wf) {
      const lastRun = wf.runs[wf.runs.length - 1];
      if (lastRun?.status === "running") {
        setRunMessage("Already running. Wait for it to complete.");
        setTimeout(() => setRunMessage(null), 3000);
        return;
      }
    }

    setRunMessage(null);
    let runData;
    try {
      runData = await runWorkflow(id);
    } catch (err) {
      setRunMessage(`Run failed: ${err}`);
      playError();
      return;
    }

    if (!runData) {
      setRunMessage("Run failed — backend returned no data. Check connection.");
      playError();
      return;
    }

    if (!runData.scriptPath) {
      setRunMessage("No script path — re-save the workflow first.");
      playError();
      return;
    }

    playSuccess();
    setBottomTab("logs");
    await refresh();

    // Deploy script to VM first (in case it's missing), then execute
    (async () => {
      try {
        // Ensure script is deployed
        await deployScriptToVm(id, runData.scriptPath!, undefined, undefined);

        // Run it via bash (explicit shell in case exec bit is lost)
        const result = await execInVm(vmId, `bash ${runData.scriptPath}`);
        const stdout = result.stdout || '';
        const stderr = result.stderr || '';
        const parts = stdout.split('---OUTPUT---');
        const trace = parts[0] || '';
        const claudeOutput = (parts[1] || '').trim();

        const stepResults = trace.split('\n').filter(l => l.trim()).map(l => {
          const tsMatch = l.match(/^\[(\d{2}:\d{2}:\d{2})\]\s*(.*)/);
          const time = tsMatch ? tsMatch[1] : '';
          const rest = tsMatch ? tsMatch[2] : l;
          const [kind, ...detail] = rest.split(':');
          return {
            type: kind.trim(),
            output: detail.join(':').trim() || rest,
            durationMs: 0,
            _time: time,
          };
        });

        const status = result.exit_code === 0 ? 'success' : 'failed';
        await saveRunResult(id, runData.runId, {
          status,
          stepResults,
          finalOutput: (claudeOutput || stderr || trace.slice(-500)).slice(0, 2000),
        });

        if (status === 'success') playSuccess();
        else { setRunMessage(`Script exited with code ${result.exit_code}`); playError(); }
      } catch (err) {
        await saveRunResult(id, runData.runId, {
          status: 'failed',
          stepResults: [{ type: 'error', output: String(err), durationMs: 0 }],
          finalOutput: String(err),
        }).catch(() => {});
        setRunMessage(`Exec failed: ${err}`);
        playError();
      }
      await refresh();
      const updated = await listWorkflows(email);
      const wfUpdated = updated.find(w => w.id === id);
      if (wfUpdated) {
        setLogs(wfUpdated.runs);
        setWorkflows(prev => prev.map(w => w.id === id ? wfUpdated : w));
      }
    })();
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
                      <div key={run.id} className="mb-3 border border-[#1a1a1a] bg-[#0a0a0a]">
                        {/* Run header */}
                        <div className="flex items-center justify-between px-2 py-1 border-b border-[#1a1a1a] bg-[#111]">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-bold ${run.status === "success" ? "text-[#5ddb6e]" : run.status === "failed" ? "text-[#f06060]" : "text-[#e8d44d] animate-pulse"}`}>
                              {run.status === "success" ? "\u2713 SUCCESS" : run.status === "failed" ? "\u2717 FAILED" : "\u25CF RUNNING"}
                            </span>
                            <span className="text-[10px] text-[#555]">
                              {new Date(run.startedAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })}
                            </span>
                          </div>
                          {run.completedAt && (
                            <span className="text-[10px] text-[#4de8e0]">
                              {Math.round((new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / 1000)}s
                            </span>
                          )}
                        </div>

                        {/* Step trace */}
                        <div className="px-2 py-1 font-mono">
                          {run.stepResults.map((sr, j) => {
                            const time = (sr as unknown as { _time?: string })._time || '';
                            const isFail = sr.type === "FAILED" || sr.type === "error";
                            const isOk = sr.type === "OK";
                            const isStep = ["FETCH", "CLAUDE", "SLACK"].includes(sr.type);
                            return (
                              <div key={j} className="flex items-start gap-1 leading-4 text-[10px]">
                                {time && <span className="text-[#333] shrink-0">{time}</span>}
                                <span className={`shrink-0 font-bold w-14 ${
                                  isFail ? "text-[#f06060]" :
                                  isOk ? "text-[#5ddb6e]" :
                                  isStep ? "text-[#4de8e0]" :
                                  "text-[#808080]"
                                }`}>
                                  {sr.type}
                                </span>
                                <span className={isFail ? "text-[#f06060]" : "text-[#808080]"}>
                                  {sr.output}
                                </span>
                              </div>
                            );
                          })}
                        </div>

                        {/* Final output */}
                        {run.finalOutput && (
                          <div className="border-t border-[#1a1a1a] px-2 py-1.5">
                            <div className="text-[9px] text-[#555] mb-0.5">OUTPUT</div>
                            <pre className="text-[10px] text-[#e0e0e0] whitespace-pre-wrap break-words max-h-[200px] overflow-y-auto">
                              {run.finalOutput}
                            </pre>
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
