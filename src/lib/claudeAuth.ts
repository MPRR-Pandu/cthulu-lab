import { Command } from "@tauri-apps/plugin-shell";

export interface ClaudeAuthStatus {
  loggedIn: boolean;
  authMethod: string;
  email: string;
  orgName: string;
  subscriptionType: string;
}

export async function checkClaudeAuth(): Promise<ClaudeAuthStatus> {
  try {
    const cmd = Command.create("exec-sh", ["-c", "claude auth status"]);
    const output = await cmd.execute();

    if (output.code !== 0) {
      return { loggedIn: false, authMethod: "none", email: "", orgName: "", subscriptionType: "" };
    }

    return JSON.parse(output.stdout);
  } catch {
    return { loggedIn: false, authMethod: "none", email: "", orgName: "", subscriptionType: "" };
  }
}
