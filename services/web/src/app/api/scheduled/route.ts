import { scheduledResponses } from "@/lib/db";

export async function GET() {
  try {
    const col = await scheduledResponses();
    const docs = await col
      .find({})
      .sort({ timestamp: -1 })
      .limit(20)
      .toArray();

    return Response.json({
      success: true,
      data: docs.map((d) => ({
        id: d._id!.toString(),
        taskId: d.taskId,
        agentId: d.agentId,
        task: d.task,
        response: d.response,
        timestamp: d.timestamp.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Get all scheduled responses error:", error);
    return Response.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { taskId, agentId, task, response } = await req.json();

    if (!taskId || !agentId || !task || !response) {
      return Response.json(
        { success: false, error: "Missing fields" },
        { status: 400 }
      );
    }

    const col = await scheduledResponses();
    await col.insertOne({
      taskId,
      agentId,
      task,
      response,
      timestamp: new Date(),
    });

    const all = await col
      .find({ taskId })
      .sort({ timestamp: -1 })
      .skip(5)
      .toArray();

    if (all.length > 0) {
      const idsToDelete = all.map((d) => d._id!);
      await col.deleteMany({ _id: { $in: idsToDelete } });
    }

    return Response.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("Save scheduled response error:", error);
    return Response.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
