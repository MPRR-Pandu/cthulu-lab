const API_URL = "http://localhost:4000";

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
  response: string
): Promise<void> {
  try {
    await fetch(`${API_URL}/scheduled`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId, agentId, task, response }),
    });
  } catch {
    // Silent - persistence is best-effort
  }
}

export async function getScheduledResponses(taskId: string): Promise<ScheduledResponse[]> {
  try {
    const res = await fetch(`${API_URL}/scheduled/${taskId}`);
    const data = await res.json();
    return data.success ? data.data : [];
  } catch {
    return [];
  }
}

export async function getAllScheduledResponses(): Promise<ScheduledResponse[]> {
  try {
    const res = await fetch(`${API_URL}/scheduled`);
    const data = await res.json();
    return data.success ? data.data : [];
  } catch {
    return [];
  }
}
