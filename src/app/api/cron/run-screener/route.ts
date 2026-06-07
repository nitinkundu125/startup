import { NextResponse } from 'next/server';
import { requireValidUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { runScreenerForSymbol } from '@/lib/screener';
import { revalidatePath } from 'next/cache';

export async function POST(request: Request) {
  // In a real production app, this would be secured by a CRON_SECRET token
  // to allow external cron services (like Vercel Cron or cron-job.org) to hit it.
  // For now, we will require the user to be logged in and trigger it manually via the UI.
  
  const user = await requireValidUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const watchlist = await prisma.watchlistItem.findMany({
      where: { userId: user.id }
    });

    if (watchlist.length === 0) {
      return NextResponse.json({ success: true, message: 'Watchlist is empty. Add stocks to scan.' });
    }

    // Run screener for all watched symbols sequentially to avoid rate limits
    for (const item of watchlist) {
      console.log(`Running screener for ${item.symbol}...`);
      await runScreenerForSymbol(user.id, item.symbol);
    }

    revalidatePath('/watchlist');

    return NextResponse.json({ success: true, message: `Successfully screened ${watchlist.length} symbols.` });

  } catch (error) {
    console.error('Screener Cron Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
