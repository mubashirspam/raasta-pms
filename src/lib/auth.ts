import { db } from '@/db';
import { appUsers, sessions, teamMembers, auditLog } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';

const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

// In-memory rate limit store, keyed by username+ip. Resets on cold start, which
// is acceptable for a small internal deployment.
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    rateLimitMap.set(key, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= MAX_ATTEMPTS) return false;

  entry.count++;
  return true;
}

/** "Ahmed Khan" -> "ahmedkhan", with a numeric suffix if that is taken. */
export async function generateUsername(fullName: string): Promise<string> {
  const base =
    fullName
      .toLowerCase()
      .replace(/[^a-z]/g, '')
      .slice(0, 40) || 'user';

  const taken = await db
    .select({ username: appUsers.username })
    .from(appUsers)
    .where(sql`${appUsers.username} = ${base} or ${appUsers.username} like ${base + '%'}`);

  const used = new Set(taken.map((t) => t.username));
  if (!used.has(base)) return base;

  for (let i = 2; i < 1000; i++) {
    const candidate = `${base}${i}`;
    if (!used.has(candidate)) return candidate;
  }
  return `${base}${nanoid(4).toLowerCase()}`;
}

/** Random 4-digit PIN, zero-padded ("0042" is valid). */
export function generatePin(): string {
  return String(Math.floor(Math.random() * 10000)).padStart(4, '0');
}

export type AuthedUser = {
  id: string;
  username: string;
  role: 'admin' | 'user';
  memberId: string | null;
};

export async function login(
  username: string,
  pin: string,
  ip: string,
  userAgent?: string,
): Promise<{ sessionId: string | null; error?: string }> {
  const uname = username.trim().toLowerCase();

  if (!checkRateLimit(`${uname}:${ip}`)) {
    return { sessionId: null, error: 'Too many attempts. Try again in 15 minutes.' };
  }
  if (!/^\d{4}$/.test(pin)) {
    return { sessionId: null, error: 'PIN must be exactly 4 digits' };
  }

  const [user] = await db.select().from(appUsers).where(eq(appUsers.username, uname));

  // Same message either way so the form never reveals which usernames exist.
  if (!user || user.pin !== pin || !user.isActive) {
    return { sessionId: null, error: 'Incorrect username or PIN' };
  }

  const sessionId = nanoid(32);
  await db.insert(sessions).values({
    id: sessionId,
    userId: user.id,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    ipAddress: ip,
    userAgent,
  });

  return { sessionId };
}

export async function getUserBySession(sessionId: string | null): Promise<AuthedUser | null> {
  if (!sessionId) return null;

  const [row] = await db
    .select({
      id: appUsers.id,
      username: appUsers.username,
      role: appUsers.role,
      memberId: appUsers.memberId,
      isActive: appUsers.isActive,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .innerJoin(appUsers, eq(sessions.userId, appUsers.id))
    .where(eq(sessions.id, sessionId));

  if (!row || !row.isActive || row.expiresAt <= new Date()) return null;

  return {
    id: row.id,
    username: row.username,
    role: row.role as 'admin' | 'user',
    memberId: row.memberId,
  };
}

export async function revokeSession(sessionId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

/** Creates the login for a team member. Returns the generated credentials. */
export async function createUserForMember(
  memberId: string,
  fullName: string,
): Promise<{ username: string; pin: string }> {
  const username = await generateUsername(fullName);
  const pin = generatePin();

  await db.insert(appUsers).values({
    id: nanoid(12),
    username,
    pin,
    role: 'user',
    memberId,
  });

  return { username, pin };
}

export async function regeneratePin(userId: string): Promise<string> {
  const pin = generatePin();
  await db
    .update(appUsers)
    .set({ pin, updatedAt: new Date() })
    .where(eq(appUsers.id, userId));
  // Force a fresh login everywhere.
  await db.delete(sessions).where(eq(sessions.userId, userId));
  return pin;
}

export async function changeOwnPin(
  userId: string,
  currentPin: string,
  newPin: string,
): Promise<{ success: boolean; error?: string }> {
  if (!/^\d{4}$/.test(newPin)) {
    return { success: false, error: 'New PIN must be exactly 4 digits' };
  }

  const [user] = await db.select().from(appUsers).where(eq(appUsers.id, userId));
  if (!user) return { success: false, error: 'User not found' };
  if (user.pin !== currentPin) return { success: false, error: 'Current PIN is incorrect' };

  await db
    .update(appUsers)
    .set({ pin: newPin, updatedAt: new Date() })
    .where(eq(appUsers.id, userId));

  return { success: true };
}

export async function writeAudit(
  action: string,
  entityType: string,
  entityId: string | number | null,
  details?: unknown,
  actor = 'admin',
  ip?: string,
): Promise<void> {
  await db.insert(auditLog).values({
    action,
    entityType,
    entityId: entityId != null ? String(entityId) : null,
    actor,
    details: (details as Record<string, unknown>) ?? null,
    ipAddress: ip ?? null,
  });
}
