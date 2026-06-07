import { NextResponse } from 'next/server';
import { requireValidUser } from '@/lib/auth';
import { fetchYahooDailyCloses } from '@/lib/index-history';
import { runDynamicBacktest, StrategyParams } from '@/lib/dynamic-backtester';

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

    const period1 = new Date('1990-01-01'); // Fetch all available lifetime data

    const result = await fetchYahooDailyCloses(symbol, period1);
    if (!result || result.length < 200) {
      return NextResponse.json({ error: 'Not enough data' }, { status: 400 });
    }

    const closes = result.map((r: any) => r.close);
    const highs = result.map((r: any) => r.high ?? r.close);
    const lows = result.map((r: any) => r.low ?? r.close);
    const volumes = result.map((r: any) => r.volume ?? 0);
    const dates = result.map((r: any) => new Date(r.date));

    const stats = runDynamicBacktest(strategy, closes, highs, lows, volumes, dates);
    
    return NextResponse.json({ success: true, stats });
  } catch (error) {
    console.error('Custom Backtest Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
