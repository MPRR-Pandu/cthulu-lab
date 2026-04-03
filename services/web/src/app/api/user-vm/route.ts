import { userVms } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const { email, vmId, tier, sshPort, webPort, sshCommand, webTerminal } =
      await req.json();

    if (!email || vmId === undefined) {
      return Response.json(
        { success: false, error: "Missing fields" },
        { status: 400 }
      );
    }

    const col = await userVms();
    const existing = await col.findOne({ email });
    if (existing) {
      return Response.json(
        { success: false, error: "User already has a VM", data: existing },
        { status: 409 }
      );
    }

    await col.insertOne({
      email,
      vmId,
      tier,
      sshPort,
      webPort,
      sshCommand,
      webTerminal,
      createdAt: new Date(),
    });

    return Response.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("Create user VM error:", error);
    return Response.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
