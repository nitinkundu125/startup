import { NextResponse } from 'next/server';
import { requireValidUser } from '@/lib/auth';
import { clearSessionCookie, getSessionUserId } from '@/lib/session';
import { clearUserPortfolio } from '@/lib/import-tradebook';
import { revalidatePath } from 'next/cache';

export async function POST() {
  const user = await requireValidUser();
  if (!user) {
    if (await getSessionUserId()) await clearSessionCookie();
    return NextResponse.json(
      { error: 'Session expired. Please sign in again.', sessionExpired: true },
      { status: 401 }
    );
  }
  const userId = user.id;

  try {
    await clearUserPortfolio(userId);

    revalidatePath('/');
    revalidatePath('/holdings');
    revalidatePath('/upload');

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Clear portfolio failed:', e);
    return NextResponse.json({ error: 'Failed to erase data.' }, { status: 500 });
  }
}
