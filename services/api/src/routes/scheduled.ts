import { Router } from 'express';
import type { Request, Response } from 'express';
import { scheduledResponses } from '../lib/db.js';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    const { taskId, agentId, task, response } = req.body;

    if (!taskId || !agentId || !task || !response) {
      res.status(400).json({ success: false, error: 'Missing fields' });
      return;
    }

    await scheduledResponses().insertOne({
      taskId,
      agentId,
      task,
      response,
      timestamp: new Date(),
    });

    const all = await scheduledResponses()
      .find({ taskId })
      .sort({ timestamp: -1 })
      .skip(5)
      .toArray();

    if (all.length > 0) {
      const idsToDelete = all.map((d) => d._id!);
      await scheduledResponses().deleteMany({ _id: { $in: idsToDelete } });
    }

    res.status(201).json({ success: true });
  } catch (error) {
    console.error('Save scheduled response error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.get('/:taskId', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const docs = await scheduledResponses()
      .find({ taskId })
      .sort({ timestamp: -1 })
      .limit(5)
      .toArray();

    res.json({
      success: true,
      data: docs.map((d) => ({
        id: d._id!.toString(),
        taskId: d.taskId,
        agentId: d.agentId,
        task: d.task,
        response: d.response,
        timestamp: d.timestamp.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Get scheduled responses error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const docs = await scheduledResponses()
      .find({})
      .sort({ timestamp: -1 })
      .limit(20)
      .toArray();

    res.json({
      success: true,
      data: docs.map((d) => ({
        id: d._id!.toString(),
        taskId: d.taskId,
        agentId: d.agentId,
        task: d.task,
        response: d.response,
        timestamp: d.timestamp.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Get all scheduled responses error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
