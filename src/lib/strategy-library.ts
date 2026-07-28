import type {
  StrategyParams,
  CompoundStrategyParams,
  SingleStrategyParams,
} from './dynamic-backtester';
import type { Timeframe } from './timeframe';

/**
 * The strategy library.
 *
 * Three kinds of entry:
 *
 *  1. NAMED SYSTEMS — documented methods from published books, carrying their
 *     source. A user seeing "Weinstein Stage 2 Breakout" can go read the book;
 *     "Compound RSI+SMA #37" tells them nothing.
 *  2. POSITIONAL SINGLES — one idea, run across daily/weekly/monthly. The same
 *     indicator on a different candle is a genuinely different strategy.
 *  3. PARAMETER SWEEPS — the classic oscillators across wider grids.
 *
 * A note on size. More strategies means more will clear any win-rate bar by
 * luck alone: at ~400, roughly 20 will hit 70% on a random series. The defence
 * is not fewer strategies, it is showing the whole distribution — the 30% ones
 * next to the 80% ones — so a single number is never mistaken for an edge.
 */

export const MASTER_STRATEGY_LIBRARY: StrategyParams[] = [];

function strategy(
  name: string,
  conditions: SingleStrategyParams[],
  opts: { timeframe?: Timeframe; source?: string } = {}
): CompoundStrategyParams {
  return {
    type: 'COMPOUND',
    name,
    conditions,
    timeframe: opts.timeframe ?? 'daily',
    source: opts.source,
  };
}

const add = (s: CompoundStrategyParams) => MASTER_STRATEGY_LIBRARY.push(s);

// ═════════════════════════════════════════════════════════════════════════════
// 1. NAMED SYSTEMS FROM PUBLISHED WORK
// ═════════════════════════════════════════════════════════════════════════════

add(strategy(
  'Weinstein Stage 2 Breakout',
  [
    { type: 'MA_REGIME', period: 30, requireRising: true, slopeLookback: 4 },
    { type: 'VOLUME', period: 20, multiple: 1.5 },
  ],
  { timeframe: 'weekly', source: 'Stan Weinstein — Secrets for Profiting in Bull and Bear Markets' }
));

add(strategy(
  'Weinstein Stage 2 (no volume filter)',
  [{ type: 'MA_REGIME', period: 30, requireRising: true, slopeLookback: 4 }],
  { timeframe: 'weekly', source: 'Stan Weinstein — Stage Analysis' }
));

add(strategy(
  'Minervini Trend Template',
  [
    { type: 'RIBBON', periods: [50, 150, 200] },
    { type: 'MA_REGIME', period: 200, requireRising: true, slopeLookback: 22 },
    { type: 'HIGH_52W', lookback: 252, withinPct: 25 },
  ],
  { source: 'Mark Minervini — Trade Like a Stock Market Wizard' }
));

add(strategy(
  'Minervini VCP Breakout',
  [
    { type: 'RIBBON', periods: [10, 20, 50] },
    { type: 'HIGH_52W', lookback: 252, withinPct: 5 },
    { type: 'VOLUME', period: 50, multiple: 1.5 },
  ],
  { source: 'Mark Minervini — Volatility Contraction Pattern' }
));

add(strategy(
  'Darvas Box Breakout',
  [
    { type: 'DONCHIAN', period: 40, exitPeriod: 20 },
    { type: 'VOLUME', period: 20, multiple: 2 },
  ],
  { source: 'Nicolas Darvas — How I Made $2,000,000 in the Stock Market' }
));

add(strategy(
  "O'Neil 52-Week High Breakout",
  [
    { type: 'HIGH_52W', lookback: 252, withinPct: 2 },
    { type: 'VOLUME', period: 50, multiple: 1.4 },
    { type: 'MA_REGIME', period: 200, requireRising: true, slopeLookback: 22 },
  ],
  { source: "William O'Neil — How to Make Money in Stocks (CANSLIM)" }
));

add(strategy(
  'Turtle System 1 (20/10)',
  [{ type: 'DONCHIAN', period: 20, exitPeriod: 10 }],
  { source: 'Richard Donchian / Turtle Traders — Way of the Turtle' }
));

