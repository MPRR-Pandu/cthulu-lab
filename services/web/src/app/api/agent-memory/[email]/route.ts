import { agentMemory } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ email: string }> }
) {
  try {
    const { email } = await params;
    const col = await agentMemory();
    const docs = await col
      .find({ email })
      .sort({ timestamp: -1 })
      .limit(200)
      .toArray();

    return Response.json({
      success: true,
      data: docs.map((d) => ({
        id: d._id!.toString(),
        agentId: d.agentId,
        task: d.task,
        result: d.result,
        timestamp: d.timestamp.toISOString(),
      })),
    });
  } catch (error) {
    console.error("List agent memories error:", error);
    return Response.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ email: string }> }
) {
  try {
    const { email } = await params;
    const { agentId, task, result } = await req.json();

    if (!agentId || !task || !result) {
      return Response.json(
        { success: false, error: "Missing fields" },
        { status: 400 }
      );
    }

    const col = await agentMemory();
    await col.insertOne({
      email,
      agentId,
      task,
      result,
      timestamp: new Date(),
    });

    return Response.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("Save agent memory error:", error);
    return Response.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ email: string }> }
) {
  try {
    const { email } = await params;
    const { agentId } = await req.json();

    if (!agentId) {
      return Response.json(
        { success: false, error: "Missing agentId" },
        { status: 400 }
      );
    }

    const col = await agentMemory();
    const result = await col.deleteMany({ email, agentId });

    return Response.json({
      success: true,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("Delete agent memories error:", error);
    return Response.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
