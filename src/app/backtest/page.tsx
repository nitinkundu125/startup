import { requireAuth } from '@/lib/redirects';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/ui/PageHeader';
import { BacktestLabClient } from './BacktestLabClient';

export default async function BacktestLabPage() {
  const userId = await requireAuth();

  // Fetch watchlist to populate the dropdown
  const watchlist = await prisma.watchlistItem.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' }
  });

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      <PageHeader
        title="Strategy Backtest Lab"
        description="Build custom algorithmic strategies and test them instantly against the stock's lifetime historical data. Or, use the Auto-Optimizer to find the mathematical Holy Grail for your favorite stock."
      />

      <BacktestLabClient initialWatchlist={watchlist} />
    </div>
  );
}
