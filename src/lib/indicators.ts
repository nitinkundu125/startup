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

export function calculateEMA(data: number[], period: number): number[] {
  const result: number[] = [];
  const multiplier = 2 / (period + 1);
  let prevEma = NaN;

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
      if (i === period - 2) {
        // Calculate SMA for the first EMA point
        let sum = 0;
        for (let j = 0; j < period - 1; j++) sum += data[i - j];
        prevEma = (sum + data[i + 1]) / period; // this will be used in next iteration
      }
    } else if (i === period - 1) {
      result.push(prevEma);
    } else {
      const ema = (data[i] - prevEma) * multiplier + prevEma;
      result.push(ema);
      prevEma = ema;
    }
  }
  return result;
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
        let avgGain = gains / period;
        let avgLoss = losses / period;
        let rs = avgGain / avgLoss;
        result.push(100 - (100 / (1 + rs)));
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
  
  // ATR is generally an SMA or RMA of TR. We'll use SMA for simplicity here.
  return calculateSMA(tr, period);
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

  // Smooth using Wilder's Smoothing (approximated here with EMA for stability or simple sum for first)
  const smoothedTR = calculateEMA(tr, period);
  const smoothedPlusDM = calculateEMA(plusDM, period);
  const smoothedMinusDM = calculateEMA(minusDM, period);

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

  const adx = calculateEMA(dx, period);
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
  const senkouA: number[] = []; // Shifted forward by 26 natively
  const senkouB: number[] = [];
  
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
      senkouA.push((tenkan[i] + kijun[i]) / 2);
    } else {
      senkouA.push(NaN);
    }

    // Senkou Span B
    if (i < senkouBPeriod - 1) { senkouB.push(NaN); } else {
      let h = -Infinity, l = Infinity;
      for (let j = 0; j < senkouBPeriod; j++) {
        if (highs[i - j] > h) h = highs[i - j];
        if (lows[i - j] < l) l = lows[i - j];
      }
      senkouB.push((h + l) / 2);
    }
  }

  return { tenkan, kijun, senkouA, senkouB };
}
