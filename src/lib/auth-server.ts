/**
 * Server-side auth utilities for use in Server Components and Route Handlers.
 * Never import from client components.
 */
import { cookies, headers } from 'next/headers';
import { validateSession } from './auth';
import { redirect } from 'next/navigation';

export const ADMIN_SESSION_COOKIE = 'raasta_admin_session';

export async function getAdminSessionId(): Promise<string | null> {
  // Check cookie first (SSR / RSC flow)
  const cookieStore = cookies();
  const cookie = cookieStore.get(ADMIN_SESSION_COOKIE);
  if (cookie?.value) return cookie.value;

  // Fall back to x-admin-session header (direct API calls)
  const headersList = headers();
  return headersList.get('x-admin-session');
}

export async function requireAdmin(): Promise<void> {
  const sessionId = await getAdminSessionId();
  const valid = await validateSession(sessionId);
  if (!valid) {
    redirect('/manage-team?auth=required');
  }
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const sessionId = await getAdminSessionId();
  return validateSession(sessionId);
}
