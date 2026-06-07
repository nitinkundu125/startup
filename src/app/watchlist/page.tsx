import { requireAuth } from '@/lib/redirects';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/ui/PageHeader';
import { WatchlistClient } from './WatchlistClient';

export default async function WatchlistPage() {
  const userId = await requireAuth();

  const watchlist = await prisma.watchlistItem.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' }
  });

  const signals = await prisma.screenerSignal.findMany({
    where: { userId },
    orderBy: { date: 'desc' },
    take: 100 // Show last 100 signals
  });

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      <PageHeader
        title="Stock Screener & Watchlist"
        description="Monitor specific stocks and generate automated BUY/SELL signals based on classic technical indicators like SMA, RSI, MACD, and Bollinger Bands."
      />

      <WatchlistClient 
        initialWatchlist={watchlist} 
        initialSignals={signals} 
      />
    </div>
  );
}
