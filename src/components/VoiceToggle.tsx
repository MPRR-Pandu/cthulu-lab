import { useAppStore } from "../store/useAppStore";
import { ipc } from "../lib/ipc";

export function VoiceToggle() {
  const voiceEnabled = useAppStore((s) => s.voiceEnabled);
  const setVoiceEnabled = useAppStore((s) => s.setVoiceEnabled);

  const toggle = async () => {
    try {
      const newState = await ipc.toggleVoice();
      setVoiceEnabled(newState);
    } catch (err) {
      console.error("Voice toggle failed:", err);
    }
  };

  return (
    <button
      onClick={toggle}
      className={`font-mono text-xs ${
        voiceEnabled ? "text-[#5ddb6e]" : "text-[#808080]"
      } hover:text-[#e0e0e0]`}
    >
      [{voiceEnabled ? "VOICE ON" : "VOICE OFF"}]
    </button>
  );
}
