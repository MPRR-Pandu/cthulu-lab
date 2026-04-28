import { useEffect } from "react";
import { ipc } from "../lib/ipc";
import { useAppStore } from "../store/useAppStore";
import type { AgentConfig } from "../types/agent";

const WORKSPACE_AGENT: AgentConfig = {
  id: "workspace",
  name: "workspace",
  display_name: "Workspace",
  description: "Direct claude CLI session in the active workspace.",
  color: "blue",
  disallowed_tools: [],
  personality: "",
  voice_style: "",
  species: "blob",
  catchphrase: "Direct chat with the workspace.",
};

export function useAgents() {
  const setAgents = useAppStore((s) => s.setAgents);
  const setActiveAgent = useAppStore((s) => s.setActiveAgent);
  const activeAgentId = useAppStore((s) => s.activeAgentId);

  useEffect(() => {
    ipc.listAgents().then((loaded) => {
      // Always expose a "workspace" entry as the default chat. Sub-agents
      // (lead/builder/...) follow it if they were extracted.
      const hasWorkspace = loaded.some((a) => a.id === WORKSPACE_AGENT.id);
      const agents = hasWorkspace ? loaded : [WORKSPACE_AGENT, ...loaded];
      setAgents(agents);
      if (!activeAgentId) {
        setActiveAgent(WORKSPACE_AGENT.id);
      }
    });
  }, []);
}
