import { useState, useEffect } from "react";
import { ipc } from "../lib/ipc";
import type { Issue } from "../types/issue";

type Tab = "manual" | "github" | "notion" | "linear";

interface AssignModalProps {
  agentId: string;
  agentName: string;
  onClose: () => void;
  onAssign: (content: string) => void;
}

export function AssignModal({ agentId: _agentId, agentName, onClose, onAssign }: AssignModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>("manual");
  const [manualText, setManualText] = useState("");

  const [ghIssues, setGhIssues] = useState<Issue[]>([]);
  const [ghLoading, setGhLoading] = useState(false);
  const [ghError, setGhError] = useState("");
  const [ghFetched, setGhFetched] = useState(false);

  const [notionConnected, setNotionConnected] = useState(false);
  const [notionToken, setNotionToken] = useState("");
  const [notionDbId, setNotionDbId] = useState(() => localStorage.getItem("cthulu_notion_db") || "");
  const [notionIssues, setNotionIssues] = useState<Issue[]>([]);
  const [notionLoading, setNotionLoading] = useState(false);
  const [notionError, setNotionError] = useState("");
  const [notionFetched, setNotionFetched] = useState(false);

  const [linearConnected, setLinearConnected] = useState(false);
  const [linearKey, setLinearKey] = useState("");
  const [linearTeamKey, setLinearTeamKey] = useState(() => localStorage.getItem("cthulu_linear_team") || "");
  const [linearIssues, setLinearIssues] = useState<Issue[]>([]);
  const [linearLoading, setLinearLoading] = useState(false);
  const [linearError, setLinearError] = useState("");
  const [linearFetched, setLinearFetched] = useState(false);

  useEffect(() => {
    ipc.getIntegrationStatus().then((s) => {
      setNotionConnected(s.notion);
      setLinearConnected(s.linear);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (activeTab === "github" && !ghFetched) {
      setGhFetched(true);
      setGhLoading(true);
      setGhError("");
      ipc.listIssues()
        .then((issues) => setGhIssues(issues))
        .catch(() => setGhError("gh CLI not found or not authenticated"))
        .finally(() => setGhLoading(false));
    }
    if (activeTab === "notion" && notionConnected && !notionFetched && notionDbId) {
      setNotionFetched(true);
      setNotionLoading(true);
      setNotionError("");
      ipc.fetchNotionTasks(notionDbId)
        .then((issues) => setNotionIssues(issues))
        .catch((e) => setNotionError(String(e)))
        .finally(() => setNotionLoading(false));
    }
    if (activeTab === "linear" && linearConnected && !linearFetched && linearTeamKey) {
      setLinearFetched(true);
      setLinearLoading(true);
      setLinearError("");
      ipc.fetchLinearIssues(linearTeamKey)
        .then((issues) => setLinearIssues(issues))
        .catch((e) => setLinearError(String(e)))
        .finally(() => setLinearLoading(false));
    }
  }, [activeTab, notionConnected, linearConnected, notionDbId, linearTeamKey, ghFetched, notionFetched, linearFetched]);

  const handleNotionConnect = async () => {
    if (!notionToken || !notionDbId) return;
    try {
      await ipc.setIntegrationToken("notion", notionToken);
      localStorage.setItem("cthulu_notion_db", notionDbId);
      setNotionConnected(true);
      setNotionFetched(false);
    } catch (e) {
      setNotionError(String(e));
    }
  };

  const handleLinearConnect = async () => {
    if (!linearKey || !linearTeamKey) return;
    try {
      await ipc.setIntegrationToken("linear", linearKey);
      localStorage.setItem("cthulu_linear_team", linearTeamKey);
      setLinearConnected(true);
      setLinearFetched(false);
    } catch (e) {
      setLinearError(String(e));
    }
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "manual", label: "MANUAL" },
    { key: "github", label: "GITHUB" },
    { key: "notion", label: "NOTION" },
    { key: "linear", label: "LINEAR" },
  ];

  const renderIssueList = (issues: Issue[], loading: boolean, error: string, source: string) => {
    if (loading) return <div className="px-3 py-4 text-[#808080]">loading...</div>;
    if (error) return <div className="px-3 py-4 text-[#ff6b6b] text-[10px]">{error}</div>;
    if (issues.length === 0) return <div className="px-3 py-4 text-[#808080]">no issues found</div>;

    return (
      <div className="overflow-y-auto max-h-[240px]">
        {issues.map((issue) => (
          <button
            key={`${source}-${issue.number}`}
            onClick={() => {
              let content: string;
              if (source === "github") {
                content = `Fix #${issue.number}: ${issue.title}\n\n${issue.url}`;
              } else if (source === "notion") {
                content = `Notion task: ${issue.title}\n\n${issue.url}`;
              } else {
                content = `LINEAR-${issue.number}: ${issue.title}\n\n${issue.url}`;
              }
              onAssign(content);
            }}
            className="block w-full text-left px-3 py-1.5 hover:bg-[#1a1a1a] text-xs font-mono border-b border-[#1a1a1a]"
          >
            <span className="text-[#4de8e0]">
              {source === "github" ? `#${issue.number}` : source === "linear" ? `LINEAR-${issue.number}` : `${issue.number}.`}
            </span>{" "}
            <span className="text-[#c0c0c0]">{issue.title}</span>
            {issue.labels.length > 0 && (
              <span className="ml-2">
                {issue.labels.map((l) => (
                  <span key={l} className="inline-block ml-1 px-1 py-px text-[8px] bg-[#1a1a1a] border border-[#333] text-[#808080] rounded">
                    {l}
                  </span>
                ))}
              </span>
            )}
          </button>
        ))}
      </div>
    );
  };

  const renderTokenForm = (
    service: "notion" | "linear",
    tokenVal: string,
    setTokenVal: (v: string) => void,
    idVal: string,
    setIdVal: (v: string) => void,
    idLabel: string,
    onConnect: () => void,
  ) => (
    <div className="px-3 py-4 space-y-2">
      <div className="text-[#808080] text-[10px] mb-2">
        paste your {service} credentials to connect
      </div>
      <input
        type="password"
        placeholder={service === "notion" ? "Integration Token" : "API Key"}
        value={tokenVal}
        onChange={(e) => setTokenVal(e.target.value)}
        className="w-full bg-[#0a0a0a] border border-[#333] text-[#e0e0e0] font-mono text-xs px-2 py-1 outline-none focus:border-[#4de8e0]"
      />
      <input
        type="text"
        placeholder={idLabel}
        value={idVal}
        onChange={(e) => setIdVal(e.target.value)}
        className="w-full bg-[#0a0a0a] border border-[#333] text-[#e0e0e0] font-mono text-xs px-2 py-1 outline-none focus:border-[#4de8e0]"
      />
      <button
        onClick={onConnect}
        disabled={!tokenVal || !idVal}
        className="px-3 py-1 text-[10px] font-mono border border-[#333] text-[#4de8e0] hover:border-[#4de8e0] disabled:opacity-30 disabled:cursor-not-allowed"
      >
        connect
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-[500px] max-h-[400px] bg-black border border-[#333] font-mono flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#333] text-[10px]">
          <span className="text-[#808080]">
            ── ASSIGN TASK ─── agent: <span className="text-[#4de8e0]">{agentName}</span>
          </span>
          <button onClick={onClose} className="text-[#808080] hover:text-[#e0e0e0] px-1">[x]</button>
        </div>

        <div className="flex border-b border-[#333]">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-1 text-[10px] font-mono ${
                activeTab === tab.key
                  ? "text-[#4de8e0] border-b border-[#4de8e0]"
                  : "text-[#808080] hover:text-[#e0e0e0]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          {activeTab === "manual" && (
            <div className="px-3 py-3 space-y-2">
              <textarea
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                placeholder="describe the task..."
                className="w-full h-[200px] bg-[#0a0a0a] border border-[#333] text-[#e0e0e0] font-mono text-xs px-2 py-1.5 outline-none focus:border-[#4de8e0] resize-none"
              />
              <button
                onClick={() => { if (manualText.trim()) onAssign(manualText.trim()); }}
                disabled={!manualText.trim()}
                className="px-3 py-1 text-[10px] font-mono border border-[#333] text-[#4de8e0] hover:border-[#4de8e0] disabled:opacity-30 disabled:cursor-not-allowed"
              >
                assign
              </button>
            </div>
          )}

          {activeTab === "github" && renderIssueList(ghIssues, ghLoading, ghError, "github")}

          {activeTab === "notion" && (
            notionConnected
              ? renderIssueList(notionIssues, notionLoading, notionError, "notion")
              : renderTokenForm("notion", notionToken, setNotionToken, notionDbId, setNotionDbId, "Database ID", handleNotionConnect)
          )}

          {activeTab === "linear" && (
            linearConnected
              ? renderIssueList(linearIssues, linearLoading, linearError, "linear")
              : renderTokenForm("linear", linearKey, setLinearKey, linearTeamKey, setLinearTeamKey, "Team Key", handleLinearConnect)
          )}
        </div>
      </div>
    </div>
  );
}
