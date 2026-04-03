import { MongoClient, type Db, type Collection } from 'mongodb';
import { env } from '../config/env.js';

const client = new MongoClient(env.DATABASE_URL);

let db: Db;

export async function connectDb(): Promise<void> {
  await client.connect();
  db = client.db();
  console.log('MongoDB connected');

  // Ensure indexes
  const users = db.collection('users');
  await users.createIndex({ email: 1 }, { unique: true });
  await users.createIndex({ username: 1 }, { unique: true });

  const sr = db.collection('scheduled_responses');
  await sr.createIndex({ taskId: 1, timestamp: -1 });

  const uv = db.collection('user_vms');
  await uv.createIndex({ email: 1 }, { unique: true });
}

export interface UserDoc {
  _id?: string;
  email: string;
  username: string;
  passwordHash: string;
  isVerified: boolean;
  refreshToken?: string | null;
  refreshTokenExpiresAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export function users(): Collection<UserDoc> {
  return db.collection<UserDoc>('users');
}

export interface WorkspaceDoc {
  _id?: string;
  userId: string;
  path: string;
  name: string;
  active: boolean;
  createdAt: Date;
}

export function workspaces(): Collection<WorkspaceDoc> {
  return db.collection<WorkspaceDoc>('workspaces');
}

export interface ScheduledResponseDoc {
  _id?: string;
  taskId: string;
  agentId: string;
  task: string;
  response: string;
  timestamp: Date;
}

export function scheduledResponses(): Collection<ScheduledResponseDoc> {
  return db.collection<ScheduledResponseDoc>('scheduled_responses');
}

export interface UserVmDoc {
  _id?: string;
  email: string;
  vmId: number;
  tier: string;
  sshPort: number;
  webPort: number;
  sshCommand: string;
  webTerminal: string;
  slackWebhook?: string;
  createdAt: Date;
}

export function userVms(): Collection<UserVmDoc> {
  return db.collection<UserVmDoc>('user_vms');
}

export interface WorkflowStepDoc {
  type: 'fetch' | 'claude';
  name?: string;
  command?: string;
  prompt?: string;
}

export interface WorkflowRunDoc {
  id: string;
  startedAt: Date;
  completedAt?: Date;
  status: 'success' | 'failed' | 'running';
  stepResults: { type: string; output: string; durationMs: number }[];
  finalOutput: string;
}

export interface WorkflowDoc {
  _id?: string;
  email: string;
  name: string;
  steps: WorkflowStepDoc[];
  schedule: string;
  sink: string;
  sinkConfig?: { type: string; webhookUrl?: string };
  scriptPath?: string;
  active: boolean;
  runs: WorkflowRunDoc[];
  createdAt: Date;
}

export function workflows(): Collection<WorkflowDoc> {
  return db.collection<WorkflowDoc>('workflows');
}
