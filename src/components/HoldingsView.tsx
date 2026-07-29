'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Upload } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { HoldingsTable } from '@/components/HoldingsTable';
import { RefreshLtpButton } from '@/components/RefreshLtpButton';
import { UploadForm } from '@/components/UploadForm';
import type { PortfolioSummary } from '@/lib/portfolio';

function applyLtpToRows<T extends { symbol: string; currentPrice: number }>(
  rows: T[],
  prices: Record<string, number>
): T[] {
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
  initialOverall,
  initialStocks,
  initialMf,
  initialUsStocks,
}: {
  initialOverall: PortfolioSummary & { ltpFetchedAt: string | null; ltpFailedSymbols: string[]; usdInr?: number };
  initialStocks: PortfolioSummary & { ltpFetchedAt: string | null; ltpFailedSymbols: string[]; usdInr?: number };
  initialMf: PortfolioSummary & { ltpFetchedAt: string | null; ltpFailedSymbols: string[]; usdInr?: number };
  initialUsStocks: PortfolioSummary & { ltpFetchedAt: string | null; ltpFailedSymbols: string[]; usdInr?: number };
}) {
  const [activeTab, setActiveTab] = useState<'overall' | 'stocks' | 'mf' | 'us_stocks'>('overall');

  const [overallHoldings, setOverallHoldings] = useState(initialOverall.holdings);
  const [stockHoldings, setStockHoldings] = useState(initialStocks.holdings);
  const [mfHoldings, setMfHoldings] = useState(initialMf.holdings);
  const [usStockHoldings, setUsStockHoldings] = useState(initialUsStocks.holdings);

  const [ltpFetchedAt, setLtpFetchedAt] = useState(initialOverall.ltpFetchedAt);
  const [failedCount, setFailedCount] = useState(initialOverall.ltpFailedSymbols.length);
  const [usdInrRate, setUsdInrRate] = useState(initialOverall.usdInr);

  const [currencyDisplay, setCurrencyDisplay] = useState<'USD' | 'INR'>('USD');

  useEffect(() => {
    setOverallHoldings(initialOverall.holdings);
    setStockHoldings(initialStocks.holdings);
    setMfHoldings(initialMf.holdings);
    setUsStockHoldings(initialUsStocks.holdings);
    setLtpFetchedAt(initialOverall.ltpFetchedAt);
    setFailedCount(initialOverall.ltpFailedSymbols.length);
    setUsdInrRate(initialOverall.usdInr);
  }, [initialOverall, initialStocks, initialMf, initialUsStocks]);

  const currentHoldings =
    activeTab === 'overall' ? overallHoldings : activeTab === 'stocks' ? stockHoldings : activeTab === 'mf' ? mfHoldings : usStockHoldings;

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
                setOverallHoldings((prev) => applyLtpToRows(prev, result.prices));
                setStockHoldings((prev) => applyLtpToRows(prev, result.prices));
                setMfHoldings((prev) => applyLtpToRows(prev, result.prices));
                setUsStockHoldings((prev) => applyLtpToRows(prev, result.prices));
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
              Import
            </Link>
          </div>
        }
      />

      <div className="flex space-x-1 rounded-lg bg-slate-100 p-1 w-fit">
        <button
          onClick={() => setActiveTab('overall')}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
            activeTab === 'overall'
              ? 'bg-white text-slate-900 shadow'
              : 'text-slate-600 hover:bg-slate-200 hover:text-slate-900'
          }`}
        >
          Overall
        </button>
        <button
          onClick={() => setActiveTab('stocks')}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
            activeTab === 'stocks'
              ? 'bg-white text-slate-900 shadow'
              : 'text-slate-600 hover:bg-slate-200 hover:text-slate-900'
          }`}
        >
          Stocks
        </button>
        <button
          onClick={() => setActiveTab('mf')}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
            activeTab === 'mf'
              ? 'bg-white text-slate-900 shadow'
              : 'text-slate-600 hover:bg-slate-200 hover:text-slate-900'
          }`}
        >
          Mutual Funds
        </button>
        <button
          onClick={() => setActiveTab('us_stocks')}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
            activeTab === 'us_stocks'
              ? 'bg-white text-slate-900 shadow'
              : 'text-slate-600 hover:bg-slate-200 hover:text-slate-900'
          }`}
        >
          US Stocks
        </button>
      </div>

      {activeTab === 'us_stocks' && (
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
        <Card padding="none">
          <div className="border-b border-[var(--color-border)] px-5 py-4">
            <CardHeader
              title="Positions"
              description={`${currentHoldings.length} open ${currentHoldings.length === 1 ? 'position' : 'positions'}`}
            />
          </div>
          <div className="p-5">
            <HoldingsTable
              holdings={currentHoldings}
              showInvestedValue={activeTab === 'mf' || activeTab === 'overall'}
              currency={activeTab === 'us_stocks' && currencyDisplay === 'USD' ? 'USD' : 'INR'}
              effectiveRate={activeTab === 'us_stocks' && currencyDisplay === 'INR' ? (usdInrRate ?? 83.5) : 1}
            />
          </div>
        </Card>
      )}
    </div>
  );
}
