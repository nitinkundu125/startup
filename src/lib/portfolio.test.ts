import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildPortfolioSummary } from './portfolio.ts';
import { preprocessCorporateActions } from './corporate-actions.ts';
import { parseTradebookCsv } from './tradebook.ts';
import {
  emptyPosition,
  addLot,
  sellLots,
  addBonus,
  applyDematReset,
  applySplit,
} from './fifo.ts';

function tx(
  overrides: Partial<Parameters<typeof buildPortfolioSummary>[0][0]> &
    Pick<Parameters<typeof buildPortfolioSummary>[0][0], 'assetId' | 'type' | 'quantity' | 'price' | 'date'>
) {
  return {
    symbol: 'TEST',
    name: 'Test',
    currentPrice: 100,
    ...overrides,
  };
}

describe('FIFO lots', () => {
  it('sells oldest lots first', () => {
    const p = emptyPosition();
    addLot(p, 10, 100, new Date('2020-01-01'));
    addLot(p, 10, 200, new Date('2021-01-01'));
    sellLots(p, 10);
    assert.equal(p.quantity, 10);
    assert.equal(p.totalCost, 2000);
    assert.equal(p.lots[0].price, 200);
  });

  it('bonus adds at zero cost (total invested unchanged)', () => {
    const p = emptyPosition();
    addLot(p, 10, 100, new Date('2020-01-01'));
    addBonus(p, 10, new Date('2021-01-01'));
    assert.equal(p.quantity, 20);
    assert.equal(p.totalCost, 1000);
  });

  it('split multiplies quantity, cost unchanged', () => {
    const p = emptyPosition();
    addLot(p, 10, 100, new Date('2020-01-01'));
    applySplit(p, 2);
    assert.equal(p.quantity, 20);
    assert.equal(p.totalCost, 1000);
  });

  it('demat preserves cost basis', () => {
    const p = emptyPosition();
    addLot(p, 50, 10, new Date('2020-01-01'));
    applyDematReset(p, 25, 500, new Date('2024-01-01'));
    assert.equal(p.quantity, 25);
    assert.equal(p.totalCost, 500);
  });
});

describe('buildPortfolioSummary', () => {
  it('FIFO buy then sell', () => {
    const summary = buildPortfolioSummary([
      tx({
        assetId: 'a1',
        type: 'BUY',
        quantity: 10,
        price: 100,
        date: new Date('2020-01-01'),
        currentPrice: 150,
      }),
      tx({
        assetId: 'a1',
        type: 'SELL',
        quantity: 5,
        price: 120,
        date: new Date('2021-01-01'),
        currentPrice: 150,
      }),
    ]);
    assert.equal(summary.holdings[0].quantity, 5);
    assert.equal(summary.holdings[0].totalInvested, 500);
    assert.equal(summary.holdings[0].currentPrice, 120);
    assert.equal(summary.totalValue, 600);
  });
});

describe('demat / ISIN change', () => {
  it('collapses oversized same-day sell+buy into CA_BUY', () => {
    const rows = [
      {
        symbol: 'FCL',
        isin: 'INE001',
        tradeDate: new Date('2025-08-12'),
        exchange: 'NSE',
        segment: 'EQ',
        series: 'EQ',
        type: 'BUY' as const,
        auction: false,
        quantity: 23,
        price: 100,
        tradeId: 'b1',
        orderId: null,
        orderExecutionTime: null,
      },
      {
        symbol: 'FCL',
        isin: 'INE002',
        tradeDate: new Date('2026-05-19'),
        exchange: 'NSE',
        segment: 'EQ',
        series: 'EQ',
        type: 'SELL' as const,
        auction: false,
        quantity: 250,
        price: 34.75,
        tradeId: 's1',
        orderId: null,
        orderExecutionTime: null,
      },
      {
        symbol: 'FCL',
        isin: 'INE002',
        tradeDate: new Date('2026-05-19'),
        exchange: 'NSE',
        segment: 'EQ',
        series: 'EQ',
        type: 'BUY' as const,
        auction: false,
        quantity: 50,
        price: 33.78,
        tradeId: 'b2',
        orderId: null,
        orderExecutionTime: null,
      },
    ];
    const processed = preprocessCorporateActions(rows);
    assert.equal(processed.filter((r) => r.type === 'SELL').length, 0);
    const ca = processed.find((r) => r.type === 'CA_BUY');
    assert.ok(ca);
    assert.equal(ca!.quantity, 50);
    const summary = buildPortfolioSummary([
      tx({
        assetId: 'fcl',
        type: 'BUY',
        quantity: 23,
        price: 100,
        date: new Date('2025-08-12'),
        currentPrice: 34,
      }),
      tx({
        assetId: 'fcl',
        type: 'DEMAT',
        quantity: ca!.quantity,
        price: ca!.price,
        date: ca!.tradeDate,
        currentPrice: 34,
      }),
    ]);
    assert.equal(summary.holdings[0].quantity, 50);
    assert.equal(summary.holdings[0].totalInvested, 2300);
  });
});

