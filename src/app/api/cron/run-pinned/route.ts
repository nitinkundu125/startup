import { NextResponse } from 'next/server';
import { requireValidUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { fetchYahooDailyCloses } from '@/lib/index-history';
import { runDynamicBacktest, StrategyParams } from '@/lib/dynamic-backtester';
import { MASTER_STRATEGY_LIBRARY } from '@/lib/strategy-library';

function getStrategyByName(name: string): StrategyParams | undefined {
  return MASTER_STRATEGY_LIBRARY.find(strat => {
    const stratName = strat.type === 'COMPOUND' ? (strat.name || 'Custom Compound') : `Single ${strat.type}`;
    return stratName === name;
  });
}

export async function POST(request: Request) {
  // In production, require CRON secret or user session
  const user = await requireValidUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const pinnedStrategies = await prisma.pinnedStrategy.findMany({
      where: { userId: user.id }
    });

    if (pinnedStrategies.length === 0) {
      return NextResponse.json({ success: true, message: 'No pinned strategies found.' });
    }

    // Group by symbol to optimize Yahoo fetches
    const symbols = Array.from(new Set(pinnedStrategies.map(p => p.symbol)));
    
    let updatedCount = 0;

    for (const symbol of symbols) {
      const period1 = new Date('1990-01-01');

      let closes: number[], highs: number[], lows: number[], volumes: number[], dates: Date[];
      try {
        const result = await fetchYahooDailyCloses(symbol, period1);
        if (result.length < 50) continue;
        closes = result.map((r: any) => r.close);
        highs = result.map((r: any) => r.high ?? r.close);
        lows = result.map((r: any) => r.low ?? r.close);
        volumes = result.map((r: any) => r.volume ?? 0);
        dates = result.map((r: any) => new Date(r.date));
      } catch (e) {
        console.error(`Failed to fetch data for ${symbol}:`, e);
        continue;
      }

      // Find all pinned strategies for this symbol
      const symbolStrategies = pinnedStrategies.filter(p => p.symbol === symbol);

      for (const pinned of symbolStrategies) {
        const strat = getStrategyByName(pinned.strategyName);
        if (!strat) continue;

        const stats = runDynamicBacktest(strat, closes, highs, lows, volumes, dates);
        
        const newSignal = stats.currentSignal || 'HOLDING';
        let isNewSignal = pinned.isNewSignal;

        // If lastSignal exists and differs from newSignal (and newSignal is not just a duplicate)
        if (pinned.lastSignal && pinned.lastSignal !== newSignal) {
          isNewSignal = true;
        }

        const statsJson = JSON.stringify({
          winRate: stats.winRate,
          totalTrades: stats.totalTrades,
          averageReturn: stats.averageReturn,
          totalReturn: stats.totalReturn
        });

        await prisma.pinnedStrategy.update({
          where: { id: pinned.id },
          data: {
            lastSignal: newSignal,
            signalDate: new Date(),
            isNewSignal,
            statsJson,
            lastUpdated: new Date()
          }
        });
        
        updatedCount++;
      }
    }

    return NextResponse.json({ success: true, message: `Updated ${updatedCount} pinned strategies.` });
  } catch (error) {
    console.error('Pinned Cron Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
