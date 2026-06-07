import { calculateRSI, calculateSMA, calculateMACD, calculateBollingerBands, calculateStochastic, calculateATR, calculateEMA, calculateVWAP, calculateOBV, calculateADX, calculateCCI, calculatePSAR, calculateIchimoku } from './indicators';

export type TradeResult = {
  entryDate: Date;
  entryPrice: number;
  exitDate: Date;
  exitPrice: number;
  returnPct: number;
  holdingPeriodDays: number;
};

export type DynamicBacktestResult = {
  totalTrades: number;
  profitableTrades: number;
  winRate: number;
  averageReturn: number;
  totalReturn: number;
  trades: TradeResult[];
  currentSignal: 'NEW_BUY' | 'NEW_SELL' | 'HOLDING' | 'WAITING';
  lastSignalDate: Date | null;
};

export type RsiParams = { type: 'RSI'; period: number; oversold: number; overbought: number; };
export type SmaParams = { type: 'SMA'; fastPeriod: number; slowPeriod: number; };
export type EmaParams = { type: 'EMA'; fastPeriod: number; slowPeriod: number; };
export type MacdParams = { type: 'MACD'; fastPeriod: number; slowPeriod: number; signalPeriod: number; };
export type BbParams = { type: 'BB'; period: number; multiplier: number; };
export type StochParams = { type: 'STOCH'; period: number; smoothK: number; smoothD: number; oversold: number; overbought: number; };
export type AtrParams = { type: 'ATR'; period: number; multiplier: number; }; // Used as trailing stop or breakout
export type VwapParams = { type: 'VWAP'; period: number; }; // Buy when price > VWAP
export type ObvParams = { type: 'OBV'; period: number; }; // Buy when OBV > OBV_SMA
export type AdxParams = { type: 'ADX'; period: number; strongThreshold: number; }; // Buy when ADX > strongThreshold AND +DI > -DI
export type CciParams = { type: 'CCI'; period: number; oversold: number; overbought: number; };
export type PsarParams = { type: 'PSAR'; step: number; maxStep: number; };
export type IchimokuParams = { type: 'ICHIMOKU'; tenkan: number; kijun: number; senkouB: number; }; // Buy when Price > Cloud

export type SingleStrategyParams = RsiParams | SmaParams | EmaParams | MacdParams | BbParams | StochParams | AtrParams | VwapParams | ObvParams | AdxParams | CciParams | PsarParams | IchimokuParams;

export type CompoundStrategyParams = {
  type: 'COMPOUND';
  name?: string; // Optional name for pre-loaded classical strategies
  conditions: SingleStrategyParams[];
};

export type StrategyParams = SingleStrategyParams | CompoundStrategyParams;

