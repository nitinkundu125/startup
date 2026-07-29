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

function getStrategyByName(name: string): StrategyParams | undefined {
  return MASTER_STRATEGY_LIBRARY.find(strat => {
    const stratName = strat.type === 'COMPOUND' ? (strat.name || 'Custom Compound') : `Single ${strat.type}`;
    return stratName === name;
  });
}

export async function POST(request: Request) {
  // A scheduler has no session cookie, so this endpoint accepts either a valid
  // CRON_SECRET (refreshes every user's pinned strategies) or a logged-in user
  // (refreshes only their own). Previously it required a session, which meant no
  // scheduler could ever call it.
  const cron = isCronRequest(request);
  const user = cron ? null : await requireValidUser();
  if (!cron && !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const pinnedStrategies = await prisma.pinnedStrategy.findMany({
      where: user ? { userId: user.id } : {},
    });

    if (pinnedStrategies.length === 0) {
      return NextResponse.json({ success: true, message: 'No pinned strategies found.' });
    }

    // Group by symbol to optimize Yahoo fetches
    const symbols = Array.from(new Set(pinnedStrategies.map(p => p.symbol)));

    // Alert destinations, loaded once. A user with no chat id simply gets no
    // alerts rather than the run failing.
    const userIds = Array.from(new Set(pinnedStrategies.map(p => p.userId)));
    const chatIdByUser = new Map<string, string>();
    if (notificationsConfigured()) {
      const users = await prisma.user.findMany({
        where: { id: { in: userIds }, telegramChatId: { not: null } },
        select: { id: true, telegramChatId: true },
      });
      for (const u of users) if (u.telegramChatId) chatIdByUser.set(u.id, u.telegramChatId);
    }

    let updatedCount = 0;
    let alertsSent = 0;
    const alertsFailed: string[] = [];

    for (const symbol of symbols) {
      const period1 = backtestStartDate();

      let seriesData;
      try {
        const rows = await fetchYahooDailyCloses(symbol, period1);
        if (rows.length < 50) continue;
        seriesData = toPriceSeries(rows);
      } catch (e) {
        console.error(`Failed to fetch data for ${symbol}:`, e);
        continue;
      }

      const { closes, highs, lows, opens, volumes, dates } = seriesData;

      // Find all pinned strategies for this symbol
      const symbolStrategies = pinnedStrategies.filter(p => p.symbol === symbol);

      for (const pinned of symbolStrategies) {
        const strat = getStrategyByName(pinned.strategyName);
        if (!strat) continue;

        const split = runSplitBacktest(strat, closes, highs, lows, volumes, dates, opens);
        const stats = split.full;

        const newSignal = stats.currentSignal || 'HOLDING';
        let isNewSignal = pinned.isNewSignal;

        // If lastSignal exists and differs from newSignal (and newSignal is not just a duplicate)
        if (pinned.lastSignal && pinned.lastSignal !== newSignal) {
          isNewSignal = true;
        }

        // Persist the held-back numbers alongside the fitted ones so the UI can
        // show whether this strategy was ever validated.
        const statsJson = JSON.stringify({
          winRate: split.inSample.winRate,
          totalTrades: split.inSample.totalTrades,
          averageReturn: split.inSample.averageReturn,
          totalReturn: split.inSample.totalReturn,
          oosWinRate: split.outOfSample.winRate,
          oosTotalTrades: split.outOfSample.totalTrades,
          oosAverageReturn: split.outOfSample.averageReturn,
          oosTotalReturn: split.outOfSample.totalReturn,
          splitDate: split.splitDate ? split.splitDate.toISOString() : null,
        });

        // Alert only on a genuine transition into an actionable signal, and only
        // once per transition. A daily cron that re-sends the same BUY every
        // morning while the condition persists trains the user to ignore it.
        let notified = pinned.lastNotifiedSignal;
        const actionable = newSignal === 'NEW_BUY' || newSignal === 'NEW_SELL';
        if (actionable && newSignal !== pinned.lastNotifiedSignal) {
          const chatId = chatIdByUser.get(pinned.userId);
          if (chatId) {
            const avgHold =
              stats.trades.length > 0
                ? stats.trades.reduce((n, t) => n + t.holdingPeriodDays, 0) / stats.trades.length
                : undefined;
            const res = await sendTelegram(
              chatId,
              formatSignalAlert({
                symbol: pinned.symbol,
                strategyName: pinned.strategyName,
                signal: newSignal,
                oosWinRate: split.outOfSample.winRate,
                oosTotalTrades: split.outOfSample.totalTrades,
                avgHoldingDays: avgHold,
                exitRule: exitRule(strat),
                price: closes[closes.length - 1],
              })
            );
            if (res.sent) {
              notified = newSignal;
              alertsSent++;
            } else {
              // Leave lastNotifiedSignal untouched so the next run retries
              // rather than silently swallowing the alert.
              alertsFailed.push(`${pinned.symbol}: ${res.reason}`);
            }
          }
        } else if (!actionable) {
          // Back to HOLDING/WAITING — clear the latch so the next real signal
          // alerts again.
          notified = null;
        }

        await prisma.pinnedStrategy.update({
          where: { id: pinned.id },
          data: {
            lastSignal: newSignal,
            signalDate: new Date(),
            isNewSignal,
            statsJson,
            lastUpdated: new Date(),
            lastNotifiedSignal: notified,
          }
        });

        updatedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Updated ${updatedCount} pinned strategies.`,
      alertsSent,
      // Reported rather than swallowed — a silently failing alert channel is
      // indistinguishable from "no signals fired".
      ...(alertsFailed.length ? { alertsFailed } : {}),
      ...(notificationsConfigured() ? {} : { note: 'TELEGRAM_BOT_TOKEN not set — alerts disabled' }),
    });
  } catch (error) {
    console.error('Pinned Cron Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
