export interface ClaudeAuthStatus {
  loggedIn: boolean;
  authMethod: string;
  email: string;
  orgName: string;
  subscriptionType: string;
}

export async function checkClaudeAuth(): Promise<ClaudeAuthStatus> {
  // Use shell plugin with expanded PATH to find claude binary
  const { Command } = await import("@tauri-apps/plugin-shell");
  const cmd = Command.create("exec-sh", [
    "-c",
    "export PATH=\"/opt/homebrew/bin:/usr/local/bin:/usr/bin:$HOME/.npm-global/bin:$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node 2>/dev/null | tail -1)/bin:$PATH\" 2>/dev/null; claude auth status",
  ]);
  const output = await cmd.execute();

  if (output.code !== 0) {
    throw new Error(output.stderr || "claude auth status failed");
  }

  const parsed = JSON.parse(output.stdout);
  return {
    loggedIn: parsed.loggedIn === true,
    authMethod: parsed.authMethod || "",
    email: parsed.email || "",
    orgName: parsed.orgName || "",
    subscriptionType: parsed.subscriptionType || "",
  };
}
