'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { login, revokeSession, changeOwnPin } from '@/lib/auth';
import { SESSION_COOKIE, getCurrentUser, getSessionId } from '@/lib/auth-server';

export async function loginAction(
  username: string,
  pin: string,
): Promise<{ success: boolean; error?: string; role?: 'admin' | 'user' }> {
  const headersList = headers();
  const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1';
  const ua = headersList.get('user-agent') ?? undefined;

  const result = await login(username, pin, ip, ua);
  if (!result.sessionId) {
    return { success: false, error: result.error };
  }

  cookies().set(SESSION_COOKIE, result.sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 8 * 60 * 60, // 8 hours
    path: '/',
  });

  const user = await getCurrentUser();
  return { success: true, role: user?.role };
}

export async function logoutAction(): Promise<void> {
  const sessionId = getSessionId();
  if (sessionId) await revokeSession(sessionId);
  cookies().delete(SESSION_COOKIE);
  redirect('/login');
}

export async function changePinAction(
  currentPin: string,
  newPin: string,
): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'Not authenticated' };
  return changeOwnPin(user.id, currentPin, newPin);
}
