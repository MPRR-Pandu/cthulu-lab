import { invoke } from "@tauri-apps/api/core";

export interface WorkspaceInfo {
  path: string;
  name: string;
  active: boolean;
}

export const workspaceIpc = {
  list: () => invoke<WorkspaceInfo[]>("list_workspaces"),
  switch: (path: string) => invoke<string>("switch_workspace", { path }),
  add: (path: string) => invoke<WorkspaceInfo[]>("add_workspace", { path }),
  remove: (path: string) => invoke<WorkspaceInfo[]>("remove_workspace", { path }),
  getActive: () => invoke<string>("get_active_workspace"),
};
