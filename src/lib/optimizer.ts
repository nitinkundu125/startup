import { fetchYahooDailyCloses } from '@/lib/index-history';
import { runDynamicBacktest, StrategyParams, DynamicBacktestResult } from './dynamic-backtester';
import { MASTER_STRATEGY_LIBRARY } from './strategy-library';

export type OptimizerResult = {
  strategy: StrategyParams;
  stats: DynamicBacktestResult;
};

export async function runOptimizer(symbol: string): Promise<OptimizerResult[]> {
  const period1 = new Date('1990-01-01'); // Fetch all available lifetime data

  let result;
  try {
    result = await fetchYahooDailyCloses(symbol, period1);
  } catch (error) {
    throw new Error('Failed to fetch historical data for backtesting.');
  }

  if (!result || result.length < 200) {
    throw new Error('Not enough historical data (minimum 200 days required).');
  }

  const closes = result.map((r: any) => r.close);
  const highs = result.map((r: any) => r.high ?? r.close);
  const lows = result.map((r: any) => r.low ?? r.close);
  const volumes = result.map((r: any) => r.volume ?? 0);
  const dates = result.map((r: any) => new Date(r.date));

  const results: OptimizerResult[] = [];

  // Evaluate all strategies in the Master Library
  for (const strat of MASTER_STRATEGY_LIBRARY) {
    const stats = runDynamicBacktest(strat, closes, highs, lows, volumes, dates);
    
    // Strict 67% win rate filter and minimum trades filter
    if (stats.totalTrades > 2 && stats.winRate >= 67) {
      results.push({ strategy: strat, stats });
    }
  }

  // Sort primarily by Average Return, then Win Rate
  results.sort((a, b) => {
    if (b.stats.averageReturn !== a.stats.averageReturn) {
      return b.stats.averageReturn - a.stats.averageReturn;
    }
    return b.stats.winRate - a.stats.winRate;
  });

  // Return the top 100
  return results.slice(0, 100);
}
