import { invoke } from "@tauri-apps/api/core";
import { getGatewayUrl } from "./config";

export interface VM {
  vm_id: number;
  tier: string;
  guest_ip: string;
  ssh_port: number;
  web_port: number;
  ssh_command: string;
  web_terminal: string;
  pid: number;
}

export interface GatewayHealth {
  status: string;
  active_vms: number;
  max_vms: number;
}

export async function gatewayHealth(): Promise<GatewayHealth | null> {
  const url = getGatewayUrl();
  if (!url) return null;
  try {
    return await invoke<GatewayHealth>("gateway_health", { gatewayUrl: url });
  } catch { return null; }
}

export async function listVMs(): Promise<VM[]> {
  const url = getGatewayUrl();
  if (!url) return [];
  try {
    return await invoke<VM[]>("gateway_list_vms", { gatewayUrl: url });
  } catch { return []; }
}

export async function createVM(tier: string): Promise<VM> {
  const url = getGatewayUrl();
  if (!url) throw new Error("Gateway URL not configured. Set it in Settings > Connection.");
  return invoke<VM>("gateway_create_vm", { gatewayUrl: url, tier });
}

export async function deleteVM(vmId: number): Promise<void> {
  const url = getGatewayUrl();
  if (!url) throw new Error("Gateway URL not configured.");
  await invoke<void>("gateway_delete_vm", { gatewayUrl: url, vmId });
}

export interface ExecResult {
  vm_id: number;
  exit_code: number;
  stdout: string;
  stderr: string;
}

export async function execInVm(vmId: number, command: string): Promise<ExecResult> {
  const url = getGatewayUrl();
  if (!url) throw new Error("Gateway URL not configured.");
  return invoke<ExecResult>("gateway_exec", { gatewayUrl: url, vmId, command });
}
