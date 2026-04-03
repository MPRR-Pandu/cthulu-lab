import { ObjectId } from "mongodb";
import { workflows } from "@/lib/db";

function generateScript(wf: {
  name: string;
  steps: { type: string; name?: string; command?: string; prompt?: string }[];
  sinkConfig?: { type: string; webhookUrl?: string };
}): string {
  const lines: string[] = [
    "#!/bin/bash",
    `# Workflow: ${wf.name}`,
    `# Generated: ${new Date().toISOString()}`,
    "",
    "export $(cat ~/.ssh/environment 2>/dev/null | xargs) 2>/dev/null",
    "WORKDIR=$(mktemp -d)",
    'trap "rm -rf $WORKDIR" EXIT',
    "",
  ];

  let fetchIdx = 0;
  const fetchFiles: string[] = [];

  for (const step of wf.steps) {
    const stepName = step.name || step.type;

    if (step.type === "fetch") {
      const file = `$WORKDIR/fetch-${fetchIdx}.txt`;
      fetchFiles.push(file);
      lines.push(`echo "[$(date +%H:%M:%S)] FETCH: ${stepName}"`);
      lines.push(`${step.command || 'echo "no command"'} > ${file} 2>&1`);
      lines.push(
        `[ $? -ne 0 ] && echo "[$(date +%H:%M:%S)] FAILED: ${stepName}" && exit 1`
      );
      lines.push(
        `echo "[$(date +%H:%M:%S)] OK: $(wc -c < ${file}) bytes"`
      );
      lines.push("");
      fetchIdx++;
    } else if (step.type === "claude") {
      const catParts = fetchFiles.map(
        (f, i) => `echo "=== Data ${i + 1} ===" && head -c 10000 ${f}`
      );
      const promptB64 = Buffer.from(
        step.prompt || "analyze the data"
      ).toString("base64");

      lines.push(`echo "[$(date +%H:%M:%S)] CLAUDE: ${stepName}"`);
      lines.push(`PROMPT=$(echo '${promptB64}' | base64 -d)`);
      lines.push(
        `(${catParts.join(' && echo "" && ')} && echo "" && echo "$PROMPT") | claude -p --output-format text --max-budget-usd 2.0 2>/dev/null > $WORKDIR/claude-output.txt`
      );
      lines.push(
        `[ $? -ne 0 ] && echo "[$(date +%H:%M:%S)] FAILED: ${stepName}" && exit 1`
      );
      lines.push(
        `echo "[$(date +%H:%M:%S)] OK: $(wc -c < $WORKDIR/claude-output.txt) bytes"`
      );
      lines.push("");
    }
  }

  const webhookUrl = wf.sinkConfig?.webhookUrl;
  if (webhookUrl && webhookUrl !== "$SLACK_WEBHOOK_URL") {
    lines.push(`WEBHOOK='${webhookUrl}'`);
  } else {
    lines.push(`source ~/.bashrc 2>/dev/null`);
    lines.push(`WEBHOOK="$SLACK_WEBHOOK_URL"`);
  }
  lines.push(
    `if [ -n "$WEBHOOK" ] && [ -f "$WORKDIR/claude-output.txt" ]; then`
  );
  lines.push(`  echo "[$(date +%H:%M:%S)] SLACK: posting"`);
  lines.push(
    `  python3 -c "import json,sys; print(json.dumps({'text': '*${wf.name.replace(/'/g, "\\'")}*\\n' + sys.stdin.read()}))" < $WORKDIR/claude-output.txt > $WORKDIR/slack.json`
  );
  lines.push(
    `  curl -s -X POST "$WEBHOOK" -H 'Content-Type: application/json' -d @$WORKDIR/slack.json`
  );
  lines.push(`  echo ""`);
  lines.push(`  echo "[$(date +%H:%M:%S)] SLACK: done"`);
  lines.push(`fi`);
  lines.push("");
  lines.push('echo "---OUTPUT---"');
  lines.push("cat $WORKDIR/claude-output.txt 2>/dev/null");

  return lines.join("\n");
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    let oid: ObjectId;
    try {
      oid = new ObjectId(id);
    } catch {
      return Response.json(
        { success: false, error: "Invalid ID" },
        { status: 400 }
      );
    }

    const col = await workflows();
    const wf = await col.findOne({ _id: oid } as never);
    if (!wf) {
      return Response.json(
        { success: false, error: "Workflow not found" },
        { status: 404 }
      );
    }

    const script = generateScript({
      name: wf.name,
      steps: wf.steps,
      sinkConfig: wf.sinkConfig,
    });
    return Response.json({
      success: true,
      data: { script, scriptPath: wf.scriptPath },
    });
  } catch (error) {
    console.error("Get workflow script error:", error);
    return Response.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
