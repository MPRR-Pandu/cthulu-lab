import { workflows } from "@/lib/db";

function safeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function POST(req: Request) {
  try {
    const { email, name, steps, schedule, sink, sinkConfig } = await req.json();
    if (
      !email ||
      !name ||
      !steps ||
      !Array.isArray(steps) ||
      steps.length === 0
    ) {
      return Response.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const safeEmail = safeName(email.split("@")[0]);
    const safeWf = safeName(name);
    const scriptPath = `/root/workflows/${safeEmail}/${safeWf}/run.sh`;

    const col = await workflows();
    const result = await col.insertOne({
      email,
      name,
      steps,
      schedule: schedule || "manual",
      sink: sink || "slack",
      sinkConfig: sinkConfig || { type: "slack" },
      scriptPath,
      active: true,
      runs: [],
      createdAt: new Date(),
    });

    return Response.json(
      { success: true, data: { id: result.insertedId.toString(), scriptPath } },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create workflow error:", error);
    return Response.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
