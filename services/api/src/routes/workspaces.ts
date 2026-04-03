import { Router } from 'express';
import type { Request, Response } from 'express';
import { workspaces } from '../lib/db.js';

const router = Router();

// No JWT auth — uses email param for user identification

// List user's workspaces
router.get('/:email', async (req: Request, res: Response) => {
  try {
    const email = req.params.email;
    const docs = await workspaces().find({ userId: email }).sort({ createdAt: 1 }).toArray();
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
    const { email, path } = req.body;

    if (!email || !path || typeof path !== 'string') {
      res.status(400).json({ success: false, error: 'Email and path are required' });
      return;
    }

    const existing = await workspaces().findOne({ userId: email, path });
    if (existing) {
      res.status(409).json({ success: false, error: 'Workspace already exists' });
      return;
    }

    await workspaces().updateMany({ userId: email }, { $set: { active: false } });

    const name = path.split('/').filter(Boolean).pop() || path;

    await workspaces().insertOne({
      userId: email,
      path,
      name,
      active: true,
      createdAt: new Date(),
    });

    const docs = await workspaces().find({ userId: email }).sort({ createdAt: 1 }).toArray();
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
    const { email, path } = req.body;

    await workspaces().updateMany({ userId: email }, { $set: { active: false } });
    await workspaces().updateOne({ userId: email, path }, { $set: { active: true } });

    const docs = await workspaces().find({ userId: email }).sort({ createdAt: 1 }).toArray();
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
    const { email, path } = req.body;

    await workspaces().deleteOne({ userId: email, path });

    const docs = await workspaces().find({ userId: email }).sort({ createdAt: 1 }).toArray();
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
