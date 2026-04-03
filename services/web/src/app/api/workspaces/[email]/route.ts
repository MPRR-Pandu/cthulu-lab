import { workspaces } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ email: string }> }
) {
  try {
    const { email } = await params;
    const col = await workspaces();
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
    console.error("List workspaces error:", error);
    return Response.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
