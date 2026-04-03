import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { connectDb } from './lib/db.js';
import authRoutes from './routes/auth.js';
import workspaceRoutes from './routes/workspaces.js';
import scheduledRoutes from './routes/scheduled.js';
import userVmRoutes from './routes/user-vm.js';
import oauthRoutes from './routes/oauth.js';
import workflowRoutes from './routes/workflows.js';

const app = express();

app.use(cors({
  origin: ['http://localhost:1420', 'tauri://localhost'],
  credentials: true,
}));

app.use(express.json({ limit: '10kb' }));

app.get('/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok' } });
});

app.use('/auth', authRoutes);
app.use('/workspaces', workspaceRoutes);
app.use('/scheduled', scheduledRoutes);
app.use('/user-vm', userVmRoutes);
app.use('/oauth', oauthRoutes);
app.use('/workflows', workflowRoutes);

app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Not found' });
});

async function start() {
  await connectDb();
  app.listen(env.PORT, () => {
    console.log(`Auth API running on port ${env.PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});

export default app;
