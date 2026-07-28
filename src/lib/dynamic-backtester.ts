import {
  calculateRSI, calculateSMA, calculateMACD, calculateBollingerBands, calculateStochastic,
  calculateATR, calculateEMA, calculateVWAP, calculateOBV, calculateADX, calculateCCI,
  calculatePSAR, calculateIchimoku,
  calculateSupertrend, calculateDonchian, calculateKeltner, calculateWilliamsR, calculateMFI,
  calculateROC, calculateAroon, calculateCMF, calculateCoppock, calculateRibbon,
  rollingHigh, rollingLow, drawdownFromHigh, slopePct, relativeVolume,
} from './indicators';
import { resample, type Timeframe } from './timeframe';

export type TradeResult = {
  entryDate: Date;
  entryPrice: number;
  exitDate: Date;
  exitPrice: number;
  /** Return before costs, %. */
  grossReturnPct: number;
  /** Return after round-trip costs, %. This is the number every metric uses. */
  returnPct: number;
  holdingPeriodDays: number;
  maxDrawdownPct: number;
};

export type DynamicBacktestResult = {
  totalTrades: number;
  profitableTrades: number;
  /** Share of trades with a positive NET return, %. */
  winRate: number;
  /** Arithmetic mean net return per trade, %. */
  averageReturn: number;
  /** COMPOUNDED net return across all trades, %. Not a sum. */
  totalReturn: number;
  /** Worst single-trade intra-trade drawdown, %. */
  maxDrawdown: number;
  /** Worst peak-to-trough drawdown of the compounded equity curve, %. */
  equityMaxDrawdown: number;
  trades: TradeResult[];
  currentSignal: 'NEW_BUY' | 'NEW_SELL' | 'HOLDING' | 'WAITING';
  lastSignalDate: Date | null;
};

export type RsiParams = { type: 'RSI'; period: number; oversold: number; overbought: number; };
export type SmaParams = { type: 'SMA'; fastPeriod: number; slowPeriod: number; };
export type EmaParams = { type: 'EMA'; fastPeriod: number; slowPeriod: number; };
export type MacdParams = { type: 'MACD'; fastPeriod: number; slowPeriod: number; signalPeriod: number; };
/**
 * `mode` picks which Bollinger setup this is:
 *  - 'breakout'  (default) buy a close above the upper band, exit back at the mid
 *  - 'reversion' buy a close below the lower band, exit back at the mid
 * Both are legitimate and they are opposite trades, so the strategy has to say
 * which one it means rather than leaving two engines to disagree about it.
 */
export type BbParams = { type: 'BB'; period: number; multiplier: number; mode?: 'breakout' | 'reversion'; };
export type StochParams = { type: 'STOCH'; period: number; smoothK: number; smoothD: number; oversold: number; overbought: number; };
export type AtrParams = { type: 'ATR'; period: number; multiplier: number; }; // Used as trailing stop or breakout
export type VwapParams = { type: 'VWAP'; period: number; }; // Buy when price > VWAP
export type ObvParams = { type: 'OBV'; period: number; }; // Buy when OBV > OBV_SMA
export type AdxParams = { type: 'ADX'; period: number; strongThreshold: number; }; // Buy when ADX > strongThreshold AND +DI > -DI
export type CciParams = { type: 'CCI'; period: number; oversold: number; overbought: number; };
export type PsarParams = { type: 'PSAR'; step: number; maxStep: number; };
export type IchimokuParams = { type: 'ICHIMOKU'; tenkan: number; kijun: number; senkouB: number; }; // Buy when Price > Cloud

// ── Positional / long-term conditions ────────────────────────────────────────
// The block above is short-horizon oscillators. These are what long-term
// investors actually use: trend regime, breakout levels, distance from highs,
// and accumulation.

