import { ObjectId } from "mongodb";
import { workflows } from "@/lib/db";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; runId: string }> }
) {
  try {
    const { id, runId } = await params;
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

    const { status, stepResults, finalOutput } = await req.json();

    const completedRun = {
      id: runId,
      startedAt:
        wf.runs.find((r) => r.id === runId)?.startedAt || new Date(),
      completedAt: new Date(),
      status: status || "failed",
      stepResults: stepResults || [],
      finalOutput: (finalOutput || "").slice(0, 2000),
    };

    await col.updateOne({ _id: oid } as never, {
      $set: {
        runs: [
          ...wf.runs.filter((r) => r.id !== runId),
          completedRun,
        ].slice(-5),
      },
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error("Save run result error:", error);
    return Response.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
