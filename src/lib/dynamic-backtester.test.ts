import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  runDynamicBacktest,
  runSplitBacktest,
  summarizeTrades,
  DEFAULT_ONE_WAY_COST_PCT,
  type CompoundStrategyParams,
  type TradeResult,
} from './dynamic-backtester.ts';

/** Sawtooth series: RSI(2) reliably swings between oversold and overbought. */
function sawtooth(n: number) {
  const closes: number[] = [], highs: number[] = [], lows: number[] = [];
  const opens: number[] = [], volumes: number[] = [], dates: Date[] = [];
  for (let i = 0; i < n; i++) {
    const p = 100 + 20 * Math.sin(i / 6);
    closes.push(p);
    // Opens are deliberately offset from closes so a same-bar fill is detectable.
    opens.push(p * 1.02);
    highs.push(p * 1.03);
    lows.push(p * 0.97);
    volumes.push(1000);
    dates.push(new Date(Date.UTC(2015, 0, 1 + i)));
  }
  return { closes, highs, lows, opens, volumes, dates };
}

const RSI_STRAT: CompoundStrategyParams = {
  type: 'COMPOUND',
  name: 'RSI test',
  conditions: [{ type: 'RSI', period: 2, oversold: 30, overbought: 70 }],
};

function trade(returnPct: number): TradeResult {
  return {
    entryDate: new Date(2020, 0, 1), entryPrice: 100,
    exitDate: new Date(2020, 1, 1), exitPrice: 100 * (1 + returnPct / 100),
    grossReturnPct: returnPct, returnPct,
    holdingPeriodDays: 30, maxDrawdownPct: 0,
  };
}

describe('runDynamicBacktest — execution', () => {
  const s = sawtooth(400);

  it('fills at the NEXT bar, never the signal bar', () => {
    // Look-ahead regression: entries used to be booked at closes[i], the very
    // bar whose close produced the signal.
    const r = runDynamicBacktest(RSI_STRAT, s.closes, s.highs, s.lows, s.volumes, s.dates, s.opens, 0);
    assert.ok(r.totalTrades > 0, 'no trades produced — test series is wrong');

    for (const t of r.trades) {
      const entryIdx = s.dates.findIndex((d) => d.getTime() === t.entryDate.getTime());
      assert.ok(entryIdx > 0, 'entry date not found in series');
      assert.equal(t.entryPrice, s.opens[entryIdx], 'entry did not fill at its own bar open');
      assert.notEqual(t.entryPrice, s.closes[entryIdx - 1], 'entry filled on the signal bar close');
    }
  });

  it('falls back to close when opens are unavailable', () => {
    const r = runDynamicBacktest(RSI_STRAT, s.closes, s.highs, s.lows, s.volumes, s.dates, undefined, 0);
    for (const t of r.trades) {
      const idx = s.dates.findIndex((d) => d.getTime() === t.entryDate.getTime());
      assert.equal(t.entryPrice, s.closes[idx]);
    }
  });

  it('charges round-trip costs so net is below gross', () => {
    const free = runDynamicBacktest(RSI_STRAT, s.closes, s.highs, s.lows, s.volumes, s.dates, s.opens, 0);
    const costed = runDynamicBacktest(RSI_STRAT, s.closes, s.highs, s.lows, s.volumes, s.dates, s.opens, DEFAULT_ONE_WAY_COST_PCT);

    assert.equal(free.totalTrades, costed.totalTrades, 'costs should not change which trades fire');
    assert.ok(costed.averageReturn < free.averageReturn, 'costs did not reduce returns');
    for (const t of costed.trades) {
      assert.ok(t.returnPct < t.grossReturnPct, 'net return is not below gross');
    }
  });

  it('never enters and exits on the same bar', () => {
    const r = runDynamicBacktest(RSI_STRAT, s.closes, s.highs, s.lows, s.volumes, s.dates, s.opens);
    for (const t of r.trades) {
      assert.ok(t.exitDate.getTime() > t.entryDate.getTime());
      assert.ok(t.holdingPeriodDays >= 1);
    }
  });
});

describe('summarizeTrades — metrics', () => {
  it('compounds the total return rather than summing it', () => {
    // Ten +5% trades is +62.9%, not +50%. The old code reported the sum.
    const r = summarizeTrades(Array.from({ length: 10 }, () => trade(5)));
    assert.ok(Math.abs(r.totalReturn - 62.889) < 0.01, `got ${r.totalReturn}`);
    assert.ok(Math.abs(r.averageReturn - 5) < 1e-9);
  });

  it('counts a win as a positive net return, with no drawdown fudge', () => {
    // Previously a winning trade whose intra-trade drawdown passed -10% was
    // rewritten to -10 and excluded from the win count.
    const deepDip: TradeResult = { ...trade(8), maxDrawdownPct: -25 };
    const r = summarizeTrades([deepDip, trade(-3)]);
    assert.equal(r.profitableTrades, 1);
    assert.equal(r.winRate, 50);
    assert.ok(Math.abs(r.averageReturn - 2.5) < 1e-9, 'return was altered by drawdown');
  });

  it('reports equity-curve drawdown separately from worst-trade drawdown', () => {
    const r = summarizeTrades([trade(20), trade(-30), trade(10)]);
    // 1.2 -> 0.84 is a 30% fall from the peak.
    assert.ok(Math.abs(r.equityMaxDrawdown - -30) < 1e-9, `got ${r.equityMaxDrawdown}`);
  });

  it('handles an empty trade list', () => {
    const r = summarizeTrades([]);
    assert.equal(r.totalTrades, 0);
    assert.equal(r.totalReturn, 0);
    assert.equal(r.equityMaxDrawdown, 0);
  });
});

describe('runSplitBacktest — validation', () => {
  const s = sawtooth(600);

  it('partitions trades into selection and held-back windows', () => {
    const split = runSplitBacktest(RSI_STRAT, s.closes, s.highs, s.lows, s.volumes, s.dates, s.opens);
    assert.ok(split.splitDate, 'no split date produced');

    const cut = split.splitDate!.getTime();
    assert.ok(split.inSample.trades.every((t) => t.entryDate.getTime() < cut));
    assert.ok(split.outOfSample.trades.every((t) => t.entryDate.getTime() >= cut));
    assert.equal(
      split.inSample.totalTrades + split.outOfSample.totalTrades,
      split.full.totalTrades
    );
  });

  it('produces trades in both windows for a strategy that trades throughout', () => {
    const split = runSplitBacktest(RSI_STRAT, s.closes, s.highs, s.lows, s.volumes, s.dates, s.opens);
    assert.ok(split.inSample.totalTrades > 0, 'no in-sample trades');
    assert.ok(split.outOfSample.totalTrades > 0, 'no out-of-sample trades');
  });

  it('carries the live signal on the out-of-sample window', () => {
    const split = runSplitBacktest(RSI_STRAT, s.closes, s.highs, s.lows, s.volumes, s.dates, s.opens);
    assert.equal(split.outOfSample.currentSignal, split.full.currentSignal);
  });
});