export type SupertrendParams = { type: 'SUPERTREND'; period: number; multiplier: number };
/** Turtle-style breakout: buy the N-bar high, exit the N-bar low. */
export type DonchianParams = { type: 'DONCHIAN'; period: number; exitPeriod?: number };
export type KeltnerParams = { type: 'KELTNER'; period: number; multiplier: number };
export type WilliamsRParams = { type: 'WILLIAMSR'; period: number; oversold: number; overbought: number };
export type MfiParams = { type: 'MFI'; period: number; oversold: number; overbought: number };
/** Absolute momentum: is the stock up more than `threshold` % over `period` bars. */
export type RocParams = { type: 'ROC'; period: number; threshold: number };
export type AroonParams = { type: 'AROON'; period: number; threshold: number };
export type CmfParams = { type: 'CMF'; period: number; threshold: number };
/** Coppock: long-term bottom finder. Buy as it turns up from below zero. */
export type CoppockParams = { type: 'COPPOCK'; roc1: number; roc2: number; wma: number };
/** MA ribbon stacked in order — Minervini's trend template as one boolean. */
export type RibbonParams = { type: 'RIBBON'; periods: number[] };
/** Price above a moving average that is itself rising. The core regime filter. */
export type MaRegimeParams = { type: 'MA_REGIME'; period: number; requireRising?: boolean; slopeLookback?: number };
/** Within `withinPct` of the trailing high — momentum, "winners keep winning". */
export type High52wParams = { type: 'HIGH_52W'; lookback: number; withinPct: number };
/** At least `minDrawdownPct` below the all-time high — "quality at a discount". */
export type DrawdownParams = { type: 'DRAWDOWN'; minDrawdownPct: number };
/** Volume at `multiple` x its own average — confirmation for breakouts. */
export type VolumeParams = { type: 'VOLUME'; period: number; multiple: number };

export type SingleStrategyParams =
  | RsiParams | SmaParams | EmaParams | MacdParams | BbParams | StochParams | AtrParams
  | VwapParams | ObvParams | AdxParams | CciParams | PsarParams | IchimokuParams
  | SupertrendParams | DonchianParams | KeltnerParams | WilliamsRParams | MfiParams
  | RocParams | AroonParams | CmfParams | CoppockParams | RibbonParams | MaRegimeParams
  | High52wParams | DrawdownParams | VolumeParams;

export type CompoundStrategyParams = {
  type: 'COMPOUND';
  name?: string; // Optional name for pre-loaded classical strategies
  conditions: SingleStrategyParams[];
  /**
   * Candle the strategy is evaluated on. Daily bars are aggregated before any
   * indicator runs, so RSI(14) weekly is a genuinely different signal from
   * RSI(14) daily rather than the same one smoothed.
   */
  timeframe?: Timeframe;
  /** Where the idea comes from — shown in the UI so a call is attributable. */
  source?: string;
};

export type StrategyParams = SingleStrategyParams | CompoundStrategyParams;

/**
 * One-way transaction cost as a fraction of trade value, charged on entry AND exit.
 *
 * 15 bps one way (~30 bps round trip) approximates Indian delivery equity with a
 * discount broker: STT 0.1% on each leg, plus exchange transaction charges, SEBI
 * turnover fee, stamp duty on the buy, GST, and brokerage.
 *
 * This is an estimate, and it is the single input most likely to be wrong for
 * you — it lands hardest on exactly the high-frequency, small-edge strategies
 * the optimizer prefers. Override with BACKTEST_ONE_WAY_COST_PCT (a fraction,
 * so 0.0025 = 25 bps per leg) rather than editing this file.
 *
 * Capital gains tax is NOT modelled — it depends on your holding period and slab.
 */
function resolveDefaultCost(): number {
  const raw = process.env.BACKTEST_ONE_WAY_COST_PCT;
  if (raw === undefined || raw.trim() === '') return 0.0015;
  const parsed = Number(raw);
  // A typo here silently changes every reported return, so reject rather than
  // fall through to NaN (which would make every net return NaN).
  if (!Number.isFinite(parsed) || parsed < 0 || parsed >= 1) {
    console.warn(
      `BACKTEST_ONE_WAY_COST_PCT="${raw}" is not a fraction in [0, 1); using the 0.0015 default.`
    );
    return 0.0015;
  }
  return parsed;
}

export const DEFAULT_ONE_WAY_COST_PCT = resolveDefaultCost();

type IndicatorCache = Record<string, number[] | Record<string, number[]>>;

/** Numeric series lookup — indicators that return a single array. */
function series(cache: IndicatorCache, key: string): number[] {
  return cache[key] as number[];
}

/** Multi-line lookup — MACD, Bollinger, Stochastic, ADX, Ichimoku. */
function lines(cache: IndicatorCache, key: string): Record<string, number[]> {
  return cache[key] as Record<string, number[]>;
}

