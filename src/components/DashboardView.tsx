'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Wallet, TrendingUp, Layers, Upload, Percent } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { AllocationChart, PerformanceChart, type PerformanceChartRow } from '@/components/DashboardCharts';
import { RefreshLtpButton } from '@/components/RefreshLtpButton';
import { DashboardPositions } from '@/components/DashboardPositions';
import { formatINR, formatPercent } from '@/lib/format';
import { applyPricesToHoldings, totalsFromHoldings } from '@/lib/holding-prices';
import type { Holding } from '@/lib/portfolio';

type DashboardInitial = {
  holdings: Holding[];
  totalValue: number;
  totalInvested: number;
  totalProfit: number;
  profitPercentage: number;
  allocationData: { name: string; value: number }[];
  performanceData: PerformanceChartRow[];
  xirr: number | null;
  ltpFetchedAt: string | null;
  ltpFailedSymbols: string[];
};

export function DashboardView({ initial }: { initial: DashboardInitial }) {
  const [holdings, setHoldings] = useState(initial.holdings);
  const [ltpFetchedAt, setLtpFetchedAt] = useState(initial.ltpFetchedAt);
  const [failedCount, setFailedCount] = useState(initial.ltpFailedSymbols.length);

  const totals = totalsFromHoldings(holdings);
  const isPositive = totals.totalProfit >= 0;

  const xirrPct =
    initial.xirr != null && Number.isFinite(initial.xirr)
      ? initial.xirr * 100
      : null;
  const xirrPositive = xirrPct != null && xirrPct >= 0;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="FIFO cost basis from tradebooks. XIRR uses your trades and current value; chart compares the same cash flows against indices."
        actions={
          <div className="flex flex-wrap items-end gap-3">
            <RefreshLtpButton
              lastFetchedAt={ltpFetchedAt}
              failedCount={failedCount}
              onSuccess={(result) => {
                setHoldings((prev) => applyPricesToHoldings(prev, result.prices));
                setLtpFetchedAt(result.fetchedAt);
                setFailedCount(result.failed.length);
              }}
            />
            <Link
              href="/upload"
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--color-border-strong)] bg-white px-4 text-sm font-medium shadow-sm transition-colors hover:bg-slate-50"
            >
              <Upload className="h-4 w-4" />
              Import data
            </Link>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        <StatCard
          label="Invested"
          value={formatINR(totals.totalInvested)}
          subValue="FIFO cost basis"
          icon={<Wallet className="h-5 w-5" />}
        />
        <StatCard
          label="Current value"
          value={formatINR(totals.totalValue)}
          subValue={ltpFetchedAt ? 'Based on live LTP' : 'Qty × last trade price'}
          icon={<Wallet className="h-5 w-5" />}
        />
        <StatCard
          label="Unrealized P&L"
          value={`${isPositive ? '+' : ''}${formatINR(totals.totalProfit)}`}
          subValue={`${isPositive ? '+' : ''}${totals.profitPercentage.toFixed(2)}%`}
          trend={isPositive ? 'up' : 'down'}
          icon={<TrendingUp className="h-5 w-5" />}
        />
        <StatCard
          label="XIRR"
          value={xirrPct != null ? formatPercent(xirrPct) : '—'}
          subValue={
            xirrPct != null
              ? 'Annualized (trades + current value)'
              : 'Need buys, sells, and current value'
          }
          trend={xirrPct != null ? (xirrPositive ? 'up' : 'down') : 'neutral'}
          icon={<Percent className="h-5 w-5" />}
        />
        <StatCard
          label="Holdings"
          value={String(holdings.length)}
          subValue={`${totals.allocationData.length} with market value`}
          icon={<Layers className="h-5 w-5" />}
        />
      </div>

      <DashboardPositions holdings={holdings} />

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <Card className="min-w-0 overflow-hidden">
          <CardHeader title="Allocation" description="By current market value" />
          <AllocationChart data={totals.allocationData} />
        </Card>
        <Card className="min-w-0 overflow-hidden lg:col-span-2">
          <CardHeader
            title="Performance"
            description="Month-end value vs same cash flows in Nifty indices (Yahoo)"
          />
          <PerformanceChart data={initial.performanceData} />
        </Card>
      </div>
    </div>
  );
}
