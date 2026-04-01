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