export function runDynamicBacktest(
  strategy: StrategyParams,
  closesIn: number[],
  highsIn: number[],
  lowsIn: number[],
  volumesIn: number[],
  datesIn: Date[],
  /** Next-bar open prices used for fills. Falls back to close when absent. */
  opensIn?: number[],
  oneWayCostPct: number = DEFAULT_ONE_WAY_COST_PCT
): DynamicBacktestResult {
  // Aggregate to the strategy's timeframe BEFORE any indicator runs, so a weekly
  // RSI is computed on weekly candles rather than being a smoothed daily one.
  // Bar dates stay real trading days, so trade dates remain meaningful.
  const tf: Timeframe = (strategy.type === 'COMPOUND' && strategy.timeframe) || 'daily';
  const bars =
    tf === 'daily'
      ? { closes: closesIn, highs: highsIn, lows: lowsIn, opens: opensIn ?? closesIn, volumes: volumesIn, dates: datesIn }
      : resample(
          { closes: closesIn, highs: highsIn, lows: lowsIn, opens: opensIn ?? closesIn, volumes: volumesIn, dates: datesIn },
          tf
        );

  const closes = bars.closes;
  const highs = bars.highs;
  const lows = bars.lows;
  const volumes = bars.volumes;
  const dates = bars.dates;
  const opens = bars.opens;

  let inTrade = false;
  let entryPrice = 0;
  let entryDate: Date | null = null;
  let entryIndex = 0;
  let highestSinceEntry = 0; // For ATR trailing stop
  let lowestSinceEntry = 0; // For calculating maximum drawdown

  let currentSignal: 'NEW_BUY' | 'NEW_SELL' | 'HOLDING' | 'WAITING' = 'WAITING';
  let lastSignalDate: Date | null = null;

  const trades: TradeResult[] = [];

  // Every strategy is evaluated as a confluence of conditions. A bare single
  // strategy is normalised into a one-condition compound so there is exactly one
  // evaluation path — previously the non-compound branch existed but was dead
  // (everything in MASTER_STRATEGY_LIBRARY is COMPOUND) and had drifted out of
  // sync with the live path.
  const conditions: SingleStrategyParams[] =
    strategy.type === 'COMPOUND' ? strategy.conditions : [strategy as SingleStrategyParams];

  const indicatorsData: IndicatorCache = {};

  // PRE-COMPUTE INDICATORS
  for (const cond of conditions) {
    if (cond.type === 'RSI') {
      const key = `RSI_${cond.period}`;
      if (!indicatorsData[key]) indicatorsData[key] = calculateRSI(closes, cond.period);
    } else if (cond.type === 'SMA') {
      const fastKey = `SMA_${cond.fastPeriod}`;
      const slowKey = `SMA_${cond.slowPeriod}`;
      if (!indicatorsData[fastKey]) indicatorsData[fastKey] = calculateSMA(closes, cond.fastPeriod);
      if (!indicatorsData[slowKey]) indicatorsData[slowKey] = calculateSMA(closes, cond.slowPeriod);
    } else if (cond.type === 'EMA') {
      const fastKey = `EMA_${cond.fastPeriod}`;
      const slowKey = `EMA_${cond.slowPeriod}`;
      if (!indicatorsData[fastKey]) indicatorsData[fastKey] = calculateEMA(closes, cond.fastPeriod);
      if (!indicatorsData[slowKey]) indicatorsData[slowKey] = calculateEMA(closes, cond.slowPeriod);
    } else if (cond.type === 'MACD') {
      const key = `MACD_${cond.fastPeriod}_${cond.slowPeriod}_${cond.signalPeriod}`;
      if (!indicatorsData[key]) indicatorsData[key] = calculateMACD(closes, cond.fastPeriod, cond.slowPeriod, cond.signalPeriod);
    } else if (cond.type === 'BB') {
      const key = `BB_${cond.period}_${cond.multiplier}`;
      if (!indicatorsData[key]) indicatorsData[key] = calculateBollingerBands(closes, cond.period, cond.multiplier);
    } else if (cond.type === 'STOCH') {
      const key = `STOCH_${cond.period}_${cond.smoothK}_${cond.smoothD}`;
      if (!indicatorsData[key]) indicatorsData[key] = calculateStochastic(highs, lows, closes, cond.period, cond.smoothK, cond.smoothD);
    } else if (cond.type === 'ATR') {
      const key = `ATR_${cond.period}`;
      if (!indicatorsData[key]) indicatorsData[key] = calculateATR(highs, lows, closes, cond.period);
    } else if (cond.type === 'VWAP') {
      const key = `VWAP_${cond.period}`;
      if (!indicatorsData[key]) indicatorsData[key] = calculateVWAP(closes, highs, lows, volumes, cond.period);
    } else if (cond.type === 'OBV') {
      const key = `OBV_MAIN`;
      const smaKey = `OBV_SMA_${cond.period}`;
      if (!indicatorsData[key]) {
        indicatorsData[key] = calculateOBV(closes, volumes);
        indicatorsData[smaKey] = calculateSMA(series(indicatorsData, key), cond.period);
      }
    } else if (cond.type === 'ADX') {
      const key = `ADX_${cond.period}`;
      if (!indicatorsData[key]) indicatorsData[key] = calculateADX(highs, lows, closes, cond.period);
    } else if (cond.type === 'CCI') {
      const key = `CCI_${cond.period}`;
      if (!indicatorsData[key]) indicatorsData[key] = calculateCCI(highs, lows, closes, cond.period);
    } else if (cond.type === 'PSAR') {
      const key = `PSAR_${cond.step}_${cond.maxStep}`;
      if (!indicatorsData[key]) indicatorsData[key] = calculatePSAR(highs, lows, cond.step, cond.maxStep);
    } else if (cond.type === 'ICHIMOKU') {
      const key = `ICHIMOKU_${cond.tenkan}_${cond.kijun}_${cond.senkouB}`;
      if (!indicatorsData[key]) indicatorsData[key] = calculateIchimoku(highs, lows, closes, cond.tenkan, cond.kijun, cond.senkouB);
    } else if (cond.type === 'SUPERTREND') {
      const key = `ST_${cond.period}_${cond.multiplier}`;
      if (!indicatorsData[key]) indicatorsData[key] = calculateSupertrend(highs, lows, closes, cond.period, cond.multiplier);
    } else if (cond.type === 'DONCHIAN') {
      const key = `DON_${cond.period}`;
      if (!indicatorsData[key]) indicatorsData[key] = calculateDonchian(highs, lows, cond.period);
      const ex = cond.exitPeriod ?? cond.period;
      const exKey = `DON_${ex}`;
      if (!indicatorsData[exKey]) indicatorsData[exKey] = calculateDonchian(highs, lows, ex);
    } else if (cond.type === 'KELTNER') {
      const key = `KC_${cond.period}_${cond.multiplier}`;
      if (!indicatorsData[key]) indicatorsData[key] = calculateKeltner(highs, lows, closes, cond.period, cond.multiplier);
    } else if (cond.type === 'WILLIAMSR') {
      const key = `WR_${cond.period}`;
      if (!indicatorsData[key]) indicatorsData[key] = calculateWilliamsR(highs, lows, closes, cond.period);
    } else if (cond.type === 'MFI') {
      const key = `MFI_${cond.period}`;
      if (!indicatorsData[key]) indicatorsData[key] = calculateMFI(highs, lows, closes, volumes, cond.period);
    } else if (cond.type === 'ROC') {
      const key = `ROC_${cond.period}`;
      if (!indicatorsData[key]) indicatorsData[key] = calculateROC(closes, cond.period);
    } else if (cond.type === 'AROON') {
      const key = `AROON_${cond.period}`;
      if (!indicatorsData[key]) indicatorsData[key] = calculateAroon(highs, lows, cond.period);
    } else if (cond.type === 'CMF') {
      const key = `CMF_${cond.period}`;
      if (!indicatorsData[key]) indicatorsData[key] = calculateCMF(highs, lows, closes, volumes, cond.period);
    } else if (cond.type === 'COPPOCK') {
      const key = `COP_${cond.roc1}_${cond.roc2}_${cond.wma}`;
      if (!indicatorsData[key]) indicatorsData[key] = calculateCoppock(closes, cond.roc1, cond.roc2, cond.wma);
    } else if (cond.type === 'RIBBON') {
      const key = `RIB_${cond.periods.join('_')}`;
      if (!indicatorsData[key]) indicatorsData[key] = calculateRibbon(closes, cond.periods);
    } else if (cond.type === 'MA_REGIME') {
      const maKey = `SMA_${cond.period}`;
      if (!indicatorsData[maKey]) indicatorsData[maKey] = calculateSMA(closes, cond.period);
      const slKey = `SLOPE_${cond.period}_${cond.slopeLookback ?? 20}`;
      if (!indicatorsData[slKey]) {
        indicatorsData[slKey] = slopePct(series(indicatorsData, maKey), cond.slopeLookback ?? 20);
      }
    } else if (cond.type === 'HIGH_52W') {
      const hKey = `RHIGH_${cond.lookback}`;
      if (!indicatorsData[hKey]) indicatorsData[hKey] = rollingHigh(highs, cond.lookback);
      const lKey = `RLOW_${cond.lookback}`;
      if (!indicatorsData[lKey]) indicatorsData[lKey] = rollingLow(lows, cond.lookback);
    } else if (cond.type === 'DRAWDOWN') {
      const key = `DD`;
      if (!indicatorsData[key]) indicatorsData[key] = drawdownFromHigh(closes, highs);
    } else if (cond.type === 'VOLUME') {
      const key = `RVOL_${cond.period}`;
      if (!indicatorsData[key]) indicatorsData[key] = relativeVolume(volumes, cond.period);
    }
  }

  /** Is this condition's entry state satisfied at bar i? (level, not crossing) */
  const evaluateBuy = (cond: SingleStrategyParams, i: number): boolean => {
    const price = closes[i];

    if (cond.type === 'RSI') {
      return series(indicatorsData, `RSI_${cond.period}`)[i] <= cond.oversold;
    } else if (cond.type === 'SMA') {
      return series(indicatorsData, `SMA_${cond.fastPeriod}`)[i] > series(indicatorsData, `SMA_${cond.slowPeriod}`)[i];
    } else if (cond.type === 'EMA') {
      return series(indicatorsData, `EMA_${cond.fastPeriod}`)[i] > series(indicatorsData, `EMA_${cond.slowPeriod}`)[i];
    } else if (cond.type === 'MACD') {
      const m = lines(indicatorsData, `MACD_${cond.fastPeriod}_${cond.slowPeriod}_${cond.signalPeriod}`);
      return m.macdLine[i] > m.signalLine[i];
    } else if (cond.type === 'BB') {
      const b = lines(indicatorsData, `BB_${cond.period}_${cond.multiplier}`);
      return cond.mode === 'reversion' ? price < b.lower[i] : price > b.upper[i];
    } else if (cond.type === 'STOCH') {
      return lines(indicatorsData, `STOCH_${cond.period}_${cond.smoothK}_${cond.smoothD}`).kLine[i] <= cond.oversold;
    } else if (cond.type === 'ATR') {
      return true; // ATR is purely a trailing-stop exit; never gates entry
    } else if (cond.type === 'VWAP') {
      return price > series(indicatorsData, `VWAP_${cond.period}`)[i];
    } else if (cond.type === 'OBV') {
      return series(indicatorsData, `OBV_MAIN`)[i] > series(indicatorsData, `OBV_SMA_${cond.period}`)[i];
    } else if (cond.type === 'ADX') {
      const a = lines(indicatorsData, `ADX_${cond.period}`);
      return a.adx[i] > cond.strongThreshold && a.plusDI[i] > a.minusDI[i];
    } else if (cond.type === 'CCI') {
      return series(indicatorsData, `CCI_${cond.period}`)[i] <= cond.oversold;
    } else if (cond.type === 'PSAR') {
      return price > series(indicatorsData, `PSAR_${cond.step}_${cond.maxStep}`)[i];
    } else if (cond.type === 'ICHIMOKU') {
      const ichi = lines(indicatorsData, `ICHIMOKU_${cond.tenkan}_${cond.kijun}_${cond.senkouB}`);
      return price > ichi.senkouA[i] && price > ichi.senkouB[i];
    } else if (cond.type === 'SUPERTREND') {
      return lines(indicatorsData, `ST_${cond.period}_${cond.multiplier}`).direction[i] === 1;
    } else if (cond.type === 'DONCHIAN') {
      // Breakout of the prior N-bar high — compare to i-1 so the bar making the
      // high does not count as breaking out of itself.
      const d = lines(indicatorsData, `DON_${cond.period}`);
      return Number.isFinite(d.upper[i - 1]) && price >= d.upper[i - 1];
    } else if (cond.type === 'KELTNER') {
      return price > lines(indicatorsData, `KC_${cond.period}_${cond.multiplier}`).upper[i];
    } else if (cond.type === 'WILLIAMSR') {
      return series(indicatorsData, `WR_${cond.period}`)[i] <= cond.oversold;
    } else if (cond.type === 'MFI') {
      return series(indicatorsData, `MFI_${cond.period}`)[i] <= cond.oversold;
    } else if (cond.type === 'ROC') {
      return series(indicatorsData, `ROC_${cond.period}`)[i] > cond.threshold;
    } else if (cond.type === 'AROON') {
      const a = lines(indicatorsData, `AROON_${cond.period}`);
      return a.up[i] > cond.threshold && a.up[i] > a.down[i];
    } else if (cond.type === 'CMF') {
      return series(indicatorsData, `CMF_${cond.period}`)[i] > cond.threshold;
    } else if (cond.type === 'COPPOCK') {
      // Turning up from below zero is the actual Coppock buy signal.
      const c = series(indicatorsData, `COP_${cond.roc1}_${cond.roc2}_${cond.wma}`);
      return Number.isFinite(c[i]) && Number.isFinite(c[i - 1]) && c[i] < 0 && c[i] > c[i - 1];
    } else if (cond.type === 'RIBBON') {
      return series(indicatorsData, `RIB_${cond.periods.join('_')}`)[i] === 1;
    } else if (cond.type === 'MA_REGIME') {
      const ma = series(indicatorsData, `SMA_${cond.period}`)[i];
      if (!Number.isFinite(ma) || price <= ma) return false;
      if (cond.requireRising === false) return true;
      return series(indicatorsData, `SLOPE_${cond.period}_${cond.slopeLookback ?? 20}`)[i] > 0;
    } else if (cond.type === 'HIGH_52W') {
      const hi = series(indicatorsData, `RHIGH_${cond.lookback}`)[i];
      if (!Number.isFinite(hi) || hi <= 0) return false;
      return ((hi - price) / hi) * 100 <= cond.withinPct;
    } else if (cond.type === 'DRAWDOWN') {
      // Negative scale: -30 is 30% off the high, so "at least 30% off" is <= -30.
      return series(indicatorsData, 'DD')[i] <= -Math.abs(cond.minDrawdownPct);
    } else if (cond.type === 'VOLUME') {
      return series(indicatorsData, `RVOL_${cond.period}`)[i] >= cond.multiple;
    }
    return false;
  };

  /** Is this condition's exit state satisfied at bar i? */
  const evaluateSell = (cond: SingleStrategyParams, i: number): boolean => {
    const price = closes[i];

    if (cond.type === 'RSI') {
      return series(indicatorsData, `RSI_${cond.period}`)[i] >= cond.overbought;
    } else if (cond.type === 'SMA') {
      return series(indicatorsData, `SMA_${cond.fastPeriod}`)[i] < series(indicatorsData, `SMA_${cond.slowPeriod}`)[i];
    } else if (cond.type === 'EMA') {
      return series(indicatorsData, `EMA_${cond.fastPeriod}`)[i] < series(indicatorsData, `EMA_${cond.slowPeriod}`)[i];
    } else if (cond.type === 'MACD') {
      const m = lines(indicatorsData, `MACD_${cond.fastPeriod}_${cond.slowPeriod}_${cond.signalPeriod}`);
      return m.macdLine[i] < m.signalLine[i];
    } else if (cond.type === 'BB') {
      const b = lines(indicatorsData, `BB_${cond.period}_${cond.multiplier}`);
      // Both modes take profit back at the mean, from their respective sides.
      return cond.mode === 'reversion' ? price > b.middle[i] : price < b.middle[i];
    } else if (cond.type === 'STOCH') {
      return lines(indicatorsData, `STOCH_${cond.period}_${cond.smoothK}_${cond.smoothD}`).kLine[i] >= cond.overbought;
    } else if (cond.type === 'ATR') {
      const atr = series(indicatorsData, `ATR_${cond.period}`)[i];
      if (!Number.isFinite(atr)) return false;
      return price < highestSinceEntry - atr * cond.multiplier;
    } else if (cond.type === 'VWAP') {
      return price < series(indicatorsData, `VWAP_${cond.period}`)[i];
    } else if (cond.type === 'OBV') {
      return series(indicatorsData, `OBV_MAIN`)[i] < series(indicatorsData, `OBV_SMA_${cond.period}`)[i];
    } else if (cond.type === 'ADX') {
      const a = lines(indicatorsData, `ADX_${cond.period}`);
      return a.minusDI[i] > a.plusDI[i];
    } else if (cond.type === 'CCI') {
      return series(indicatorsData, `CCI_${cond.period}`)[i] >= cond.overbought;
    } else if (cond.type === 'PSAR') {
      return price < series(indicatorsData, `PSAR_${cond.step}_${cond.maxStep}`)[i];
    } else if (cond.type === 'ICHIMOKU') {
      const ichi = lines(indicatorsData, `ICHIMOKU_${cond.tenkan}_${cond.kijun}_${cond.senkouB}`);
      return price < Math.min(ichi.senkouA[i], ichi.senkouB[i]);
    } else if (cond.type === 'SUPERTREND') {
      return lines(indicatorsData, `ST_${cond.period}_${cond.multiplier}`).direction[i] === -1;
    } else if (cond.type === 'DONCHIAN') {
      // Turtles exit on a shorter channel than they enter on (55 in, 20 out).
      const ex = cond.exitPeriod ?? cond.period;
      const d = lines(indicatorsData, `DON_${ex}`);
      return Number.isFinite(d.lower[i - 1]) && price <= d.lower[i - 1];
    } else if (cond.type === 'KELTNER') {
      return price < lines(indicatorsData, `KC_${cond.period}_${cond.multiplier}`).middle[i];
    } else if (cond.type === 'WILLIAMSR') {
      return series(indicatorsData, `WR_${cond.period}`)[i] >= cond.overbought;
    } else if (cond.type === 'MFI') {
      return series(indicatorsData, `MFI_${cond.period}`)[i] >= cond.overbought;
    } else if (cond.type === 'ROC') {
      // Momentum gone: stop being positive.
      return series(indicatorsData, `ROC_${cond.period}`)[i] < 0;
    } else if (cond.type === 'AROON') {
      const a = lines(indicatorsData, `AROON_${cond.period}`);
      return a.down[i] > a.up[i];
    } else if (cond.type === 'CMF') {
      return series(indicatorsData, `CMF_${cond.period}`)[i] < 0;
    } else if (cond.type === 'COPPOCK') {
      const c = series(indicatorsData, `COP_${cond.roc1}_${cond.roc2}_${cond.wma}`);
      return Number.isFinite(c[i]) && Number.isFinite(c[i - 1]) && c[i] > 0 && c[i] < c[i - 1];
    } else if (cond.type === 'RIBBON') {
      // Exit when the stack simply stops holding, not only when fully inverted —
      // waiting for -1 on a long-term ribbon gives back most of the move.
      return series(indicatorsData, `RIB_${cond.periods.join('_')}`)[i] !== 1;
    } else if (cond.type === 'MA_REGIME') {
      const ma = series(indicatorsData, `SMA_${cond.period}`)[i];
      return Number.isFinite(ma) && price < ma;
    } else if (cond.type === 'HIGH_52W') {
      const hi = series(indicatorsData, `RHIGH_${cond.lookback}`)[i];
      const lo = series(indicatorsData, `RLOW_${cond.lookback}`)[i];
      if (!Number.isFinite(hi) || !Number.isFinite(lo) || hi === lo) return false;
      // Fallen back into the bottom third of the range: momentum thesis is dead.
      return (price - lo) / (hi - lo) < 0.33;
    } else if (cond.type === 'DRAWDOWN') {
      // Recovered to within 5% of the high — the discount thesis has played out.
      return series(indicatorsData, 'DD')[i] >= -5;
    } else if (cond.type === 'VOLUME') {
      return false; // Volume confirms entries; it is never an exit on its own.
    }
    return false;
  };

  const allBuyTrue = (i: number) => conditions.every((c) => evaluateBuy(c, i));

  /**
   * Fill price for a signal observed at the close of bar i-1.
   * You cannot know a bar's close and also trade at it, so fills happen at the
   * NEXT bar's open (falling back to its close when opens are unavailable).
   */
  const fillPrice = (i: number): number => {
    const o = opens?.[i];
    return o != null && Number.isFinite(o) && o > 0 ? o : closes[i];
  };

  const c = oneWayCostPct;

  // EXECUTION LOOP — signal is evaluated on bar i, executed on bar i+1.
  for (let i = 1; i < closes.length; i++) {
    const isLastBar = i === closes.length - 1;

    if (!inTrade) {
      let buyNow = allBuyTrue(i);

      // Confluence trigger lock: fire only on the transition into all-true, so a
      // condition set that stays satisfied for weeks does not re-enter every bar.
      if (buyNow && allBuyTrue(i - 1)) buyNow = false;

      if (buyNow) {
        if (isLastBar) {
          // Signal fired on the final bar — it would be filled tomorrow.
          currentSignal = 'NEW_BUY';
          lastSignalDate = dates[i];
        } else {
          inTrade = true;
          entryIndex = i + 1;
          entryPrice = fillPrice(i + 1);
          entryDate = dates[i + 1];
          highestSinceEntry = entryPrice;
          lowestSinceEntry = entryPrice;
        }
      } else if (isLastBar) {
        currentSignal = 'WAITING';
        lastSignalDate = dates[i];
      }
    } else {
      if (closes[i] > highestSinceEntry) highestSinceEntry = closes[i];
      // lows[i] because the stock can dip intra-day well below its close
      if (lows[i] < lowestSinceEntry) lowestSinceEntry = lows[i];

      const sellNow = conditions.some((cond) => evaluateSell(cond, i));

      if (sellNow && entryDate) {
        if (isLastBar) {
          currentSignal = 'NEW_SELL';
          lastSignalDate = dates[i];
        } else {
          const exitPrice = fillPrice(i + 1);
          const exitDate = dates[i + 1];
          const grossReturnPct = ((exitPrice - entryPrice) / entryPrice) * 100;
          // Pay the cost on both legs: buy above the print, sell below it.
          const netEntry = entryPrice * (1 + c);
          const netExit = exitPrice * (1 - c);
          const returnPct = ((netExit - netEntry) / netEntry) * 100;

          trades.push({
            entryDate,
            entryPrice,
            exitDate,
            exitPrice,
            grossReturnPct,
            returnPct,
            holdingPeriodDays: i + 1 - entryIndex,
            maxDrawdownPct: ((lowestSinceEntry - entryPrice) / entryPrice) * 100,
          });

          inTrade = false;
          entryDate = null;
        }
      } else if (isLastBar) {
        currentSignal = 'HOLDING';
        lastSignalDate = dates[i];
      }
    }
  }

  return summarizeTrades(trades, currentSignal, lastSignalDate);
}

