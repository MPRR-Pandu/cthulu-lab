import { Router } from 'express';
import type { Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { workflows, userVms } from '../lib/db.js';
import crypto from 'node:crypto';

const router = Router();
const GATEWAY = process.env.GATEWAY_URL || 'http://34.100.130.60:8080';

async function vmExec(vmId: number, command: string, timeout = 30): Promise<{ exit_code: number; stdout: string; stderr: string }> {
  const res = await fetch(`${GATEWAY}/vms/${vmId}/exec`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command, timeout }),
  });
  return res.json() as Promise<{ exit_code: number; stdout: string; stderr: string }>;
}

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

  // Slack sink
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

// ── CREATE ── generates script, deploys to VM, sets up cron
router.post('/', async (req: Request, res: Response) => {
  try {
    const { email, name, steps, schedule, sink, sinkConfig } = req.body;
    if (!email || !name || !steps || !Array.isArray(steps) || steps.length === 0) {
      res.status(400).json({ success: false, error: 'Missing required fields' });
      return;
    }

    const vm = await userVms().findOne({ email });
    const safeEmail = safeName(email.split('@')[0]);
    const safeWf = safeName(name);
    const scriptPath = `/root/workflows/${safeEmail}/${safeWf}/run.sh`;

    const script = generateScript({ name, steps, sinkConfig });
    const scriptB64 = Buffer.from(script).toString('base64');

    if (vm) {
      // Deploy script to VM
      const deployCmd = `mkdir -p /root/workflows/${safeEmail}/${safeWf} && echo '${scriptB64}' | base64 -d > ${scriptPath} && chmod +x ${scriptPath} && echo DEPLOYED`;
      const result = await vmExec(vm.vmId, deployCmd);
      console.log(`[workflow] Deploy ${scriptPath}: ${result.stdout.trim()}`);

      // Set up cron if scheduled — schedule IS the cron expression
      if (schedule && schedule !== 'manual') {
        const cronCmd = `(crontab -l 2>/dev/null | grep -v '${safeWf}/run.sh'; echo "${schedule} ${scriptPath} >> /root/workflows/${safeEmail}/${safeWf}/cron.log 2>&1") | crontab -`;
        await vmExec(vm.vmId, cronCmd);
        console.log(`[workflow] Cron: ${schedule} ${scriptPath}`);
      }
    }

    await workflows().insertOne({
      email, name, steps, schedule: schedule || 'manual',
      sink: sink || 'slack', sinkConfig: sinkConfig || { type: 'slack' },
      scriptPath, active: true, runs: [], createdAt: new Date(),
    });

    res.status(201).json({ success: true });
  } catch (error) {
    console.error('Create workflow error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ── UPDATE ── regenerates script, redeploys to VM, updates cron
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

    const vm = await userVms().findOne({ email: existing.email });
    const safeEmail = safeName(existing.email.split('@')[0]);
    const oldSafeWf = safeName(existing.name);
    const newSafeWf = safeName(name);
    const scriptPath = `/root/workflows/${safeEmail}/${newSafeWf}/run.sh`;

    const script = generateScript({ name, steps, sinkConfig });
    const scriptB64 = Buffer.from(script).toString('base64');

    if (vm) {
      // Remove old script + cron if name changed
      if (oldSafeWf !== newSafeWf && existing.scriptPath) {
        const oldDir = existing.scriptPath.replace('/run.sh', '');
        await vmExec(vm.vmId, `rm -rf ${oldDir} && (crontab -l 2>/dev/null | grep -v '${oldSafeWf}/run.sh') | crontab - 2>/dev/null; echo OK`).catch(() => {});
      } else {
        // Remove old cron entry
        await vmExec(vm.vmId, `(crontab -l 2>/dev/null | grep -v '${oldSafeWf}/run.sh') | crontab - 2>/dev/null; echo OK`).catch(() => {});
      }

      // Deploy new script
      const deployCmd = `mkdir -p /root/workflows/${safeEmail}/${newSafeWf} && echo '${scriptB64}' | base64 -d > ${scriptPath} && chmod +x ${scriptPath} && echo DEPLOYED`;
      const result = await vmExec(vm.vmId, deployCmd);
      console.log(`[workflow] Redeploy ${scriptPath}: ${result.stdout.trim()}`);

      // Set up new cron if scheduled
      if (schedule && schedule !== 'manual') {
        const cronCmd = `(crontab -l 2>/dev/null | grep -v '${newSafeWf}/run.sh'; echo "${schedule} ${scriptPath} >> /root/workflows/${safeEmail}/${newSafeWf}/cron.log 2>&1") | crontab -`;
        await vmExec(vm.vmId, cronCmd);
        console.log(`[workflow] Cron updated: ${schedule} ${scriptPath}`);
      }
    }

    // Update MongoDB
    await workflows().updateOne({ _id: oid } as any, {
      $set: { name, steps, schedule: schedule || 'manual', sink: sink || 'slack', sinkConfig, scriptPath },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Update workflow error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ── DELETE ── removes script + cron from VM
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    let oid: ObjectId;
    try { oid = new ObjectId(id); } catch { res.status(400).json({ success: false, error: 'Invalid ID' }); return; }

    const wf = await workflows().findOne({ _id: oid } as any);
    if (wf) {
      const vm = await userVms().findOne({ email: wf.email });
      if (vm && wf.scriptPath) {
        const dir = wf.scriptPath.replace('/run.sh', '');
        const safeWf = safeName(wf.name);
        await vmExec(vm.vmId, `rm -rf ${dir} && (crontab -l 2>/dev/null | grep -v '${safeWf}/run.sh') | crontab - 2>/dev/null; echo OK`).catch(() => {});
      }
    }

    await workflows().deleteOne({ _id: oid } as any);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete workflow error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ── TOGGLE ── enable/disable cron without changing schedule
router.post('/:id/toggle', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    let oid: ObjectId;
    try { oid = new ObjectId(id); } catch { res.status(400).json({ success: false, error: 'Invalid ID' }); return; }

    const wf = await workflows().findOne({ _id: oid } as any);
    if (!wf) { res.status(404).json({ success: false, error: 'Workflow not found' }); return; }

    const { active } = req.body;
    const vm = await userVms().findOne({ email: wf.email });

    if (vm && wf.scriptPath) {
      const safeWf = safeName(wf.name);

      if (active && wf.schedule !== 'manual') {
        // Enable cron — schedule IS the cron expression
        const safeEmail = safeName(wf.email.split('@')[0]);
        const cronCmd = `(crontab -l 2>/dev/null | grep -v '${safeWf}/run.sh'; echo "${wf.schedule} ${wf.scriptPath} >> /root/workflows/${safeEmail}/${safeWf}/cron.log 2>&1") | crontab -`;
        await vmExec(vm.vmId, cronCmd);
        console.log(`[workflow] Cron ENABLED: ${wf.name} (${wf.schedule})`);
      } else {
        // Disable cron
        const cronCmd = `(crontab -l 2>/dev/null | grep -v '${safeWf}/run.sh') | crontab - 2>/dev/null; echo OK`;
        await vmExec(vm.vmId, cronCmd);
        console.log(`[workflow] Cron DISABLED: ${wf.name}`);
      }
    }

    await workflows().updateOne({ _id: oid } as any, { $set: { active: !!active } });
    res.json({ success: true });
  } catch (error) {
    console.error('Toggle workflow error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ── RUN ── executes the script in VM
router.post('/:id/run', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    let oid: ObjectId;
    try { oid = new ObjectId(id); } catch { res.status(400).json({ success: false, error: 'Invalid ID' }); return; }

    const wf = await workflows().findOne({ _id: oid } as any);
    if (!wf) { res.status(404).json({ success: false, error: 'Workflow not found' }); return; }

    const vm = await userVms().findOne({ email: wf.email });
    if (!vm) { res.status(404).json({ success: false, error: 'No VM found' }); return; }

    const lastRun = wf.runs[wf.runs.length - 1];
    if (lastRun?.status === 'running') {
      res.status(409).json({ success: false, error: 'Already running' });
      return;
    }

    const runId = crypto.randomUUID();
    const runEntry = { id: runId, startedAt: new Date(), status: 'running' as const, stepResults: [] as any[], finalOutput: '' };
    await workflows().updateOne({ _id: oid } as any, { $set: { runs: [...wf.runs, runEntry].slice(-5) } });

    res.json({ success: true, data: { runId } });

    // Execute script in background
    (async () => {
      const start = Date.now();
      console.log(`[workflow] RUN ${wf.name}: ${wf.scriptPath}`);

      try {
        const result = await vmExec(vm.vmId, wf.scriptPath || 'echo "no script"', 180);
        const stdout = result.stdout || '';
        const stderr = result.stderr || '';

        const parts = stdout.split('---OUTPUT---');
        const trace = parts[0] || '';
        const claudeOutput = (parts[1] || '').trim();

        const stepResults = trace.split('\n').filter(l => l.startsWith('[')).map(l => ({
          type: l.replace(/\[.*?\]\s*/, ''),
          output: l,
          durationMs: 0,
        }));

        const status = result.exit_code === 0 ? 'success' as const : 'failed' as const;

        const completedRun = {
          id: runId, startedAt: new Date(start), completedAt: new Date(),
          status, stepResults, finalOutput: (claudeOutput || stderr || trace.slice(-500)).slice(0, 2000),
        };

        const current = await workflows().findOne({ _id: oid } as any);
        if (current) {
          await workflows().updateOne({ _id: oid } as any, {
            $set: { runs: [...current.runs.filter((r: any) => r.id !== runId), completedRun].slice(-5) },
          });
        }
        console.log(`[workflow] ${wf.name}: ${status} (${Date.now() - start}ms)`);
      } catch (err) {
        console.error(`[workflow] ${wf.name} error:`, err);
        const current = await workflows().findOne({ _id: oid } as any);
        if (current) {
          const failedRun = {
            id: runId, startedAt: new Date(start), completedAt: new Date(),
            status: 'failed' as const, stepResults: [{ type: 'error', output: String(err), durationMs: 0 }],
            finalOutput: String(err),
          };
          await workflows().updateOne({ _id: oid } as any, {
            $set: { runs: [...current.runs.filter((r: any) => r.id !== runId), failedRun].slice(-5) },
          });
        }
      }
    })();
  } catch (error) {
    console.error('Run workflow error:', error);
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
