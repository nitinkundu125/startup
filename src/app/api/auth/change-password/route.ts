import { NextResponse } from 'next/server';
import { changePassword, requireValidUser } from '@/lib/auth';
import { setSessionCookie, clearSessionCookie } from '@/lib/session';

export async function POST(request: Request) {
  const user = await requireValidUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { currentPassword, newPassword } = await request.json();
    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Current and new password are required' },
        { status: 400 }
      );
    }

    // Revokes every outstanding session, including this browser's.
    await changePassword(user.id, currentPassword, newPassword);

    // Re-issue for the caller so changing a password does not log you out of the
    // tab you are sitting in. Every OTHER session stays dead.
    try {
      await setSessionCookie(user.id);
    } catch {
      await clearSessionCookie();
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Password change failed';
    // Wrong current password is a client error, not a server fault.
    const status = /incorrect|at least|must differ/i.test(message) ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