/**
 * Turn a list of closed trades into headline metrics.
 *
 * Metrics use NET returns with no adjustment. The previous code rewrote a winning
 * trade's return to -10 when its intra-trade drawdown passed -10% and excluded it
 * from the win count, which made "win rate" and "average return" incomparable to
 * any external benchmark. Drawdown is now reported as its own metric rather than
 * folded into the return.
 */
export function summarizeTrades(
  trades: TradeResult[],
  currentSignal: DynamicBacktestResult['currentSignal'] = 'WAITING',
  lastSignalDate: Date | null = null
): DynamicBacktestResult {
  if (trades.length === 0) {
    return {
      totalTrades: 0, profitableTrades: 0, winRate: 0, averageReturn: 0,
      totalReturn: 0, maxDrawdown: 0, equityMaxDrawdown: 0,
      trades: [], currentSignal, lastSignalDate,
    };
  }

  const profitableTrades = trades.filter((t) => t.returnPct > 0).length;
  const winRate = (profitableTrades / trades.length) * 100;
  const averageReturn = trades.reduce((acc, t) => acc + t.returnPct, 0) / trades.length;

  // Compounded, not summed: ten +5% trades is +62.9%, not +50%.
  const growth = trades.reduce((acc, t) => acc * (1 + t.returnPct / 100), 1);
  const totalReturn = (growth - 1) * 100;

  // Peak-to-trough of the compounded equity curve — the drawdown an investor
  // actually experiences, as opposed to the worst single trade.
  let equity = 1;
  let peak = 1;
  let equityMaxDrawdown = 0;
  for (const t of trades) {
    equity *= 1 + t.returnPct / 100;
    if (equity > peak) peak = equity;
    const dd = ((equity - peak) / peak) * 100;
    if (dd < equityMaxDrawdown) equityMaxDrawdown = dd;
  }

  return {
    totalTrades: trades.length,
    profitableTrades,
    winRate,
    averageReturn,
    totalReturn,
    maxDrawdown: Math.min(...trades.map((t) => t.maxDrawdownPct)),
    equityMaxDrawdown,
    trades,
    currentSignal,
    lastSignalDate,
  };
}

