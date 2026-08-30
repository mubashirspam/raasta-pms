import { config } from 'dotenv';
import type { Config } from 'drizzle-kit';

// drizzle-kit runs outside Next.js, so .env.local is not loaded for us.
config({ path: '.env.local' });

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  // strict:true always prompts for confirmation, which blocks non-interactive runs.
  strict: false,
} satisfies Config;