describe('same-day round trip is not demat', () => {
  it('YESBANK buy+sell same day nets to zero then later buy', () => {
    const rows = [
      {
        symbol: 'YESBANK',
        isin: 'INE528G01035',
        tradeDate: new Date('2024-04-04'),
        exchange: 'NSE',
        segment: 'EQ',
        series: 'EQ',
        type: 'BUY' as const,
        auction: false,
        quantity: 400,
        price: 25.2,
        tradeId: '1',
        orderId: null,
        orderExecutionTime: null,
      },
      {
        symbol: 'YESBANK',
        isin: 'INE528G01035',
        tradeDate: new Date('2024-04-04'),
        exchange: 'NSE',
        segment: 'EQ',
        series: 'EQ',
        type: 'SELL' as const,
        auction: false,
        quantity: 400,
        price: 25.1,
        tradeId: '2',
        orderId: null,
        orderExecutionTime: null,
      },
      {
        symbol: 'YESBANK',
        isin: 'INE528G01035',
        tradeDate: new Date('2026-03-17'),
        exchange: 'NSE',
        segment: 'EQ',
        series: 'EQ',
        type: 'BUY' as const,
        auction: false,
        quantity: 42,
        price: 18.84,
        tradeId: '3',
        orderId: null,
        orderExecutionTime: null,
      },
    ];
    const processed = preprocessCorporateActions(rows);
    assert.equal(processed.filter((r) => r.type === 'CA_BUY').length, 0);
    const summary = buildPortfolioSummary(
      processed.map((r) =>
        tx({
          assetId: 'yes',
          type: r.type,
          quantity: r.quantity,
          price: r.price,
          date: r.tradeDate,
          currentPrice: 18.84,
        })
      )
    );
    assert.equal(summary.holdings[0].quantity, 42);
  });
});

describe('stock split on ISIN change (Kotak 5:1)', () => {
  it('applies split before post-split sells', () => {
    const rows = [
      {
        symbol: 'KOTAKBANK',
        isin: 'INE237A01028',
        tradeDate: new Date('2024-04-08'),
        exchange: 'NSE',
        segment: 'EQ',
        series: 'EQ',
        type: 'BUY' as const,
        auction: false,
        quantity: 24,
        price: 1685,
        tradeId: 'k1',
        orderId: null,
        orderExecutionTime: null,
      },
      {
        symbol: 'KOTAKBANK',
        isin: 'INE237A01028',
        tradeDate: new Date('2025-12-28'),
        exchange: 'NSE',
        segment: 'EQ',
        series: 'EQ',
        type: 'SELL' as const,
        auction: false,
        quantity: 6,
        price: 2171.5,
        tradeId: 'k2',
        orderId: null,
        orderExecutionTime: null,
      },
      {
        symbol: 'KOTAKBANK',
        isin: 'INE237A01036',
        tradeDate: new Date('2026-04-28'),
        exchange: 'NSE',
        segment: 'EQ',
        series: 'EQ',
        type: 'SELL' as const,
        auction: false,
        quantity: 10,
        price: 382.05,
        tradeId: 'k3',
        orderId: null,
        orderExecutionTime: null,
      },
    ];
    const processed = preprocessCorporateActions(rows);
    assert.ok(processed.some((r) => r.type === 'SPLIT' && r.splitRatio === 5));
    const txs = processed.map((r) =>
      tx({
        assetId: 'kotak',
        type: r.type === 'CA_BUY' ? 'DEMAT' : r.type,
        quantity: r.type === 'SPLIT' ? 0 : r.quantity,
        price: r.price,
        splitRatio: r.splitRatio ?? null,
        date: r.tradeDate,
        currentPrice: 382,
      })
    );
    const summary = buildPortfolioSummary(txs);
    assert.equal(summary.holdings[0].quantity, 80);
  });
});

describe('corporate actions from CSV fixture', () => {
  it('parses Paisa-style Zerodha sample', () => {
    const csv = `symbol,isin,trade_date,exchange,segment,series,trade_type,auction,quantity,price,trade_id,order_id,order_execution_time
RELIANCE,INE002A01018,2020-01-15,NSE,EQ,EQ,buy,false,10,1500.5,1,1,2020-01-15T10:00:00
RELIANCE,INE002A01018,2021-06-01,NSE,EQ,EQ,sell,false,5,2200,2,2,2021-06-01T10:00:00`;
    const { rows, errors } = parseTradebookCsv(csv);
    assert.equal(errors.length, 0);
    const processed = preprocessCorporateActions(rows);
    assert.equal(processed.length, 2);
    const summary = buildPortfolioSummary(
      processed.map((r) =>
        tx({
          assetId: 'rel',
          type: r.type,
          quantity: r.quantity,
          price: r.price,
          date: r.tradeDate,
          currentPrice: 2200,
          splitRatio: r.splitRatio,
        })
      )
    );
    assert.equal(summary.holdings[0].quantity, 5);
  });
});
