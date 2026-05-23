import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseNseSubject,
  parseNseDate,
  parseNseRows,
} from './nse-corporate-actions.ts';

describe('NSE corporate action parsing', () => {
  it('parses Kotak 5:1 face value split', () => {
    const d = parseNseDate('14-Jan-2026')!;
    const ca = parseNseSubject(
      'KOTAKBANK',
      'Face Value Split (Sub-Division) - From Rs 5/- Per Share To Re 1/- Per Share',
      d
    );
    assert.equal(ca?.type, 'SPLIT');
    assert.equal(ca?.shareMultiplier, 5);
  });

  it('parses FCL bonus 4:1 and split 2:1', () => {
    const d = parseNseDate('31-Oct-2025')!;
    const bonus = parseNseSubject('FCL', 'Bonus 4:1', d);
    assert.equal(bonus?.type, 'BONUS');
    assert.deepEqual(bonus?.bonusRatio, { bonus: 4, held: 1 });

    const split = parseNseSubject(
      'FCL',
      'Face Value Split (Sub-Division) - From Rs 2/- Per Share To Re 1/- Per Share',
      d
    );
    assert.equal(split?.type, 'SPLIT');
    assert.equal(split?.shareMultiplier, 2);
  });

  it('parses HDFCBANK bonus 1:1', () => {
    const d = parseNseDate('26-Aug-2025')!;
    const ca = parseNseSubject('HDFCBANK', 'Bonus 1:1', d);
    assert.equal(ca?.type, 'BONUS');
    assert.deepEqual(ca?.bonusRatio, { bonus: 1, held: 1 });
  });
});
