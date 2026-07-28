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
};

import {
  MIN_IN_SAMPLE_TRADES,
  backtestStartDate,
  MIN_IN_SAMPLE_WIN_RATE,
  HELD_UP_MIN_WIN_RATE,
  MIN_OOS_TRADES,
} from '@/lib/backtest-constants';

const MAX_SYMBOLS_PER_BATCH = 50;

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

          // Save to cache
          await prisma.scanCache.upsert({
            where: { symbol_dateKey: { symbol, dateKey } },
            update: { results: JSON.stringify(symbolResults) },
            create: {
              symbol,
              dateKey,
              results: JSON.stringify(symbolResults)
            }
          });

          return symbolResults;
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

    // Rank by out-of-sample performance. A held-back sample too small to mean
    // anything sorts below every properly-validated result, however good its
    // numbers look — one winning trade is a 100% win rate and proves nothing.
    batchResults.sort((a, b) => {
      const av = a.oosTotalTrades >= MIN_OOS_TRADES;
      const bv = b.oosTotalTrades >= MIN_OOS_TRADES;
      if (av !== bv) return av ? -1 : 1;
      if (!av) return b.oosTotalTrades - a.oosTotalTrades;
      if (b.oosWinRate !== a.oosWinRate) return b.oosWinRate - a.oosWinRate;
      return b.oosAverageReturn - a.oosAverageReturn;
    });

    return NextResponse.json({
      success: true,
      results: batchResults,
      strategiesPerSymbol: MASTER_STRATEGY_LIBRARY.length,
      symbolsScanned: targetSymbols.length,
      // Surfaced rather than silently dropped — a truncated scan should not read
      // as full coverage.
      symbolsSkipped: truncated > 0 ? truncated : 0,
    });
  } catch (error) {
    console.error('Batch Optimize Error:', error);
    return NextResponse.json({ error: 'Optimization failed' }, { status: 500 });
  }
}
