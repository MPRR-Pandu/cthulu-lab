import { invoke } from "@tauri-apps/api/core";
import { getApiUrl } from "./config";

/** All API calls go through Rust reqwest to bypass browser CORS */
async function api<T = unknown>(
  path: string,
  method: string = "GET",
  body?: unknown,
): Promise<T> {
  const raw = await invoke<string>("api_proxy", {
    apiBase: getApiUrl(),
    path,
    method,
    body: body ? JSON.stringify(body) : null,
  });
  return JSON.parse(raw) as T;
}

interface ApiRes<T> { success: boolean; data: T; error?: string }

export interface WorkflowStep {
  type: 'fetch' | 'claude';
  name?: string;
  command?: string;
  prompt?: string;
}

export interface WorkflowRun {
  id: string;
  startedAt: string;
  completedAt?: string;
  status: 'success' | 'failed' | 'running';
  stepResults: { type: string; output: string; durationMs: number }[];
  finalOutput: string;
}

export interface SinkConfig {
  type: 'ui' | 'slack';
  webhookUrl?: string;
}

export interface Workflow {
  id: string;
  email: string;
  name: string;
  steps: WorkflowStep[];
  schedule: string;
  sink: string;
  sinkConfig?: SinkConfig;
  scriptPath?: string;
  active: boolean;
  runs: WorkflowRun[];
  createdAt: string;
}

export async function listWorkflows(email: string): Promise<Workflow[]> {
  try {
    const res = await api<ApiRes<Workflow[]>>(`/workflows/list/${encodeURIComponent(email)}`);
    return res.success ? res.data : [];
  } catch { return []; }
}

export async function createWorkflow(
  wf: Omit<Workflow, 'id' | 'runs' | 'createdAt' | 'scriptPath'>,
): Promise<{ success: boolean; id?: string; scriptPath?: string; error?: string }> {
  try {
    const res = await api<ApiRes<{ id: string; scriptPath?: string }>>("/workflows", "POST", wf);
    return { success: res.success, id: res.data?.id, scriptPath: res.data?.scriptPath };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function updateWorkflow(
  id: string,
  body: { name: string; steps: WorkflowStep[]; schedule: string; sink: string; sinkConfig?: SinkConfig },
): Promise<{ success: boolean; scriptPath?: string }> {
  try {
    const res = await api<ApiRes<{ scriptPath?: string }>>(`/workflows/${encodeURIComponent(id)}`, "PUT", body);
    return { success: res.success, scriptPath: res.data?.scriptPath };
  } catch { return { success: false }; }
}

export async function deleteWorkflow(id: string): Promise<{ success: boolean; scriptPath?: string; name?: string }> {
  try {
    const res = await api<ApiRes<{ scriptPath?: string; name?: string }>>(`/workflows/${encodeURIComponent(id)}`, "DELETE");
    return { success: res.success, scriptPath: res.data?.scriptPath, name: res.data?.name };
  } catch { return { success: false }; }
}

export async function runWorkflow(id: string): Promise<{ runId: string; scriptPath: string } | null> {
  try {
    const res = await api<ApiRes<{ runId: string; scriptPath: string }>>(`/workflows/${encodeURIComponent(id)}/run`, "POST");
    return res.success ? res.data : null;
  } catch { return null; }
}

export async function saveRunResult(
  workflowId: string,
  runId: string,
  result: { status: string; stepResults: unknown[]; finalOutput: string },
): Promise<boolean> {
  try {
    const res = await api<ApiRes<unknown>>(
      `/workflows/${encodeURIComponent(workflowId)}/runs/${encodeURIComponent(runId)}`,
      "PUT",
      result,
    );
    return res.success;
  } catch { return false; }
}

export async function getWorkflowScript(id: string): Promise<{ script: string; scriptPath: string } | null> {
  try {
    const res = await api<ApiRes<{ script: string; scriptPath: string }>>(`/workflows/${encodeURIComponent(id)}/script`);
    return res.success ? res.data : null;
  } catch { return null; }
}

export async function getWorkflowRuns(id: string): Promise<WorkflowRun[]> {
  try {
    const res = await api<ApiRes<WorkflowRun[]>>(`/workflows/${encodeURIComponent(id)}/runs`);
    return res.success ? res.data : [];
  } catch { return []; }
}

export async function toggleWorkflow(
  id: string,
  active: boolean,
): Promise<{ success: boolean; scriptPath?: string; schedule?: string; name?: string }> {
  try {
    const res = await api<ApiRes<{ scriptPath?: string; schedule?: string; name?: string }>>(
      `/workflows/${encodeURIComponent(id)}/toggle`,
      "POST",
      { active },
    );
    return { success: res.success, scriptPath: res.data?.scriptPath, schedule: res.data?.schedule, name: res.data?.name };
  } catch { return { success: false }; }
}
