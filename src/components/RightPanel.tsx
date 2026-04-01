import { SwarmVisual } from "./SwarmVisual";
import { SwarmControl } from "./SwarmControl";
import { MissionPanel } from "./MissionPanel";
import { QueuePanel } from "./QueuePanel";
import { ActivityPanel } from "./ActivityPanel";

export function RightPanel() {
  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-[#333333]">
        <MissionPanel />
      </div>
      <div className="border-b border-[#333333] flex-1 overflow-y-auto">
        <QueuePanel />
      </div>
      <div className="border-b border-[#333333] flex-1 overflow-y-auto">
        <ActivityPanel />
      </div>
      <div className="h-[350px] border-t border-[#333333]">
        <SwarmVisual />
      </div>
      <div className="border-t border-[#333333]">
        <SwarmControl />
      </div>
    </div>
  );
}
