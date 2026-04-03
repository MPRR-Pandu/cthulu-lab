import { workspaces } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const { email, path } = await req.json();

    if (!email || !path || typeof path !== "string") {
      return Response.json(
        { success: false, error: "Email and path are required" },
        { status: 400 }
      );
    }

    const col = await workspaces();

    const existing = await col.findOne({ userId: email, path });
    if (existing) {
      return Response.json(
        { success: false, error: "Workspace already exists" },
        { status: 409 }
      );
    }

    await col.updateMany({ userId: email }, { $set: { active: false } });

    const name = path.split("/").filter(Boolean).pop() || path;

    await col.insertOne({
      userId: email,
      path,
      name,
      active: true,
      createdAt: new Date(),
    });

    const docs = await col.find({ userId: email }).sort({ createdAt: 1 }).toArray();
    return Response.json(
      {
        success: true,
        data: docs.map((d) => ({
          id: d._id!.toString(),
          path: d.path,
          name: d.name,
          active: d.active,
        })),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Add workspace error:", error);
    return Response.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const { email, path } = await req.json();

    const col = await workspaces();
    await col.deleteOne({ userId: email, path });

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
    console.error("Remove workspace error:", error);
    return Response.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
