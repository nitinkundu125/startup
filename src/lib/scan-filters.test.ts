import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY_FILTERS, matchesFilters, activeFilterCount } from './scan-filters.ts';
import type { ScanRow } from './scan-result.ts';

/**
 * The filters run in the browser now, over a finished scan. They decide what a
 * user sees, so "0 means off" and "drawdowns compare by magnitude" are the two
 * rules worth pinning down — getting either backwards silently empties the table.
 */

const row = (over: Partial<ScanRow> = {}): ScanRow => ({
  symbol: 'TEST.NS',
  strategyName: 'Test',
  totalTrades: 20,
  profitableTrades: 12,
  winRate: 60,
  averageReturn: 2,
  totalReturn: 40,
  maxDrawdown: -15,
  equityMaxDrawdown: -25,
  oosTotalTrades: 8,
  oosWinRate: 55,
  oosAverageReturn: 1.5,
  oosTotalReturn: 12,
  oosMaxDrawdown: -18,
  oosEquityMaxDrawdown: -22,
  heldUp: true,
  splitDate: null,
  strategy: {} as ScanRow['strategy'],
  ...over,
});

describe('matchesFilters', () => {
  it('keeps everything when nothing is set', () => {
    // A strategy that lost on every trade still passes: no floor is switched on.
    assert.equal(matchesFilters(row({ winRate: 0, oosWinRate: 0 }), EMPTY_FILTERS), true);
  });

  it('applies the fitted floors', () => {
    assert.equal(matchesFilters(row({ winRate: 60 }), { ...EMPTY_FILTERS, minWinRate: 55 }), true);
    assert.equal(matchesFilters(row({ winRate: 50 }), { ...EMPTY_FILTERS, minWinRate: 55 }), false);
    assert.equal(matchesFilters(row({ totalTrades: 4 }), { ...EMPTY_FILTERS, minTrades: 10 }), false);
  });

  it('compares drawdown by magnitude, entered positive', () => {
    // Stored as -15; a ceiling of 20 means "nothing worse than -20%".
    assert.equal(matchesFilters(row({ maxDrawdown: -15 }), { ...EMPTY_FILTERS, maxDrawdown: 20 }), true);
    assert.equal(matchesFilters(row({ maxDrawdown: -35 }), { ...EMPTY_FILTERS, maxDrawdown: 20 }), false);
  });

  it('does not treat a drawdown ceiling of 0 as "no drawdown allowed"', () => {
    // Taken literally this rejects every real strategy, so 0 has to mean off.
    assert.equal(matchesFilters(row({ maxDrawdown: -40 }), EMPTY_FILTERS), true);
  });

  it('fails a held-back win-rate floor when there were no held-back trades', () => {
    // No trades means no win rate to clear — it must not pass by default.
    const noOos = row({ oosTotalTrades: 0, oosWinRate: 0 });
    assert.equal(matchesFilters(noOos, { ...EMPTY_FILTERS, oosMinWinRate: 50 }), false);
    // ...but with no floor set, it is simply an unvalidated row, not excluded.
    assert.equal(matchesFilters(noOos, EMPTY_FILTERS), true);
  });

  it('applies the held-back floors independently of the fitted ones', () => {
    const strongFittedWeakOos = row({ winRate: 90, oosWinRate: 20 });
    assert.equal(matchesFilters(strongFittedWeakOos, { ...EMPTY_FILTERS, minWinRate: 80 }), true);
    assert.equal(matchesFilters(strongFittedWeakOos, { ...EMPTY_FILTERS, oosMinWinRate: 50 }), false);
  });
});

describe('activeFilterCount', () => {
  it('counts only the floors that are switched on', () => {
    assert.equal(activeFilterCount(EMPTY_FILTERS), 0);
    assert.equal(activeFilterCount({ ...EMPTY_FILTERS, minWinRate: 55, oosMinTrades: 3 }), 2);
  });
});
