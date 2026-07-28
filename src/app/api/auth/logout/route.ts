import { NextResponse } from 'next/server';
import { clearSessionCookie } from '@/lib/session';
import { getSessionUserId } from '@/lib/session';
import { revokeAllSessions } from '@/lib/auth';

export async function POST() {
  // Clearing the cookie only removes the browser's copy — a token captured
  // beforehand stayed valid for the full 30 days. Bump the revocation cut-off
  // so every outstanding token for this user dies now.
  const userId = await getSessionUserId();
  if (userId) {
    try {
      await revokeAllSessions(userId);
    } catch (e) {
      // Never block logout on a DB failure; the cookie still gets cleared.
      console.error('Failed to revoke sessions on logout:', e);
    }
  }

  await clearSessionCookie();
  return NextResponse.json({ success: true });
}