add(strategy(
  'Turtle System 2 (55/20)',
  [{ type: 'DONCHIAN', period: 55, exitPeriod: 20 }],
  { source: 'Richard Donchian / Turtle Traders — Way of the Turtle' }
));

add(strategy(
  'Coppock Curve Bottom',
  [{ type: 'COPPOCK', roc1: 14, roc2: 11, wma: 10 }],
  { timeframe: 'monthly', source: 'Edwin Coppock — Barron\'s, 1962' }
));

add(strategy(
  'Faber 10-Month SMA Timing',
  [{ type: 'MA_REGIME', period: 10, requireRising: false }],
  { timeframe: 'monthly', source: 'Meb Faber — A Quantitative Approach to Tactical Asset Allocation' }
));

add(strategy(
  'Tudor Jones 200-Day Rule',
  [{ type: 'MA_REGIME', period: 200, requireRising: false }],
  { source: 'Paul Tudor Jones — Market Wizards ("nothing good happens below the 200-day")' }
));

add(strategy(
  'Connors RSI(2) Mean Reversion',
  [
    { type: 'MA_REGIME', period: 200, requireRising: false },
    { type: 'RSI', period: 2, oversold: 10, overbought: 70 },
  ],
  { source: 'Larry Connors — Short Term Trading Strategies That Work' }
));

add(strategy(
  'Elder Triple Screen',
  [
    { type: 'MA_REGIME', period: 13, requireRising: true, slopeLookback: 4 },
    { type: 'STOCH', period: 14, smoothK: 3, smoothD: 3, oversold: 30, overbought: 70 },
  ],
  { timeframe: 'weekly', source: 'Alexander Elder — Trading for a Living' }
));

add(strategy(
  'Raschke Holy Grail',
  [
    { type: 'ADX', period: 14, strongThreshold: 30 },
    { type: 'RSI', period: 14, oversold: 45, overbought: 75 },
  ],
  { source: 'Linda Raschke — Street Smarts' }
));

add(strategy(
  'Antonacci Absolute Momentum',
  [{ type: 'ROC', period: 12, threshold: 0 }],
  { timeframe: 'monthly', source: 'Gary Antonacci — Dual Momentum Investing' }
));

add(strategy(
  'Livermore Pivotal Point',
  [
    { type: 'DONCHIAN', period: 60, exitPeriod: 20 },
    { type: 'VOLUME', period: 20, multiple: 1.8 },
  ],
  { source: 'Jesse Livermore — Reminiscences of a Stock Operator' }
));

add(strategy(
  'Bollinger Squeeze Breakout',
  [
    { type: 'BB', period: 20, multiplier: 2 },
    { type: 'KELTNER', period: 20, multiplier: 1.5 },
  ],
  { source: 'John Bollinger — Bollinger on Bollinger Bands' }
));

add(strategy(
  'Dow Theory Higher Highs',
  [
    { type: 'AROON', period: 25, threshold: 70 },
    { type: 'MA_REGIME', period: 50, requireRising: true, slopeLookback: 20 },
  ],
  { source: 'Charles Dow — Dow Theory' }
));

add(strategy(
  'Wyckoff Accumulation Breakout',
  [
    { type: 'CMF', period: 20, threshold: 0.1 },
    { type: 'DONCHIAN', period: 30, exitPeriod: 15 },
  ],
  { source: 'Richard Wyckoff — accumulation / mark-up phase' }
));

add(strategy(
  'Radge Weekend Trend Trader',
  [
    { type: 'DONCHIAN', period: 20, exitPeriod: 10 },
    { type: 'MA_REGIME', period: 30, requireRising: false },
  ],
  { timeframe: 'weekly', source: 'Nick Radge — Weekend Trend Trader' }
));

add(strategy(
  'Quality at a Discount',
  [
    { type: 'DRAWDOWN', minDrawdownPct: 30 },
    { type: 'MA_REGIME', period: 200, requireRising: false },
  ],
  { source: 'Value instinct expressed technically — buy the recovery, not the falling knife' }
));

