import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  indexCashEventsFromTransactions,
  simulateIndexMonthEnds,
} from './benchmark.ts';
import type { TxInput } from './portfolio.ts';
import type { DailyClose } from './index-history.ts';

function d(iso: string): Date {
  return new Date(iso);
}

describe('simulateIndexMonthEnds', () => {
  it('buys index units on same cash as stock BUY', () => {
    const series: DailyClose[] = [
      { date: d('2024-01-01'), close: 100 },
      { date: d('2024-01-31'), close: 110 },
    ];
    const events = [{ date: d('2024-01-01'), amount: 10_000, isBuy: true }];
    const vals = simulateIndexMonthEnds(events, series, ['2024-01']);
    assert.ok(Math.abs((vals.get('2024-01') ?? 0) - 11_000) < 1);
  });

  it('extracts BUY/SELL from transactions', () => {
    const txs: TxInput[] = [
      {
        assetId: 'a',
        symbol: 'X',
        name: 'X',
        type: 'BUY',
        quantity: 5,
        price: 200,
        date: d('2024-03-01'),
        currentPrice: 200,
      },
      {
        assetId: 'a',
        symbol: 'X',
        name: 'X',
        type: 'SELL',
        quantity: 2,
        price: 250,
        date: d('2024-06-01'),
        currentPrice: 250,
      },
    ];
    const events = indexCashEventsFromTransactions(txs);
    assert.equal(events.length, 2);
    assert.equal(events[0].amount, 1000);
    assert.equal(events[1].amount, 500);
  });
});
