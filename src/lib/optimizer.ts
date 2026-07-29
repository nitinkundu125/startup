import { fetchYahooDailyCloses, toPriceSeries } from '@/lib/index-history';
import {
  runSplitBacktest,
  StrategyParams,
  DynamicBacktestResult,
} from './dynamic-backtester';
import { MASTER_STRATEGY_LIBRARY } from './strategy-library';

/**
 * Same shape the batch scanner returns.
 *
 * Scanning one stock and scanning five hundred are the same operation with a
 * different symbol list, so they now produce identical rows and share one table
 * — two result shapes meant two tables that drifted apart.
 */
export type OptimizerResult = {
  symbol: string;
  strategyName: string;
  totalTrades: number;
  profitableTrades: number;
  winRate: number;
  averageReturn: number;
  totalReturn: number;
  maxDrawdown: number;
  equityMaxDrawdown: number;
  oosTotalTrades: number;
  oosWinRate: number;
  oosAverageReturn: number;
  oosTotalReturn: number;
  oosMaxDrawdown: number;
  oosEquityMaxDrawdown: number;
  heldUp: boolean;
  splitDate: string | null;
  strategy: StrategyParams;
  currentSignal?: 'NEW_BUY' | 'NEW_SELL' | 'HOLDING' | 'WAITING';
  lastClose?: number;
  matchedTotal?: number;
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
  backtestStartDate,
  HELD_UP_MIN_WIN_RATE,
  MIN_OOS_TRADES,
} from './backtest-constants';

export { MIN_OOS_TRADES };

export type OptimizerFilters = {
  /** Minimum fitted-window win rate, %. 0 = no filter. */
  minWinRate?: number;
  /** Minimum fitted-window trades. 0 = no filter. */
  minTrades?: number;
  /** Drawdown tolerance as a POSITIVE percent (20 = nothing worse than -20%). 0 = no filter. */
  maxDrawdown?: number;
  /** Held-back floors. See the note in the batch route on what filtering here costs. */
  oosMinWinRate?: number;
  oosMinTrades?: number;
  oosMaxDrawdown?: number;
};

export async function runOptimizer(
  symbol: string,
  filters: OptimizerFilters = {}
): Promise<OptimizerReport> {
  // Default to showing everything. The same floors are available here as in the
  // batch scanner so the two tabs cannot silently disagree about one stock.
  const clamp = (v: unknown, lo: number, hi: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo;
  };
  const winRateFloor = clamp(filters.minWinRate, 0, 100);
  const tradesFloor = clamp(filters.minTrades, 0, 10_000);
  const drawdownCeiling = clamp(filters.maxDrawdown, 0, 100);
  const oosWinFloor = clamp(filters.oosMinWinRate, 0, 100);
  const oosTradesFloor = clamp(filters.oosMinTrades, 0, 10_000);
  const oosDrawdownCeiling = clamp(filters.oosMaxDrawdown, 0, 100);

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

  // Every strategy is run, and by default every result is returned.
  //
  // Showing the whole distribution is the safer default: cherry-picking only the
  // strategies that cleared a bar is what makes a win rate misleading. Seeing
  // the 30% ones next to the 80% ones is what stops a single number being read
  // as an edge. The floors above are opt-in for when that list is too long.
  for (const strat of MASTER_STRATEGY_LIBRARY) {
    const split = runSplitBacktest(strat, closes, highs, lows, volumes, dates, opens);
    if (split.splitDate) splitDate = split.splitDate.toISOString();

    // Floors apply to the fitted window only; the held-back window must never
    // influence which strategies are selected. Both default to 0, so by default
    // nothing is filtered and every strategy is returned.
    if (split.inSample.totalTrades < tradesFloor) continue;
    if (winRateFloor > 0) {
      // A strategy that never traded has no win rate, so it cannot clear a floor.
      if (split.inSample.totalTrades === 0) continue;
      if (split.inSample.winRate < winRateFloor) continue;
    }
    // maxDrawdown is negative; compare magnitudes.
    if (drawdownCeiling > 0 && Math.abs(split.inSample.maxDrawdown) > drawdownCeiling) continue;

    if (split.outOfSample.totalTrades < oosTradesFloor) continue;
    if (oosWinFloor > 0) {
      if (split.outOfSample.totalTrades === 0 || split.outOfSample.winRate < oosWinFloor) continue;
    }
    if (oosDrawdownCeiling > 0 && Math.abs(split.outOfSample.maxDrawdown) > oosDrawdownCeiling) continue;

    if (split.full.totalTrades === 0) continue;
    strategiesPassed++;
    if (
      split.outOfSample.totalTrades >= MIN_OOS_TRADES &&
      split.outOfSample.winRate >= HELD_UP_MIN_WIN_RATE
    ) {
      strategiesHeldUp++;
    }

    const { inSample, outOfSample } = split;
    results.push({
      symbol,
      strategyName: strat.type === 'COMPOUND' ? (strat.name || 'Custom Compound') : `Single ${strat.type}`,
      totalTrades: inSample.totalTrades,
      profitableTrades: inSample.profitableTrades,
      winRate: inSample.winRate,
      averageReturn: inSample.averageReturn,
      totalReturn: inSample.totalReturn,
      maxDrawdown: inSample.maxDrawdown,
      equityMaxDrawdown: inSample.equityMaxDrawdown,
      oosTotalTrades: outOfSample.totalTrades,
      oosWinRate: outOfSample.winRate,
      oosAverageReturn: outOfSample.averageReturn,
      oosTotalReturn: outOfSample.totalReturn,
      oosMaxDrawdown: outOfSample.maxDrawdown,
      oosEquityMaxDrawdown: outOfSample.equityMaxDrawdown,
      heldUp: outOfSample.totalTrades >= MIN_OOS_TRADES && outOfSample.winRate >= HELD_UP_MIN_WIN_RATE,
      splitDate: split.splitDate ? split.splitDate.toISOString() : null,
      strategy: strat,
      currentSignal: outOfSample.currentSignal,
      lastClose: closes[closes.length - 1],
    });
  }

  // Same ranking as the batch scanner: validated results first, then by
  // out-of-sample performance. One ordering for one table.
  results.sort((a, b) => {
    const av = a.oosTotalTrades >= MIN_OOS_TRADES;
    const bv = b.oosTotalTrades >= MIN_OOS_TRADES;
    if (av !== bv) return av ? -1 : 1;
    if (!av) return b.oosTotalTrades - a.oosTotalTrades;
    if (b.oosWinRate !== a.oosWinRate) return b.oosWinRate - a.oosWinRate;
    return b.oosAverageReturn - a.oosAverageReturn;
  });
  if (results.length > 0) results[0].matchedTotal = results.length;

  return {
    // Everything. Filtering is the user's job, not a hidden slice.
    results,
    strategiesTested: MASTER_STRATEGY_LIBRARY.length,
    strategiesPassed,
    strategiesHeldUp,
    splitDate,
  };
}
