import { useState } from "react";
import { InboxPanel } from "./InboxPanel";
import { SessionsPanel } from "./SessionsPanel";
import { CraftPanel } from "./CraftPanel";
import { MemoryPanel } from "./MemoryPanel";
import { LogoMascot } from "./LogoMascot";
import { WorkspacePicker } from "./WorkspacePicker";
import { playClick } from "../lib/sounds";

type Tab = "sessions" | "inbox" | "memory";

export function Sidebar() {
  const [tab, setTab] = useState<Tab>("sessions");

  return (
    <div className="w-56 shrink-0 border-r border-[#333333] flex flex-col font-mono text-xs">
      <LogoMascot />
      <div className="border-b border-[#333333]">
        <WorkspacePicker />
      </div>
      <div className="flex border-b border-[#333333]">
        <button
          onClick={() => { setTab("sessions"); playClick(); }}
          className={`flex-1 py-1 text-center text-[10px] ${
            tab === "sessions" ? "text-[#4de8e0] border-b border-[#4de8e0] text-glow" : "text-[#808080] hover:text-[#e0e0e0] glow-hover"
          }`}
        >
          SESSIONS
        </button>
        <button
          onClick={() => { setTab("inbox"); playClick(); }}
          className={`flex-1 py-1 text-center text-[10px] ${
            tab === "inbox" ? "text-[#4de8e0] border-b border-[#4de8e0] text-glow" : "text-[#808080] hover:text-[#e0e0e0] glow-hover"
          }`}
        >
          INBOX
        </button>
        <button
          onClick={() => { setTab("memory"); playClick(); }}
          className={`flex-1 py-1 text-center text-[10px] ${
            tab === "memory" ? "text-[#4de8e0] border-b border-[#4de8e0] text-glow" : "text-[#808080] hover:text-[#e0e0e0] glow-hover"
          }`}
        >
          MEMORY
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {tab === "sessions" ? <SessionsPanel /> : tab === "inbox" ? <InboxPanel /> : <MemoryPanel />}
      </div>
      <div className="border-t border-[#333333] overflow-y-auto max-h-[280px]">
        <CraftPanel />
      </div>
    </div>
  );
}
