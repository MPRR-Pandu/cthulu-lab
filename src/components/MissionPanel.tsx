import { useEffect, useRef } from "react";
import { useAppStore } from "../store/useAppStore";
import { playHallelujah, playProgress } from "../lib/sounds";

export function MissionPanel() {
  const mission = useAppStore((s) => s.mission);
  const prevDone = useRef(0);

  // Play sounds on progress changes
  useEffect(() => {
    if (!mission) return;
    if (mission.done > prevDone.current) {
      if (mission.done >= mission.total) {
        playHallelujah(); // 🎵 Mission complete!
      } else {
        playProgress();
      }
    }
    prevDone.current = mission.done;
  }, [mission?.done, mission?.total]);

  if (!mission) {
    return (
      <div className="px-2 py-1.5 font-mono text-xs">
        <div className="text-[#808080]">── MISSION ──</div>
        <div className="text-[#333333] mt-1 italic">no active mission</div>
        <div className="text-[#333333] text-[10px] mt-0.5">use /lead to start one</div>
      </div>
    );
  }

  const pct = mission.total > 0 ? Math.round((mission.done / mission.total) * 100) : 0;
  const filled = Math.round(pct / 10);
  const bar = "█".repeat(filled) + "░".repeat(10 - filled);

  return (
    <div className="px-2 py-1.5 font-mono text-xs">
      <div className="text-[#808080]">── MISSION ──</div>
      <div className="text-[#5dadec] mt-1 font-bold truncate">{mission.name}</div>
      <div className="mt-0.5">
        <span className={pct === 100 ? "text-[#5ddb6e]" : "text-[#e8d44d]"}>{bar}</span>
        <span className="text-[#808080] ml-1">{mission.done}/{mission.total}</span>
        <span className="text-[#808080] ml-1">{pct}%</span>
        {pct === 100 && <span className="text-[#5ddb6e] ml-1">COMPLETE</span>}
      </div>
    </div>
  );
}
