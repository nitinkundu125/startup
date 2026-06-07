'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Wallet, TrendingUp, Layers, Upload, Percent } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { AllocationChart, PerformanceChart, CashFlowChart, type PerformanceChartRow } from '@/components/DashboardCharts';
import { RefreshLtpButton } from '@/components/RefreshLtpButton';
import { DashboardPositions } from '@/components/DashboardPositions';
import { formatINR, formatUSD, formatPercent } from '@/lib/format';
import { applyPricesToHoldings, totalsFromHoldings } from '@/lib/holding-prices';
import type { Holding } from '@/lib/portfolio';
import { UploadForm } from '@/components/UploadForm';

type DashboardInitial = {
  holdings: Holding[];
  totalValue: number;
  totalInvested: number;
  totalProfit: number;
  profitPercentage: number;
  allocationData: { name: string; value: number }[];
  performanceData: PerformanceChartRow[];
  monthlyCashFlows: { month: string; invested: number; withdrawn: number; net: number }[];
  totalDividends: number;
  xirr: number | null;
  ltpFetchedAt: string | null;
  ltpFailedSymbols: string[];
  usdInr?: number;
};

export function DashboardView({ initialOverall, initialStocks, initialMf, initialUsStocks }: { initialOverall: DashboardInitial, initialStocks: DashboardInitial, initialMf: DashboardInitial, initialUsStocks: DashboardInitial }) {
  const [activeTab, setActiveTab] = useState<'overall' | 'stocks' | 'mf' | 'us_stocks'>('overall');
  
  const [overallHoldings, setOverallHoldings] = useState(initialOverall.holdings);
  const [stockHoldings, setStockHoldings] = useState(initialStocks.holdings);
  const [mfHoldings, setMfHoldings] = useState(initialMf.holdings);
  const [usStockHoldings, setUsStockHoldings] = useState(initialUsStocks.holdings);
  
  const [ltpFetchedAt, setLtpFetchedAt] = useState(initialOverall.ltpFetchedAt);
  const [failedCount, setFailedCount] = useState(initialOverall.ltpFailedSymbols.length);
  const [usdInrRate, setUsdInrRate] = useState(initialOverall.usdInr);

  const [currencyDisplay, setCurrencyDisplay] = useState<'USD' | 'INR'>('USD');

  // Sync state when server props update (e.g., after router.refresh() from an import)
  useEffect(() => {
    setOverallHoldings(initialOverall.holdings);
    setStockHoldings(initialStocks.holdings);
    setMfHoldings(initialMf.holdings);
    setUsStockHoldings(initialUsStocks.holdings);
    setLtpFetchedAt(initialOverall.ltpFetchedAt);
    setFailedCount(initialOverall.ltpFailedSymbols.length);
    setUsdInrRate(initialOverall.usdInr);
  }, [initialOverall, initialStocks, initialMf, initialUsStocks]);

  const currentHoldings = activeTab === 'overall' ? overallHoldings : activeTab === 'stocks' ? stockHoldings : activeTab === 'mf' ? mfHoldings : usStockHoldings;
  const currentInitial = activeTab === 'overall' ? initialOverall : activeTab === 'stocks' ? initialStocks : activeTab === 'mf' ? initialMf : initialUsStocks;

  const totals = totalsFromHoldings(currentHoldings);
  const isPositive = totals.totalProfit >= 0;

  const xirrPct =
    currentInitial.xirr != null && Number.isFinite(currentInitial.xirr)
      ? currentInitial.xirr * 100
      : null;
  const xirrPositive = xirrPct != null && xirrPct >= 0;

  const showCurrencyToggle = activeTab === 'us_stocks';
  const displayUsd = showCurrencyToggle && currencyDisplay === 'USD';
  const effectiveRate = showCurrencyToggle && !displayUsd ? (usdInrRate ?? 83.5) : 1;

  const displayFormat = displayUsd ? formatUSD : formatINR;

  const mfCategoryAllocation = useMemo(() => {
    if (activeTab !== 'mf') return [];
    const map = new Map<string, number>();
    for (const h of currentHoldings) {
      const name = h.name.toLowerCase();
      let category = 'Other / Debt';
      if (name.includes('small') && name.includes('cap')) category = 'Small Cap';
      else if (name.includes('mid') && name.includes('cap')) category = 'Mid Cap';
      else if (name.includes('flexi') || name.includes('multi')) category = 'Flexi / Multi Cap';
      else if (name.includes('large') && name.includes('mid')) category = 'Large & Mid Cap';
      else if (name.includes('index') || name.includes('nifty') || name.includes('sensex')) category = 'Index Funds';
      else if (name.includes('elss') || name.includes('tax')) category = 'ELSS (Tax Saving)';
      else if (name.includes('large') || name.includes('bluechip')) category = 'Large Cap / Bluechip';
      
      map.set(category, (map.get(category) || 0) + (h.quantity * h.currentPrice));
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [activeTab, currentHoldings]);

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
                setOverallHoldings((prev) => applyPricesToHoldings(prev, result.prices));
                setStockHoldings((prev) => applyPricesToHoldings(prev, result.prices));
                setMfHoldings((prev) => applyPricesToHoldings(prev, result.prices));
                setUsStockHoldings((prev) => applyPricesToHoldings(prev, result.prices));
                setLtpFetchedAt(result.fetchedAt);
                setFailedCount(result.failed.length);
                if (result.usdInr) setUsdInrRate(result.usdInr);
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

      <div className="flex space-x-1 rounded-lg bg-slate-100 p-1 w-fit">
        <button
          onClick={() => setActiveTab('overall')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
            activeTab === 'overall'
              ? 'bg-white text-blue-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          Overall
        </button>
        <button
          onClick={() => setActiveTab('stocks')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
            activeTab === 'stocks'
              ? 'bg-white text-blue-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          Stocks
        </button>
        <button
          onClick={() => setActiveTab('mf')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
            activeTab === 'mf'
              ? 'bg-white text-blue-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          Mutual Funds
        </button>
        <button
          onClick={() => setActiveTab('us_stocks')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
            activeTab === 'us_stocks'
              ? 'bg-white text-blue-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          US Stocks
        </button>
      </div>

      {showCurrencyToggle && (
        <div className="flex items-center gap-2 rounded-md border border-[var(--color-border)] bg-white p-1 shadow-sm w-fit">
          <button
            onClick={() => setCurrencyDisplay('USD')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-all ${
              currencyDisplay === 'USD' ? 'bg-teal-50 text-teal-700' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            USD
          </button>
          <button
            onClick={() => setCurrencyDisplay('INR')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-all ${
              currencyDisplay === 'INR' ? 'bg-teal-50 text-teal-700' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            INR
          </button>
        </div>
      )}

      {activeTab === 'stocks' && stockHoldings.length === 0 ? (
        <div className="mt-8">
          <UploadForm hasExistingData={false} importType="STOCK" />
        </div>
      ) : activeTab === 'mf' && mfHoldings.length === 0 ? (
        <div className="mt-8">
          <UploadForm hasExistingData={false} importType="MUTUAL_FUND" />
        </div>
      ) : activeTab === 'us_stocks' && usStockHoldings.length === 0 ? (
        <div className="mt-8">
          <UploadForm hasExistingData={false} importType="US_STOCK" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
            <StatCard
              label="Invested"
              value={displayFormat(totals.totalInvested * effectiveRate)}
              subValue="FIFO cost basis"
              icon={<Wallet className="h-5 w-5" />}
            />
            <StatCard
              label="Current value"
              value={displayFormat(totals.totalValue * effectiveRate)}
              subValue={ltpFetchedAt ? 'Based on live LTP' : 'Qty × last trade price'}
              icon={<Wallet className="h-5 w-5" />}
            />
            <StatCard
              label="Unrealized P&L"
              value={`${isPositive ? '+' : ''}${displayFormat(totals.totalProfit * effectiveRate)}`}
              subValue={`${isPositive ? '+' : ''}${totals.profitPercentage.toFixed(2)}%`}
              trend={isPositive ? 'up' : 'down'}
              icon={<TrendingUp className="h-5 w-5" />}
            />
            <StatCard
              label="Dividends"
              value={displayFormat((currentInitial.totalDividends || 0) * effectiveRate)}
              subValue="Cash earned from holding"
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
              value={String(currentHoldings.length)}
              subValue={`${totals.allocationData.length} with market value`}
              icon={<Layers className="h-5 w-5" />}
            />
          </div>

          <DashboardPositions holdings={currentHoldings} currency={displayUsd ? 'USD' : 'INR'} effectiveRate={effectiveRate} />

          <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
            <Card className="min-w-0 overflow-hidden">
              <CardHeader title={activeTab === 'mf' ? "Fund Allocation" : "Allocation"} description="By current market value" />
              <AllocationChart data={totals.allocationData.map(d => ({ ...d, value: d.value * effectiveRate }))} currency={displayUsd ? 'USD' : 'INR'} />
            </Card>
            {activeTab === 'mf' && (
              <Card className="min-w-0 overflow-hidden">
                <CardHeader title="Category Allocation" description="By mutual fund category" />
                <AllocationChart data={mfCategoryAllocation} currency="INR" />
              </Card>
            )}
            <Card className="min-w-0 overflow-hidden lg:col-span-2">
              <CardHeader
                title="Performance"
                description="Month-end value vs same cash flows in Nifty indices (Yahoo)"
              />
              <PerformanceChart data={currentInitial.performanceData} />
            </Card>
            {activeTab === 'mf' && (
              <Card className="min-w-0 overflow-hidden lg:col-span-2">
                <CardHeader
                  title="Monthly Cash Flows"
                  description="Total capital invested vs withdrawn per month"
                />
                <CashFlowChart data={currentInitial.monthlyCashFlows} />
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  );
}
