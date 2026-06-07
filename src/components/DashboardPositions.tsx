'use client';

import Link from 'next/link';
import { formatINR, formatUSD, formatQuantity } from '@/lib/format';
import { Card, CardHeader } from '@/components/ui/Card';
import type { Holding } from '@/lib/portfolio';

export function DashboardPositions({ holdings, currency = 'INR', effectiveRate = 1 }: { holdings: Holding[]; currency?: 'INR' | 'USD'; effectiveRate?: number }) {
  const displayFormat = currency === 'USD' ? formatUSD : formatINR;

  const rows = [...holdings]
    .map((h) => ({
      ...h,
      currentPrice: h.currentPrice * effectiveRate,
      totalInvested: h.totalInvested * effectiveRate,
      currentValue: h.quantity * (h.currentPrice * effectiveRate),
      pnl: (h.quantity * (h.currentPrice * effectiveRate)) - (h.totalInvested * effectiveRate),
      pnlPct:
        h.totalInvested > 0
          ? ((h.quantity * h.currentPrice - h.totalInvested) / h.totalInvested) * 100
          : 0,
    }))
    .sort((a, b) => b.currentValue - a.currentValue);

  if (rows.length === 0) return null;

  return (
    <Card padding="none">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] px-5 py-4">
        <CardHeader
          title="Current value by position"
          description="Market value = quantity × last price (live LTP after refresh)"
        />
        <Link
          href="/holdings"
          className="text-sm font-medium text-teal-700 hover:text-teal-800"
        >
          View all holdings →
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-slate-50/80">
              <th className="px-4 py-3 font-medium text-[var(--color-muted)]">Symbol</th>
              <th className="px-4 py-3 text-right font-medium text-[var(--color-muted)]">
                Qty
              </th>
              <th className="px-4 py-3 text-right font-medium text-[var(--color-muted)]">
                Last price
              </th>
              <th className="px-4 py-3 text-right font-medium text-[var(--color-muted)]">
                Invested
              </th>
              <th className="px-4 py-3 text-right font-medium text-[var(--color-muted)]">
                Current value
              </th>
              <th className="px-4 py-3 text-right font-medium text-[var(--color-muted)]">
                P&L
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {rows.map((h) => {
              const up = h.pnl >= 0;
              return (
                <tr key={h.assetId} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3 font-medium">{h.symbol}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-[var(--color-muted)]">
                    {formatQuantity(h.quantity)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {displayFormat(h.currentPrice)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-[var(--color-muted)]">
                    {displayFormat(h.totalInvested)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">
                    {displayFormat(h.currentValue)}
                  </td>
                  <td
                    className={`px-4 py-3 text-right tabular-nums font-medium ${up ? 'text-success' : 'text-danger'}`}
                  >
                    {up ? '+' : ''}
                    {displayFormat(h.pnl)}
                    <span className="ml-1 text-xs font-normal opacity-90">
                      ({up ? '+' : ''}
                      {h.pnlPct.toFixed(1)}%)
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-[var(--color-border)] bg-slate-50/50 font-semibold">
              <td className="px-4 py-3" colSpan={3}>
                Totals
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {displayFormat(rows.reduce((s, h) => s + h.totalInvested, 0))}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {displayFormat(rows.reduce((s, h) => s + h.currentValue, 0))}
              </td>
              <td
                className={`px-4 py-3 text-right tabular-nums ${
                  rows.reduce((s, h) => s + h.pnl, 0) >= 0 ? 'text-success' : 'text-danger'
                }`}
              >
                {rows.reduce((s, h) => s + h.pnl, 0) >= 0 ? '+' : ''}
                {displayFormat(rows.reduce((s, h) => s + h.pnl, 0))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}
