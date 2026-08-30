/**
 * Server-side auth utilities for Server Components and Route Handlers.
 * Never import from client components.
 */
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { teamMembers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getUserBySession, type AuthedUser } from './auth';

export const SESSION_COOKIE = 'raasta_session';

export function getSessionId(): string | null {
  return cookies().get(SESSION_COOKIE)?.value ?? null;
}

export async function getCurrentUser(): Promise<AuthedUser | null> {
  return getUserBySession(getSessionId());
}

/** The logged-in user plus their team-member record (category and position). */
export async function getCurrentMember() {
  const user = await getCurrentUser();
  if (!user?.memberId) return null;

  const member = await db.query.teamMembers.findFirst({
    where: eq(teamMembers.id, user.memberId),
    with: { category: true, position: true },
  });

  return member ? { user, member } : null;
}

/** Any authenticated user; sends anonymous visitors to the login screen. */
export async function requireUser(): Promise<AuthedUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

export async function requireAdmin(): Promise<AuthedUser> {
  const user = await requireUser();
  if (user.role !== 'admin') redirect('/home');
  return user;
}

/** A regular user with their member record; admins are sent to their own area. */
export async function requireMember() {
  const user = await requireUser();
  if (user.role === 'admin') redirect('/analytics');

  const ctx = await getCurrentMember();
  if (!ctx) redirect('/login');
  return ctx;
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const user = await getCurrentUser();
  return user?.role === 'admin';
}
