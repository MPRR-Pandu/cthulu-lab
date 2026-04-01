export type Role = "User" | "Agent" | "System";

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  timestamp: string;
  agent_id: string;
  is_streaming: boolean;
}

export interface StreamChunk {
  agent_id: string;
  message_id: string;
  chunk: string;
  done: boolean;
}

export interface PermissionRequest {
  agent_id: string;
  tool_name: string;
  tool_input: string;
  block_index: number;
}
