import { cookies } from 'next/headers';
import {
  createSessionToken,
  verifySessionToken,
  verifySessionTokenFull,
  type VerifiedSession,
} from '@/lib/session-token';

const COOKIE_NAME = 'session';
const MAX_AGE_DAYS = 30;

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
    secure: process.env.NODE_ENV === 'production',
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
