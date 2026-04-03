const API_URL = "http://localhost:4000";

export interface UserVm {
  email: string;
  vmId: number;
  tier: string;
  sshPort: number;
  webPort: number;
  sshCommand: string;
  webTerminal: string;
  createdAt: string;
}

export async function getUserVm(email: string): Promise<UserVm | null> {
  try {
    const res = await fetch(`${API_URL}/user-vm/${encodeURIComponent(email)}`);
    const data = await res.json();
    return data.success ? data.data : null;
  } catch { return null; }
}

export async function saveUserVm(vm: Omit<UserVm, "createdAt">): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/user-vm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(vm),
    });
    const data = await res.json();
    return data.success;
  } catch { return false; }
}

export async function deleteUserVm(email: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/user-vm/${encodeURIComponent(email)}`, { method: "DELETE" });
    const data = await res.json();
    return data.success;
  } catch { return false; }
}

export async function updateSlackWebhook(email: string, slackWebhook: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/user-vm/${encodeURIComponent(email)}/slack-webhook`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slackWebhook }),
    });
    const data = await res.json();
    return data.success;
  } catch { return false; }
}
