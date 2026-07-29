import { NextResponse } from 'next/server';
import { requireValidUser } from '@/lib/auth';
import { fetchYahooDailyCloses, toPriceSeries } from '@/lib/index-history';
import { runSplitBacktest, StrategyParams } from '@/lib/dynamic-backtester';
import { MASTER_STRATEGY_LIBRARY } from '@/lib/strategy-library';
import { prisma } from '@/lib/prisma';

/**
 * Bumped when the shape or meaning of a cached result changes, so stale entries
 * from before the correctness fixes are not served as if they were current.
 */
const SCAN_CACHE_VERSION = 'v2';

export type BatchOptimizerResult = {
  symbol: string;
  strategyName: string;
  /** In-sample (selection window) figures. */
  totalTrades: number;
  profitableTrades: number;
  winRate: number;
  averageReturn: number;
  /** Worst single-trade drawdown, %. Deepest a position went underwater. */
  maxDrawdown: number;
  /** Worst peak-to-trough of the compounded equity curve, %. */
  equityMaxDrawdown: number;
  totalReturn: number;
  /** Held-back window — judge the strategy on these, not the ones above. */
  oosTotalTrades: number;
  oosWinRate: number;
  oosAverageReturn: number;
  oosTotalReturn: number;
  /** Same two definitions as above, so fitted and OOS are directly comparable.
   *  Previously only the equity figure was exposed for OOS while the fitted
   *  column was worst-trade — two different metrics sitting side by side. */
  oosMaxDrawdown: number;
  oosEquityMaxDrawdown: number;
  /** True when the strategy stayed profitable on data it was not selected on. */
  heldUp: boolean;
  splitDate: string | null;
  strategy: StrategyParams;
  currentSignal?: 'NEW_BUY' | 'NEW_SELL' | 'HOLDING' | 'WAITING';
  /** Strategies that traded on this symbol before the per-symbol cap. First row only. */
  matchedTotal?: number;
  /** Most recent close, used to prefill the buy form. Not a live quote. */
  lastClose?: number;
};

import {
  backtestStartDate,
  HELD_UP_MIN_WIN_RATE,
  MIN_OOS_TRADES,
} from '@/lib/backtest-constants';

const MAX_SYMBOLS_PER_BATCH = 50;

/**
 * Ranking, shared by the per-symbol cap and the final ordering.
 *
 * A held-back sample too small to mean anything sorts below every properly
 * validated result however good it looks — one winning trade is a 100% win rate
 * and proves nothing.
 */
function rankByOutOfSample(a: BatchOptimizerResult, b: BatchOptimizerResult): number {
  const av = a.oosTotalTrades >= MIN_OOS_TRADES;
  const bv = b.oosTotalTrades >= MIN_OOS_TRADES;
  if (av !== bv) return av ? -1 : 1;
  if (!av) return b.oosTotalTrades - a.oosTotalTrades;
  if (b.oosWinRate !== a.oosWinRate) return b.oosWinRate - a.oosWinRate;
  return b.oosAverageReturn - a.oosAverageReturn;
}

