import { cookies } from 'next/headers';
import {
  createSessionToken,
  verifySessionToken,
  verifySessionTokenFull,
  type VerifiedSession,
} from '@/lib/session-token';

const COOKIE_NAME = 'session';
const MAX_AGE_DAYS = 30;

/**
 * Whether to mark the session cookie `Secure`.
 *
 * This was hardwired to NODE_ENV === 'production', but the two are not the same
 * question. A production build served over plain HTTP sets `Secure`, browsers
 * refuse to send the cookie back, and login silently fails: the API returns 200
 * and the user stays logged out with nothing in the logs.
 *
 * What actually matters is whether the app is reached over HTTPS. Set
 * COOKIE_SECURE explicitly to say so; otherwise fall back to the old NODE_ENV
 * behaviour, which is the safe default for anything public.
 *
 * COOKIE_SECURE=false means session cookies travel in cleartext. Only acceptable
 * on a trusted private network — put TLS in front before exposing this anywhere.
 */
function cookieSecure(): boolean {
  const raw = process.env.COOKIE_SECURE?.trim().toLowerCase();
  if (raw === 'true' || raw === '1') return true;
  if (raw === 'false' || raw === '0') return false;
  return process.env.NODE_ENV === 'production';
}

export async function getSessionUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

/** Signature-verified session including its issued-at, for revocation checks. */
export async function getVerifiedSession(): Promise<VerifiedSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionTokenFull(token);
}

export async function setSessionCookie(userId: string): Promise<void> {
  const cookieStore = await cookies();
  const token = await createSessionToken(userId);
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_DAYS * 24 * 60 * 60,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export { verifySessionToken };
