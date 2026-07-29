'use client';

import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from 'lucide-react';
import { formatINR, formatUSD, formatQuantity } from '@/lib/format';
import { formatAssetLabel } from '@/lib/asset-identity';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Layers } from 'lucide-react';

export type HoldingRow = {
  assetId: string;
  symbol: string;
  name: string;
  symbolAliases: string[];
  isin: string | null;
  quantity: number;
  currentPrice: number;
  avgBuyPrice: number;
  totalInvested: number;
  brokerAdjusted?: boolean;
  liveLtp?: boolean;
  benchmarkId?: string | null;
  xirr?: number | null;
  benchmarkXirr?: number | null;
};

type SortKey =
  | 'asset'
  | 'quantity'
  | 'avgBuyPrice'
  | 'currentPrice'
  | 'totalInvested'
  | 'totalValue'
  | 'profit'
  | 'profitPct'
  | 'xirr';

type SortDir = 'asc' | 'desc';

type EnrichedHolding = HoldingRow & {
  totalValue: number;
  profit: number;
  profitPct: number;
};

function enrich(h: HoldingRow, effectiveRate: number = 1): EnrichedHolding {
  const currentPrice = h.currentPrice * effectiveRate;
  const totalInvested = h.totalInvested * effectiveRate;
  const totalValue = h.quantity * currentPrice;
  const profit = totalValue - totalInvested;
  const profitPct = totalInvested > 0 ? (profit / totalInvested) * 100 : 0;
  return { ...h, currentPrice, totalInvested, totalValue, profit, profitPct };
}

function compare(a: EnrichedHolding, b: EnrichedHolding, key: SortKey): number {
  switch (key) {
    case 'asset':
      return a.symbol.localeCompare(b.symbol);
    case 'quantity':
      return a.quantity - b.quantity;
    case 'avgBuyPrice':
      return a.avgBuyPrice - b.avgBuyPrice;
    case 'currentPrice':
      return a.currentPrice - b.currentPrice;
    case 'totalInvested':
      return a.totalInvested - b.totalInvested;
    case 'totalValue':
      return a.totalValue - b.totalValue;
    case 'profit':
      return a.profit - b.profit;
    case 'profitPct':
      return a.profitPct - b.profitPct;
    case 'xirr':
      return (a.xirr ?? -999) - (b.xirr ?? -999);
    default:
      return 0;
  }
}

