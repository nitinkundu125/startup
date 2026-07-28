import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateADX,
  calculateEMA,
  calculateRSI,
  calculateATR,
  calculateIchimoku,
  wilderSmooth,
} from './indicators.ts';

/** Deterministic price series with regime changes — no Math.random in tests. */
function syntheticSeries(n: number) {
  let seed = 7;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const closes: number[] = [], highs: number[] = [], lows: number[] = [];
  let p = 100;
  for (let i = 0; i < n; i++) {
    p = Math.max(1, p * (1 + (Math.sin(i / 120) * 0.3 + (rnd() - 0.5) * 2.5) / 100));
    closes.push(p);
    highs.push(p * (1 + rnd() * 0.012));
    lows.push(p * (1 - rnd() * 0.012));
  }
  return { closes, highs, lows };
}

/** Textbook Wilder RSI, used as the oracle. */
function referenceRsi(data: number[], period = 14): number[] {
  const out: number[] = [NaN];
  let g = 0, l = 0;
  for (let i = 1; i <= period; i++) {
    const d = data[i] - data[i - 1];
    if (d > 0) g += d; else l -= d;
    out.push(NaN);
  }
  let ag = g / period, al = l / period;
  out[period] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
  for (let i = period + 1; i < data.length; i++) {
    const d = data[i] - data[i - 1];
    ag = (ag * (period - 1) + (d > 0 ? d : 0)) / period;
    al = (al * (period - 1) + (d < 0 ? -d : 0)) / period;
    out.push(al === 0 ? 100 : 100 - 100 / (1 + ag / al));
  }
  return out;
}

describe('calculateEMA', () => {
  it('re-seeds after leading NaN instead of propagating it forever', () => {
    // Regression: the old implementation seeded unconditionally, so any NaN in
    // the warm-up window poisoned every later value. This is what made ADX NaN.
    const withNaN = [NaN, NaN, NaN, NaN, NaN, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const out = calculateEMA(withNaN, 5);
    assert.ok(out.filter(Number.isFinite).length > 0, 'EMA produced no finite values');
    assert.ok(Number.isFinite(out[out.length - 1]));
  });

  it('does not read past the end of the array', () => {
    // data.length === period - 1 used to read data[period-1] (undefined).
    assert.doesNotThrow(() => calculateEMA([1, 2, 3, 4], 5));
    assert.ok(calculateEMA([1, 2, 3, 4], 5).every((v) => Number.isNaN(v)));
  });
});

describe('calculateRSI', () => {
  it('matches a reference Wilder implementation everywhere', () => {
    const { closes } = syntheticSeries(500);
    const actual = calculateRSI(closes, 14);
    const expected = referenceRsi(closes, 14);

    let maxDev = 0;
    for (let i = 0; i < closes.length; i++) {
      if (!Number.isFinite(actual[i]) || !Number.isFinite(expected[i])) continue;
      maxDev = Math.max(maxDev, Math.abs(actual[i] - expected[i]));
    }
    // Was ~42 RSI points off for the first ~100 bars because the seed carried
    // running sums forward instead of the Wilder averages.
    assert.ok(maxDev < 1e-9, `RSI deviates from Wilder by ${maxDev} points`);
  });

  it('stays within 0..100', () => {
    const { closes } = syntheticSeries(300);
    for (const v of calculateRSI(closes, 14)) {
      if (Number.isFinite(v)) assert.ok(v >= 0 && v <= 100, `RSI out of range: ${v}`);
    }
  });
});

describe('calculateADX', () => {
  it('produces finite values rather than all NaN', () => {
    // Regression: ADX was NaN for every bar on every symbol, which silently
    // disabled every ADX strategy in the library.
    const { closes, highs, lows } = syntheticSeries(400);
    const { adx, plusDI, minusDI } = calculateADX(highs, lows, closes, 14);

    assert.ok(adx.filter(Number.isFinite).length > 300, 'ADX is still mostly NaN');
    assert.ok(plusDI.filter(Number.isFinite).length > 300);
    assert.ok(minusDI.filter(Number.isFinite).length > 300);
  });

  it('keeps ADX and DI within 0..100', () => {
    const { closes, highs, lows } = syntheticSeries(400);
    const { adx, plusDI, minusDI } = calculateADX(highs, lows, closes, 14);
    for (const arr of [adx, plusDI, minusDI]) {
      for (const v of arr) {
        if (Number.isFinite(v)) assert.ok(v >= 0 && v <= 100, `value out of range: ${v}`);
      }
    }
  });

  it('warms up over 2 x period, as Wilder requires', () => {
    const { closes, highs, lows } = syntheticSeries(200);
    const { adx } = calculateADX(highs, lows, closes, 14);
    assert.ok(!Number.isFinite(adx[20]), 'ADX produced a value before its warm-up completed');
    assert.ok(Number.isFinite(adx[60]));
  });
});

describe('wilderSmooth', () => {
  it('decays toward a constant input', () => {
    const flat = new Array(100).fill(5);
    const out = wilderSmooth(flat, 14);
    assert.ok(Math.abs(out[99] - 5) < 1e-9);
  });
});

describe('calculateATR', () => {
  it('is positive and finite once warmed up', () => {
    const { closes, highs, lows } = syntheticSeries(200);
    const atr = calculateATR(highs, lows, closes, 14);
    assert.ok(Number.isFinite(atr[100]));
    assert.ok(atr[100] > 0);
  });
});

describe('calculateIchimoku', () => {
  it('shifts the cloud forward by kijunPeriod', () => {
    // The spans are plotted 26 bars ahead; the value at bar i must be the one
    // computed at bar i-26, not the one computed at bar i.
    const { closes, highs, lows } = syntheticSeries(300);
    const ichi = calculateIchimoku(highs, lows, closes, 9, 26, 52);

    const i = 200;
    const unshifted = (ichi.tenkan[i] + ichi.kijun[i]) / 2;
    const expected = (ichi.tenkan[i - 26] + ichi.kijun[i - 26]) / 2;

    assert.ok(Math.abs(ichi.senkouA[i] - expected) < 1e-9, 'Senkou A is not shifted');
    assert.notEqual(ichi.senkouA[i], unshifted);
    // Nothing before the shift window can have a value.
    assert.ok(ichi.senkouA.slice(0, 26).every((v) => Number.isNaN(v)));
  });
});
