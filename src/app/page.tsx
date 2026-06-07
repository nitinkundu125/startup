export const dynamic = 'force-dynamic';

import { Alert } from '@/components/ui/Alert';
import { DashboardView } from '@/components/DashboardView';
import { DangerZone } from '@/components/DangerZone';
import {
  getPortfolioSummaryForUser,
  formatMonthLabel,
} from '@/lib/portfolio-data';
import { requireAuth } from '@/lib/redirects';

export default async function Dashboard() {
  const userId = await requireAuth();
  
  const overallSummary = await getPortfolioSummaryForUser(userId, undefined, undefined);
  const stockSummary = await getPortfolioSummaryForUser(userId, undefined, 'STOCK');
  const mfSummary = await getPortfolioSummaryForUser(userId, [], 'MUTUAL_FUND');
  const usStockSummary = await getPortfolioSummaryForUser(userId, undefined, 'US_STOCK');
  
  const errors = overallSummary.doctorWarnings.filter((w) => w.level === 'error');
  const warns = overallSummary.doctorWarnings.filter((w) => w.level === 'warn');

  const formatPerformance = (summary: any) =>
    summary.performanceChartData.map((p: any) => ({
      date: formatMonthLabel(p.date),
      value: p.value,
      invested: p.invested,
      nifty50: p.nifty50,
      nifty500: p.nifty500,
      midcap150: p.midcap150,
      smallcap250: p.smallcap250,
    }));

  const overallPerformance = formatPerformance(overallSummary);
  const stockPerformance = formatPerformance(stockSummary);
  const mfPerformance = formatPerformance(mfSummary);
  const usStockPerformance = formatPerformance(usStockSummary);

  return (
    <div className="space-y-8">
      {(errors.length > 0 || warns.length > 0) && (
        <Alert tone={errors.length > 0 ? 'error' : 'warning'} title="Data quality">
          <ul className="mt-2 list-inside list-disc space-y-1">
            {errors.slice(0, 4).map((w, i) => (
              <li key={`e-${i}`}>
                {w.symbol ? <strong>{w.symbol}: </strong> : null}
                {w.message}
              </li>
            ))}
            {warns.slice(0, 6).map((w, i) => (
              <li key={`w-${i}`}>
                {w.symbol ? <strong>{w.symbol}: </strong> : null}
                {w.message}
              </li>
            ))}
          </ul>
        </Alert>
      )}

      <DashboardView
        initialOverall={{
          holdings: overallSummary.holdings,
          totalValue: overallSummary.totalValue,
          totalInvested: overallSummary.totalInvested,
          totalProfit: overallSummary.totalProfit,
          profitPercentage: overallSummary.profitPercentage,
          allocationData: overallSummary.allocationData,
          performanceData: overallPerformance,
          xirr: overallSummary.xirr,
          ltpFetchedAt: overallSummary.ltpFetchedAt,
          ltpFailedSymbols: overallSummary.ltpFailedSymbols,
          usdInr: overallSummary.usdInr,
        }}
        initialStocks={{
          holdings: stockSummary.holdings,
          totalValue: stockSummary.totalValue,
          totalInvested: stockSummary.totalInvested,
          totalProfit: stockSummary.totalProfit,
          profitPercentage: stockSummary.profitPercentage,
          allocationData: stockSummary.allocationData,
          performanceData: stockPerformance,
          xirr: stockSummary.xirr,
          ltpFetchedAt: stockSummary.ltpFetchedAt,
          ltpFailedSymbols: stockSummary.ltpFailedSymbols,
          usdInr: stockSummary.usdInr,
        }}
        initialMf={{
          holdings: mfSummary.holdings,
          totalValue: mfSummary.totalValue,
          totalInvested: mfSummary.totalInvested,
          totalProfit: mfSummary.totalProfit,
          profitPercentage: mfSummary.profitPercentage,
          allocationData: mfSummary.allocationData,
          performanceData: mfPerformance,
          xirr: mfSummary.xirr,
          ltpFetchedAt: mfSummary.ltpFetchedAt,
          ltpFailedSymbols: mfSummary.ltpFailedSymbols,
          usdInr: mfSummary.usdInr,
        }}
        initialUsStocks={{
          holdings: usStockSummary.holdings,
          totalValue: usStockSummary.totalValue,
          totalInvested: usStockSummary.totalInvested,
          totalProfit: usStockSummary.totalProfit,
          profitPercentage: usStockSummary.profitPercentage,
          allocationData: usStockSummary.allocationData,
          performanceData: usStockPerformance,
          xirr: usStockSummary.xirr,
          ltpFetchedAt: usStockSummary.ltpFetchedAt,
          ltpFailedSymbols: usStockSummary.ltpFailedSymbols,
          usdInr: usStockSummary.usdInr,
        }}
      />

      <DangerZone />
    </div>
  );
}
