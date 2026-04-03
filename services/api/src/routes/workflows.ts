import { Router } from 'express';
import type { Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { workflows } from '../lib/db.js';
import crypto from 'node:crypto';

const router = Router();

function safeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function generateScript(wf: { name: string; steps: { type: string; name?: string; command?: string; prompt?: string }[]; sinkConfig?: { type: string; webhookUrl?: string } }): string {
  const lines: string[] = [
    '#!/bin/bash',
    `# Workflow: ${wf.name}`,
    `# Generated: ${new Date().toISOString()}`,
    '',
    'export $(cat ~/.ssh/environment 2>/dev/null | xargs) 2>/dev/null',
    'WORKDIR=$(mktemp -d)',
    'trap "rm -rf $WORKDIR" EXIT',
    '',
  ];

  let fetchIdx = 0;
  const fetchFiles: string[] = [];

  for (const step of wf.steps) {
    const stepName = step.name || step.type;

    if (step.type === 'fetch') {
      const file = `$WORKDIR/fetch-${fetchIdx}.txt`;
      fetchFiles.push(file);
      lines.push(`echo "[$(date +%H:%M:%S)] FETCH: ${stepName}"`);
      lines.push(`${step.command || 'echo "no command"'} > ${file} 2>&1`);
      lines.push(`[ $? -ne 0 ] && echo "[$(date +%H:%M:%S)] FAILED: ${stepName}" && exit 1`);
      lines.push(`echo "[$(date +%H:%M:%S)] OK: $(wc -c < ${file}) bytes"`);
      lines.push('');
      fetchIdx++;
    } else if (step.type === 'claude') {
      const catParts = fetchFiles.map((f, i) => `echo "=== Data ${i + 1} ===" && head -c 10000 ${f}`);
      const promptB64 = Buffer.from(step.prompt || 'analyze the data').toString('base64');

      lines.push(`echo "[$(date +%H:%M:%S)] CLAUDE: ${stepName}"`);
      lines.push(`PROMPT=$(echo '${promptB64}' | base64 -d)`);
      lines.push(`(${catParts.join(' && echo "" && ')} && echo "" && echo "$PROMPT") | claude -p --output-format text --max-budget-usd 2.0 2>/dev/null > $WORKDIR/claude-output.txt`);
      lines.push(`[ $? -ne 0 ] && echo "[$(date +%H:%M:%S)] FAILED: ${stepName}" && exit 1`);
      lines.push(`echo "[$(date +%H:%M:%S)] OK: $(wc -c < $WORKDIR/claude-output.txt) bytes"`);
      lines.push('');
    }
  }

  const webhookUrl = wf.sinkConfig?.webhookUrl;
  if (webhookUrl && webhookUrl !== '$SLACK_WEBHOOK_URL') {
    lines.push(`WEBHOOK='${webhookUrl}'`);
  } else {
    lines.push(`source ~/.bashrc 2>/dev/null`);
    lines.push(`WEBHOOK="$SLACK_WEBHOOK_URL"`);
  }
  lines.push(`if [ -n "$WEBHOOK" ] && [ -f "$WORKDIR/claude-output.txt" ]; then`);
  lines.push(`  echo "[$(date +%H:%M:%S)] SLACK: posting"`);
  lines.push(`  python3 -c "import json,sys; print(json.dumps({'text': '*${wf.name.replace(/'/g, "\\'")}*\\n' + sys.stdin.read()}))" < $WORKDIR/claude-output.txt > $WORKDIR/slack.json`);
  lines.push(`  curl -s -X POST "$WEBHOOK" -H 'Content-Type: application/json' -d @$WORKDIR/slack.json`);
  lines.push(`  echo ""`);
  lines.push(`  echo "[$(date +%H:%M:%S)] SLACK: done"`);
  lines.push(`fi`);
  lines.push('');
  lines.push('echo "---OUTPUT---"');
  lines.push('cat $WORKDIR/claude-output.txt 2>/dev/null');

  return lines.join('\n');
}

// ── LIST ──
router.get('/:email', async (req: Request, res: Response) => {
  try {
    const docs = await workflows().find({ email: req.params.email as string }).sort({ createdAt: -1 }).toArray();
    const data = docs.map((d) => ({
      id: String(d._id), email: d.email, name: d.name, steps: d.steps,
      schedule: d.schedule, sink: d.sink, sinkConfig: d.sinkConfig,
      scriptPath: d.scriptPath, active: d.active,
      runs: d.runs.map((r) => ({
        ...r,
        startedAt: r.startedAt instanceof Date ? r.startedAt.toISOString() : r.startedAt,
        completedAt: r.completedAt instanceof Date ? r.completedAt.toISOString() : r.completedAt,
      })),
      createdAt: d.createdAt.toISOString(),
    }));
    res.json({ success: true, data });
  } catch (error) {
    console.error('List workflows error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ── GET SCRIPT ── returns generated bash script for Mac app to deploy
router.get('/:id/script', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    let oid: ObjectId;
    try { oid = new ObjectId(id); } catch { res.status(400).json({ success: false, error: 'Invalid ID' }); return; }

    const wf = await workflows().findOne({ _id: oid } as any);
    if (!wf) { res.status(404).json({ success: false, error: 'Workflow not found' }); return; }

    const script = generateScript({ name: wf.name, steps: wf.steps, sinkConfig: wf.sinkConfig });
    res.json({ success: true, data: { script, scriptPath: wf.scriptPath } });
  } catch (error) {
    console.error('Get workflow script error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ── CREATE ── saves to MongoDB only (Mac app handles VM deployment)
router.post('/', async (req: Request, res: Response) => {
  try {
    const { email, name, steps, schedule, sink, sinkConfig } = req.body;
    if (!email || !name || !steps || !Array.isArray(steps) || steps.length === 0) {
      res.status(400).json({ success: false, error: 'Missing required fields' });
      return;
    }

    const safeEmail = safeName(email.split('@')[0]);
    const safeWf = safeName(name);
    const scriptPath = `/root/workflows/${safeEmail}/${safeWf}/run.sh`;

    const result = await workflows().insertOne({
      email, name, steps, schedule: schedule || 'manual',
      sink: sink || 'slack', sinkConfig: sinkConfig || { type: 'slack' },
      scriptPath, active: true, runs: [], createdAt: new Date(),
    });

    res.status(201).json({ success: true, data: { id: result.insertedId.toString(), scriptPath } });
  } catch (error) {
    console.error('Create workflow error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ── UPDATE ── saves to MongoDB only (Mac app handles VM redeployment)
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    let oid: ObjectId;
    try { oid = new ObjectId(id); } catch { res.status(400).json({ success: false, error: 'Invalid ID' }); return; }

    const existing = await workflows().findOne({ _id: oid } as any);
    if (!existing) { res.status(404).json({ success: false, error: 'Workflow not found' }); return; }

    const { name, steps, schedule, sink, sinkConfig } = req.body;
    if (!name || !steps || !Array.isArray(steps) || steps.length === 0) {
      res.status(400).json({ success: false, error: 'Missing required fields' });
      return;
    }

    const safeEmail = safeName(existing.email.split('@')[0]);
    const newSafeWf = safeName(name);
    const scriptPath = `/root/workflows/${safeEmail}/${newSafeWf}/run.sh`;

    await workflows().updateOne({ _id: oid } as any, {
      $set: { name, steps, schedule: schedule || 'manual', sink: sink || 'slack', sinkConfig, scriptPath },
    });

    res.json({ success: true, data: { scriptPath } });
  } catch (error) {
    console.error('Update workflow error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ── DELETE ── removes from MongoDB only (Mac app handles VM cleanup)
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    let oid: ObjectId;
    try { oid = new ObjectId(id); } catch { res.status(400).json({ success: false, error: 'Invalid ID' }); return; }

    const wf = await workflows().findOne({ _id: oid } as any);
    const scriptPath = wf?.scriptPath;
    const wfName = wf?.name;

    await workflows().deleteOne({ _id: oid } as any);
    res.json({ success: true, data: { scriptPath, name: wfName } });
  } catch (error) {
    console.error('Delete workflow error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ── TOGGLE ── updates active status in MongoDB only (Mac app handles cron)
router.post('/:id/toggle', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    let oid: ObjectId;
    try { oid = new ObjectId(id); } catch { res.status(400).json({ success: false, error: 'Invalid ID' }); return; }

    const wf = await workflows().findOne({ _id: oid } as any);
    if (!wf) { res.status(404).json({ success: false, error: 'Workflow not found' }); return; }

    const { active } = req.body;
    await workflows().updateOne({ _id: oid } as any, { $set: { active: !!active } });
    res.json({ success: true, data: { scriptPath: wf.scriptPath, schedule: wf.schedule, name: wf.name } });
  } catch (error) {
    console.error('Toggle workflow error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ── RUN ── marks as running in MongoDB (Mac app handles execution + result save)
router.post('/:id/run', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    let oid: ObjectId;
    try { oid = new ObjectId(id); } catch { res.status(400).json({ success: false, error: 'Invalid ID' }); return; }

    const wf = await workflows().findOne({ _id: oid } as any);
    if (!wf) { res.status(404).json({ success: false, error: 'Workflow not found' }); return; }

    const lastRun = wf.runs[wf.runs.length - 1];
    if (lastRun?.status === 'running') {
      res.status(409).json({ success: false, error: 'Already running' });
      return;
    }

    const runId = crypto.randomUUID();
    const runEntry = { id: runId, startedAt: new Date(), status: 'running' as const, stepResults: [] as any[], finalOutput: '' };
    await workflows().updateOne({ _id: oid } as any, { $set: { runs: [...wf.runs, runEntry].slice(-5) } });

    res.json({ success: true, data: { runId, scriptPath: wf.scriptPath } });
  } catch (error) {
    console.error('Run workflow error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ── SAVE RUN RESULT ── called by Mac app after VM execution
router.put('/:id/runs/:runId', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const runId = req.params.runId as string;
    let oid: ObjectId;
    try { oid = new ObjectId(id); } catch { res.status(400).json({ success: false, error: 'Invalid ID' }); return; }

    const wf = await workflows().findOne({ _id: oid } as any);
    if (!wf) { res.status(404).json({ success: false, error: 'Workflow not found' }); return; }

    const { status, stepResults, finalOutput } = req.body;

    const completedRun = {
      id: runId,
      startedAt: wf.runs.find((r) => r.id === runId)?.startedAt || new Date(),
      completedAt: new Date(),
      status: status || 'failed',
      stepResults: stepResults || [],
      finalOutput: (finalOutput || '').slice(0, 2000),
    };

    await workflows().updateOne({ _id: oid } as any, {
      $set: { runs: [...wf.runs.filter((r) => r.id !== runId), completedRun].slice(-5) },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Save run result error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ── RUNS ──
router.get('/:id/runs', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    let oid: ObjectId;
    try { oid = new ObjectId(id); } catch { res.status(400).json({ success: false, error: 'Invalid ID' }); return; }

    const wf = await workflows().findOne({ _id: oid } as any);
    if (!wf) { res.status(404).json({ success: false, error: 'Workflow not found' }); return; }

    res.json({
      success: true,
      data: wf.runs.map((r) => ({
        ...r,
        startedAt: r.startedAt instanceof Date ? r.startedAt.toISOString() : r.startedAt,
        completedAt: r.completedAt instanceof Date ? r.completedAt.toISOString() : r.completedAt,
      })),
    });
  } catch (error) {
    console.error('Get workflow runs error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
