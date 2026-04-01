import { Router } from 'express';
import type { Request, Response } from 'express';
import { workspaces } from '../lib/db.js';
import { authenticate } from '../middleware/authenticate.js';

const router = Router();

router.use(authenticate);

// List user's workspaces
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const docs = await workspaces().find({ userId }).sort({ createdAt: 1 }).toArray();
    res.json({
      success: true,
      data: docs.map((d) => ({
        id: d._id!.toString(),
        path: d.path,
        name: d.name,
        active: d.active,
      })),
    });
  } catch (error) {
    console.error('List workspaces error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Add workspace
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { path } = req.body;

    if (!path || typeof path !== 'string') {
      res.status(400).json({ success: false, error: 'Path is required' });
      return;
    }

    // Check duplicate
    const existing = await workspaces().findOne({ userId, path });
    if (existing) {
      res.status(409).json({ success: false, error: 'Workspace already exists' });
      return;
    }

    // Deactivate all others, make this one active
    await workspaces().updateMany({ userId }, { $set: { active: false } });

    const name = path.split('/').filter(Boolean).pop() || path;

    await workspaces().insertOne({
      userId,
      path,
      name,
      active: true,
      createdAt: new Date(),
    });

    const docs = await workspaces().find({ userId }).sort({ createdAt: 1 }).toArray();
    res.status(201).json({
      success: true,
      data: docs.map((d) => ({
        id: d._id!.toString(),
        path: d.path,
        name: d.name,
        active: d.active,
      })),
    });
  } catch (error) {
    console.error('Add workspace error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Switch active workspace
router.put('/active', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { path } = req.body;

    await workspaces().updateMany({ userId }, { $set: { active: false } });
    await workspaces().updateOne({ userId, path }, { $set: { active: true } });

    const docs = await workspaces().find({ userId }).sort({ createdAt: 1 }).toArray();
    res.json({
      success: true,
      data: docs.map((d) => ({
        id: d._id!.toString(),
        path: d.path,
        name: d.name,
        active: d.active,
      })),
    });
  } catch (error) {
    console.error('Switch workspace error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Remove workspace
router.delete('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { path } = req.body;

    await workspaces().deleteOne({ userId, path });

    const docs = await workspaces().find({ userId }).sort({ createdAt: 1 }).toArray();
    res.json({
      success: true,
      data: docs.map((d) => ({
        id: d._id!.toString(),
        path: d.path,
        name: d.name,
        active: d.active,
      })),
    });
  } catch (error) {
    console.error('Remove workspace error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
