import { SwarmVisual } from "./SwarmVisual";
import { SwarmControl } from "./SwarmControl";
import { MissionPanel } from "./MissionPanel";
import { SchedulerPanel } from "./SchedulerPanel";
import { QueuePanel } from "./QueuePanel";
import { ActivityPanel } from "./ActivityPanel";
import { WorkforcePanel } from "./WorkforcePanel";

export function RightPanel() {
  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-[#333333]">
        <MissionPanel />
      </div>
      <div className="border-b border-[#333333] max-h-[80px] overflow-y-auto">
        <SchedulerPanel />
      </div>
      <div className="border-b border-[#333333] max-h-[80px] overflow-y-auto">
        <QueuePanel />
      </div>
      <div className="border-b border-[#333333] max-h-[60px] overflow-y-auto">
        <ActivityPanel />
      </div>
      <div className="h-[240px] shrink-0 border-b border-[#333333]">
        <SwarmVisual />
      </div>
      <div className="border-b border-[#333333]">
        <SwarmControl />
      </div>
      <div className="max-h-[180px] overflow-y-auto">
        <WorkforcePanel />
      </div>
    </div>
  );
}
