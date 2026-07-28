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
  MIN_IN_SAMPLE_WIN_RATE,
  HELD_UP_MIN_WIN_RATE,
  MIN_OOS_TRADES,
} from './backtest-constants';

export { MIN_OOS_TRADES };

export async function runOptimizer(symbol: string): Promise<OptimizerReport> {
  const period1 = new Date('1990-01-01'); // Fetch all available lifetime data

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

  for (const strat of MASTER_STRATEGY_LIBRARY) {
    const split = runSplitBacktest(strat, closes, highs, lows, volumes, dates, opens);
    if (split.splitDate) splitDate = split.splitDate.toISOString();

    // Select on the training window ONLY. Selecting on full history is how you
    // ship noise: with ~46 strategies against one price series, several will
    // clear any win-rate threshold by chance alone.
    const passed =
      split.inSample.totalTrades >= MIN_IN_SAMPLE_TRADES &&
      split.inSample.winRate >= MIN_IN_SAMPLE_WIN_RATE;
    if (!passed) continue;

    strategiesPassed++;
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

  // Rank by out-of-sample performance, not by what we fitted on. Strategies
  // whose held-back sample is too small to mean anything sort below every
  // properly-validated one regardless of how flattering their numbers look.
  const validated = (r: OptimizerResult) => r.outOfSample.totalTrades >= MIN_OOS_TRADES;

  results.sort((a, b) => {
    const av = validated(a);
    const bv = validated(b);
    if (av !== bv) return av ? -1 : 1;
    if (!av) {
      // Neither is validated — order by sample size so the least-thin is first.
      return b.outOfSample.totalTrades - a.outOfSample.totalTrades;
    }
    const d = b.outOfSample.averageReturn - a.outOfSample.averageReturn;
    if (d !== 0) return d;
    return b.outOfSample.winRate - a.outOfSample.winRate;
  });

  return {
    results: results.slice(0, 100),
    strategiesTested: MASTER_STRATEGY_LIBRARY.length,
    strategiesPassed,
    strategiesHeldUp,
    splitDate,
  };
}
