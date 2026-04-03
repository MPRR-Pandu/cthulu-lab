import { workflows } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ email: string }> }
) {
  try {
    const { email } = await params;
    const col = await workflows();
    const docs = await col
      .find({ email })
      .sort({ createdAt: -1 })
      .toArray();
    const data = docs.map((d) => ({
      id: String(d._id),
      email: d.email,
      name: d.name,
      steps: d.steps,
      schedule: d.schedule,
      sink: d.sink,
      sinkConfig: d.sinkConfig,
      scriptPath: d.scriptPath,
      active: d.active,
      runs: d.runs.map((r) => ({
        ...r,
        startedAt:
          r.startedAt instanceof Date
            ? r.startedAt.toISOString()
            : r.startedAt,
        completedAt:
          r.completedAt instanceof Date
            ? r.completedAt.toISOString()
            : r.completedAt,
      })),
      createdAt: d.createdAt.toISOString(),
    }));
    return Response.json({ success: true, data });
  } catch (error) {
    console.error("List workflows error:", error);
    return Response.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
