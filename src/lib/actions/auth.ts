'use server';

import { cookies, headers } from 'next/headers';
import {
  isPinConfigured,
  setupPin,
  verifyPinAndCreateSession,
  revokeSession,
  changePin,
} from '@/lib/auth';
import { ADMIN_SESSION_COOKIE } from '@/lib/auth-server';

export async function checkPinStatus(): Promise<{ configured: boolean }> {
  const configured = await isPinConfigured();
  return { configured };
}

export async function setupPinAction(
  pin: string,
): Promise<{ success: boolean; error?: string }> {
  return setupPin(pin);
}

export async function loginAction(
  pin: string,
): Promise<{ success: boolean; error?: string; tooManyAttempts?: boolean }> {
  const headersList = headers();
  const ip =
    headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1';
  const ua = headersList.get('user-agent') ?? undefined;

  const result = await verifyPinAndCreateSession(pin, ip, ua);

  if (!result.sessionId) {
    return {
      success: false,
      error: result.error,
      tooManyAttempts: result.tooManyAttempts,
    };
  }

  // Set httpOnly cookie for SSR routes
  const cookieStore = cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, result.sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 8 * 60 * 60, // 8 hours
    path: '/',
  });

  return { success: true };
}

export async function logoutAction(): Promise<void> {
  const cookieStore = cookies();
  const sessionId = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (sessionId) {
    await revokeSession(sessionId);
    cookieStore.delete(ADMIN_SESSION_COOKIE);
  }
}

export async function changePinAction(
  currentPin: string,
  newPin: string,
): Promise<{ success: boolean; error?: string }> {
  const cookieStore = cookies();
  const sessionId = cookieStore.get(ADMIN_SESSION_COOKIE)?.value ?? '';
  return changePin(currentPin, newPin, sessionId);
}
