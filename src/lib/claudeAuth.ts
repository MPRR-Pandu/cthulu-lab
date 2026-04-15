import { invoke } from "@tauri-apps/api/core";

export interface ClaudeAuthStatus {
  loggedIn: boolean;
  authMethod: string;
  email: string;
  orgName: string;
  subscriptionType: string;
}

export async function checkClaudeAuth(): Promise<ClaudeAuthStatus> {
  // Use Rust Tauri command that reads from macOS Keychain directly —
  // no PATH dependency, works reliably in packaged DMG builds.
  // Rust struct uses #[serde(rename = "loggedIn")] etc., so JSON keys are camelCase.
  return await invoke<ClaudeAuthStatus>("claude_auth_status");
}
