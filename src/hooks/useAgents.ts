import { useEffect } from "react";
import { ipc } from "../lib/ipc";
import { useAppStore } from "../store/useAppStore";

export function useAgents() {
  const setAgents = useAppStore((s) => s.setAgents);
  const setActiveAgent = useAppStore((s) => s.setActiveAgent);
  const activeAgentId = useAppStore((s) => s.activeAgentId);

  useEffect(() => {
    ipc.listAgents().then((agents) => {
      setAgents(agents);
      if (!activeAgentId && agents.length > 0) {
        setActiveAgent(agents[0].id);
      }
    });
  }, []);
}
