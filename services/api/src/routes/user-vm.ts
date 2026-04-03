import { Router } from 'express';
import type { Request, Response } from 'express';
import { userVms } from '../lib/db.js';

const router = Router();

router.get('/:email', async (req: Request, res: Response) => {
  try {
    const doc = await userVms().findOne({ email: req.params.email });
    if (!doc) {
      res.json({ success: true, data: null });
      return;
    }
    res.json({
      success: true,
      data: {
        email: doc.email,
        vmId: doc.vmId,
        tier: doc.tier,
        sshPort: doc.sshPort,
        webPort: doc.webPort,
        sshCommand: doc.sshCommand,
        webTerminal: doc.webTerminal,
        createdAt: doc.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Get user VM error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { email, vmId, tier, sshPort, webPort, sshCommand, webTerminal } = req.body;

    if (!email || vmId === undefined) {
      res.status(400).json({ success: false, error: 'Missing fields' });
      return;
    }

    const existing = await userVms().findOne({ email });
    if (existing) {
      res.status(409).json({ success: false, error: 'User already has a VM', data: existing });
      return;
    }

    await userVms().insertOne({
      email,
      vmId,
      tier,
      sshPort,
      webPort,
      sshCommand,
      webTerminal,
      createdAt: new Date(),
    });

    res.status(201).json({ success: true });
  } catch (error) {
    console.error('Create user VM error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.put('/:email/slack-webhook', async (req: Request, res: Response) => {
  try {
    const { slackWebhook } = req.body;
    if (!slackWebhook) {
      res.status(400).json({ success: false, error: 'slackWebhook is required' });
      return;
    }

    const result = await userVms().updateOne(
      { email: req.params.email },
      { $set: { slackWebhook } }
    );

    if (result.matchedCount === 0) {
      res.status(404).json({ success: false, error: 'VM not found for user' });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Update slack webhook error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.delete('/:email', async (req: Request, res: Response) => {
  try {
    await userVms().deleteOne({ email: req.params.email });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete user VM error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
