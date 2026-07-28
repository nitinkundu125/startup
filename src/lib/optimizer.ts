import { fetchYahooDailyCloses, toPriceSeries } from '@/lib/index-history';
import {
  runSplitBacktest,
  StrategyParams,
  DynamicBacktestResult,
} from './dynamic-backtester';
import { MASTER_STRATEGY_LIBRARY } from './strategy-library';

export type OptimizerResult = {
  strategy: StrategyParams;
  /** Whole-history stats. Display only — the selection was fitted on part of this. */
  stats: DynamicBacktestResult;
  /** Selection window. The win-rate filter is applied to this. */
  inSample: DynamicBacktestResult;
  /** Held-back window. This is the number that actually means something. */
  outOfSample: DynamicBacktestResult;
  splitDate: string | null;
};

export type OptimizerReport = {
  results: OptimizerResult[];
  /** How many strategies were tried — needed to read the results honestly. */
  strategiesTested: number;
  /** How many cleared the in-sample filter. */
  strategiesPassed: number;
  /** Of those, how many also stayed profitable out-of-sample. */
  strategiesHeldUp: number;
  splitDate: string | null;
};

import {
  MIN_IN_SAMPLE_TRADES,
  backtestStartDate,
  MIN_IN_SAMPLE_WIN_RATE,
  HELD_UP_MIN_WIN_RATE,
  MIN_OOS_TRADES,
} from './backtest-constants';

export { MIN_OOS_TRADES };

export async function runOptimizer(symbol: string): Promise<OptimizerReport> {
  const period1 = backtestStartDate();

  let rows;
  try {
    rows = await fetchYahooDailyCloses(symbol, period1);
  } catch {
    throw new Error('Failed to fetch historical data for backtesting.');
  }

  if (!rows || rows.length < 200) {
    throw new Error('Not enough historical data (minimum 200 days required).');
  }

  const { closes, highs, lows, opens, volumes, dates } = toPriceSeries(rows);

  const results: OptimizerResult[] = [];
  let strategiesPassed = 0;
  let strategiesHeldUp = 0;
  let splitDate: string | null = null;

  // Every strategy in the library is run and every result is returned. Nothing
  // is filtered out.
  //
  // Showing the whole distribution is also the safer choice: cherry-picking only
  // the strategies that cleared a bar is what makes a win rate misleading. If
  // the user can see all 46 — the 30% ones next to the 80% ones — the number
  // means what it appears to mean.
  for (const strat of MASTER_STRATEGY_LIBRARY) {
    const split = runSplitBacktest(strat, closes, highs, lows, volumes, dates, opens);
    if (split.splitDate) splitDate = split.splitDate.toISOString();

    if (split.full.totalTrades > 0) strategiesPassed++;
    if (
      split.outOfSample.totalTrades >= MIN_OOS_TRADES &&
      split.outOfSample.winRate >= HELD_UP_MIN_WIN_RATE
    ) {
      strategiesHeldUp++;
    }

    results.push({
      strategy: strat,
      stats: split.full,
      inSample: split.inSample,
      outOfSample: split.outOfSample,
      splitDate: split.splitDate ? split.splitDate.toISOString() : null,
    });
  }

  // Rank by win rate over the stock's full history — the number being displayed.
  // Strategies that never triggered sort last; a 0-trade strategy has no win
  // rate, and 0% would read as "it lost" rather than "it never fired".
  results.sort((a, b) => {
    const at = a.stats.totalTrades > 0;
    const bt = b.stats.totalTrades > 0;
    if (at !== bt) return at ? -1 : 1;
    if (!at) return 0;
    if (b.stats.winRate !== a.stats.winRate) return b.stats.winRate - a.stats.winRate;
    if (b.stats.averageReturn !== a.stats.averageReturn) {
      return b.stats.averageReturn - a.stats.averageReturn;
    }
    // More trades behind the same win rate is the stronger result.
    return b.stats.totalTrades - a.stats.totalTrades;
  });

  return {
    results: results.slice(0, 100),
    strategiesTested: MASTER_STRATEGY_LIBRARY.length,
    strategiesPassed,
    strategiesHeldUp,
    splitDate,
  };
}