export function runDynamicBacktest(
  strategy: StrategyParams,
  closes: number[],
  highs: number[],
  lows: number[],
  volumes: number[],
  dates: Date[]
): DynamicBacktestResult {
  let inTrade = false;
  let entryPrice = 0;
  let entryDate: Date | null = null;
  let entryIndex = 0;
  let highestSinceEntry = 0; // For ATR trailing stop
  
  let currentSignal: 'NEW_BUY' | 'NEW_SELL' | 'HOLDING' | 'WAITING' = 'WAITING';
  let lastSignalDate: Date | null = null;

  const trades: TradeResult[] = [];

  const conditions: SingleStrategyParams[] = strategy.type === 'COMPOUND' ? strategy.conditions : [strategy as SingleStrategyParams];

  const indicatorsData: any = {};

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
        indicatorsData[smaKey] = calculateSMA(indicatorsData[key], cond.period);
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
    }
  }

  // Helper to evaluate buy condition for a specific index
  const evaluateBuy = (cond: SingleStrategyParams, i: number, isCompound: boolean) => {
    const price = closes[i];
    const prevPrice = closes[i - 1];

    if (cond.type === 'RSI') {
      const rsi = indicatorsData[`RSI_${cond.period}`];
      return isCompound ? (rsi[i] <= cond.oversold) : (rsi[i] < cond.oversold && rsi[i - 1] >= cond.oversold);
    } else if (cond.type === 'SMA') {
      const fast = indicatorsData[`SMA_${cond.fastPeriod}`];
      const slow = indicatorsData[`SMA_${cond.slowPeriod}`];
      return isCompound ? (fast[i] > slow[i]) : (fast[i] > slow[i] && fast[i - 1] <= slow[i - 1]);
    } else if (cond.type === 'EMA') {
      const fast = indicatorsData[`EMA_${cond.fastPeriod}`];
      const slow = indicatorsData[`EMA_${cond.slowPeriod}`];
      return isCompound ? (fast[i] > slow[i]) : (fast[i] > slow[i] && fast[i - 1] <= slow[i - 1]);
    } else if (cond.type === 'MACD') {
      const m = indicatorsData[`MACD_${cond.fastPeriod}_${cond.slowPeriod}_${cond.signalPeriod}`];
      return isCompound ? (m.macdLine[i] > m.signalLine[i]) : (m.macdLine[i] > m.signalLine[i] && m.macdLine[i - 1] <= m.signalLine[i - 1]);
    } else if (cond.type === 'BB') {
      const b = indicatorsData[`BB_${cond.period}_${cond.multiplier}`];
      return isCompound ? (price > b.upper[i]) : (price > b.upper[i] && prevPrice <= b.upper[i - 1]);
    } else if (cond.type === 'STOCH') {
      const s = indicatorsData[`STOCH_${cond.period}_${cond.smoothK}_${cond.smoothD}`];
      return isCompound ? (s.kLine[i] <= cond.oversold) : (s.kLine[i] > s.dLine[i] && s.kLine[i - 1] <= s.dLine[i - 1] && s.kLine[i] <= cond.oversold);
    } else if (cond.type === 'ATR') {
      return true; // ATR is usually purely for trailing stops
    } else if (cond.type === 'VWAP') {
      const vwap = indicatorsData[`VWAP_${cond.period}`];
      return isCompound ? (price > vwap[i]) : (price > vwap[i] && prevPrice <= vwap[i - 1]);
    } else if (cond.type === 'OBV') {
      const obv = indicatorsData[`OBV_MAIN`];
      const sma = indicatorsData[`OBV_SMA_${cond.period}`];
      return isCompound ? (obv[i] > sma[i]) : (obv[i] > sma[i] && obv[i - 1] <= sma[i - 1]);
    } else if (cond.type === 'ADX') {
      const adxData = indicatorsData[`ADX_${cond.period}`];
      const isStrong = adxData.adx[i] > cond.strongThreshold && adxData.plusDI[i] > adxData.minusDI[i];
      const wasStrong = adxData.adx[i - 1] > cond.strongThreshold && adxData.plusDI[i - 1] > adxData.minusDI[i - 1];
      return isCompound ? isStrong : (isStrong && !wasStrong);
    } else if (cond.type === 'CCI') {
      const cci = indicatorsData[`CCI_${cond.period}`];
      return isCompound ? (cci[i] <= cond.oversold) : (cci[i] > cond.oversold && cci[i - 1] <= cond.oversold);
    } else if (cond.type === 'PSAR') {
      const psar = indicatorsData[`PSAR_${cond.step}_${cond.maxStep}`];
      return isCompound ? (price > psar[i]) : (price > psar[i] && prevPrice <= psar[i - 1]);
    } else if (cond.type === 'ICHIMOKU') {
      const ichi = indicatorsData[`ICHIMOKU_${cond.tenkan}_${cond.kijun}_${cond.senkouB}`];
      // Price above both Senkou A and B (above the cloud)
      const isAboveCloud = price > ichi.senkouA[i] && price > ichi.senkouB[i];
      const wasAboveCloud = prevPrice > ichi.senkouA[i - 1] && prevPrice > ichi.senkouB[i - 1];
      return isCompound ? isAboveCloud : (isAboveCloud && !wasAboveCloud);
    }
    return false;
  };

  // Helper to evaluate sell condition for a specific index
  const evaluateSell = (cond: SingleStrategyParams, i: number, isCompound: boolean) => {
    const price = closes[i];
    const prevPrice = closes[i - 1];

    if (cond.type === 'RSI') {
      const rsi = indicatorsData[`RSI_${cond.period}`];
      return isCompound ? (rsi[i] >= cond.overbought) : (rsi[i] < cond.overbought && rsi[i - 1] >= cond.overbought);
    } else if (cond.type === 'SMA') {
      const fast = indicatorsData[`SMA_${cond.fastPeriod}`];
      const slow = indicatorsData[`SMA_${cond.slowPeriod}`];
      return isCompound ? (fast[i] < slow[i]) : (fast[i] < slow[i] && fast[i - 1] >= slow[i - 1]);
    } else if (cond.type === 'EMA') {
      const fast = indicatorsData[`EMA_${cond.fastPeriod}`];
      const slow = indicatorsData[`EMA_${cond.slowPeriod}`];
      return isCompound ? (fast[i] < slow[i]) : (fast[i] < slow[i] && fast[i - 1] >= slow[i - 1]);
    } else if (cond.type === 'MACD') {
      const m = indicatorsData[`MACD_${cond.fastPeriod}_${cond.slowPeriod}_${cond.signalPeriod}`];
      return isCompound ? (m.macdLine[i] < m.signalLine[i]) : (m.macdLine[i] < m.signalLine[i] && m.macdLine[i - 1] >= m.signalLine[i - 1]);
    } else if (cond.type === 'BB') {
      const b = indicatorsData[`BB_${cond.period}_${cond.multiplier}`];
      return isCompound ? (price < b.middle[i]) : (price < b.middle[i] && prevPrice >= b.middle[i - 1]);
    } else if (cond.type === 'STOCH') {
      const s = indicatorsData[`STOCH_${cond.period}_${cond.smoothK}_${cond.smoothD}`];
      return isCompound ? (s.kLine[i] >= cond.overbought) : (s.kLine[i] < s.dLine[i] && s.kLine[i - 1] >= s.dLine[i - 1] && s.kLine[i] >= cond.overbought);
    } else if (cond.type === 'ATR') {
      const atr = indicatorsData[`ATR_${cond.period}`];
      const stopLossPrice = highestSinceEntry - (atr[i] * cond.multiplier);
      return (price < stopLossPrice);
    } else if (cond.type === 'VWAP') {
      const vwap = indicatorsData[`VWAP_${cond.period}`];
      return isCompound ? (price < vwap[i]) : (price < vwap[i] && prevPrice >= vwap[i - 1]);
    } else if (cond.type === 'OBV') {
      const obv = indicatorsData[`OBV_MAIN`];
      const sma = indicatorsData[`OBV_SMA_${cond.period}`];
      return isCompound ? (obv[i] < sma[i]) : (obv[i] < sma[i] && obv[i - 1] >= sma[i - 1]);
    } else if (cond.type === 'ADX') {
      const adxData = indicatorsData[`ADX_${cond.period}`];
      // Sell when trend breaks (minusDI crosses above plusDI)
      const isWeak = adxData.minusDI[i] > adxData.plusDI[i];
      const wasWeak = adxData.minusDI[i - 1] > adxData.plusDI[i - 1];
      return isCompound ? isWeak : (isWeak && !wasWeak);
    } else if (cond.type === 'CCI') {
      const cci = indicatorsData[`CCI_${cond.period}`];
      return isCompound ? (cci[i] >= cond.overbought) : (cci[i] < cond.overbought && cci[i - 1] >= cond.overbought);
    } else if (cond.type === 'PSAR') {
      const psar = indicatorsData[`PSAR_${cond.step}_${cond.maxStep}`];
      return isCompound ? (price < psar[i]) : (price < psar[i] && prevPrice >= psar[i - 1]);
    } else if (cond.type === 'ICHIMOKU') {
      const ichi = indicatorsData[`ICHIMOKU_${cond.tenkan}_${cond.kijun}_${cond.senkouB}`];
      // Sell when price falls below the cloud
      const isBelowCloud = price < Math.min(ichi.senkouA[i], ichi.senkouB[i]);
      const wasBelowCloud = prevPrice < Math.min(ichi.senkouA[i - 1], ichi.senkouB[i - 1]);
      return isCompound ? isBelowCloud : (isBelowCloud && !wasBelowCloud);
    }
    return false;
  };

  // EXECUTION LOOP
  for (let i = 1; i < closes.length; i++) {
    const price = closes[i];
    const date = dates[i];

    if (!inTrade) {
      let allBuyTrue = true;

      for (const cond of conditions) {
        if (!evaluateBuy(cond, i, strategy.type === 'COMPOUND')) {
          allBuyTrue = false;
          break;
        }
      }

      // Confluence trigger lock (only buy if they weren't ALL true yesterday)
      if (allBuyTrue && strategy.type === 'COMPOUND') {
        let allBuyTrueYesterday = true;
        for (const cond of conditions) {
          if (!evaluateBuy(cond, i - 1, true)) {
            allBuyTrueYesterday = false;
            break;
          }
        }
        if (allBuyTrueYesterday) allBuyTrue = false;
      }

      if (allBuyTrue) {
        inTrade = true;
        entryPrice = price;
        entryDate = date;
        entryIndex = i;
        highestSinceEntry = price;
        if (i === closes.length - 1) {
          currentSignal = 'NEW_BUY';
          lastSignalDate = date;
        }
      } else if (i === closes.length - 1) {
        currentSignal = 'WAITING';
        lastSignalDate = date;
      }
    } 
    else {
      let anySellTrue = false;
      
      if (price > highestSinceEntry) {
        highestSinceEntry = price;
      }

      for (const cond of conditions) {
        if (evaluateSell(cond, i, strategy.type === 'COMPOUND')) {
          anySellTrue = true;
          break;
        }
      }

      if (anySellTrue && entryDate) {
        inTrade = false;
        const returnPct = ((price - entryPrice) / entryPrice) * 100;
        const holdingPeriodDays = i - entryIndex;
        
        trades.push({
          entryDate,
          entryPrice,
          exitDate: date,
          exitPrice: price,
          returnPct,
          holdingPeriodDays
        });
        
        if (i === closes.length - 1) {
          currentSignal = 'NEW_SELL';
          lastSignalDate = date;
        }
      } else if (i === closes.length - 1) {
        currentSignal = 'HOLDING';
        lastSignalDate = date;
      }
    }
  }

  if (trades.length === 0) {
    return { totalTrades: 0, profitableTrades: 0, winRate: 0, averageReturn: 0, totalReturn: 0, trades: [], currentSignal, lastSignalDate };
  }

  const profitableTrades = trades.filter(t => t.returnPct > 0).length;
  const winRate = (profitableTrades / trades.length) * 100;
  const averageReturn = trades.reduce((acc, t) => acc + t.returnPct, 0) / trades.length;
  const totalReturn = trades.reduce((acc, t) => acc + t.returnPct, 0);

  return {
    totalTrades: trades.length,
    profitableTrades,
    winRate,
    averageReturn,
    totalReturn,
    trades,
    currentSignal,
    lastSignalDate
  };
}
