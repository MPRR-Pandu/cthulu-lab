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
  const status = await invoke<{
    logged_in: boolean;
    auth_method: string;
    email: string;
    org_name: string;
    subscription_type: string;
  }>("claude_auth_status");

  return {
    loggedIn: status.logged_in,
    authMethod: status.auth_method,
    email: status.email,
    orgName: status.org_name,
    subscriptionType: status.subscription_type,
  };
}
