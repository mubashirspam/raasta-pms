import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import * as schema from './schema';
import * as relations from './relations';

// The neon-http driver cannot run transactions ("No transactions support in
// neon-http driver"), and several server actions write parent + child rows
// atomically. The WebSocket-backed pool supports them.
neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });

export const db = drizzle(pool, { schema: { ...schema, ...relations } });

export type DB = typeof db;
