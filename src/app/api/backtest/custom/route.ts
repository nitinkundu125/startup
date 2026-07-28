import { NextResponse } from 'next/server';
import { backtestStartDate } from '@/lib/backtest-constants';
import { requireValidUser } from '@/lib/auth';
import { fetchYahooDailyCloses, toPriceSeries } from '@/lib/index-history';
import { runSplitBacktest, StrategyParams } from '@/lib/dynamic-backtester';

export async function POST(request: Request) {
  const user = await requireValidUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const symbol = body.symbol;
    const strategy: StrategyParams = body.strategy;

    if (!symbol || !strategy) {
      return NextResponse.json({ error: 'Missing symbol or strategy' }, { status: 400 });
    }

    const period1 = backtestStartDate();

    const rows = await fetchYahooDailyCloses(symbol, period1);
    if (!rows || rows.length < 200) {
      return NextResponse.json({ error: 'Not enough data' }, { status: 400 });
    }

    const { closes, highs, lows, opens, volumes, dates } = toPriceSeries(rows);
    const split = runSplitBacktest(strategy, closes, highs, lows, volumes, dates, opens);

    return NextResponse.json({
      success: true,
      // `stats` stays the whole-history run for backwards compatibility.
      stats: split.full,
      inSample: split.inSample,
      outOfSample: split.outOfSample,
      splitDate: split.splitDate ? split.splitDate.toISOString() : null,
    });
  } catch (error) {
    console.error('Custom Backtest Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
