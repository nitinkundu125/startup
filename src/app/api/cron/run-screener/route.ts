import { NextResponse } from 'next/server';
import { requireValidUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { runScreenerForSymbol } from '@/lib/screener';
import { revalidatePath } from 'next/cache';
import { isCronRequest } from '@/lib/cron-auth';

export async function POST(request: Request) {
  // Accepts either a valid CRON_SECRET (scans every user's watchlist) or a
  // logged-in user (scans only their own). Requiring a session meant no external
  // scheduler could ever invoke this.
  const cron = isCronRequest(request);
  const user = cron ? null : await requireValidUser();
  if (!cron && !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const watchlist = await prisma.watchlistItem.findMany({
      where: user ? { userId: user.id } : {},
    });

    if (watchlist.length === 0) {
      return NextResponse.json({ success: true, message: 'Watchlist is empty. Add stocks to scan.' });
    }

    // Run screener for all watched symbols sequentially to avoid rate limits
    for (const item of watchlist) {
      console.log(`Running screener for ${item.symbol}...`);
      await runScreenerForSymbol(item.userId, item.symbol);
    }

    revalidatePath('/watchlist');

    return NextResponse.json({ success: true, message: `Successfully screened ${watchlist.length} symbols.` });

  } catch (error) {
    console.error('Screener Cron Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
