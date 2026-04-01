import { useState, useEffect } from "react";
import { useAppStore } from "../store/useAppStore";
import { apiFetch } from "../lib/api";
import { workspaceIpc } from "../lib/workspaceIpc";

interface Workspace {
  id: string;
  path: string;
  name: string;
  active: boolean;
}

export function WorkspacePicker() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [adding, setAdding] = useState(false);
  const [newPath, setNewPath] = useState("");
  const [error, setError] = useState("");
  const setHasWorkspace = useAppStore((s) => s.setHasWorkspace);

  const loadWorkspaces = async () => {
    const res = await apiFetch<Workspace[]>("/workspaces");
    if (res.success && res.data) {
      setWorkspaces(res.data);
      setHasWorkspace(res.data.length > 0);
      const active = res.data.find((w) => w.active);
      if (active) {
        useAppStore.setState({ repoName: active.name });
        workspaceIpc.switch(active.path).catch(() => {});
      }
    }
  };

  useEffect(() => {
    loadWorkspaces();
  }, []);

  const handleSwitch = async (path: string) => {
    const res = await apiFetch<Workspace[]>("/workspaces/active", {
      method: "PUT",
      body: JSON.stringify({ path }),
    });
    if (res.success && res.data) {
      setWorkspaces(res.data);
      const active = res.data.find((w) => w.active);
      if (active) {
        useAppStore.setState({ repoName: active.name });
        workspaceIpc.switch(active.path).catch(() => {});
      }
    }
  };

  const handleAdd = async () => {
    if (!newPath.trim()) return;
    setError("");

    try {
      await workspaceIpc.add(newPath.trim());
    } catch {
      setError("directory not found");
      return;
    }

    const res = await apiFetch<Workspace[]>("/workspaces", {
      method: "POST",
      body: JSON.stringify({ path: newPath.trim() }),
    });

    if (res.success && res.data) {
      setWorkspaces(res.data);
      setNewPath("");
      setAdding(false);
      setHasWorkspace(true);
      const active = res.data.find((w) => w.active);
      if (active) {
        useAppStore.setState({ repoName: active.name });
        workspaceIpc.switch(active.path).catch(() => {});
      }
    } else {
      setError(res.error || "failed to add");
    }
  };

  const handleRemove = async (path: string) => {
    const res = await apiFetch<Workspace[]>("/workspaces", {
      method: "DELETE",
      body: JSON.stringify({ path }),
    });
    if (res.success && res.data) {
      setWorkspaces(res.data);
      setHasWorkspace(res.data.length > 0);
      workspaceIpc.remove(path).catch(() => {});
    }
  };

  return (
    <div className="px-2 py-1 font-mono text-xs">
      <div className="text-[#808080] mb-1">── WORKSPACE ──</div>

      {workspaces.length === 0 && !adding && (
        <div className="text-[#555555] italic mb-1">no workspace yet</div>
      )}

      {workspaces.map((ws) => (
        <div key={ws.id} className="flex items-center gap-1 py-0.5 group">
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
