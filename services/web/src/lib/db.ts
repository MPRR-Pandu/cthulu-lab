import { MongoClient, type Db, type Collection } from "mongodb";

const MONGODB_URI =
  process.env.MONGODB_URI ||
  process.env.DATABASE_URL ||
  "mongodb://root:checkOne@localhost:27017/cthulu_lab?authSource=admin";

let client: MongoClient;
let db: Db;

if (process.env.NODE_ENV === "development") {
  const g = globalThis as unknown as { _mongoClient?: MongoClient };
  if (!g._mongoClient) {
    g._mongoClient = new MongoClient(MONGODB_URI);
  }
  client = g._mongoClient;
} else {
  client = new MongoClient(MONGODB_URI);
}

export async function getDb(): Promise<Db> {
  if (!db) {
    await client.connect();
    db = client.db();
  }
  return db;
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

export async function users(): Promise<Collection<UserDoc>> {
  const d = await getDb();
  return d.collection<UserDoc>("users");
}

export interface WorkspaceDoc {
  _id?: string;
  userId: string;
  path: string;
  name: string;
  active: boolean;
  createdAt: Date;
}

export async function workspaces(): Promise<Collection<WorkspaceDoc>> {
  const d = await getDb();
  return d.collection<WorkspaceDoc>("workspaces");
}

export interface ScheduledResponseDoc {
  _id?: string;
  taskId: string;
  agentId: string;
  task: string;
  response: string;
  timestamp: Date;
}

export async function scheduledResponses(): Promise<
  Collection<ScheduledResponseDoc>
> {
  const d = await getDb();
  return d.collection<ScheduledResponseDoc>("scheduled_responses");
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

export async function userVms(): Promise<Collection<UserVmDoc>> {
  const d = await getDb();
  return d.collection<UserVmDoc>("user_vms");
}

export interface WorkflowStepDoc {
  type: "fetch" | "claude";
  name?: string;
  command?: string;
  prompt?: string;
}

export interface WorkflowRunDoc {
  id: string;
  startedAt: Date;
  completedAt?: Date;
  status: "success" | "failed" | "running";
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

export async function workflows(): Promise<Collection<WorkflowDoc>> {
  const d = await getDb();
  return d.collection<WorkflowDoc>("workflows");
}
