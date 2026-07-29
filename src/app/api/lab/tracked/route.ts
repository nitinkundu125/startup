import { NextResponse } from 'next/server';
import { requireValidUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { fetchLtpForSymbol } from '@/lib/market-quotes';
import { MASTER_STRATEGY_LIBRARY } from '@/lib/strategy-library';
import { exitRule } from '@/lib/describe-strategy';

/**
 * The user's open positions, with live P&L and exit state.
 *
 * Watching setups you do not own was removed: a signal only matters once money
 * is behind it, and buy opportunities come from scanning rather than a standing
 * watchlist. So this list answers exactly one question — what do I hold, and
 * should I sell any of it?
 */

function findStrategy(name: string) {
  return MASTER_STRATEGY_LIBRARY.find(
    (s) => (s.type === 'COMPOUND' ? s.name || 'Custom Compound' : `Single ${s.type}`) === name
  );
}

function parseStats(json: string | null) {
  if (!json) return null;
  try {
    return JSON.parse(json) as {
      oosWinRate?: number;
      oosTotalTrades?: number;
      oosAverageReturn?: number;
    };
  } catch {
    return null;
  }
}

export async function GET() {
  const user = await requireValidUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const positions = await prisma.labPosition.findMany({
    where: { userId: user.id },
    orderBy: { entryDate: 'desc' },
  });

  const open = positions.filter((p) => p.status === 'OPEN');

  const prices = new Map<string, number>();
  await Promise.all(
    [...new Set(open.map((p) => p.symbol))].map(async (s) => {
      const ltp = await fetchLtpForSymbol(s.replace('.NS', ''));
      if (ltp != null) prices.set(s, ltp);
    })
  );

  const rows = open.map((p) => {
    const strat = findStrategy(p.strategyName);
    const ltp = prices.get(p.symbol) ?? null;
    const stats = parseStats(p.statsJson);
    const invested = p.entryPrice * p.quantity;
    const pnl = ltp != null ? (ltp - p.entryPrice) * p.quantity : null;

    return {
      id: p.id,
      symbol: p.symbol,
      strategyName: p.strategyName,
      currentPrice: ltp,
      entryPrice: p.entryPrice,
      quantity: p.quantity,
      entryDate: p.entryDate,
      stopLossPrice: p.stopLossPrice,
      invested,
      pnl,
      pnlPct: pnl != null ? (pnl / invested) * 100 : null,
      stopBreached: p.stopLossPrice != null && ltp != null && ltp <= p.stopLossPrice,
      signal: p.lastSignal,
      lastChecked: p.lastChecked,
      oosWinRate: stats?.oosWinRate ?? null,
      oosTotalTrades: stats?.oosTotalTrades ?? null,
      exitRule: strat ? exitRule(strat) : null,
      // Never checked yet means the cron has not run since this was opened —
      // "no sell signal" and "nobody has looked" must not read the same.
      neverChecked: p.lastChecked == null,
    };
  });

  // Anything demanding action first.
  rows.sort((a, b) => {
    const rank = (r: typeof a) => (r.stopBreached ? 0 : r.signal === 'NEW_SELL' ? 1 : 2);
    return rank(a) - rank(b) || a.symbol.localeCompare(b.symbol);
  });

  const closed = positions.filter((p) => p.status === 'CLOSED');

  return NextResponse.json({
    success: true,
    rows,
    summary: {
      holding: rows.length,
      invested: rows.reduce((n, r) => n + r.invested, 0),
      unrealisedPnl: rows.reduce((n, r) => n + (r.pnl ?? 0), 0),
      pricedCount: rows.filter((r) => r.currentPrice != null).length,
      needsAction: rows.filter((r) => r.stopBreached || r.signal === 'NEW_SELL').length,
    },
    closed: closed.map((p) => ({
      id: p.id,
      symbol: p.symbol,
      strategyName: p.strategyName,
      entryPrice: p.entryPrice,
      exitPrice: p.exitPrice,
      quantity: p.quantity,
      entryDate: p.entryDate,
      exitDate: p.exitDate,
      realised: p.exitPrice != null ? (p.exitPrice - p.entryPrice) * p.quantity : null,
    })),
  });
}
