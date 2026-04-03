import { getApiUrl } from "./config";

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem("auth_access_token");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

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
    const res = await fetch(`${getApiUrl()}/workflows/list/${encodeURIComponent(email)}`, {
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    return data.success ? data.data : [];
  } catch { return []; }
}

export async function createWorkflow(wf: Omit<Workflow, 'id' | 'runs' | 'createdAt' | 'scriptPath'>): Promise<{ success: boolean; id?: string; scriptPath?: string }> {
  try {
    const res = await fetch(`${getApiUrl()}/workflows`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(wf),
    });
    const data = await res.json();
    return { success: data.success, id: data.data?.id, scriptPath: data.data?.scriptPath };
  } catch { return { success: false }; }
}

export async function updateWorkflow(id: string, body: { name: string; steps: WorkflowStep[]; schedule: string; sink: string; sinkConfig?: SinkConfig }): Promise<{ success: boolean; scriptPath?: string }> {
  try {
    const res = await fetch(`${getApiUrl()}/workflows/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(body),
    });
    const d = await res.json();
    return { success: d.success, scriptPath: d.data?.scriptPath };
  } catch { return { success: false }; }
}

export async function deleteWorkflow(id: string): Promise<{ success: boolean; scriptPath?: string; name?: string }> {
  try {
    const res = await fetch(`${getApiUrl()}/workflows/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    return { success: data.success, scriptPath: data.data?.scriptPath, name: data.data?.name };
  } catch { return { success: false }; }
}

export async function runWorkflow(id: string): Promise<{ runId: string; scriptPath: string } | null> {
  try {
    const res = await fetch(`${getApiUrl()}/workflows/${encodeURIComponent(id)}/run`, {
      method: "POST",
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    return data.success ? { runId: data.data.runId, scriptPath: data.data.scriptPath } : null;
  } catch { return null; }
}

export async function saveRunResult(workflowId: string, runId: string, result: { status: string; stepResults: any[]; finalOutput: string }): Promise<boolean> {
  try {
    const res = await fetch(`${getApiUrl()}/workflows/${encodeURIComponent(workflowId)}/runs/${encodeURIComponent(runId)}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(result),
    });
    const data = await res.json();
    return data.success;
  } catch { return false; }
}

export async function getWorkflowScript(id: string): Promise<{ script: string; scriptPath: string } | null> {
  try {
    const res = await fetch(`${getApiUrl()}/workflows/${encodeURIComponent(id)}/script`, {
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    return data.success ? data.data : null;
  } catch { return null; }
}

export async function getWorkflowRuns(id: string): Promise<WorkflowRun[]> {
  try {
    const res = await fetch(`${getApiUrl()}/workflows/${encodeURIComponent(id)}/runs`, {
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    return data.success ? data.data : [];
  } catch { return []; }
}

export async function toggleWorkflow(id: string, active: boolean): Promise<{ success: boolean; scriptPath?: string; schedule?: string; name?: string }> {
  try {
    const res = await fetch(`${getApiUrl()}/workflows/${encodeURIComponent(id)}/toggle`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ active }),
    });
    const data = await res.json();
    return { success: data.success, scriptPath: data.data?.scriptPath, schedule: data.data?.schedule, name: data.data?.name };
  } catch { return { success: false }; }
}
