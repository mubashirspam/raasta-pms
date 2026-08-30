import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import * as schema from './schema';
import * as relations from './relations';

// The neon-http driver cannot run transactions ("No transactions support in
// neon-http driver"), and several server actions write parent + child rows
// atomically. The WebSocket-backed pool supports them.
neonConfig.webSocketConstructor = ws;

const connectionString = process.env.DATABASE_URL;

// Without a connection string pg quietly falls back to localhost, so the Neon
// driver dials wss://localhost/v2 inside the serverless function and every
// query dies with "ECONNREFUSED 127.0.0.1:443" — a WebSocket error that says
// nothing about the actual cause. Fail with the reason instead.
//
// `next build` imports this module without ever running a query, so a missing
// URL must not break the build.
if (!connectionString && process.env.NEXT_PHASE !== 'phase-production-build') {
  throw new Error(
    'DATABASE_URL is not set. Add it to the environment (on Vercel: Settings → ' +
      'Environment Variables, with the Production scope ticked) and redeploy — ' +
      'environment changes do not apply to existing deployments.',
  );
}

const pool = new Pool({ connectionString });

export const db = drizzle(pool, { schema: { ...schema, ...relations } });

export type DB = typeof db;
