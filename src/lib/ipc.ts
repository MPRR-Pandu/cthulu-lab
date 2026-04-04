import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { AgentConfig } from "../types/agent";
import type { ChatMessage, StreamChunk } from "../types/chat";
import type { Issue } from "../types/issue";
import type { SkillInfo } from "../types/skill";

export const ipc = {
  listAgents: () => invoke<AgentConfig[]>("list_agents"),

  switchAgent: (agentId: string) =>
    invoke<AgentConfig>("switch_agent", { agentId }),

  reloadAgents: () => invoke<AgentConfig[]>("reload_agents"),

  sendMessage: (agentId: string, content: string) =>
    invoke<string>("send_message", { agentId, content }),

  getChatHistory: (agentId: string) =>
    invoke<ChatMessage[]>("get_chat_history", { agentId }),

  toggleVoice: () => invoke<boolean>("toggle_voice"),

  respondPermission: (agentId: string, allow: boolean) =>
    invoke<void>("respond_permission", { agentId, allow }),

  setSpeedMode: (mode: string) =>
    invoke<string>("set_speed_mode", { mode }),

  setAutoApprove: (enabled: boolean) =>
    invoke<boolean>("set_auto_approve", { enabled }),

  setBudgetCap: (cap: number) =>
    invoke<number>("set_budget_cap", { cap }),

  listIssues: () => invoke<Issue[]>("list_issues"),

  setIntegrationToken: (service: string, token: string) =>
    invoke<void>("set_integration_token", { service, token }),

  getIntegrationStatus: () =>
    invoke<{ github: boolean; notion: boolean; linear: boolean }>("get_integration_status"),

  fetchNotionTasks: (databaseId: string) =>
    invoke<Issue[]>("fetch_notion_tasks", { databaseId }),

  fetchLinearIssues: (teamKey: string) =>
    invoke<Issue[]>("fetch_linear_issues", { teamKey }),

  listSkills: () => invoke<SkillInfo[]>("list_skills"),

  createSkill: (
    name: string,
    description: string,
    whenToUse: string,
    procedure: string,
    pitfalls: string,
    verification: string
  ) =>
    invoke<string>("create_skill", {
      name,
      description,
      whenToUse,
      procedure,
      pitfalls,
      verification,
    }),

  deleteSkill: (name: string) => invoke<void>("delete_skill", { name }),

  testApiConnection: (url: string) => invoke<string>("test_api_connection", { url }),
  testGatewayConnection: (url: string) => invoke<string>("test_gateway_connection", { url }),

  delegateToAgent: (fromAgent: string, toAgent: string, task: string, context: string) =>
    invoke<string>("delegate_to_agent", { fromAgent, toAgent, task, context }),
};

export function onChatStream(
  callback: (chunk: StreamChunk) => void
): Promise<UnlistenFn> {
  return listen<StreamChunk>("chat-stream", (event) =>
    callback(event.payload)
  );
}