/** Fraction of history used for strategy selection. The rest is held back. */
export const DEFAULT_TRAIN_FRACTION = 0.7;

export type SplitBacktestResult = {
  /** Selection window. Choose strategies on this. */
  inSample: DynamicBacktestResult;
  /** Held-back window. Judge strategies on this. */
  outOfSample: DynamicBacktestResult;
  /** Whole history. For display only — never select on it. */
  full: DynamicBacktestResult;
  splitDate: Date | null;
};

/**
 * Run a backtest and split the resulting trades into a selection window and a
 * held-back window.
 *
 * Without this, scanning ~46 strategies and keeping whatever cleared a 67% win
 * rate is pure selection-on-outcome: run enough rules against one price series
 * and some will clear any threshold by chance. A strategy that looks strong
 * in-sample and collapses out-of-sample was noise.
 *
 * Trades are partitioned by entry date rather than re-running on a sliced
 * series, so the out-of-sample window keeps full indicator warm-up. Indicators
 * only ever look backwards, so this introduces no look-ahead.
 */
export function runSplitBacktest(
  strategy: StrategyParams,
  closes: number[],
  highs: number[],
  lows: number[],
  volumes: number[],
  dates: Date[],
  opens?: number[],
  oneWayCostPct: number = DEFAULT_ONE_WAY_COST_PCT,
  trainFraction: number = DEFAULT_TRAIN_FRACTION
): SplitBacktestResult {
  const full = runDynamicBacktest(strategy, closes, highs, lows, volumes, dates, opens, oneWayCostPct);

  const splitIdx = Math.floor(dates.length * trainFraction);
  const splitDate = dates[splitIdx] ?? null;

  if (!splitDate) {
    return { inSample: full, outOfSample: summarizeTrades([]), full, splitDate: null };
  }

  const cut = splitDate.getTime();
  const inTrades = full.trades.filter((t) => t.entryDate.getTime() < cut);
  const outTrades = full.trades.filter((t) => t.entryDate.getTime() >= cut);

  return {
    full,
    splitDate,
    inSample: summarizeTrades(inTrades),
    // The live signal belongs to the most recent window.
    outOfSample: summarizeTrades(outTrades, full.currentSignal, full.lastSignalDate),
  };
}
