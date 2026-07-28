import { prisma } from '@/lib/prisma';
import { fetchYahooDailyCloses, toPriceSeries } from '@/lib/index-history';
import {
  runSplitBacktest,
  type CompoundStrategyParams,
  type DynamicBacktestResult,
} from './dynamic-backtester';

/**
 * Watchlist screener.
 *
 * This used to run its own backtest engine (`backtester.ts`) which defined the
 * same named strategies differently from the Backtest Lab — its RSI exit fired
 * on a cross UP through 70 while the Lab's fired on a cross DOWN through it, so
 * two screens with the same label meant opposite things. There is now one engine.
 */

const RECENT_WINDOW_DAYS = 90;

type ScreenerStrategy = {
  strategy: CompoundStrategyParams;
  buyRule: string;
  sellRule: string;
  buyDescription: string;
  sellDescription: string;
};

const SCREENS: ScreenerStrategy[] = [
  {
    strategy: { type: 'COMPOUND', name: 'SMA Golden Cross', conditions: [{ type: 'SMA', fastPeriod: 50, slowPeriod: 200 }] },
    buyRule: 'SMA_GOLDEN_CROSS',
    sellRule: 'SMA_DEATH_CROSS',
    buyDescription: '50-day SMA crossed above 200-day SMA.',
    sellDescription: '50-day SMA crossed below 200-day SMA.',
  },
  {
    strategy: { type: 'COMPOUND', name: 'RSI Reversion', conditions: [{ type: 'RSI', period: 14, oversold: 30, overbought: 70 }] },
    buyRule: 'RSI_OVERSOLD',
    sellRule: 'RSI_OVERBOUGHT',
    buyDescription: 'RSI dropped into oversold territory.',
    sellDescription: 'RSI rose into overbought territory.',
  },
  {
    strategy: { type: 'COMPOUND', name: 'MACD Momentum', conditions: [{ type: 'MACD', fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 }] },
    buyRule: 'MACD_BULLISH',
    sellRule: 'MACD_BEARISH',
    buyDescription: 'MACD line crossed above Signal line.',
    sellDescription: 'MACD line crossed below Signal line.',
  },
  {
    strategy: { type: 'COMPOUND', name: 'Bollinger Reversion', conditions: [{ type: 'BB', period: 20, multiplier: 2, mode: 'reversion' }] },
    buyRule: 'BB_LOWER_BREAKOUT',
    sellRule: 'BB_UPPER_BREAKOUT',
    buyDescription: 'Price closed below the lower Bollinger Band.',
    sellDescription: 'Price reverted back above the Bollinger mid-band.',
  },
];

/**
 * Historical-edge blurb.
 *
 * Reports the HELD-BACK window and says so. A win rate quoted from the same data
 * the rule was measured on is not evidence of an edge.
 */
function edgeMessage(split: { inSample: DynamicBacktestResult; outOfSample: DynamicBacktestResult }): string {
  const oos = split.outOfSample;
  if (oos.totalTrades === 0) {
    const n = split.inSample.totalTrades;
    if (n === 0) return 'No historical occurrences of this setup — no edge estimate available.';
    return `Seen ${n} time(s) historically but not once in the held-back period, so this edge is unvalidated.`;
  }
  const sign = oos.averageReturn > 0 ? '+' : '';
  return (
    `Out-of-sample: ${oos.totalTrades} occurrence(s), ${oos.profitableTrades} profitable ` +
    `(${oos.winRate.toFixed(0)}% win rate), ${sign}${oos.averageReturn.toFixed(1)}% average net return ` +
    `per trade after costs.`
  );
}

export async function runScreenerForSymbol(userId: string, symbol: string) {
  const period1 = new Date('1990-01-01'); // Fetch all available lifetime data

  let rows;
  try {
    rows = await fetchYahooDailyCloses(symbol, period1);
  } catch (error) {
    console.error(`Failed to fetch history for ${symbol}:`, error);
    return;
  }

  if (rows.length < 200) {
    console.warn(`Not enough data for ${symbol} to compute 200 SMA.`);
    return;
  }

  const { closes, highs, lows, opens, volumes, dates } = toPriceSeries(rows);

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RECENT_WINDOW_DAYS);

  type PendingSignal = {
    type: 'BUY' | 'SELL';
    rule: string;
    price: number;
    date: Date;
    description: string;
  };
  const pending: PendingSignal[] = [];

  for (const screen of SCREENS) {
    const split = runSplitBacktest(screen.strategy, closes, highs, lows, volumes, dates, opens);
    const blurb = edgeMessage(split);

    for (const trade of split.full.trades) {
      if (trade.entryDate >= cutoff) {
        pending.push({
          type: 'BUY',
          rule: screen.buyRule,
          price: trade.entryPrice,
          date: trade.entryDate,
          description: `${screen.buyDescription}\n${blurb}`,
        });
      }
      if (trade.exitDate >= cutoff) {
        pending.push({
          type: 'SELL',
          rule: screen.sellRule,
          price: trade.exitPrice,
          date: trade.exitDate,
          description: `${screen.sellDescription}\n${blurb}`,
        });
      }
    }
  }

  // Replace this symbol's feed atomically so a mid-run failure cannot leave the
  // watchlist showing a half-deleted set of signals.
  await prisma.$transaction([
    prisma.screenerSignal.deleteMany({ where: { userId, symbol } }),
    ...pending.map((s) =>
      prisma.screenerSignal.create({
        data: {
          userId,
          symbol,
          type: s.type,
          rule: s.rule,
          price: s.price,
          date: s.date,
          description: s.description,
        },
      })
    ),
  ]);
}
