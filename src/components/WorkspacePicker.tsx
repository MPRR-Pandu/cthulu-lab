import { useState, useEffect } from "react";
import { useAppStore } from "../store/useAppStore";
import { useAuthStore } from "../store/useAuthStore";
import { workspaceIpc, type WorkspaceInfo } from "../lib/workspaceIpc";
import { getApiUrl } from "../lib/config";

const API_URL = getApiUrl();

/** Best-effort sync to cloud backend — never blocks UI */
function syncToBackend(method: string, email: string, path?: string) {
  if (!email) return;
  const url = method === "PUT" ? `${API_URL}/workspaces/active` : `${API_URL}/workspaces`;
  fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, path }),
  }).catch(() => {});
}

export function WorkspacePicker() {
  const [workspaces, setWorkspaces] = useState<WorkspaceInfo[]>([]);
  const [adding, setAdding] = useState(false);
  const [newPath, setNewPath] = useState("");
  const [error, setError] = useState("");
  const setHasWorkspace = useAppStore((s) => s.setHasWorkspace);
  const user = useAuthStore((s) => s.user);
  const email = user?.email ?? "";

  const loadWorkspaces = async () => {
    try {
      const list = await workspaceIpc.list();
      setWorkspaces(list);
      setHasWorkspace(list.length > 0);

      const active = list.find((w) => w.active);
      if (active) {
        useAppStore.setState({ repoName: active.name });
      }
    } catch {
      // Tauri not available (web preview)
    }
  };

  useEffect(() => {
    loadWorkspaces();
  }, [email]);

  const handleSwitch = async (path: string) => {
    try {
      await workspaceIpc.switch(path);
    } catch {
      return;
    }
    syncToBackend("PUT", email, path);
    await loadWorkspaces();
  };

  const handleAdd = async () => {
    const cleaned = newPath.trim();
    if (!cleaned) return;
    setError("");

    if (!cleaned.startsWith("/")) {
      setError("path must be absolute (start with /)");
      return;
    }
    if (cleaned.includes("..")) {
      setError("path cannot contain '..'");
      return;
    }
    if (/[<>"|?*]/.test(cleaned)) {
      setError("path contains invalid characters");
      return;
    }

    try {
      const list = await workspaceIpc.add(cleaned);
      setWorkspaces(list);
      setHasWorkspace(true);
      setNewPath("");
      setAdding(false);

      const active = list.find((w) => w.active);
      if (active) {
        useAppStore.setState({ repoName: active.name });
      }
    } catch (err) {
      setError(String(err).replace(/^Error: /, ""));
      return;
    }

    syncToBackend("POST", email, cleaned);
  };

  const handleRemove = async (path: string) => {
    try {
      const list = await workspaceIpc.remove(path);
      setWorkspaces(list);
      setHasWorkspace(list.length > 0);

      const active = list.find((w) => w.active);
      if (active) {
        useAppStore.setState({ repoName: active.name });
      }
    } catch {
      // ignore
    }
    syncToBackend("DELETE", email, path);
  };

  return (
    <div className="px-2 py-1 font-mono text-xs">
      <div className="text-[#808080] mb-1">── WORKSPACE ──</div>

      {workspaces.length === 0 && !adding && (
        <div className="text-[#555555] italic mb-1">no workspace yet</div>
      )}

      {workspaces.map((ws) => (
        <div key={ws.path} className="flex items-center gap-1 py-0.5 group">
          <button
            onClick={() => handleSwitch(ws.path)}
            className={`flex-1 text-left truncate ${
              ws.active ? "text-[#4de8e0] font-bold" : "text-[#808080] hover:text-[#e0e0e0]"
            }`}
          >
            <span className="inline-block w-3">{ws.active ? "▸" : " "}</span>
            {ws.name}
          </button>
          {!ws.active && (
            <button
              onClick={() => handleRemove(ws.path)}
              className="text-[#333333] hover:text-[#f06060] hidden group-hover:inline"
            >
              ×
            </button>
          )}
        </div>
      ))}

      {adding ? (
        <div className="mt-1">
          <input
            type="text"
            value={newPath}
            onChange={(e) => { setNewPath(e.target.value); setError(""); }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
              if (e.key === "Escape") { setAdding(false); setError(""); }
            }}
            placeholder="/path/to/project"
            autoFocus
            className="w-full bg-[#0a0a0a] border border-[#333333] text-[#e0e0e0] placeholder-[#333333] px-1 py-0.5 outline-none focus:border-[#4de8e0] text-xs"
          />
          {error && <div className="text-[#f06060] mt-0.5">{error}</div>}
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="text-[#555555] hover:text-[#4de8e0] mt-1"
        >
          + add workspace
        </button>
      )}
    </div>
  );
}