export async function POST(request: Request) {
  const user = await requireValidUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { symbols, minWinRate, minTrades, maxDrawdown,
            oosMinWinRate, oosMinTrades, oosMaxDrawdown } = await request.json();

    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      return NextResponse.json({ error: 'No symbols provided' }, { status: 400 });
    }

    // Filters are the caller's choice and default to OFF. They used to be
    // hardcoded at 67% / 8 trades and applied silently, which meant the Batch
    // Scanner and the Auto-Optimizer quietly disagreed about the same stock.
    const clamp = (v: unknown, lo: number, hi: number, dflt: number) => {
      const n = Number(v);
      return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt;
    };
    const winRateFloor = clamp(minWinRate, 0, 100, 0);
    const tradesFloor = clamp(minTrades, 0, 10_000, 0);
    /**
     * Drawdown tolerance, entered as a POSITIVE percentage (20 means "nothing
     * worse than -20%"). 0 disables it — the same off-switch as the other two.
     * Taking 0 literally would reject every strategy, since any real one goes
     * underwater at some point.
     */
    const drawdownCeiling = clamp(maxDrawdown, 0, 100, 0);

    /**
     * Held-back floors. Filtering on out-of-sample spends some of its value as
     * validation — you are selecting with the data that was meant to check the
     * selection. Offered because it is genuinely useful, and labelled in the UI
     * so the tradeoff is visible rather than hidden.
     */
    const oosWinFloor = clamp(oosMinWinRate, 0, 100, 0);
    const oosTradesFloor = clamp(oosMinTrades, 0, 10_000, 0);
    const oosDrawdownCeiling = clamp(oosMaxDrawdown, 0, 100, 0);

    const targetSymbols = symbols.slice(0, MAX_SYMBOLS_PER_BATCH);
    const truncated = symbols.length - targetSymbols.length;
    const batchResults: BatchOptimizerResult[] = [];

    // Chunk size of 5 to avoid Yahoo rate limits
    const CHUNK_SIZE = 5;
    for (let i = 0; i < targetSymbols.length; i += CHUNK_SIZE) {
      const chunk = targetSymbols.slice(i, i + CHUNK_SIZE);
      // Filters are part of the key: results are filtered BEFORE caching, so an
      // unfiltered scan must not be served a cached filtered set, or vice versa.
      const dateKey = `${SCAN_CACHE_VERSION}:${new Date().toISOString().split('T')[0]}:w${winRateFloor}t${tradesFloor}d${drawdownCeiling}:ow${oosWinFloor}ot${oosTradesFloor}od${oosDrawdownCeiling}`;

      const chunkPromises = chunk.map(async (symbol) => {
        try {
          // Check cache first
          const cached = await prisma.scanCache.findUnique({
            where: { symbol_dateKey: { symbol, dateKey } }
          });

          if (cached) {
            return JSON.parse(cached.results) as BatchOptimizerResult[];
          }

          const period1 = backtestStartDate();
          const rows = await fetchYahooDailyCloses(symbol, period1);
          if (rows.length < 100) return null; // Not enough data

          const { closes, highs, lows, opens, volumes, dates } = toPriceSeries(rows);

          const symbolResults: BatchOptimizerResult[] = [];

          for (const strat of MASTER_STRATEGY_LIBRARY) {
            const split = runSplitBacktest(strat, closes, highs, lows, volumes, dates, opens);
            const { inSample, outOfSample } = split;

            // A strategy that never traded has no win rate to judge.
            if (inSample.totalTrades === 0) continue;
            // Caller-supplied floors, applied to the fitted window only — the
            // held-back window must never influence selection.
            if (inSample.totalTrades < tradesFloor || inSample.winRate < winRateFloor) {
              continue;
            }
            // maxDrawdown is negative; compare magnitudes.
            if (drawdownCeiling > 0 && Math.abs(inSample.maxDrawdown) > drawdownCeiling) {
              continue;
            }

            if (outOfSample.totalTrades < oosTradesFloor) continue;
            if (oosWinFloor > 0) {
              // No held-back trades means no win rate to clear.
              if (outOfSample.totalTrades === 0 || outOfSample.winRate < oosWinFloor) continue;
            }
            if (oosDrawdownCeiling > 0 && Math.abs(outOfSample.maxDrawdown) > oosDrawdownCeiling) {
              continue;
            }

            symbolResults.push({
              symbol,
              strategyName: strat.type === 'COMPOUND' ? (strat.name || 'Custom Compound') : `Single ${strat.type}`,
              totalTrades: inSample.totalTrades,
              profitableTrades: inSample.profitableTrades,
              winRate: inSample.winRate,
              averageReturn: inSample.averageReturn,
              totalReturn: inSample.totalReturn,
              maxDrawdown: inSample.maxDrawdown,
              equityMaxDrawdown: inSample.equityMaxDrawdown,
              oosMaxDrawdown: outOfSample.maxDrawdown,
              oosTotalTrades: outOfSample.totalTrades,
              oosWinRate: outOfSample.winRate,
              oosAverageReturn: outOfSample.averageReturn,
              oosTotalReturn: outOfSample.totalReturn,
              oosEquityMaxDrawdown: outOfSample.equityMaxDrawdown,
              heldUp:
                outOfSample.totalTrades >= MIN_OOS_TRADES &&
                outOfSample.winRate >= HELD_UP_MIN_WIN_RATE,
              splitDate: split.splitDate ? split.splitDate.toISOString() : null,
              strategy: strat,
              currentSignal: outOfSample.currentSignal,
              lastClose: closes[closes.length - 1],
            });
          }

          // Everything that cleared the filters is returned; the user filters
          // further themselves. The browser is protected a layer lower, where
          // the client paints a bounded number of rows.
          symbolResults.sort(rankByOutOfSample);
          const capped = symbolResults;
          if (capped.length > 0) capped[0].matchedTotal = symbolResults.length;

          // Cache the capped set — it is what gets served, so caching the full
          // list would only make same-day rescans slower for no benefit.
          await prisma.scanCache.upsert({
            where: { symbol_dateKey: { symbol, dateKey } },
            update: { results: JSON.stringify(capped) },
            create: {
              symbol,
              dateKey,
              results: JSON.stringify(capped)
            }
          });

          return capped;
        } catch (e) {
          console.error(`Failed to process ${symbol}:`, e);
          return null;
        }
      });

      const results = await Promise.all(chunkPromises);
      for (const res of results) {
        if (res) batchResults.push(...res);
      }
    }

    batchResults.sort(rankByOutOfSample);

    const matchedTotal = batchResults.reduce((n, r) => n + (r.matchedTotal ?? 0), 0);

    return NextResponse.json({
      success: true,
      results: batchResults,
      strategiesPerSymbol: MASTER_STRATEGY_LIBRARY.length,
      symbolsScanned: targetSymbols.length,
      // How many strategy/symbol pairs actually traded, vs how many are being
      // returned. Without this the cap reads as "these are all the matches".
      matchedTotal,
      // Echo the filters back so the UI can state what was applied rather than
      // presenting a filtered list as the full picture.
      filters: {
        minWinRate: winRateFloor, minTrades: tradesFloor, maxDrawdown: drawdownCeiling,
        oosMinWinRate: oosWinFloor, oosMinTrades: oosTradesFloor, oosMaxDrawdown: oosDrawdownCeiling,
      },
      // Surfaced rather than silently dropped — a truncated scan should not read
      // as full coverage.
      symbolsSkipped: truncated > 0 ? truncated : 0,
    });
  } catch (error) {
    console.error('Batch Optimize Error:', error);
    return NextResponse.json({ error: 'Optimization failed' }, { status: 500 });
  }
}
