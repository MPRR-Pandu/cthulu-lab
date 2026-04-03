import { userVms } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ email: string }> }
) {
  try {
    const { email } = await params;
    const col = await userVms();
    const doc = await col.findOne({ email });
    if (!doc) {
      return Response.json({ success: true, data: null });
    }
    return Response.json({
      success: true,
      data: {
        email: doc.email,
        vmId: doc.vmId,
        tier: doc.tier,
        sshPort: doc.sshPort,
        webPort: doc.webPort,
        sshCommand: doc.sshCommand,
        webTerminal: doc.webTerminal,
        createdAt: doc.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Get user VM error:", error);
    return Response.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ email: string }> }
) {
  try {
    const { email } = await params;
    const col = await userVms();
    await col.deleteOne({ email });
    return Response.json({ success: true });
  } catch (error) {
    console.error("Delete user VM error:", error);
    return Response.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
