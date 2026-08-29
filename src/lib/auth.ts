import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '@/db';
import { adminSettings, adminSessions, auditLog } from '@/db/schema';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
  }),
  secret: process.env.BETTER_AUTH_SECRET!,
  baseURL: process.env.BETTER_AUTH_URL ?? process.env.NEXTAUTH_URL ?? 'http://localhost:3000',
  emailAndPassword: {
    enabled: false, // We use a custom credentials flow
  },
  plugins: [],
});

// ─── Custom PIN auth helpers (not using Better Auth sessions) ─────────────────
// We keep a custom admin_sessions table for the PIN flow so the UX stays identical
// to the original Express build. Better Auth is available if SSO is added later.

const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

// In-memory rate limit store (resets on cold start — acceptable for a single-admin app)
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();

function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return { allowed: true, remaining: MAX_ATTEMPTS - 1 };
  }

  if (entry.count >= MAX_ATTEMPTS) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: MAX_ATTEMPTS - entry.count };
}

export async function isPinConfigured(): Promise<boolean> {
  const [settings] = await db
    .select({ pinSet: adminSettings.pinSet })
    .from(adminSettings)
    .where(eq(adminSettings.id, 1));
  return settings?.pinSet ?? false;
}

export async function setupPin(pin: string): Promise<{ success: boolean; error?: string }> {
  if (!/^\d{4}$/.test(pin)) {
    return { success: false, error: 'PIN must be exactly 4 digits' };
  }

  const already = await isPinConfigured();
  if (already) {
    return { success: false, error: 'PIN already configured. Use change-pin instead.' };
  }

  const hash = await bcrypt.hash(pin, 12);

  await db
    .insert(adminSettings)
    .values({ id: 1, pinHash: hash, pinSet: true })
    .onConflictDoUpdate({
      target: adminSettings.id,
      set: { pinHash: hash, pinSet: true, updatedAt: new Date() },
    });

  return { success: true };
}

export async function verifyPinAndCreateSession(
  pin: string,
  ip: string,
  userAgent?: string,
): Promise<{ sessionId: string | null; error?: string; tooManyAttempts?: boolean }> {
  const { allowed } = checkRateLimit(ip);
  if (!allowed) {
    return {
      sessionId: null,
      error: 'Too many attempts. Try again in 15 minutes.',
      tooManyAttempts: true,
    };
  }

  if (!/^\d{4}$/.test(pin)) {
    return { sessionId: null, error: 'Invalid PIN format' };
  }

  const [settings] = await db.select().from(adminSettings).where(eq(adminSettings.id, 1));

  if (!settings?.pinHash) {
    return { sessionId: null, error: 'PIN not configured' };
  }

  const valid = await bcrypt.compare(pin, settings.pinHash);
  if (!valid) {
    return { sessionId: null, error: 'Incorrect PIN' };
  }

  const sessionId = nanoid(32);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await db.insert(adminSessions).values({
    id: sessionId,
    expiresAt,
    ipAddress: ip,
    userAgent,
  });

  return { sessionId };
}

export async function validateSession(sessionId: string | null): Promise<boolean> {
  if (!sessionId) return false;

  const [session] = await db
    .select({ expiresAt: adminSessions.expiresAt })
    .from(adminSessions)
    .where(eq(adminSessions.id, sessionId));

  if (!session) return false;
  return session.expiresAt > new Date();
}

export async function revokeSession(sessionId: string): Promise<void> {
  await db.delete(adminSessions).where(eq(adminSessions.id, sessionId));
}

export async function changePin(
  currentPin: string,
  newPin: string,
  sessionId: string,
): Promise<{ success: boolean; error?: string }> {
  const isValid = await validateSession(sessionId);
  if (!isValid) return { success: false, error: 'Not authenticated' };

  if (!/^\d{4}$/.test(newPin)) {
    return { success: false, error: 'New PIN must be exactly 4 digits' };
  }

  const [settings] = await db.select().from(adminSettings).where(eq(adminSettings.id, 1));

  if (!settings?.pinHash) {
    return { success: false, error: 'PIN not configured' };
  }

  const valid = await bcrypt.compare(currentPin, settings.pinHash);
  if (!valid) {
    return { success: false, error: 'Current PIN is incorrect' };
  }

  const hash = await bcrypt.hash(newPin, 12);

  await db
    .update(adminSettings)
    .set({ pinHash: hash, updatedAt: new Date() })
    .where(eq(adminSettings.id, 1));

  // Revoke all existing sessions
  await db.delete(adminSessions);

  return { success: true };
}

export async function writeAudit(
  action: string,
  entityType: string,
  entityId: string | number | null,
  details?: unknown,
  ip?: string,
): Promise<void> {
  await db.insert(auditLog).values({
    action,
    entityType,
    entityId: entityId != null ? String(entityId) : null,
    actor: 'admin',
    details: details as Record<string, unknown> ?? null,
    ipAddress: ip ?? null,
  });
}
