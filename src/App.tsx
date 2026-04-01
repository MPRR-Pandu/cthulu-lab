import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { ChatArea } from "./components/ChatArea";
import { InputBar } from "./components/InputBar";
import { SwarmVisual } from "./components/SwarmVisual";
import { RightPanel } from "./components/RightPanel";
import { PermissionBanner } from "./components/PermissionBanner";
import { useAgents } from "./hooks/useAgents";
import { useStreamListener } from "./hooks/useStreamListener";
import { useAuthStore } from "./store/useAuthStore";
import { useAppStore } from "./store/useAppStore";

function NoWorkspace() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center font-mono text-xs">
      <pre className="text-[#333333] text-sm leading-tight mb-4">{
`  ┌─────────────────────┐
  │                     │
  │    NO WORKSPACE     │
  │                     │
  └─────────────────────┘`
      }</pre>
      <div className="text-[#808080] mb-1">add a workspace to start</div>
      <div className="text-[#555555]">← click <span className="text-[#4de8e0]">+ add workspace</span> in the sidebar</div>
      <div className="text-[#333333] mt-4 max-w-[300px] text-center">
        a workspace is a project directory where agents will read, edit, and build code
      </div>
    </div>
  );
}

function App() {
  useAgents();
  useStreamListener();
  const [view, setView] = useState<"chat" | "swarm" | "split">("split");
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const hasWorkspace = useAppStore((s) => s.hasWorkspace);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="flex h-screen bg-black text-[#e0e0e0] font-mono">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-7 border-b border-[#333333] flex items-center justify-between px-2 text-xs">
          <TopBar />
          <div className="flex items-center gap-1 ml-2">
            {hasWorkspace && (
              <>
                <button
                  onClick={() => setView("chat")}
                  className={`px-2 py-0.5 ${view === "chat" ? "text-[#5dadec]" : "text-[#808080]"} hover:text-[#e0e0e0]`}
                >
                  [CHAT]
                </button>
                <button
                  onClick={() => setView("swarm")}
                  className={`px-2 py-0.5 ${view === "swarm" ? "text-[#5dadec]" : "text-[#808080]"} hover:text-[#e0e0e0]`}
                >
                  [SWARM]
                </button>
                <button
                  onClick={() => setView("split")}
                  className={`px-2 py-0.5 ${view === "split" ? "text-[#5dadec]" : "text-[#808080]"} hover:text-[#e0e0e0]`}
                >
                  [SPLIT]
                </button>
              </>
            )}
            <span className="text-[#333333] mx-1">|</span>
            {user && (
              <span className="text-[#808080] text-xs">{user.username}</span>
            )}
            <button
              onClick={handleLogout}
              className="px-2 py-0.5 text-[#808080] hover:text-[#ff6b6b] transition-colors"
            >
              [EXIT]
            </button>
          </div>
        </div>

        {!hasWorkspace ? (
          <NoWorkspace />
        ) : (
          <>
            {view === "chat" && (
              <>
                <ChatArea />
                <PermissionBanner />
                <InputBar />
              </>
            )}

            {view === "swarm" && (
              <div className="flex-1">
                <SwarmVisual />
              </div>
            )}

            {view === "split" && (
              <div className="flex-1 flex min-h-0">
                <div className="flex-1 flex flex-col min-w-0">
                  <ChatArea />
                  <PermissionBanner />
                  <InputBar />
                </div>
                <div className="w-[320px] border-l border-[#333333] overflow-y-auto">
                  <RightPanel />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default App;
