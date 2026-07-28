export function calculateSMA(data: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
      continue;
    }
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += data[i - j];
    }
    result.push(sum / period);
  }
  return result;
}

/**
 * Recursive smoother that tolerates leading/interior NaN.
 *
 * The previous EMA implementation seeded unconditionally and carried the seed
 * forward, so a single NaN anywhere in the warm-up window poisoned the entire
 * output (this is why ADX was NaN for every bar — its `dx` input is NaN-padded).
 * Here a NaN resets the run; the smoother re-seeds from the next full window of
 * finite values.
 *
 * `alphaFor` picks the weighting: EMA uses 2/(period+1), Wilder's RMA uses
 * 1/period (Wilder(n) is equivalent to EMA(2n-1)).
 */
function recursiveSmooth(data: number[], period: number, alpha: number): number[] {
  const out: number[] = new Array(data.length).fill(NaN);
  if (period <= 0 || !Number.isFinite(alpha)) return out;

  let runStart = -1;
  let prev = NaN;

  for (let i = 0; i < data.length; i++) {
    if (!Number.isFinite(data[i])) {
      runStart = -1;
      prev = NaN;
      continue;
    }
    if (runStart < 0) runStart = i;

    if (Number.isFinite(prev)) {
      prev = (data[i] - prev) * alpha + prev;
      out[i] = prev;
    } else if (i - runStart + 1 >= period) {
      // Seed with the SMA of the first complete window of finite values.
      let sum = 0;
      for (let j = 0; j < period; j++) sum += data[i - j];
      prev = sum / period;
      out[i] = prev;
    }
  }
  return out;
}

export function calculateEMA(data: number[], period: number): number[] {
  return recursiveSmooth(data, period, 2 / (period + 1));
}

/** Wilder's smoothing (RMA) — the correct basis for ATR, ADX and RSI. */
export function wilderSmooth(data: number[], period: number): number[] {
  return recursiveSmooth(data, period, 1 / period);
}

export function calculateRSI(data: number[], period: number = 14): number[] {
  const result: number[] = [];
  let gains = 0;
  let losses = 0;

  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      result.push(NaN);
      continue;
    }

    const diff = data[i] - data[i - 1];
    
    if (i <= period) {
      if (diff > 0) gains += diff;
      else losses -= diff;
      
      if (i === period) {
        const avgGain = gains / period;
        const avgLoss = losses / period;
        // Carry the AVERAGES forward, not the running sums. The previous code
        // left `gains`/`losses` holding sums, so the first Wilder step below
        // seeded with values `period`x too large and under-weighted new bars
        // until the recursion decayed it out — up to ~42 RSI points of error
        // over the first ~100 bars.
        gains = avgGain;
        losses = avgLoss;
        if (avgLoss === 0) {
          result.push(avgGain === 0 ? 50 : 100);
        } else {
          result.push(100 - 100 / (1 + avgGain / avgLoss));
        }
      } else {
        result.push(NaN);
      }
    } else {
      const prevAvgGain = gains; // Reusing variable to store prev average
      const prevAvgLoss = losses;
      
      const currentGain = diff > 0 ? diff : 0;
      const currentLoss = diff < 0 ? -diff : 0;
      
      const avgGain = (prevAvgGain * (period - 1) + currentGain) / period;
      const avgLoss = (prevAvgLoss * (period - 1) + currentLoss) / period;
      
      gains = avgGain; // Save for next iteration
      losses = avgLoss;
      
      if (avgLoss === 0) {
        result.push(100);
      } else {
        const rs = avgGain / avgLoss;
        result.push(100 - (100 / (1 + rs)));
      }
    }
  }
  return result;
}

export function calculateMACD(data: number[], fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  const fastEma = calculateEMA(data, fastPeriod);
  const slowEma = calculateEMA(data, slowPeriod);
  
  const macdLine: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (isNaN(fastEma[i]) || isNaN(slowEma[i])) {
      macdLine.push(NaN);
    } else {
      macdLine.push(fastEma[i] - slowEma[i]);
    }
  }
  
  // Clean up NaNs to calculate EMA of MACD
  const validMacd = macdLine.filter(x => !isNaN(x));
  const signalEmaValid = calculateEMA(validMacd, signalPeriod);
  
  const signalLine: number[] = [];
  let signalIdx = 0;
  for (let i = 0; i < data.length; i++) {
    if (isNaN(macdLine[i])) {
      signalLine.push(NaN);
    } else {
      signalLine.push(signalEmaValid[signalIdx++]);
    }
  }

  const histogram = macdLine.map((m, i) => m - signalLine[i]);

  return { macdLine, signalLine, histogram };
}

export function calculateBollingerBands(data: number[], period = 20, stdDev = 2) {
  const sma = calculateSMA(data, period);
  const upper: number[] = [];
  const lower: number[] = [];

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      upper.push(NaN);
      lower.push(NaN);
      continue;
    }

    // Calculate standard deviation
    let varianceSum = 0;
    for (let j = 0; j < period; j++) {
      varianceSum += Math.pow(data[i - j] - sma[i], 2);
    }
    const standardDeviation = Math.sqrt(varianceSum / period);

    upper.push(sma[i] + standardDeviation * stdDev);
    lower.push(sma[i] - standardDeviation * stdDev);
  }

  return { middle: sma, upper, lower };
}

