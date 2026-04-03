import { ObjectId } from "mongodb";
import { workflows } from "@/lib/db";

function safeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function PUT(
  req: Request,
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
    const existing = await col.findOne({ _id: oid } as never);
    if (!existing) {
      return Response.json(
        { success: false, error: "Workflow not found" },
        { status: 404 }
      );
    }

    const { name, steps, schedule, sink, sinkConfig } = await req.json();
    if (
      !name ||
      !steps ||
      !Array.isArray(steps) ||
      steps.length === 0
    ) {
      return Response.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const safeEmail = safeName(existing.email.split("@")[0]);
    const newSafeWf = safeName(name);
    const scriptPath = `/root/workflows/${safeEmail}/${newSafeWf}/run.sh`;

    await col.updateOne({ _id: oid } as never, {
      $set: {
        name,
        steps,
        schedule: schedule || "manual",
        sink: sink || "slack",
        sinkConfig,
        scriptPath,
      },
    });

    return Response.json({ success: true, data: { scriptPath } });
  } catch (error) {
    console.error("Update workflow error:", error);
    return Response.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
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
    const scriptPath = wf?.scriptPath;
    const wfName = wf?.name;

    await col.deleteOne({ _id: oid } as never);
    return Response.json({
      success: true,
      data: { scriptPath, name: wfName },
    });
  } catch (error) {
    console.error("Delete workflow error:", error);
    return Response.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
