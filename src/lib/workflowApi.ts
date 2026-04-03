const API_URL = "http://localhost:4000";

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

export interface Workflow {
  id: string;
  email: string;
  name: string;
  steps: WorkflowStep[];
  schedule: string;
  sink: string;
  active: boolean;
  runs: WorkflowRun[];
  createdAt: string;
}

export async function listWorkflows(email: string): Promise<Workflow[]> {
  try {
    const res = await fetch(`${API_URL}/workflows/${encodeURIComponent(email)}`);
    const data = await res.json();
    return data.success ? data.data : [];
  } catch { return []; }
}

export async function createWorkflow(wf: Omit<Workflow, 'id' | 'runs' | 'createdAt'>): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/workflows`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(wf),
    });
    const data = await res.json();
    return data.success;
  } catch { return false; }
}

export async function deleteWorkflow(id: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/workflows/${encodeURIComponent(id)}`, { method: "DELETE" });
    const data = await res.json();
    return data.success;
  } catch { return false; }
}

export async function runWorkflow(id: string): Promise<string | null> {
  try {
    const res = await fetch(`${API_URL}/workflows/${encodeURIComponent(id)}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json();
    return data.success ? data.data.runId : null;
  } catch { return null; }
}

export async function getWorkflowRuns(id: string): Promise<WorkflowRun[]> {
  try {
    const res = await fetch(`${API_URL}/workflows/${encodeURIComponent(id)}/runs`);
    const data = await res.json();
    return data.success ? data.data : [];
  } catch { return []; }
}
