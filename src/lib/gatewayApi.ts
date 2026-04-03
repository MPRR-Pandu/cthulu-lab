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
  try {
    return await invoke<GatewayHealth>("gateway_health", { gatewayUrl: getGatewayUrl() });
  } catch { return null; }
}

export async function listVMs(): Promise<VM[]> {
  try {
    return await invoke<VM[]>("gateway_list_vms", { gatewayUrl: getGatewayUrl() });
  } catch { return []; }
}

export async function createVM(tier: string): Promise<VM | null> {
  try {
    return await invoke<VM>("gateway_create_vm", { gatewayUrl: getGatewayUrl(), tier });
  } catch { return null; }
}

export async function deleteVM(vmId: number): Promise<boolean> {
  try {
    await invoke<void>("gateway_delete_vm", { gatewayUrl: getGatewayUrl(), vmId });
    return true;
  } catch { return false; }
}

export interface ExecResult {
  vm_id: number;
  exit_code: number;
  stdout: string;
  stderr: string;
}

export async function execInVm(vmId: number, command: string): Promise<ExecResult> {
  return invoke<ExecResult>("gateway_exec", { gatewayUrl: getGatewayUrl(), vmId, command });
}
