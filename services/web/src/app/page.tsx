import Link from "next/link";

const features = [
  {
    title: "Agent Chat",
    desc: "Talk to Claude in your VM. Run commands, edit files, debug code -- all through natural language.",
    icon: ">_",
  },
  {
    title: "Workflows",
    desc: "Chain fetch + Claude steps into automated pipelines. Schedule with cron. Push results to Slack.",
    icon: "{}",
  },
  {
    title: "VM Gateway",
    desc: "Your own cloud VM with SSH access. Deploy agents, run workflows, persist state.",
    icon: "~/",
  },
];

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center">
      <nav className="w-full flex items-center justify-between px-8 py-4 border-b border-[#1a1a1a]">
        <span className="text-cyan font-bold tracking-wider text-sm">
          CTHULU LAB
        </span>
        <div className="flex gap-4">
          <Link
            href="/login"
            className="px-4 py-2 text-sm text-[#e0e0e0] border border-[#333] hover:border-cyan hover:text-cyan transition-colors"
          >
            LOGIN
          </Link>
        </div>
      </nav>

      <main className="flex flex-1 w-full max-w-4xl flex-col items-center justify-center px-8 py-24 gap-16">
        <div className="flex flex-col items-center gap-6 text-center">
          <h1
            className="text-6xl font-bold tracking-widest text-cyan"
            style={{ animation: "glow 3s ease-in-out infinite" }}
          >
            CTHULU LAB
          </h1>
          <p className="text-lg text-dim max-w-md">
            AI-Powered Workflow Automation for Your VM
          </p>
          <span
            className="inline-block w-2 h-5 bg-cyan"
            style={{ animation: "blink 1s step-end infinite" }}
          />
        </div>

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

        <div className="flex flex-col sm:flex-row gap-4">
          <Link
            href="/download"
            className="px-8 py-3 bg-cyan text-black font-bold text-sm tracking-wider hover:bg-cyan/80 transition-colors text-center"
          >
            DOWNLOAD FOR MAC
          </Link>
          <Link
            href="/login"
            className="px-8 py-3 border border-cyan text-cyan font-bold text-sm tracking-wider hover:bg-cyan/10 transition-colors text-center"
          >
            LOGIN
          </Link>
        </div>
      </main>

      <footer className="w-full border-t border-[#1a1a1a] px-8 py-4 text-center text-dim text-xs">
        cthulu lab -- autonomous agents for your cloud vm
      </footer>
    </div>
  );
}