export function calculateStochastic(highs: number[], lows: number[], closes: number[], period = 14, smoothK = 3, smoothD = 3) {
  const kLine: number[] = [];
  
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      kLine.push(NaN);
      continue;
    }
    
    let highestHigh = -Infinity;
    let lowestLow = Infinity;
    
    for (let j = 0; j < period; j++) {
      if (highs[i - j] > highestHigh) highestHigh = highs[i - j];
      if (lows[i - j] < lowestLow) lowestLow = lows[i - j];
    }
    
    if (highestHigh === lowestLow) {
      kLine.push(50);
    } else {
      kLine.push(((closes[i] - lowestLow) / (highestHigh - lowestLow)) * 100);
    }
  }

  const kSmooth = calculateSMA(kLine, smoothK);
  const dLine = calculateSMA(kSmooth, smoothD);

  return { kLine: kSmooth, dLine };
}

export function calculateATR(highs: number[], lows: number[], closes: number[], period = 14) {
  const tr: number[] = [];
  
  for (let i = 0; i < closes.length; i++) {
    if (i === 0) {
      tr.push(highs[i] - lows[i]);
      continue;
    }
    
    const highLow = highs[i] - lows[i];
    const highClose = Math.abs(highs[i] - closes[i - 1]);
    const lowClose = Math.abs(lows[i] - closes[i - 1]);
    
    tr.push(Math.max(highLow, highClose, lowClose));
  }
  
  // Wilder's RMA, not SMA — matches what every charting platform calls "ATR".
  return wilderSmooth(tr, period);
}


// 2. Volume Weighted Average Price (VWAP)
// Normally reset daily. Since we have daily data over years, we can do a rolling VWAP or just cumulative.
// For swing trading, rolling VWAP (e.g. 20-day VWAP) is preferred.
export function calculateVWAP(closes: number[], highs: number[], lows: number[], volumes: number[], period = 20) {
  const vwap: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      vwap.push(NaN);
      continue;
    }
    let sumPV = 0;
    let sumV = 0;
    for (let j = 0; j < period; j++) {
      const idx = i - j;
      const typicalPrice = (highs[idx] + lows[idx] + closes[idx]) / 3;
      sumPV += typicalPrice * volumes[idx];
      sumV += volumes[idx];
    }
    vwap.push(sumV === 0 ? closes[i] : sumPV / sumV);
  }
  return vwap;
}

// 3. On-Balance Volume (OBV)
export function calculateOBV(closes: number[], volumes: number[]) {
  const obv: number[] = [0];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > closes[i - 1]) obv.push(obv[i - 1] + volumes[i]);
    else if (closes[i] < closes[i - 1]) obv.push(obv[i - 1] - volumes[i]);
    else obv.push(obv[i - 1]);
  }
  return obv;
}

// 4. Average Directional Index (ADX)
export function calculateADX(highs: number[], lows: number[], closes: number[], period = 14) {
  const tr = [];
  const plusDM = [];
  const minusDM = [];
  
  for (let i = 0; i < closes.length; i++) {
    if (i === 0) {
      tr.push(0); plusDM.push(0); minusDM.push(0);
      continue;
    }
    const hl = highs[i] - lows[i];
    const hc = Math.abs(highs[i] - closes[i - 1]);
    const lc = Math.abs(lows[i] - closes[i - 1]);
    tr.push(Math.max(hl, hc, lc));

    const upMove = highs[i] - highs[i - 1];
    const downMove = lows[i - 1] - lows[i];
    
    if (upMove > downMove && upMove > 0) plusDM.push(upMove); else plusDM.push(0);
    if (downMove > upMove && downMove > 0) minusDM.push(downMove); else minusDM.push(0);
  }

  // Wilder's smoothing — EMA(period) is a different filter and made "ADX > 25"
  // mean something other than it does on any chart.
  const smoothedTR = wilderSmooth(tr, period);
  const smoothedPlusDM = wilderSmooth(plusDM, period);
  const smoothedMinusDM = wilderSmooth(minusDM, period);

  const plusDI = [];
  const minusDI = [];
  const dx = [];

  for (let i = 0; i < closes.length; i++) {
    if (i < period || smoothedTR[i] === 0 || isNaN(smoothedTR[i])) {
      plusDI.push(NaN); minusDI.push(NaN); dx.push(NaN);
      continue;
    }
    const pDI = 100 * (smoothedPlusDM[i] / smoothedTR[i]);
    const mDI = 100 * (smoothedMinusDM[i] / smoothedTR[i]);
    plusDI.push(pDI);
    minusDI.push(mDI);
    dx.push(100 * (Math.abs(pDI - mDI) / (pDI + mDI || 1)));
  }

  // `dx` is NaN-padded for the first `period` bars; wilderSmooth re-seeds after
  // the padding instead of propagating NaN forever (the old EMA did not, which
  // made every ADX value NaN and silently disabled every ADX strategy).
  const adx = wilderSmooth(dx, period);
  return { adx, plusDI, minusDI };
}

