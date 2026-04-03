import Link from "next/link";

const steps = [
  {
    num: "01",
    title: "Install Claude Code",
    cmd: "npm i -g @anthropic-ai/claude-code",
  },
  {
    num: "02",
    title: "Login to Claude",
    cmd: "claude auth login",
  },
  {
    num: "03",
    title: "Download Cthulu Lab",
    cmd: null,
    note: "Download the .dmg below and install",
  },
  {
    num: "04",
    title: "Set Backend URL",
    cmd: null,
    note: "Open Settings and set Backend URL to your API endpoint",
  },
  {
    num: "05",
    title: "Set Gateway URL",
    cmd: null,
    note: "Set Gateway URL to your VM gateway endpoint",
  },
  {
    num: "06",
    title: "Add Workspace",
    cmd: null,
    note: "Add a workspace path to start managing your projects",
  },
  {
    num: "07",
    title: "Start Chatting",
    cmd: null,
    note: "Open the agent chat and start talking to Claude in your VM",
  },
];

export default function DownloadPage() {
  return (
    <div className="flex flex-col flex-1">
      <nav className="w-full flex items-center justify-between px-8 py-4 border-b border-[#1a1a1a]">
        <Link
          href="/"
          className="text-cyan font-bold tracking-wider text-sm"
        >
          CTHULU LAB
        </Link>
        <Link
          href="/login"
          className="px-3 py-1 text-xs border border-[#333] text-[#e0e0e0] hover:border-cyan hover:text-cyan transition-colors"
        >
          LOGIN
        </Link>
      </nav>

      <main className="flex-1 w-full max-w-3xl mx-auto px-8 py-12 flex flex-col gap-10">
        <div>
          <h1 className="text-2xl font-bold tracking-wider mb-2">
            <span className="text-green">$</span> DOWNLOAD
          </h1>
          <p className="text-dim text-sm">
            Get Cthulu Lab for macOS and set up in minutes
          </p>
        </div>

        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="text-green text-xs font-bold tracking-wider mb-1">
              CTHULU LAB FOR MAC
            </div>
            <div className="text-dim text-xs">
              macOS 12+ -- Apple Silicon & Intel
            </div>
          </div>
          <a
            href="#"
            className="px-6 py-2 bg-cyan text-black font-bold text-sm tracking-wider hover:bg-cyan/80 transition-colors"
          >
            DOWNLOAD .DMG
          </a>
        </div>

        <div className="flex flex-col gap-1">
          <h2 className="text-green text-xs font-bold tracking-wider mb-3">
            SETUP STEPS
          </h2>
          {steps.map((s) => (
            <div
              key={s.num}
              className="border border-[#1a1a1a] bg-[#0a0a0a] p-4 flex flex-col gap-2"
            >
              <div className="flex items-center gap-3">
                <span className="text-cyan text-xs font-bold">{s.num}</span>
                <span className="text-sm font-bold">{s.title}</span>
              </div>
              {s.cmd ? (
                <pre className="text-green text-xs bg-black px-3 py-2 border border-[#1a1a1a] overflow-x-auto">
                  <span className="text-dim">$ </span>
                  {s.cmd}
                </pre>
              ) : null}
              {s.note ? (
                <p className="text-dim text-xs pl-7">{s.note}</p>
              ) : null}
            </div>
          ))}
        </div>

        <div className="text-dim text-xs">
          <span className="text-green">need help?</span> check the docs or
          open an issue on github
        </div>
      </main>
    </div>
  );
}
