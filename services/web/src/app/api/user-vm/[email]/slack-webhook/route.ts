import { userVms } from "@/lib/db";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ email: string }> }
) {
  try {
    const { email } = await params;
    const { slackWebhook } = await req.json();
    if (!slackWebhook) {
      return Response.json(
        { success: false, error: "slackWebhook is required" },
        { status: 400 }
      );
    }

    const col = await userVms();
    const result = await col.updateOne({ email }, { $set: { slackWebhook } });

    if (result.matchedCount === 0) {
      return Response.json(
        { success: false, error: "VM not found for user" },
        { status: 404 }
      );
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Update slack webhook error:", error);
    return Response.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
