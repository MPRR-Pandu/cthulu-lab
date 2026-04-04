import { invoke } from "@tauri-apps/api/core";
import { getApiUrl } from "./config";

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
    return await invoke<UserVm | null>("get_user_vm", { apiUrl: getApiUrl(), email });
  } catch { return null; }
}

export async function saveUserVm(vm: Omit<UserVm, "createdAt">): Promise<boolean> {
  return invoke<boolean>("save_user_vm", {
    apiUrl: getApiUrl(),
    email: vm.email,
    vmId: vm.vmId,
    tier: vm.tier,
    sshPort: vm.sshPort,
    webPort: vm.webPort,
    webTerminal: vm.webTerminal,
  });
}

export async function deleteUserVm(email: string): Promise<boolean> {
  try {
    return await invoke<boolean>("delete_user_vm", { apiUrl: getApiUrl(), email });
  } catch { return false; }
}

export async function updateSlackWebhook(email: string, slackWebhook: string): Promise<boolean> {
  try {
    return await invoke<boolean>("update_slack_webhook", { apiUrl: getApiUrl(), email, slackWebhook });
  } catch { return false; }
}
