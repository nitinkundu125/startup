import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireValidUser } from '@/lib/auth';
import { clearSessionCookie, getSessionUserId } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { refreshLtpsForUser } from '@/lib/ltp-store';

export async function POST() {
  const user = await requireValidUser();
  if (!user) {
    if (await getSessionUserId()) await clearSessionCookie();
    return NextResponse.json(
      { error: 'Session expired. Please sign in again.', sessionExpired: true },
      { status: 401 }
    );
  }

  try {
    const assets = await prisma.asset.findMany({
      where: { userId: user.id },
      select: { symbol: true },
    });

    const symbols = [...new Set(assets.map((a) => a.symbol))];
    if (symbols.length === 0) {
      return NextResponse.json(
        { error: 'No holdings to price. Import tradebooks first.' },
        { status: 400 }
      );
    }

    const snapshot = await refreshLtpsForUser(user.id, symbols);

    revalidatePath('/');
    revalidatePath('/holdings');

    return NextResponse.json({
      success: true,
      fetchedAt: snapshot.fetchedAt,
      updated: Object.keys(snapshot.prices).length,
      prices: snapshot.prices,
      failed: snapshot.failed ?? [],
    });
  } catch (e) {
    console.error('LTP refresh failed:', e);
    return NextResponse.json(
      { error: 'Could not fetch live prices. Try again in a moment.' },
      { status: 502 }
    );
  }
}
