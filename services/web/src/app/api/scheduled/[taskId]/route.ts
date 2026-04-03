import { scheduledResponses } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params;
    const col = await scheduledResponses();
    const docs = await col
      .find({ taskId })
      .sort({ timestamp: -1 })
      .limit(5)
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
    console.error("Get scheduled responses error:", error);
    return Response.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
