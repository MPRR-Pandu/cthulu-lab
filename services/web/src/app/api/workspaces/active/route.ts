import { workspaces } from "@/lib/db";

export async function PUT(req: Request) {
  try {
    const { email, path } = await req.json();

    const col = await workspaces();
    await col.updateMany({ userId: email }, { $set: { active: false } });
    await col.updateOne({ userId: email, path }, { $set: { active: true } });

    const docs = await col.find({ userId: email }).sort({ createdAt: 1 }).toArray();
    return Response.json({
      success: true,
      data: docs.map((d) => ({
        id: d._id!.toString(),
        path: d.path,
        name: d.name,
        active: d.active,
      })),
    });
  } catch (error) {
    console.error("Switch workspace error:", error);
    return Response.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
