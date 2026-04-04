import { invoke } from "@tauri-apps/api/core";
import { getApiUrl } from "./config";

async function api<T = unknown>(path: string, method = "GET", body?: unknown): Promise<T> {
  const raw = await invoke<string>("api_proxy", {
    apiBase: getApiUrl(),
    path,
    method,
    body: body ? JSON.stringify(body) : null,
  });
  return JSON.parse(raw) as T;
}

interface ApiRes<T> { success: boolean; data: T }

export interface MemoryEntry {
  agentId: string;
  task: string;
  result: string;
  timestamp: string;
}

export interface SessionEntry {
  agentId: string;
  messages: { role: string; content: string; id: string; timestamp: string }[];
}

export async function saveMemory(
  email: string,
  agentId: string,
  task: string,
  result: string,
): Promise<void> {
  try {
    await api(`/agent-memory/${encodeURIComponent(email)}`, "POST", {
      agentId,
      task,
      result,
    });
  } catch {
    // Silent — persistence is best-effort
  }
}

export async function loadMemories(
  email: string,
): Promise<Record<string, MemoryEntry[]>> {
  try {
    const res = await api<ApiRes<Record<string, MemoryEntry[]>>>(
      `/agent-memory/${encodeURIComponent(email)}`,
    );
    return res.success ? res.data : {};
  } catch {
    return {};
  }
}

export async function loadSessions(
  email: string,
): Promise<SessionEntry[]> {
  try {
    const res = await api<ApiRes<SessionEntry[]>>(
      `/agent-sessions/${encodeURIComponent(email)}`,
    );
    return res.success ? res.data : [];
  } catch {
    return [];
  }
}

export async function saveSession(
  email: string,
  agentId: string,
  messages: { role: string; content: string; id: string; timestamp: string }[],
): Promise<void> {
  try {
    const capped = messages.slice(-50);
    await api(`/agent-sessions/${encodeURIComponent(email)}`, "PUT", {
      agentId,
      messages: capped,
    });
  } catch {
    // Silent — persistence is best-effort
  }
}
