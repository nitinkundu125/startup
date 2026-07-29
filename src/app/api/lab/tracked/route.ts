import { NextResponse } from 'next/server';
import { requireValidUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { fetchLtpForSymbol } from '@/lib/market-quotes';
import { MASTER_STRATEGY_LIBRARY } from '@/lib/strategy-library';
import { exitRule } from '@/lib/describe-strategy';

/**
 * One list of everything the user is tracking.
 *
 * Pinning and recording a buy were two separate panels for what is really one
 * idea — "track this strategy on this stock" — in two states:
 *
 *   WATCHING  no position. Waiting for a BUY signal.
 *   HOLDING   position open. Waiting for a SELL signal.
 *
 * Buying does not create a second thing to manage, it moves a row from one
 * state to the other. Presenting them as separate lists meant anything bought
 * appeared twice, and neither list said whether you actually owned it.
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

  const [pinned, positions] = await Promise.all([
    prisma.pinnedStrategy.findMany({ where: { userId: user.id }, orderBy: { pinnedAt: 'desc' } }),
    prisma.labPosition.findMany({ where: { userId: user.id }, orderBy: { entryDate: 'desc' } }),
  ]);

  const openByKey = new Map(
    positions.filter((p) => p.status === 'OPEN').map((p) => [`${p.symbol}|${p.strategyName}`, p])
  );

  // A position can outlive its pin (unpinned by hand, or pinned before this
  // existed), and it must never vanish from the list just because of that —
  // the user still owns the stock.
  const rowKeys = new Set(pinned.map((p) => `${p.symbol}|${p.strategyName}`));
  for (const key of openByKey.keys()) rowKeys.add(key);

  const symbols = [...new Set([...rowKeys].map((k) => k.split('|')[0]))];
  const prices = new Map<string, number>();
  await Promise.all(
    symbols.map(async (s) => {
      const ltp = await fetchLtpForSymbol(s.replace('.NS', ''));
      if (ltp != null) prices.set(s, ltp);
    })
  );

  const pinnedByKey = new Map(pinned.map((p) => [`${p.symbol}|${p.strategyName}`, p]));

  const rows = [...rowKeys].map((key) => {
    const [symbol, strategyName] = key.split('|');
    const pin = pinnedByKey.get(key);
    const pos = openByKey.get(key);
    const strat = findStrategy(strategyName);
    const ltp = prices.get(symbol) ?? null;
    const stats = parseStats(pin?.statsJson ?? null);

    const invested = pos ? pos.entryPrice * pos.quantity : null;
    const pnl = pos && ltp != null ? (ltp - pos.entryPrice) * pos.quantity : null;

    return {
      key,
      symbol,
      strategyName,
      state: pos ? ('HOLDING' as const) : ('WATCHING' as const),
      pinned: Boolean(pin),
      currentPrice: ltp,

      signal: pin?.lastSignal ?? null,
      signalDate: pin?.signalDate ?? null,
      isNewSignal: pin?.isNewSignal ?? false,
      lastUpdated: pin?.lastUpdated ?? null,

      oosWinRate: stats?.oosWinRate ?? null,
      oosTotalTrades: stats?.oosTotalTrades ?? null,
      exitRule: strat ? exitRule(strat) : null,

      position: pos
        ? {
            id: pos.id,
            entryPrice: pos.entryPrice,
            quantity: pos.quantity,
            entryDate: pos.entryDate,
            stopLossPrice: pos.stopLossPrice,
            invested,
            pnl,
            pnlPct: pnl != null && invested ? (pnl / invested) * 100 : null,
            stopBreached: pos.stopLossPrice != null && ltp != null && ltp <= pos.stopLossPrice,
          }
        : null,
    };
  });

  // Anything needing action first: a fired signal, then holdings, then watches.
  const rank = (r: (typeof rows)[number]) => {
    if (r.state === 'HOLDING' && (r.signal === 'NEW_SELL' || r.position?.stopBreached)) return 0;
    if (r.state === 'WATCHING' && r.signal === 'NEW_BUY') return 1;
    if (r.state === 'HOLDING') return 2;
    return 3;
  };
  rows.sort((a, b) => rank(a) - rank(b) || a.symbol.localeCompare(b.symbol));

  const holding = rows.filter((r) => r.state === 'HOLDING');
  const closed = positions.filter((p) => p.status === 'CLOSED');

  return NextResponse.json({
    success: true,
    rows,
    summary: {
      watching: rows.filter((r) => r.state === 'WATCHING').length,
      holding: holding.length,
      invested: holding.reduce((n, r) => n + (r.position?.invested ?? 0), 0),
      unrealisedPnl: holding.reduce((n, r) => n + (r.position?.pnl ?? 0), 0),
      // Holdings whose quote failed are excluded rather than counted at zero.
      pricedCount: holding.filter((r) => r.currentPrice != null).length,
      actionable: rows.filter((r) => rank(r) <= 1).length,
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
