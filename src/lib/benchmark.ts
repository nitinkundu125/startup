import { BONUS_MAX_PRICE } from '@/lib/corporate-actions';
import {
  closeOnOrBefore,
  fetchYahooDailyCloses,
  monthEndDate,
  type DailyClose,
} from '@/lib/index-history';
import type { TxInput } from '@/lib/portfolio';

export type BenchmarkId = 'nifty50' | 'nifty500' | 'midcap150' | 'smallcap250';

export type BenchmarkIndex = {
  id: BenchmarkId;
  label: string;
  yahoo: string;
};

/** Yahoo symbols with daily history (index tickers verified on chart API). */
export const BENCHMARK_INDICES: BenchmarkIndex[] = [
  { id: 'nifty50', label: 'Nifty 50', yahoo: 'NIFTYBEES.NS' },
  { id: 'nifty500', label: 'Nifty 500', yahoo: 'MONIFTY500.NS' },
  { id: 'midcap150', label: 'Midcap 150', yahoo: 'MID150BEES.NS' },
  /** Index has no Yahoo history; HDFC Smallcap 250 ETF tracks the index from Feb 2023. */
  { id: 'smallcap250', label: 'Smallcap 250', yahoo: 'HDFCSML250.NS' },
];

function indexPriceOnDate(series: DailyClose[], onOrBefore: Date): number | null {
  const px = closeOnOrBefore(series, onOrBefore);
  if (px != null) return px;
  const first = series[0];
  return first && first.close > 0 ? first.close : null;
}

export type IndexCashEvent = { date: Date; amount: number; isBuy: boolean };

export function indexCashEventsFromTransactions(transactions: TxInput[]): IndexCashEvent[] {
  const events: IndexCashEvent[] = [];

  for (const tx of transactions) {
    const type = tx.type.toUpperCase();
    if (type === 'BUY' && tx.price >= BONUS_MAX_PRICE) {
      const amount = tx.quantity * tx.price;
      if (amount > 0) events.push({ date: tx.date, amount, isBuy: true });
    } else if (type === 'SELL') {
      const amount = tx.quantity * tx.price;
      if (amount > 0) events.push({ date: tx.date, amount, isBuy: false });
    }
  }

  events.sort((a, b) => a.date.getTime() - b.date.getTime());
  return events;
}

export function calculateIndexTerminalValue(events: IndexCashEvent[], indexSeries: DailyClose[], asOf: Date): number | null {
  if (!events.length || !indexSeries.length) return null;

  let units = 0;
  let eventIdx = 0;

  while (eventIdx < events.length && events[eventIdx].date.getTime() <= asOf.getTime()) {
    const ev = events[eventIdx];
    const px = indexPriceOnDate(indexSeries, ev.date);
    if (px != null && px > 0) {
      if (ev.isBuy) {
        units += ev.amount / px;
      } else {
        const sellUnits = ev.amount / px;
        units = Math.max(0, units - sellUnits);
      }
    }
    eventIdx++;
  }

  const endPx = indexPriceOnDate(indexSeries, asOf);
  if (endPx != null && units > 0) {
    return units * endPx;
  }
  return 0;
}

/**
 * Same cash flows as the portfolio, invested in a single index (units of index).
 * Returns month-end simulated value for each `YYYY-MM` key.
 */
export function simulateIndexMonthEnds(
  events: IndexCashEvent[],
  indexSeries: DailyClose[],
  monthKeys: string[]
): Map<string, number> {
  const result = new Map<string, number>();
  if (!events.length || !indexSeries.length || !monthKeys.length) return result;

  let units = 0;
  let eventIdx = 0;

  for (const ym of monthKeys) {
    const end = monthEndDate(ym);
    const endValue = calculateIndexTerminalValue(events, indexSeries, end);
    result.set(ym, endValue || 0);
  }

  return result;
}

import { xirr, type CashFlow } from '@/lib/xirr';

export function simulateBenchmarkXirr(events: IndexCashEvent[], indexSeries: DailyClose[], asOf: Date = new Date()): number | null {
  if (!events.length || !indexSeries.length) return null;

  const terminalValue = calculateIndexTerminalValue(events, indexSeries, asOf) || 0;
  
  const flows: CashFlow[] = events.map(e => ({
    date: e.date,
    amount: e.isBuy ? -e.amount : e.amount
  }));

  if (terminalValue > 0) {
    flows.push({ date: asOf, amount: terminalValue });
  }

  return xirr(flows);
}

export async function fetchBenchmarkSeries(
  index: BenchmarkIndex,
  transactions: TxInput[],
  monthKeys: string[]
): Promise<Map<string, number> | null> {
  const events = indexCashEventsFromTransactions(transactions);
  if (!events.length || !monthKeys.length) return null;

  const start = events[0].date;
  const series = await fetchYahooDailyCloses(index.yahoo, start);
  if (!series.length) return null;

  const simulated = simulateIndexMonthEnds(events, series, monthKeys);
  const hasValue = [...simulated.values()].some((v) => v > 0);
  return hasValue ? simulated : null;
}

export async function buildBenchmarkMonthValues(
  transactions: TxInput[],
  monthKeys: string[]
): Promise<Partial<Record<BenchmarkId, Map<string, number>>>> {
  const out: Partial<Record<BenchmarkId, Map<string, number>>> = {};

  await Promise.all(
    BENCHMARK_INDICES.map(async (idx) => {
      const series = await fetchBenchmarkSeries(idx, transactions, monthKeys);
      if (series) out[idx.id] = series;
    })
  );

  return out;
}

export const BENCHMARK_CHART_COLORS: Record<BenchmarkId, string> = {
  nifty50: '#0369a1',
  nifty500: '#7c3aed',
  midcap150: '#c2410c',
  smallcap250: '#be185d',
};
