import Link from "next/link";
import CthulhuLogo from "./CthulhuLogo";

const features = [
  {
    title: "Agent Chat",
    desc: "5 autonomous agents with context switching. Plan, build, review, fix, analyze — all via natural language.",
    icon: ">_",
  },
  {
    title: "Workflows",
    desc: "Fetch data, pipe to Claude, post to Slack. Visual canvas with React Flow. Schedule with cron.",
    icon: "{}",
  },
  {
    title: "Gateway to Heaven",
    desc: "Your own cloud VM. Auth sync, embedded terminal, workflow execution — all from the desktop app.",
    icon: "~/",
  },
];

const screenshots = [
  {
    title: "Terminal UI",
    desc: "Monospace dark theme with glow effects, swarm visualization, and agent workforce panel.",
    content: (
      <pre className="text-[8px] leading-tight text-[#808080]">{`┌─────────────┬──────────────────┬─────────────┐
│  CTHULU LAB │                  │ WORKFORCE   │
│  ╭─────╮    │  Doc Brown:      │ ▸ Doc   [D] │
│  │ ·  · │   │  Sprint: Auth    │   Marty [M] │
│  ╰──┬──╯   │  Status: 1/3    │   Bird  [B] │
│             │                  │   Rick  [R] │
│ [SESSIONS]  │  > fix the bug_  │   Prof  [A] │
│ [INBOX]     │                  │             │
│ [MEMORY]    │                  │ ── SWARM ── │
│── CRAFT ──  │                  │    ○   ○    │
│ what:       │                  │   / \\ / \\   │
│ [GENERATE]  │                  │  ○──●──○   │
└─────────────┴──────────────────┴─────────────┘`}</pre>
    ),
  },
  {
    title: "Workflow Canvas",
    desc: "React Flow visual editor with drag-and-drop nodes, live JSON/YAML editing, and cron scheduling.",
    content: (
      <pre className="text-[8px] leading-tight text-[#808080]">{`┌── WORKFLOWS ──┬────────────────────────┐
│               │                        │
│ ▸ BTC Alert ● │  ┌──────┐   ┌────────┐│
│   News Brief  │  │ CRON │──▸│ FETCH  ││
│               │  └──────┘   └───┬────┘│
│ ── NODES ──   │              ┌──▾───┐ │
│ ⏰ cron       │              │CLAUDE│ │
│ 🔗 fetch      │              └──┬───┘ │
│ 🤖 claude     │              ┌──▾───┐ │
│ 📤 slack      │              │SLACK │ │
│               │              └──────┘ │
│ ── README ──  ├── [JSON] [YAML] [LOGS]│
│ */5 * * * *   │ { "name": "BTC...",   │
└───────────────┴────────────────────────┘`}</pre>
    ),
  },
  {
    title: "Gateway to Heaven",
    desc: "Create VMs, sync Claude auth, run workflows, embedded web terminal — all via HTTP.",
    content: (
      <pre className="text-[8px] leading-tight text-[#808080]">{`┌── GATEWAY TO HEAVEN ──────────────────┐
│ ● online                    1/20 VMs  │
│                                       │
│ ┌── VM-1 [nano] ● running ─────────┐ │
│ │ port: 2223 · web: 7701           │ │
│ │                                   │ │
│ │ [TERMINAL] [SYNC AUTH] [CHECK]    │ │
│ │                                   │ │
│ │ ┌─────────────────────────────┐   │ │
│ │ │ root@vm:~# claude auth...  │   │ │
│ │ │ { "loggedIn": true }        │   │ │
│ │ └─────────────────────────────┘   │ │
│ └───────────────────────────────────┘ │
└───────────────────────────────────────┘`}</pre>
    ),
  },
];

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center">
      <nav className="w-full flex items-center justify-between px-8 py-4 border-b border-[#1a1a1a]">
        <span className="text-cyan font-bold tracking-wider text-sm">
          CTHULU LAB
        </span>
        <Link
          href="/login"
          className="px-3 py-1 text-xs text-[#e0e0e0] border border-[#333] hover:border-cyan hover:text-cyan transition-colors"
        >
          LOGIN
        </Link>
      </nav>

      <main className="flex flex-1 w-full max-w-5xl flex-col items-center px-8 py-16 gap-20">
        {/* Hero with 3D logo */}
        <div className="flex flex-col items-center gap-8 text-center">
          <CthulhuLogo />
          <h1
            className="text-6xl font-bold tracking-widest text-cyan"
            style={{ animation: "glow 3s ease-in-out infinite" }}
          >
            CTHULU LAB
          </h1>
          <p className="text-lg text-dim max-w-lg">
            autonomous AI agents + workflow automation on your own cloud VM
          </p>
          <span
            className="inline-block w-2 h-5 bg-cyan"
            style={{ animation: "blink 1s step-end infinite" }}
          />
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
          {features.map((f) => (
            <div
              key={f.title}
              className="border border-[#1a1a1a] bg-[#0a0a0a] p-6 flex flex-col gap-3 hover:border-cyan/30 transition-colors"
            >
              <span className="text-cyan text-2xl font-bold">{f.icon}</span>
              <h3 className="text-green font-bold text-sm tracking-wider">
                {f.title}
              </h3>
              <p className="text-dim text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* App screenshots */}
        <div className="w-full">
          <h2 className="text-center text-[#808080] text-xs tracking-widest mb-8">
            ── INSIDE THE APP ──
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {screenshots.map((s) => (
              <div
                key={s.title}
                className="border border-[#1a1a1a] bg-[#050505] overflow-hidden hover:border-cyan/20 transition-colors"
              >
                <div className="border-b border-[#1a1a1a] px-3 py-1.5 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#f06060]" />
                  <span className="w-2 h-2 rounded-full bg-[#e8d44d]" />
                  <span className="w-2 h-2 rounded-full bg-[#5ddb6e]" />
                  <span className="text-[#555] text-[9px] ml-2">{s.title}</span>
                </div>
                <div className="p-3 overflow-hidden">
                  {s.content}
                </div>
                <div className="px-3 pb-3">
                  <p className="text-dim text-[10px]">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="flex flex-col items-center gap-4">
          <Link
            href="/login"
            className="px-8 py-3 bg-cyan text-black font-bold text-sm tracking-wider hover:bg-cyan/80 transition-colors text-center"
          >
            LOGIN TO DOWNLOAD FOR MAC
          </Link>
          <span className="text-dim text-[10px]">
            available for macOS — early access
          </span>
        </div>
      </main>

      <footer className="w-full border-t border-[#1a1a1a] px-8 py-4 flex items-center justify-center gap-2 text-dim text-xs">
        <span>cthulu lab</span>
        <span className="text-[#333]">|</span>
        <span>powered by</span>
        <a href="https://bitcoin.com" target="_blank" rel="noopener noreferrer" className="text-[#f7931a] hover:text-[#f7931a]/80 font-bold">
          BITCOIN.COM
        </a>
      </footer>
    </div>
  );
}
