import { ObjectId } from "mongodb";
import { workflows } from "@/lib/db";

export async function GET(
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

    return Response.json({
      success: true,
      data: wf.runs.map((r) => ({
        ...r,
        startedAt:
          r.startedAt instanceof Date
            ? r.startedAt.toISOString()
            : r.startedAt,
        completedAt:
          r.completedAt instanceof Date
            ? r.completedAt.toISOString()
            : r.completedAt,
      })),
    });
  } catch (error) {
    console.error("Get workflow runs error:", error);
    return Response.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
