import { NextResponse } from 'next/server';
import { backtestStartDate } from '@/lib/backtest-constants';
import { requireValidUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { fetchYahooDailyCloses, toPriceSeries } from '@/lib/index-history';
import { runSplitBacktest, StrategyParams } from '@/lib/dynamic-backtester';
import { MASTER_STRATEGY_LIBRARY } from '@/lib/strategy-library';
import { isCronRequest } from '@/lib/cron-auth';
import { sendTelegram, formatSignalAlert, notificationsConfigured } from '@/lib/notify';
import { exitRule } from '@/lib/describe-strategy';

/**
 * Re-run each OPEN position's strategy and answer one question: sell yet?
 *
 * This replaces the pinned-strategy sweep. Watching setups you do not own was
 * dropped — a signal matters once money is behind it, and buy opportunities
 * come from scanning rather than a standing watchlist. So the work list is
 * simply "what does the user currently hold".
 *
 * Schedule after the close on trading days:
 *   30 16 * * 1-5 curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" \
 *     http://172.16.245.84:3000/api/cron/check-exits
 */

function getStrategyByName(name: string): StrategyParams | undefined {
  return MASTER_STRATEGY_LIBRARY.find((s) =>
    (s.type === 'COMPOUND' ? s.name || 'Custom Compound' : `Single ${s.type}`) === name
  );
}

export async function POST(request: Request) {
  const cron = isCronRequest(request);
  const user = cron ? null : await requireValidUser();
  if (!cron && !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const positions = await prisma.labPosition.findMany({
      where: { status: 'OPEN', ...(user ? { userId: user.id } : {}) },
    });

    if (positions.length === 0) {
      return NextResponse.json({ success: true, message: 'No open positions.' });
    }

    const chatIdByUser = new Map<string, string>();
    if (notificationsConfigured()) {
      const users = await prisma.user.findMany({
        where: { id: { in: [...new Set(positions.map((p) => p.userId))] }, telegramChatId: { not: null } },
        select: { id: true, telegramChatId: true },
      });
      for (const u of users) if (u.telegramChatId) chatIdByUser.set(u.id, u.telegramChatId);
    }

    // One fetch per symbol, not per position — the same stock held under two
    // strategies must not be downloaded twice.
    const seriesBySymbol = new Map<string, ReturnType<typeof toPriceSeries>>();
    for (const symbol of new Set(positions.map((p) => p.symbol))) {
      try {
        const rows = await fetchYahooDailyCloses(symbol, backtestStartDate());
        if (rows.length >= 50) seriesBySymbol.set(symbol, toPriceSeries(rows));
      } catch (e) {
        console.error(`check-exits: fetch failed for ${symbol}`, e);
      }
    }

    let checked = 0;
    let alertsSent = 0;
    const alertsFailed: string[] = [];
    const sellNow: string[] = [];
    const stopsHit: string[] = [];

    for (const pos of positions) {
      const series = seriesBySymbol.get(pos.symbol);
      const strat = getStrategyByName(pos.strategyName);
      if (!series || !strat) continue;

      const { closes, highs, lows, opens, volumes, dates } = series;
      const split = runSplitBacktest(strat, closes, highs, lows, volumes, dates, opens);
      const signal = split.full.currentSignal || 'HOLDING';
      const price = closes[closes.length - 1];

      // A breached stop is its own alert, independent of the strategy — the
      // whole point of a stop is that it fires when the strategy has not.
      const stopBreached = pos.stopLossPrice != null && price <= pos.stopLossPrice;
      if (stopBreached) stopsHit.push(pos.symbol);
      if (signal === 'NEW_SELL') sellNow.push(pos.symbol);

      // Only SELL matters for something already held. A BUY signal on a stock
      // you own is noise, not an instruction.
      const actionable = signal === 'NEW_SELL' || stopBreached;
      const alertKey = stopBreached ? 'STOP' : signal;

      let notified = pos.lastNotifiedSignal;
      if (actionable && alertKey !== pos.lastNotifiedSignal) {
        const chatId = chatIdByUser.get(pos.userId);
        if (chatId) {
          const pnlPct = ((price - pos.entryPrice) / pos.entryPrice) * 100;
          const body = stopBreached
            ? [
                '🛑 <b>STOP LOSS HIT</b>',
                '',
                `<b>${pos.symbol.replace('.NS', '')}</b>`,
                `Stop was ₹${pos.stopLossPrice!.toFixed(2)}, price is ₹${price.toFixed(2)}`,
                `Position: ${pos.quantity} @ ₹${pos.entryPrice.toFixed(2)} (${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(1)}%)`,
              ].join('\n')
            : formatSignalAlert({
                symbol: pos.symbol,
                strategyName: pos.strategyName,
                signal: 'NEW_SELL',
                oosWinRate: split.outOfSample.winRate,
                oosTotalTrades: split.outOfSample.totalTrades,
                exitRule: exitRule(strat),
                price,
              }) + `\n\nYour position: ${pos.quantity} @ ₹${pos.entryPrice.toFixed(2)} (${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(1)}%)`;

          const res = await sendTelegram(chatId, body);
          if (res.sent) { notified = alertKey; alertsSent++; }
          // Latch untouched on failure so the next run retries.
          else alertsFailed.push(`${pos.symbol}: ${res.reason}`);
        }
      } else if (!actionable) {
        notified = null; // back to holding — re-arm for the next real exit
      }

      await prisma.labPosition.update({
        where: { id: pos.id },
        data: {
          lastSignal: signal,
          signalDate: new Date(),
          isNewSignal: actionable,
          lastNotifiedSignal: notified,
          lastChecked: new Date(),
          statsJson: JSON.stringify({
            oosWinRate: split.outOfSample.winRate,
            oosTotalTrades: split.outOfSample.totalTrades,
            oosAverageReturn: split.outOfSample.averageReturn,
          }),
        },
      });
      checked++;
    }

    return NextResponse.json({
      success: true,
      message: `Checked ${checked} open position(s).`,
      sellNow,
      stopsHit,
      alertsSent,
      ...(alertsFailed.length ? { alertsFailed } : {}),
      ...(notificationsConfigured() ? {} : { note: 'TELEGRAM_BOT_TOKEN not set — alerts disabled' }),
    });
  } catch (error) {
    console.error('check-exits error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
