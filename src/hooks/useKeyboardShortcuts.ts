import { useEffect } from "react";
import { useAppStore } from "../store/useAppStore";
import { ipc } from "../lib/ipc";
import { playSwitch } from "../lib/sounds";

export function useKeyboardShortcuts() {
  const agents = useAppStore((s) => s.agents);
  const setActiveAgent = useAppStore((s) => s.setActiveAgent);
  const setShortcutAction = useAppStore((s) => s.setShortcutAction);
  const setSettingsOpen = useAppStore((s) => s.setSettingsOpen);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key >= "1" && e.key <= "5") {
        e.preventDefault();
        const idx = parseInt(e.key) - 1;
        if (agents[idx]) {
          setActiveAgent(agents[idx].id);
          ipc.switchAgent(agents[idx].id);
          playSwitch();
        }
        return;
      }

      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setShortcutAction("focus-craft");
        setTimeout(() => setShortcutAction(null), 100);
        return;
      }

      if (mod && e.key.toLowerCase() === "e") {
        e.preventDefault();
        setShortcutAction("export-chat");
        setTimeout(() => setShortcutAction(null), 100);
        return;
      }

      if (mod && e.key === ",") {
        e.preventDefault();
        setSettingsOpen(true);
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        setSettingsOpen(false);
        setShortcutAction("close-modal");
        setTimeout(() => setShortcutAction(null), 100);
        return;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [agents, setActiveAgent, setShortcutAction, setSettingsOpen]);
}
