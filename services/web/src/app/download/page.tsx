import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

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
    num: "03b",
    title: "Allow on macOS",
    cmd: "xattr -cr ~/Downloads/CthluLab-0.1.0-mac.dmg",
    note: "Run this before opening the .dmg — macOS blocks unsigned downloads",
  },
  {
    num: "04",
    title: "Open Settings",
    cmd: null,
    note: "Set Backend URL to your API endpoint",
  },
  {
    num: "05",
    title: "Set Gateway URL",
    cmd: null,
    note: "Point to your VM Manager for Gateway to Heaven",
  },
  {
    num: "06",
    title: "Add Workspace",
    cmd: null,
    note: "Add a project directory and start building",
  },
];

export default async function DownloadPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="flex flex-col flex-1">
      <nav className="w-full flex items-center justify-between px-8 py-4 border-b border-[#1a1a1a]">
        <Link href="/" className="text-cyan font-bold tracking-wider text-sm">
          CTHULU LAB
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/docs" className="px-3 py-1 text-xs text-[#808080] border border-[#333] hover:border-cyan hover:text-cyan transition-colors">
            API DOCS
          </Link>
          <span className="text-dim text-xs">{session.user.email}</span>
        </div>
      </nav>

      <main className="flex-1 w-full max-w-3xl mx-auto px-8 py-12 flex flex-col gap-10">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold tracking-wider">
              <span className="text-green">$</span> DOWNLOAD
            </h1>
            <span className="text-[9px] px-2 py-0.5 border border-cyan/30 text-cyan">
              EARLY ACCESS
            </span>
          </div>
          <p className="text-dim text-sm">
            welcome, <span className="text-cyan">{session.user.name || session.user.email}</span> — grab the Mac app and set up in minutes
          </p>
        </div>

        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="text-green text-xs font-bold tracking-wider mb-1">
              CTHULU LAB FOR MAC
            </div>
            <div className="text-dim text-xs">
              macOS 12+ — Apple Silicon & Intel
            </div>
            <div className="text-[#333] text-[10px] mt-1">
              available for macOS — early access
            </div>
          </div>
          <a
            href="/CthluLab-0.1.0-mac.dmg"
            download
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
            <div key={s.num} className="border border-[#1a1a1a] bg-[#0a0a0a] p-4 flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <span className="text-cyan text-xs font-bold">{s.num}</span>
                <span className="text-sm font-bold">{s.title}</span>
              </div>
              {s.cmd && (
                <pre className="text-green text-xs bg-black px-3 py-2 border border-[#1a1a1a] overflow-x-auto">
                  <span className="text-dim">$ </span>{s.cmd}
                </pre>
              )}
              {s.note && <p className="text-dim text-xs pl-7">{s.note}</p>}
            </div>
          ))}
        </div>

        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4 text-[10px] text-dim">
          <span className="text-cyan">what you get:</span> 5 AI agents, workflow canvas, VM gateway, Slack integration, cron scheduling, self-improving skills, keyboard shortcuts, terminal UI with glow effects.
        </div>
      </main>
    </div>
  );
}
