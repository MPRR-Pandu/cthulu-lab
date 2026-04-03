import { ObjectId } from "mongodb";
import { workflows } from "@/lib/db";

export async function POST(
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
    const wf = await col.findOne({ _id: oid } as never);
    if (!wf) {
      return Response.json(
        { success: false, error: "Workflow not found" },
        { status: 404 }
      );
    }

    const { active } = await req.json();
    await col.updateOne({ _id: oid } as never, {
      $set: { active: !!active },
    });
    return Response.json({
      success: true,
      data: {
        scriptPath: wf.scriptPath,
        schedule: wf.schedule,
        name: wf.name,
      },
    });
  } catch (error) {
    console.error("Toggle workflow error:", error);
    return Response.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