add(strategy(
  'Deep Value Recovery',
  [
    { type: 'DRAWDOWN', minDrawdownPct: 50 },
    { type: 'MA_REGIME', period: 50, requireRising: true, slopeLookback: 20 },
  ],
  { timeframe: 'weekly', source: 'Buy 50% off the high, only once the trend has turned' }
));

add(strategy(
  'Supertrend Weekly Positional',
  [{ type: 'SUPERTREND', period: 10, multiplier: 3 }],
  { timeframe: 'weekly', source: 'Olivier Seban — Supertrend, the most-used indicator in Indian retail' }
));

add(strategy(
  'Golden Cross (classic)',
  [{ type: 'SMA', fastPeriod: 50, slowPeriod: 200 }],
  { source: 'Classic — 50/200 crossover' }
));

// ═════════════════════════════════════════════════════════════════════════════
// 2. POSITIONAL SINGLES ACROSS TIMEFRAMES
// ═════════════════════════════════════════════════════════════════════════════

const TIMEFRAMES: Timeframe[] = ['daily', 'weekly', 'monthly'];
const tfLabel = (t: Timeframe) => (t === 'daily' ? 'D' : t === 'weekly' ? 'W' : 'M');

/**
 * Bars in one year, per timeframe.
 *
 * Every lookback in this file is counted in BARS, so a "52-week high" is 252
 * bars daily but 52 weekly and 12 monthly. Reusing 252 everywhere silently asks
 * for a five-year high on weekly candles — which simply never triggers.
 */
const BARS_PER_YEAR: Record<Timeframe, number> = { daily: 252, weekly: 52, monthly: 12 };

/** Convert a daily-bar lookback into the equivalent for this timeframe. */
const yearBars = (tf: Timeframe, years = 1) => Math.max(3, Math.round(BARS_PER_YEAR[tf] * years));

