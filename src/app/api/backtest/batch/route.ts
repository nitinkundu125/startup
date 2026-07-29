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
  totalReturn: number;
  maxDrawdown: number;
  /** Held-back window — judge the strategy on these, not the ones above. */
  oosTotalTrades: number;
  oosWinRate: number;
  oosAverageReturn: number;
  oosTotalReturn: number;
  oosEquityMaxDrawdown: number;
  /** True when the strategy stayed profitable on data it was not selected on. */
  heldUp: boolean;
  splitDate: string | null;
  strategy: StrategyParams;
  currentSignal?: 'NEW_BUY' | 'NEW_SELL' | 'HOLDING' | 'WAITING';
  /** Strategies that traded on this symbol before the per-symbol cap. First row only. */
  matchedTotal?: number;
};

import {
  MIN_IN_SAMPLE_TRADES,
  backtestStartDate,
  MIN_IN_SAMPLE_WIN_RATE,
  HELD_UP_MIN_WIN_RATE,
  MIN_OOS_TRADES,
} from '@/lib/backtest-constants';

const MAX_SYMBOLS_PER_BATCH = 50;

/**
 * Strategies returned per symbol.
 *
 * With 277 strategies, roughly 262 produce trades on a typical stock. Across a
 * Nifty 500 scan that is ~130,000 rows into a single un-virtualised table —
 * over a million DOM nodes, which hangs the browser rather than rendering.
 *
 * Only the best few per symbol are useful anyway: nobody reads the 200th-ranked
 * strategy for a stock. The rest are counted and reported, never silently
 * dropped, so the numbers still add up.
 */
const MAX_RESULTS_PER_SYMBOL = 10;

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
    const { symbols } = await request.json();

    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      return NextResponse.json({ error: 'No symbols provided' }, { status: 400 });
    }

    const targetSymbols = symbols.slice(0, MAX_SYMBOLS_PER_BATCH);
    const truncated = symbols.length - targetSymbols.length;
    const batchResults: BatchOptimizerResult[] = [];

    // Chunk size of 5 to avoid Yahoo rate limits
    const CHUNK_SIZE = 5;
    for (let i = 0; i < targetSymbols.length; i += CHUNK_SIZE) {
      const chunk = targetSymbols.slice(i, i + CHUNK_SIZE);
      const dateKey = `${SCAN_CACHE_VERSION}:${new Date().toISOString().split('T')[0]}`;

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

            // Select on the training window only — never on full history.
            if (
              inSample.totalTrades < MIN_IN_SAMPLE_TRADES ||
              inSample.winRate < MIN_IN_SAMPLE_WIN_RATE
            ) {
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
            });
          }

          // Keep only the best few for this symbol. `matchedTotal` rides along on
          // the first row so the UI can say how many were considered — a capped
          // list that looks complete is worse than no cap at all.
          const matchedTotal = symbolResults.length;
          symbolResults.sort(rankByOutOfSample);
          const capped = symbolResults.slice(0, MAX_RESULTS_PER_SYMBOL);
          if (capped.length > 0) capped[0].matchedTotal = matchedTotal;

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
      returnedPerSymbol: MAX_RESULTS_PER_SYMBOL,
      // Surfaced rather than silently dropped — a truncated scan should not read
      // as full coverage.
      symbolsSkipped: truncated > 0 ? truncated : 0,
    });
  } catch (error) {
    console.error('Batch Optimize Error:', error);
    return NextResponse.json({ error: 'Optimization failed' }, { status: 500 });
  }
}
