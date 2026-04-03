import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getDb } from "@/lib/db";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const email = session.user.email || "";
  const db = await getDb();

  const workflowDocs = await db
    .collection("workflows")
    .find({ email })
    .sort({ createdAt: -1 })
    .limit(10)
    .toArray();

  const vmDoc = await db.collection("user_vms").findOne({ email });

  return (
    <div className="flex flex-col flex-1">
      <nav className="w-full flex items-center justify-between px-8 py-4 border-b border-[#1a1a1a]">
        <Link
          href="/"
          className="text-cyan font-bold tracking-wider text-sm"
        >
          CTHULU LAB
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-dim text-xs">{email}</span>
          <Link
            href="/download"
            className="px-3 py-1 text-xs border border-[#333] text-[#e0e0e0] hover:border-cyan hover:text-cyan transition-colors"
          >
            DOWNLOAD
          </Link>
        </div>
      </nav>

      <main className="flex-1 w-full max-w-5xl mx-auto px-8 py-8 flex flex-col gap-8">
        <div className="flex items-center gap-3">
          <span className="text-green">$</span>
          <h1 className="text-xl font-bold tracking-wider">DASHBOARD</h1>
          <span
            className="inline-block w-2 h-4 bg-cyan"
            style={{ animation: "blink 1s step-end infinite" }}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4">
            <div className="text-dim text-xs mb-1">WORKFLOWS</div>
            <div className="text-cyan text-2xl font-bold">
              {workflowDocs.length}
            </div>
          </div>
          <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4">
            <div className="text-dim text-xs mb-1">VM STATUS</div>
            <div
              className={`text-2xl font-bold ${vmDoc ? "text-green" : "text-dim"}`}
            >
              {vmDoc ? "ONLINE" : "NONE"}
            </div>
          </div>
          <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4">
            <div className="text-dim text-xs mb-1">SSH</div>
            <div className="text-sm text-[#e0e0e0] truncate">
              {vmDoc ? (vmDoc as Record<string, unknown>).sshCommand as string : "--"}
            </div>
          </div>
        </div>

        <div className="border border-[#1a1a1a] bg-[#0a0a0a]">
          <div className="px-4 py-3 border-b border-[#1a1a1a] flex items-center justify-between">
            <span className="text-green text-xs font-bold tracking-wider">
              WORKFLOWS
            </span>
          </div>
          {workflowDocs.length === 0 ? (
            <div className="px-4 py-8 text-center text-dim text-sm">
              No workflows yet. Create one from the Mac app.
            </div>
          ) : (
            <div className="divide-y divide-[#1a1a1a]">
              {workflowDocs.map((wf) => (
                <div
                  key={String(wf._id)}
                  className="px-4 py-3 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-2 h-2 rounded-full ${wf.active ? "bg-green" : "bg-dim"}`}
                    />
                    <span className="text-sm">{wf.name as string}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-dim">
                    <span>{wf.schedule as string}</span>
                    <span>
                      {((wf.steps as unknown[]) || []).length} steps
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="text-dim text-xs">
          <span className="text-green">tip:</span> manage workflows and VM
          from the{" "}
          <Link href="/download" className="text-cyan hover:underline">
            Mac app
          </Link>
        </div>
      </main>
    </div>
  );
}
