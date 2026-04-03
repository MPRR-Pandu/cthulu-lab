import { useState, useEffect } from "react";
import { useAppStore } from "../store/useAppStore";
import { useAuthStore } from "../store/useAuthStore";
import { workspaceIpc } from "../lib/workspaceIpc";

const API_URL = "http://localhost:4000";

interface MongoWorkspace {
  id: string;
  path: string;
  name: string;
  active: boolean;
}

async function fetchWorkspaces(email: string): Promise<MongoWorkspace[]> {
  try {
    const res = await fetch(`${API_URL}/workspaces/${encodeURIComponent(email)}`);
    const data = await res.json();
    return data.success ? data.data : [];
  } catch { return []; }
}

async function addWorkspaceToDb(email: string, path: string): Promise<MongoWorkspace[]> {
  try {
    const res = await fetch(`${API_URL}/workspaces`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, path }),
    });
    const data = await res.json();
    return data.success ? data.data : [];
  } catch { return []; }
}

async function switchWorkspaceInDb(email: string, path: string): Promise<MongoWorkspace[]> {
  try {
    const res = await fetch(`${API_URL}/workspaces/active`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, path }),
    });
    const data = await res.json();
    return data.success ? data.data : [];
  } catch { return []; }
}

async function removeWorkspaceFromDb(email: string, path: string): Promise<MongoWorkspace[]> {
  try {
    const res = await fetch(`${API_URL}/workspaces`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, path }),
    });
    const data = await res.json();
    return data.success ? data.data : [];
  } catch { return []; }
}

export function WorkspacePicker() {
  const [workspaces, setWorkspaces] = useState<MongoWorkspace[]>([]);
  const [adding, setAdding] = useState(false);
  const [newPath, setNewPath] = useState("");
  const [error, setError] = useState("");
  const setHasWorkspace = useAppStore((s) => s.setHasWorkspace);
  const user = useAuthStore((s) => s.user);
  const email = user?.email ?? "";

  const loadWorkspaces = async () => {
    if (!email) return;
    const list = await fetchWorkspaces(email);

    // Verify each workspace exists locally, mark missing ones
    const verified: MongoWorkspace[] = [];
    for (const ws of list) {
      try {
        await workspaceIpc.add(ws.path);
        verified.push(ws);
      } catch {
        // Directory doesn't exist locally — skip it but keep in DB
        verified.push({ ...ws, name: `${ws.name} (not found)` });
      }
    }

    setWorkspaces(verified);
    const validCount = list.length;
    setHasWorkspace(validCount > 0);

    const active = verified.find((w) => w.active);
    if (active) {
      try {
        await workspaceIpc.switch(active.path);
        useAppStore.setState({ repoName: active.name });
      } catch {
        // Active workspace doesn't exist locally
      }
    }
  };

  useEffect(() => {
    loadWorkspaces();
  }, [email]);

  const handleSwitch = async (path: string) => {
    // Verify locally first
    try {
      await workspaceIpc.switch(path);
    } catch {
      return; // Dir doesn't exist locally
    }

    const list = await switchWorkspaceInDb(email, path);
    setWorkspaces(list);
    const active = list.find((w) => w.active);
    if (active) {
      useAppStore.setState({ repoName: active.name });
    }
  };

  const handleAdd = async () => {
    const cleaned = newPath.trim();
    if (!cleaned) return;
    setError("");

    // Validate path format
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

    // Verify/create directory via Rust (creates child if parent exists)
    try {
      await workspaceIpc.add(cleaned);
    } catch (err) {
      setError(String(err).replace(/^Error: /, ""));
      return;
    }

    // Save to MongoDB
    const list = await addWorkspaceToDb(email, cleaned);
    setWorkspaces(list);
    setHasWorkspace(true);
    setNewPath("");
    setAdding(false);

    // Switch to it
    await workspaceIpc.switch(cleaned);
    useAppStore.setState({
      repoName: cleaned.split("/").filter(Boolean).pop() || cleaned,
    });
    await loadWorkspaces();
  };

  const handleRemove = async (path: string) => {
    const list = await removeWorkspaceFromDb(email, path);
    setWorkspaces(list);
    setHasWorkspace(list.length > 0);
    workspaceIpc.remove(path).catch(() => {});
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
