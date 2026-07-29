/**
 * Plain-English entry and exit rules for a strategy.
 *
 * The exit condition has always existed — it is what ends every backtested
 * trade — but it was never shown anywhere. A user saw "BUY TODAY", bought, and
 * then held a position with no idea what they were waiting for. These strings
 * are generated from the same condition objects the engine evaluates, so they
 * cannot drift from what actually runs.
 */
import type { SingleStrategyParams, StrategyParams } from './dynamic-backtester';

const tf = (t?: string) => (t === 'weekly' ? ' (weekly)' : t === 'monthly' ? ' (monthly)' : '');

/** What has to be true to enter. */
export function describeEntry(c: SingleStrategyParams): string {
  switch (c.type) {
    case 'RSI': return `RSI(${c.period}) at or below ${c.oversold}`;
    case 'SMA': return `${c.fastPeriod}-bar SMA above ${c.slowPeriod}-bar SMA`;
    case 'EMA': return `${c.fastPeriod}-bar EMA above ${c.slowPeriod}-bar EMA`;
    case 'MACD': return `MACD(${c.fastPeriod}/${c.slowPeriod}) above its signal line`;
    case 'BB': return c.mode === 'reversion'
      ? `price below the lower Bollinger band (${c.period}, ${c.multiplier}σ)`
      : `price above the upper Bollinger band (${c.period}, ${c.multiplier}σ)`;
    case 'STOCH': return `Stochastic(${c.period}) at or below ${c.oversold}`;
    case 'ATR': return 'no entry condition (ATR is a trailing stop only)';
    case 'VWAP': return `price above the ${c.period}-bar VWAP`;
    case 'OBV': return `OBV above its ${c.period}-bar average`;
    case 'ADX': return `ADX(${c.period}) above ${c.strongThreshold} with +DI over −DI`;
    case 'CCI': return `CCI(${c.period}) at or below ${c.oversold}`;
    case 'PSAR': return 'price above the Parabolic SAR';
    case 'ICHIMOKU': return 'price above the Ichimoku cloud';
    case 'SUPERTREND': return `Supertrend(${c.period}, ${c.multiplier}) turns up`;
    case 'DONCHIAN': return `price breaks the ${c.period}-bar high`;
    case 'KELTNER': return `price above the upper Keltner channel (${c.period})`;
    case 'WILLIAMSR': return `Williams %R(${c.period}) at or below ${c.oversold}`;
    case 'MFI': return `Money Flow Index(${c.period}) at or below ${c.oversold}`;
    case 'ROC': return `${c.period}-bar momentum above ${c.threshold}%`;
    case 'AROON': return `Aroon Up above ${c.threshold} and leading Aroon Down`;
    case 'CMF': return `Chaikin Money Flow above ${c.threshold}`;
    case 'COPPOCK': return 'Coppock Curve turns up from below zero';
    case 'RIBBON': return `moving averages stacked in order (${c.periods.join(' > ')})`;
    case 'MA_REGIME': return c.requireRising === false
      ? `price above the ${c.period}-bar moving average`
      : `price above a rising ${c.period}-bar moving average`;
    case 'HIGH_52W': return `price within ${c.withinPct}% of its ${c.lookback}-bar high`;
    case 'DRAWDOWN': return `price at least ${c.minDrawdownPct}% below its all-time high`;
    case 'VOLUME': return `volume at ${c.multiple}× its ${c.period}-bar average`;
    default: return 'unknown condition';
  }
}

/** What ends the trade. Exits are ANY-of, so one of these is enough. */
export function describeExit(c: SingleStrategyParams): string {
  switch (c.type) {
    case 'RSI': return `RSI(${c.period}) reaches ${c.overbought}`;
    case 'SMA': return `${c.fastPeriod}-bar SMA falls below ${c.slowPeriod}-bar SMA`;
    case 'EMA': return `${c.fastPeriod}-bar EMA falls below ${c.slowPeriod}-bar EMA`;
    case 'MACD': return 'MACD crosses below its signal line';
    case 'BB': return c.mode === 'reversion'
      ? 'price recovers above the Bollinger mid-band'
      : 'price falls back to the Bollinger mid-band';
    case 'STOCH': return `Stochastic(${c.period}) reaches ${c.overbought}`;
    case 'ATR': return `price falls ${c.multiplier}× ATR(${c.period}) below its high since entry (trailing stop)`;
    case 'VWAP': return `price falls below the ${c.period}-bar VWAP`;
    case 'OBV': return `OBV falls below its ${c.period}-bar average`;
    case 'ADX': return '−DI crosses above +DI (trend breaks)';
    case 'CCI': return `CCI(${c.period}) reaches ${c.overbought}`;
    case 'PSAR': return 'price falls below the Parabolic SAR';
    case 'ICHIMOKU': return 'price falls below the Ichimoku cloud';
    case 'SUPERTREND': return `Supertrend(${c.period}, ${c.multiplier}) turns down`;
    case 'DONCHIAN': return `price breaks the ${c.exitPeriod ?? c.period}-bar low`;
    case 'KELTNER': return `price falls below the Keltner mid-line (${c.period})`;
    case 'WILLIAMSR': return `Williams %R(${c.period}) reaches ${c.overbought}`;
    case 'MFI': return `Money Flow Index(${c.period}) reaches ${c.overbought}`;
    case 'ROC': return `${c.period}-bar momentum turns negative`;
    case 'AROON': return 'Aroon Down overtakes Aroon Up';
    case 'CMF': return 'Chaikin Money Flow turns negative';
    case 'COPPOCK': return 'Coppock Curve turns down from above zero';
    case 'RIBBON': return 'the moving-average stack breaks';
    case 'MA_REGIME': return `price falls below the ${c.period}-bar moving average`;
    case 'HIGH_52W': return 'price falls into the bottom third of its range';
    case 'DRAWDOWN': return 'price recovers to within 5% of its all-time high';
    case 'VOLUME': return ''; // confirms entries only, never an exit
    default: return '';
  }
}

function conditionsOf(s: StrategyParams): SingleStrategyParams[] {
  return s.type === 'COMPOUND' ? s.conditions : [s as SingleStrategyParams];
}

/** "RSI(14) at or below 30 AND price above a rising 200-bar moving average" */
export function entryRule(s: StrategyParams): string {
  const parts = conditionsOf(s).map(describeEntry).filter((p) => !p.startsWith('no entry'));
  const timeframe = s.type === 'COMPOUND' ? tf(s.timeframe) : '';
  return (parts.join(' AND ') || 'always') + timeframe;
}

/**
 * "RSI(14) reaches 70, OR price falls below the 200-bar moving average"
 *
 * Exits are ANY-of in the engine, so whichever fires first ends the trade — the
 * OR here is not a simplification.
 */
export function exitRule(s: StrategyParams): string {
  const parts = conditionsOf(s).map(describeExit).filter(Boolean);
  const timeframe = s.type === 'COMPOUND' ? tf(s.timeframe) : '';
  if (parts.length === 0) return 'no exit condition — position would be held indefinitely';
  return parts.join(', OR ') + timeframe;
}
