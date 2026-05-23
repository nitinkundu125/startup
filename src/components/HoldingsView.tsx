'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Upload } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { HoldingsTable, type HoldingRow } from '@/components/HoldingsTable';
import { RefreshLtpButton } from '@/components/RefreshLtpButton';
function applyLtpToRows(
  rows: HoldingRow[],
  prices: Record<string, number>
): HoldingRow[] {
  const map = new Map(
    Object.entries(prices).map(([k, v]) => [k.toUpperCase(), v])
  );
  return rows.map((h) => {
    const ltp = map.get(h.symbol.toUpperCase());
    if (ltp == null) return h;
    return { ...h, currentPrice: ltp, liveLtp: true };
  });
}

export function HoldingsView({
  initialHoldings,
  initialLtpFetchedAt,
  initialFailedCount,
}: {
  initialHoldings: HoldingRow[];
  initialLtpFetchedAt: string | null;
  initialFailedCount: number;
}) {
  const [holdings, setHoldings] = useState(initialHoldings);
  const [ltpFetchedAt, setLtpFetchedAt] = useState(initialLtpFetchedAt);
  const [failedCount, setFailedCount] = useState(initialFailedCount);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Holdings"
        description="Sortable positions with FIFO cost. Refresh live prices for NSE LTP; upload holdings.csv to align quantity with Zerodha."
        actions={
          <div className="flex flex-wrap items-end gap-3">
            <RefreshLtpButton
              lastFetchedAt={ltpFetchedAt}
              failedCount={failedCount}
              onSuccess={(result) => {
                setHoldings((prev) => applyLtpToRows(prev, result.prices));
                setLtpFetchedAt(result.fetchedAt);
                setFailedCount(result.failed.length);
              }}
            />
            <Link
              href="/upload"
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--color-border-strong)] bg-white px-4 text-sm font-medium shadow-sm transition-colors hover:bg-slate-50"
            >
              <Upload className="h-4 w-4" />
              Import
            </Link>
          </div>
        }
      />

      <Card padding="none">
        <div className="border-b border-[var(--color-border)] px-5 py-4">
          <CardHeader
            title="Positions"
            description={`${holdings.length} open ${holdings.length === 1 ? 'position' : 'positions'}`}
          />
        </div>
        <div className="p-5">
          <HoldingsTable holdings={holdings} />
        </div>
      </Card>
    </div>
  );
}
