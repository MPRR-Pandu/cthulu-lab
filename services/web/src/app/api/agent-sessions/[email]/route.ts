import { agentSessions } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ email: string }> }
) {
  try {
    const { email } = await params;
    const col = await agentSessions();
    const docs = await col
      .find({ email })
      .sort({ updatedAt: -1 })
      .toArray();

    return Response.json({
      success: true,
      data: docs.map((d) => ({
        id: d._id!.toString(),
        agentId: d.agentId,
        messages: d.messages,
        updatedAt: d.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("List agent sessions error:", error);
    return Response.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ email: string }> }
) {
  try {
    const { email } = await params;
    const { agentId, messages } = await req.json();

    if (!agentId || !Array.isArray(messages)) {
      return Response.json(
        { success: false, error: "Missing agentId or messages array" },
        { status: 400 }
      );
    }

    const capped = messages.slice(-50);

    const col = await agentSessions();
    await col.updateOne(
      { email, agentId },
      {
        $set: {
          messages: capped,
          updatedAt: new Date(),
        },
        $setOnInsert: {
          email,
          agentId,
        },
      },
      { upsert: true }
    );

    return Response.json({ success: true });
  } catch (error) {
    console.error("Upsert agent session error:", error);
    return Response.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
