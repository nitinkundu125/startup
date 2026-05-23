import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { xirr, type CashFlow } from './xirr.ts';
import { portfolioCashFlows } from './cashflows.ts';
import type { TxInput } from './portfolio.ts';

function d(iso: string): Date {
  return new Date(iso);
}

describe('xirr', () => {
  it('returns null without both signs', () => {
    assert.equal(xirr([{ date: d('2024-01-01'), amount: -100 }]), null);
  });

  it('solves a simple two-flow case', () => {
    const flows: CashFlow[] = [
      { date: d('2024-01-01'), amount: -100_000 },
      { date: d('2025-01-01'), amount: 110_000 },
    ];
    const rate = xirr(flows);
    assert.ok(rate != null);
    assert.ok(Math.abs(rate! - 0.1) < 0.002);
  });

  it('handles irregular cash flows', () => {
    const flows: CashFlow[] = [
      { date: d('2023-06-01'), amount: -50_000 },
      { date: d('2024-01-15'), amount: -30_000 },
      { date: d('2024-08-01'), amount: 20_000 },
      { date: d('2025-05-01'), amount: 75_000 },
    ];
    const rate = xirr(flows);
    assert.ok(rate != null && Number.isFinite(rate));
  });
});

describe('portfolioCashFlows', () => {
  it('ignores bonus and includes terminal value', () => {
    const txs: TxInput[] = [
      {
        assetId: 'a',
        symbol: 'X',
        name: 'X',
        type: 'BUY',
        quantity: 10,
        price: 100,
        date: d('2024-01-01'),
        currentPrice: 100,
      },
      {
        assetId: 'a',
        symbol: 'X',
        name: 'X',
        type: 'BONUS',
        quantity: 5,
        price: 0,
        date: d('2024-06-01'),
        currentPrice: 100,
      },
    ];
    const flows = portfolioCashFlows(txs, 1500, d('2025-01-01'));
    assert.equal(flows.length, 2);
    assert.equal(flows[0].amount, -1000);
    assert.equal(flows[1].amount, 1500);
  });
});
