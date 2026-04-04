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

export interface ScheduledResponse {
  id: string;
  taskId: string;
  agentId: string;
  task: string;
  response: string;
  timestamp: string;
}

export async function saveScheduledResponse(
  taskId: string,
  agentId: string,
  task: string,
  response: string,
): Promise<void> {
  try {
    await api("/scheduled", "POST", { taskId, agentId, task, response });
  } catch {
    // Silent — persistence is best-effort
  }
}

export async function getScheduledResponses(taskId: string): Promise<ScheduledResponse[]> {
  try {
    const res = await api<ApiRes<ScheduledResponse[]>>(`/scheduled/${taskId}`);
    return res.success ? res.data : [];
  } catch { return []; }
}

export async function getAllScheduledResponses(): Promise<ScheduledResponse[]> {
  try {
    const res = await api<ApiRes<ScheduledResponse[]>>("/scheduled");
    return res.success ? res.data : [];
  } catch { return []; }
}
