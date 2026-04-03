import { ObjectId } from "mongodb";
import crypto from "node:crypto";
import { workflows } from "@/lib/db";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    let oid: ObjectId;
    try {
      oid = new ObjectId(id);
    } catch {
      return Response.json(
        { success: false, error: "Invalid ID" },
        { status: 400 }
      );
    }

    const col = await workflows();
    const wf = await col.findOne({ _id: oid } as never);
    if (!wf) {
      return Response.json(
        { success: false, error: "Workflow not found" },
        { status: 404 }
      );
    }

    const lastRun = wf.runs[wf.runs.length - 1];
    if (lastRun?.status === "running") {
      return Response.json(
        { success: false, error: "Already running" },
        { status: 409 }
      );
    }

    const runId = crypto.randomUUID();
    const runEntry = {
      id: runId,
      startedAt: new Date(),
      status: "running" as const,
      stepResults: [] as { type: string; output: string; durationMs: number }[],
      finalOutput: "",
    };
    await col.updateOne({ _id: oid } as never, {
      $set: { runs: [...wf.runs, runEntry].slice(-5) },
    });

    return Response.json({
      success: true,
      data: { runId, scriptPath: wf.scriptPath },
    });
  } catch (error) {
    console.error("Run workflow error:", error);
    return Response.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
