import { NextResponse } from 'next/server';
import { requireValidUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { fetchLtpForSymbol } from '@/lib/market-quotes';
import { MASTER_STRATEGY_LIBRARY } from '@/lib/strategy-library';
import { exitRule } from '@/lib/describe-strategy';

function findStrategy(name: string) {
  return MASTER_STRATEGY_LIBRARY.find((s) =>
    (s.type === 'COMPOUND' ? s.name || 'Custom Compound' : `Single ${s.type}`) === name
  );
}

/**
 * Open and closed positions, with live P&L on the open ones.
 *
 * The exit rule travels with each position so the answer to "when do I sell" is
 * attached to the trade rather than buried in the strategy that produced it.
 */
export async function GET() {
  const user = await requireValidUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const positions = await prisma.labPosition.findMany({
    where: { userId: user.id },
    orderBy: [{ status: 'asc' }, { entryDate: 'desc' }],
  });

  // One quote per distinct symbol, not per position — holding the same stock
  // under two strategies should not fetch it twice.
  const openSymbols = [...new Set(positions.filter((p) => p.status === 'OPEN').map((p) => p.symbol))];
  const prices = new Map<string, number>();
  await Promise.all(
    openSymbols.map(async (s) => {
      const ltp = await fetchLtpForSymbol(s.replace('.NS', ''));
      if (ltp != null) prices.set(s, ltp);
    })
  );

  const enriched = positions.map((p) => {
    const strat = findStrategy(p.strategyName);
    const ltp = p.status === 'OPEN' ? prices.get(p.symbol) ?? null : null;
    const exit = p.status === 'CLOSED' ? p.exitPrice : ltp;

    const invested = p.entryPrice * p.quantity;
    const pnl = exit != null ? (exit - p.entryPrice) * p.quantity : null;

    return {
      ...p,
      currentPrice: ltp,
      invested,
      currentValue: exit != null ? exit * p.quantity : null,
      pnl,
      pnlPct: pnl != null && invested > 0 ? (pnl / invested) * 100 : null,
      exitRule: strat ? exitRule(strat) : 'Strategy no longer in the library.',
      // Surfaced so a stop that has already been breached is visible without
      // the user doing the arithmetic themselves.
      stopBreached:
        p.status === 'OPEN' && p.stopLossPrice != null && ltp != null && ltp <= p.stopLossPrice,
    };
  });

  const open = enriched.filter((p) => p.status === 'OPEN');
  return NextResponse.json({
    success: true,
    positions: enriched,
    summary: {
      openCount: open.length,
      invested: open.reduce((n, p) => n + p.invested, 0),
      // Positions whose quote failed are excluded rather than counted at zero.
      currentValue: open.reduce((n, p) => n + (p.currentValue ?? p.invested), 0),
      unrealisedPnl: open.reduce((n, p) => n + (p.pnl ?? 0), 0),
      pricedCount: open.filter((p) => p.currentPrice != null).length,
    },
  });
}

/** Record a position taken after a signal. */
export async function POST(request: Request) {
  const user = await requireValidUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { symbol, strategyName, entryPrice, quantity, entryDate, stopLossPrice, notes } = body;

    if (!symbol || !strategyName) {
      return NextResponse.json({ error: 'symbol and strategyName are required' }, { status: 400 });
    }
    const price = Number(entryPrice);
    const qty = Number(quantity);
    if (!Number.isFinite(price) || price <= 0) {
      return NextResponse.json({ error: 'entryPrice must be a positive number' }, { status: 400 });
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      return NextResponse.json({ error: 'quantity must be a positive number' }, { status: 400 });
    }

    const stop = stopLossPrice == null || stopLossPrice === '' ? null : Number(stopLossPrice);
    if (stop != null && (!Number.isFinite(stop) || stop <= 0)) {
      return NextResponse.json({ error: 'stopLossPrice must be a positive number' }, { status: 400 });
    }
    // A stop above entry would trigger the moment it is set.
    if (stop != null && stop >= price) {
      return NextResponse.json(
        { error: 'stopLossPrice must be below entryPrice' },
        { status: 400 }
      );
    }

    const position = await prisma.labPosition.create({
      data: {
        userId: user.id,
        symbol: String(symbol).toUpperCase(),
        strategyName: String(strategyName),
        entryPrice: price,
        quantity: qty,
        entryDate: entryDate ? new Date(entryDate) : new Date(),
        stopLossPrice: stop,
        notes: notes ? String(notes).slice(0, 500) : null,
      },
    });

    return NextResponse.json({ success: true, position });
  } catch (e) {
    console.error('Create position error:', e);
    return NextResponse.json({ error: 'Could not record position' }, { status: 500 });
  }
}