export function HoldingsTable({ holdings, showInvestedValue, currency = 'INR', effectiveRate = 1 }: { holdings: HoldingRow[], showInvestedValue?: boolean, currency?: 'USD' | 'INR', effectiveRate?: number }) {
  const [sortKey, setSortKey] = useState<SortKey>('totalValue');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [query, setQuery] = useState('');

  const displayFormat = currency === 'USD' ? formatUSD : formatINR;

  const enriched = useMemo(() => holdings.map(h => enrich(h, effectiveRate)), [holdings, effectiveRate]);

  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase();
    if (!q) return enriched;
    return enriched.filter(
      (h) =>
        h.symbol.toUpperCase().includes(q) ||
        h.symbolAliases.some((a) => a.toUpperCase().includes(q))
    );
  }, [enriched, query]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      const cmp = compare(a, b, sortKey);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [filtered, sortKey, sortDir]);

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, h) => ({
        value: acc.value + h.totalValue,
        invested: acc.invested + h.totalInvested,
        profit: acc.profit + h.profit,
      }),
      { value: 0, invested: 0, profit: 0 }
    );
  }, [filtered]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'asset' ? 'asc' : 'desc');
    }
  }

  function SortIcon({ column }: { column: SortKey }) {
    if (sortKey !== column) {
      return <ArrowUpDown className="h-3.5 w-3.5 text-slate-300" />;
    }
    return sortDir === 'asc' ? (
      <ArrowUp className="h-3.5 w-3.5 text-teal-600" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5 text-teal-600" />
    );
  }

  const columns = useMemo(() => {
    const cols: { key: SortKey; label: string; align?: 'right' }[] = [
      { key: 'asset', label: 'Symbol' },
      { key: 'quantity', label: 'Qty', align: 'right' },
      { key: 'avgBuyPrice', label: 'Avg cost', align: 'right' },
      { key: 'currentPrice', label: 'Last price', align: 'right' },
    ];
    if (showInvestedValue) {
      cols.push({ key: 'totalInvested', label: 'Invested', align: 'right' });
    }
    cols.push(
      { key: 'totalValue', label: 'Value', align: 'right' },
      { key: 'profit', label: 'P&L', align: 'right' },
      { key: 'xirr', label: 'XIRR', align: 'right' }
    );
    return cols;
  }, [showInvestedValue]);

  if (holdings.length === 0) {
    return (
      <EmptyState
        icon={<Layers className="h-6 w-6" />}
        title="No holdings"
        description="Import your Zerodha tradebooks to build your portfolio."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted)]" />
          <input
            type="search"
            placeholder="Search symbol…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-10 w-full rounded-lg border border-[var(--color-border-strong)] bg-white pl-9 pr-3 text-sm shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
          />
        </div>
        <div className="flex flex-wrap gap-4 text-sm tabular-nums">
          <span className="text-[var(--color-muted)]">
            Value <strong className="text-[var(--color-foreground)]">{displayFormat(totals.value)}</strong>
          </span>
          <span className="text-[var(--color-muted)]">
            P&L{' '}
            <strong className={totals.profit >= 0 ? 'text-success' : 'text-danger'}>
              {totals.profit >= 0 ? '+' : ''}
              {displayFormat(totals.profit)}
            </strong>
          </span>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-white shadow-[var(--shadow-sm)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-slate-50/80">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={`px-4 py-3 font-medium text-[var(--color-muted)] ${col.align === 'right' ? 'text-right' : ''}`}
                  >
                    <button
                      type="button"
                      onClick={() => handleSort(col.key)}
                      className={`inline-flex items-center gap-1 hover:text-[var(--color-foreground)] ${col.align === 'right' ? 'ml-auto' : ''}`}
                    >
                      {col.label}
                      <SortIcon column={col.key} />
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-12 text-center text-[var(--color-muted)]">
                    No symbols match &quot;{query}&quot;
                  </td>
                </tr>
              ) : (
                sorted.map((holding) => {
                  const isPositive = holding.profit >= 0;
                  const label = formatAssetLabel(
                    holding.symbol,
                    holding.symbolAliases,
                    holding.isin
                  );

                  return (
                    <tr
                      key={holding.assetId}
                      className="transition-colors hover:bg-slate-50/60"
                    >
                      <td className="px-4 py-3.5">
                        <div className="font-medium text-[var(--color-foreground)]">
                          {label.title}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[var(--color-muted)]">
                          <span className="truncate max-w-[200px]">{label.subtitle}</span>
                          {holding.liveLtp && (
                            <Badge tone="accent">Live LTP</Badge>
                          )}
                          {holding.brokerAdjusted && (
                            <Badge tone="warning">Broker qty</Badge>
                          )}
                          <div className="ml-2 flex items-center">
                            <span className="text-[10px] text-slate-400 mr-1 uppercase tracking-wider">vs</span>
                            <span className="text-xs text-slate-500 font-medium border-b border-dashed border-slate-300">
                              {holding.benchmarkId === 'smallcap250' ? 'Smallcap 250' : 
                               holding.benchmarkId === 'midcap150' ? 'Midcap 150' : 
                               holding.benchmarkId === 'nifty500' ? 'Nifty 500' : 
                               'Nifty 50'}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums">
                        {formatQuantity(holding.quantity)}
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums text-[var(--color-muted)]">
                        {displayFormat(holding.avgBuyPrice * effectiveRate)}
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums">
                        {displayFormat(holding.currentPrice)}
                      </td>
                      {showInvestedValue && (
                        <td className="px-4 py-3.5 text-right font-medium tabular-nums text-[var(--color-muted)]">
                          {displayFormat(holding.totalInvested)}
                        </td>
                      )}
                      <td className="px-4 py-3.5 text-right font-medium tabular-nums">
                        {displayFormat(holding.totalValue)}
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums">
                        <div
                          className={
                            isPositive ? 'font-medium text-success' : 'font-medium text-danger'
                          }
                        >
                          {isPositive ? '+' : ''}
                          {displayFormat(holding.profit)}
                        </div>
                        <div
                          className={`text-xs ${isPositive ? 'text-success' : 'text-danger'}`}
                        >
                          {isPositive ? '+' : ''}
                          {holding.profitPct.toFixed(2)}%
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums">
                        <div
                          className={
                            holding.xirr && holding.xirr >= 0 ? 'font-medium text-[var(--color-foreground)]' : 'font-medium text-danger'
                          }
                        >
                          {holding.xirr != null ? `${(holding.xirr * 100).toFixed(1)}%` : '—'}
                        </div>
                        {holding.benchmarkXirr != null && holding.xirr != null && (
                          <div
                            className={`text-[10px] mt-1 flex flex-col items-end gap-0.5 ${
                              holding.xirr >= holding.benchmarkXirr
                                ? 'text-teal-600'
                                : 'text-slate-400'
                            }`}
                            title="Benchmark XIRR for same cash flows"
                          >
                            <span>vs {holding.benchmarkId === 'smallcap250' ? 'Smallcap 250' : 
                               holding.benchmarkId === 'midcap150' ? 'Midcap 150' : 
                               holding.benchmarkId === 'nifty500' ? 'Nifty 500' : 
                               'Nifty 50'}: {(holding.benchmarkXirr * 100).toFixed(1)}%</span>
                            <span className="font-medium bg-slate-50/50 px-1 py-0.5 rounded">
                               {holding.xirr >= holding.benchmarkXirr ? '+' : ''}{((holding.xirr - holding.benchmarkXirr) * 100).toFixed(1)}% Alpha
                            </span>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
