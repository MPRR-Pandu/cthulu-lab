import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { AgentConfig } from "../types/agent";
import type { ChatMessage, StreamChunk } from "../types/chat";

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
};

export function onChatStream(
  callback: (chunk: StreamChunk) => void
): Promise<UnlistenFn> {
  return listen<StreamChunk>("chat-stream", (event) =>
    callback(event.payload)
  );
}
