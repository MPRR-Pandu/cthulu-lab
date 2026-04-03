import { Router } from 'express';
import type { Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { workflows, userVms } from '../lib/db.js';
import crypto from 'node:crypto';

const router = Router();

router.get('/:email', async (req: Request, res: Response) => {
  try {
    const docs = await workflows()
      .find({ email: req.params.email as string })
      .sort({ createdAt: -1 })
      .toArray();

    const data = docs.map((d) => ({
      id: String(d._id),
      email: d.email,
      name: d.name,
      steps: d.steps,
      schedule: d.schedule,
      sink: d.sink,
      active: d.active,
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

router.post('/', async (req: Request, res: Response) => {
  try {
    const { email, name, steps, schedule, sink } = req.body;

    if (!email || !name || !steps || !Array.isArray(steps) || steps.length === 0) {
      res.status(400).json({ success: false, error: 'Missing required fields' });
      return;
    }

    await workflows().insertOne({
      email,
      name,
      steps,
      schedule: schedule || 'manual',
      sink: sink || 'ui',
      active: true,
      runs: [],
      createdAt: new Date(),
    });

    res.status(201).json({ success: true });
  } catch (error) {
    console.error('Create workflow error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    let oid: ObjectId;
    try {
      oid = new ObjectId(id);
    } catch {
      res.status(400).json({ success: false, error: 'Invalid ID' });
      return;
    }

    await workflows().deleteOne({ _id: oid } as any);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete workflow error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.post('/:id/run', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    let oid: ObjectId;
    try {
      oid = new ObjectId(id);
    } catch {
      res.status(400).json({ success: false, error: 'Invalid ID' });
      return;
    }

    const wf = await workflows().findOne({ _id: oid } as any);
    if (!wf) {
      res.status(404).json({ success: false, error: 'Workflow not found' });
      return;
    }

    const vm = await userVms().findOne({ email: wf.email });
    if (!vm) {
      res.status(404).json({ success: false, error: 'No VM found for user' });
      return;
    }

    const runId = crypto.randomUUID();
    const run = {
      id: runId,
      startedAt: new Date(),
      status: 'running' as const,
      stepResults: [] as { type: string; output: string; durationMs: number }[],
      finalOutput: '',
    };

    const runs = [...wf.runs, run].slice(-5);
    await workflows().updateOne({ _id: oid } as any, { $set: { runs } });

    res.json({ success: true, data: { runId } });
  } catch (error) {
    console.error('Run workflow error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.get('/:id/runs', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    let oid: ObjectId;
    try {
      oid = new ObjectId(id);
    } catch {
      res.status(400).json({ success: false, error: 'Invalid ID' });
      return;
    }

    const wf = await workflows().findOne({ _id: oid } as any);
    if (!wf) {
      res.status(404).json({ success: false, error: 'Workflow not found' });
      return;
    }

    const data = wf.runs.map((r) => ({
      ...r,
      startedAt: r.startedAt instanceof Date ? r.startedAt.toISOString() : r.startedAt,
      completedAt: r.completedAt instanceof Date ? r.completedAt.toISOString() : r.completedAt,
    }));

    res.json({ success: true, data });
  } catch (error) {
    console.error('Get workflow runs error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