for (const tf of TIMEFRAMES) {
  const T = tfLabel(tf);

  for (const [p, m] of [[7, 3], [10, 3], [14, 2]] as const) {
    add(strategy(`Supertrend (${p},${m}) [${T}]`, [{ type: 'SUPERTREND', period: p, multiplier: m }], { timeframe: tf }));
  }

  for (const [entry, exit] of [[20, 10], [40, 20], [55, 20]] as const) {
    add(strategy(`Donchian Breakout ${entry}/${exit} [${T}]`, [{ type: 'DONCHIAN', period: entry, exitPeriod: exit }], { timeframe: tf }));
  }

  // MA periods scaled so "200-day MA" stays a 200-DAY MA on every timeframe:
  // 200 daily bars ≈ 40 weekly ≈ 10 monthly.
  for (const days of [50, 100, 200] as const) {
    const p = Math.max(3, Math.round(days * (BARS_PER_YEAR[tf] / 252)));
    add(strategy(`Above Rising ${days}d MA [${T}]`, [{ type: 'MA_REGIME', period: p, requireRising: true, slopeLookback: Math.max(3, Math.round(20 * (BARS_PER_YEAR[tf] / 252))) }], { timeframe: tf }));
    add(strategy(`Above ${days}d MA [${T}]`, [{ type: 'MA_REGIME', period: p, requireRising: false }], { timeframe: tf }));
  }

  for (const within of [2, 5, 10] as const) {
    add(strategy(`Within ${within}% of 52w High [${T}]`, [{ type: 'HIGH_52W', lookback: yearBars(tf), withinPct: within }], { timeframe: tf }));
  }

  for (const dd of [20, 30, 40, 50] as const) {
    add(strategy(`${dd}% Off All-Time High [${T}]`, [{ type: 'DRAWDOWN', minDrawdownPct: dd }], { timeframe: tf }));
  }

  add(strategy(`MA Ribbon Aligned [${T}]`, [{ type: 'RIBBON', periods: [10, 20, 50, 200] }], { timeframe: tf }));
  add(strategy(`Aroon Trend (25) [${T}]`, [{ type: 'AROON', period: 25, threshold: 70 }], { timeframe: tf }));
  add(strategy(`Chaikin Money Flow (20) [${T}]`, [{ type: 'CMF', period: 20, threshold: 0.05 }], { timeframe: tf }));
  add(strategy(`Keltner Breakout (20,2) [${T}]`, [{ type: 'KELTNER', period: 20, multiplier: 2 }], { timeframe: tf }));

  for (const p of [14, 21] as const) {
    add(strategy(`Williams %R (${p}) [${T}]`, [{ type: 'WILLIAMSR', period: p, oversold: -80, overbought: -20 }], { timeframe: tf }));
    add(strategy(`Money Flow Index (${p}) [${T}]`, [{ type: 'MFI', period: p, oversold: 20, overbought: 80 }], { timeframe: tf }));
  }

  for (const p of [6, 12] as const) {
    add(strategy(`Momentum ROC (${p}) [${T}]`, [{ type: 'ROC', period: p, threshold: 0 }], { timeframe: tf }));
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 3. CLASSIC OSCILLATOR SWEEPS (daily + weekly)
// ═════════════════════════════════════════════════════════════════════════════

for (const tf of ['daily', 'weekly'] as Timeframe[]) {
  const T = tfLabel(tf);

  for (const period of [2, 7, 10, 14, 21]) {
    for (const oversold of [10, 20, 25, 30, 40]) {
      if (period === 2 && oversold > 20) continue; // RSI(2) only makes sense deep
      add(strategy(`RSI Reversion (${period},${oversold}) [${T}]`,
        [{ type: 'RSI', period, oversold, overbought: 100 - oversold }], { timeframe: tf }));
    }
  }

  const maPairs: [number, number][] = [[5, 20], [9, 21], [10, 30], [10, 50], [20, 50], [20, 100], [50, 150], [50, 200]];
  for (const [fast, slow] of maPairs) {
    add(strategy(`SMA Cross ${fast}/${slow} [${T}]`, [{ type: 'SMA', fastPeriod: fast, slowPeriod: slow }], { timeframe: tf }));
    add(strategy(`EMA Cross ${fast}/${slow} [${T}]`, [{ type: 'EMA', fastPeriod: fast, slowPeriod: slow }], { timeframe: tf }));
  }

  for (const [f, s] of [[8, 21], [12, 26], [19, 39]] as const) {
    add(strategy(`MACD (${f}/${s}) [${T}]`, [{ type: 'MACD', fastPeriod: f, slowPeriod: s, signalPeriod: 9 }], { timeframe: tf }));
  }

  for (const period of [10, 20, 50]) {
    for (const mult of [1.5, 2, 2.5]) {
      add(strategy(`Bollinger Breakout (${period},${mult}) [${T}]`,
        [{ type: 'BB', period, multiplier: mult }], { timeframe: tf }));
      add(strategy(`Bollinger Reversion (${period},${mult}) [${T}]`,
        [{ type: 'BB', period, multiplier: mult, mode: 'reversion' }], { timeframe: tf }));
    }
  }

  for (const period of [14, 21]) {
    for (const oversold of [20, 30]) {
      add(strategy(`Stochastic (${period},${oversold}) [${T}]`,
        [{ type: 'STOCH', period, smoothK: 3, smoothD: 3, oversold, overbought: 100 - oversold }], { timeframe: tf }));
    }
  }

  for (const period of [20, 40]) {
    add(strategy(`CCI Reversion (${period}) [${T}]`,
      [{ type: 'CCI', period, oversold: -200, overbought: 200 }], { timeframe: tf }));
  }

  add(strategy(`Ichimoku Kumo Breakout [${T}]`,
    [{ type: 'ICHIMOKU', tenkan: 9, kijun: 26, senkouB: 52 }], { timeframe: tf }));
  add(strategy(`Parabolic SAR [${T}]`, [{ type: 'PSAR', step: 0.02, maxStep: 0.2 }], { timeframe: tf }));
  add(strategy(`ADX Trend Rider [${T}]`, [{ type: 'ADX', period: 14, strongThreshold: 25 }], { timeframe: tf }));
  add(strategy(`OBV Accumulation [${T}]`, [{ type: 'OBV', period: 20 }], { timeframe: tf }));
  add(strategy(`VWAP Value Buy [${T}]`, [{ type: 'VWAP', period: 20 }], { timeframe: tf }));
}

// ═════════════════════════════════════════════════════════════════════════════
// 4. CONFLUENCE COMBOS
// ═════════════════════════════════════════════════════════════════════════════

for (const tf of ['daily', 'weekly'] as Timeframe[]) {
  const T = tfLabel(tf);

  for (const [fast, slow] of [[20, 50], [50, 200]] as const) {
    for (const rsiOs of [30, 40]) {
      add(strategy(`Pullback Buyer (SMA ${fast}/${slow} + RSI ${rsiOs}) [${T}]`, [
        { type: 'SMA', fastPeriod: fast, slowPeriod: slow },
        { type: 'RSI', period: 14, oversold: rsiOs, overbought: 70 },
      ], { timeframe: tf }));
    }
  }

  add(strategy(`Trend + Volume Confirmation [${T}]`, [
    { type: 'MA_REGIME', period: 50, requireRising: true, slopeLookback: 20 },
    { type: 'VOLUME', period: 20, multiple: 1.5 },
  ], { timeframe: tf }));

  add(strategy(`Supertrend + Money Flow [${T}]`, [
    { type: 'SUPERTREND', period: 10, multiplier: 3 },
    { type: 'MFI', period: 14, oversold: 50, overbought: 85 },
  ], { timeframe: tf }));

  add(strategy(`Breakout + Accumulation [${T}]`, [
    { type: 'DONCHIAN', period: 40, exitPeriod: 20 },
    { type: 'CMF', period: 20, threshold: 0.05 },
  ], { timeframe: tf }));

  add(strategy(`Strong Trend Rider (ADX + 50/200) [${T}]`, [
    { type: 'ADX', period: 14, strongThreshold: 25 },
    { type: 'SMA', fastPeriod: 50, slowPeriod: 200 },
  ], { timeframe: tf }));

  add(strategy(`Momentum + Trend + Dip [${T}]`, [
    { type: 'MA_REGIME', period: 200, requireRising: true, slopeLookback: 22 },
    { type: 'MACD', fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
    { type: 'RSI', period: 14, oversold: 45, overbought: 75 },
  ], { timeframe: tf }));

  add(strategy(`Institutional Sniper (VWAP+ADX+OBV+PSAR) [${T}]`, [
    { type: 'VWAP', period: 20 },
    { type: 'ADX', period: 14, strongThreshold: 25 },
    { type: 'OBV', period: 20 },
    { type: 'PSAR', step: 0.02, maxStep: 0.2 },
  ], { timeframe: tf }));

  add(strategy(`Volatility Rider (BB + Stoch + ATR stop) [${T}]`, [
    { type: 'BB', period: 20, multiplier: 2 },
    { type: 'STOCH', period: 14, smoothK: 3, smoothD: 3, oversold: 50, overbought: 80 },
    { type: 'ATR', period: 14, multiplier: 3 },
  ], { timeframe: tf }));

  add(strategy(`Japanese Volume Cloud (Ichimoku+OBV+RSI) [${T}]`, [
    { type: 'ICHIMOKU', tenkan: 9, kijun: 26, senkouB: 52 },
    { type: 'OBV', period: 20 },
    { type: 'RSI', period: 14, oversold: 50, overbought: 80 },
  ], { timeframe: tf }));

  add(strategy(`52w High + Rising 200 + Volume [${T}]`, [
    { type: 'HIGH_52W', lookback: 252, withinPct: 5 },
    { type: 'MA_REGIME', period: 200, requireRising: true, slopeLookback: 22 },
    { type: 'VOLUME', period: 50, multiple: 1.3 },
  ], { timeframe: tf }));
}

/** Named systems come first so they head the list when scores tie. */
export const NAMED_SYSTEM_COUNT = 24;