// 5. Commodity Channel Index (CCI)
export function calculateCCI(highs: number[], lows: number[], closes: number[], period = 20) {
  const cci: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      cci.push(NaN);
      continue;
    }
    const typicalPrices = [];
    for (let j = 0; j < period; j++) {
      const idx = i - j;
      typicalPrices.push((highs[idx] + lows[idx] + closes[idx]) / 3);
    }
    const currentTP = typicalPrices[0];
    const smaTP = typicalPrices.reduce((a, b) => a + b, 0) / period;
    
    const meanDeviation = typicalPrices.reduce((sum, tp) => sum + Math.abs(tp - smaTP), 0) / period;
    
    cci.push(meanDeviation === 0 ? 0 : (currentTP - smaTP) / (0.015 * meanDeviation));
  }
  return cci;
}

// 6. Parabolic SAR (PSAR)
export function calculatePSAR(highs: number[], lows: number[], step = 0.02, maxStep = 0.2) {
  const psar: number[] = [];
  if (highs.length < 2) return psar;

  let isUptrend = true;
  let ep = highs[0]; // Extreme Point
  let af = step; // Acceleration Factor
  let currentSar = lows[0];

  psar.push(currentSar);

  for (let i = 1; i < highs.length; i++) {
    const prevSar = currentSar;
    
    currentSar = prevSar + af * (ep - prevSar);

    if (isUptrend) {
      // Must not be higher than the previous two lows
      currentSar = Math.min(currentSar, lows[i - 1], i > 1 ? lows[i - 2] : lows[i - 1]);
      
      if (lows[i] < currentSar) {
        isUptrend = false;
        currentSar = ep;
        ep = lows[i];
        af = step;
      } else {
        if (highs[i] > ep) {
          ep = highs[i];
          af = Math.min(af + step, maxStep);
        }
      }
    } else {
      // Must not be lower than the previous two highs
      currentSar = Math.max(currentSar, highs[i - 1], i > 1 ? highs[i - 2] : highs[i - 1]);
      
      if (highs[i] > currentSar) {
        isUptrend = true;
        currentSar = ep;
        ep = highs[i];
        af = step;
      } else {
        if (lows[i] < ep) {
          ep = lows[i];
          af = Math.min(af + step, maxStep);
        }
      }
    }
    psar.push(currentSar);
  }
  return psar;
}

// 7. Ichimoku Cloud
export function calculateIchimoku(highs: number[], lows: number[], closes: number[], tenkanPeriod = 9, kijunPeriod = 26, senkouBPeriod = 52) {
  const tenkan: number[] = [];
  const kijun: number[] = [];
  // Raw (unshifted) spans. Ichimoku plots these `kijunPeriod` bars FORWARD, so
  // the cloud you compare today's price against was computed 26 bars ago. The
  // shift is applied after the loop — previously it was never applied at all
  // despite the comment claiming otherwise.
  const rawSenkouA: number[] = [];
  const rawSenkouB: number[] = [];

  for (let i = 0; i < closes.length; i++) {
    // Tenkan-sen (Conversion Line)
    if (i < tenkanPeriod - 1) { tenkan.push(NaN); } else {
      let h = -Infinity, l = Infinity;
      for (let j = 0; j < tenkanPeriod; j++) {
        if (highs[i - j] > h) h = highs[i - j];
        if (lows[i - j] < l) l = lows[i - j];
      }
      tenkan.push((h + l) / 2);
    }
    
    // Kijun-sen (Base Line)
    if (i < kijunPeriod - 1) { kijun.push(NaN); } else {
      let h = -Infinity, l = Infinity;
      for (let j = 0; j < kijunPeriod; j++) {
        if (highs[i - j] > h) h = highs[i - j];
        if (lows[i - j] < l) l = lows[i - j];
      }
      kijun.push((h + l) / 2);
    }
    
    // Senkou Span A
    if (!isNaN(tenkan[i]) && !isNaN(kijun[i])) {
      rawSenkouA.push((tenkan[i] + kijun[i]) / 2);
    } else {
      rawSenkouA.push(NaN);
    }

    // Senkou Span B
    if (i < senkouBPeriod - 1) { rawSenkouB.push(NaN); } else {
      let h = -Infinity, l = Infinity;
      for (let j = 0; j < senkouBPeriod; j++) {
        if (highs[i - j] > h) h = highs[i - j];
        if (lows[i - j] < l) l = lows[i - j];
      }
      rawSenkouB.push((h + l) / 2);
    }
  }

  // Shift the cloud forward by kijunPeriod: the span at bar i was computed from
  // data up to bar i - kijunPeriod. Uses only past data, so no look-ahead.
  const shift = (raw: number[]) =>
    raw.map((_, i) => (i >= kijunPeriod ? raw[i - kijunPeriod] : NaN));

  return { tenkan, kijun, senkouA: shift(rawSenkouA), senkouB: shift(rawSenkouB) };
}
