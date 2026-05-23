export const dynamic = 'force-dynamic';

import { Alert } from '@/components/ui/Alert';
import { DashboardView } from '@/components/DashboardView';
import { DangerZone } from '@/components/DangerZone';
import {
  getPortfolioSummaryForUser,
  formatMonthLabel,
} from '@/lib/portfolio-data';
import { requirePortfolioData } from '@/lib/redirects';

export default async function Dashboard() {
  const userId = await requirePortfolioData();
  const summary = await getPortfolioSummaryForUser(userId);
  const errors = summary.doctorWarnings.filter((w) => w.level === 'error');
  const warns = summary.doctorWarnings.filter((w) => w.level === 'warn');

  const chartPerformance = summary.performanceChartData.map((p) => ({
    date: formatMonthLabel(p.date),
    value: p.value,
    invested: p.invested,
    nifty50: p.nifty50,
    nifty500: p.nifty500,
    midcap150: p.midcap150,
    smallcap250: p.smallcap250,
  }));

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
          {summary.doctorWarnings.length > 10 && (
            <p className="mt-2 text-xs opacity-80">
              +{summary.doctorWarnings.length - 10} more — review on Holdings
            </p>
          )}
        </Alert>
      )}

      <DashboardView
        initial={{
          holdings: summary.holdings,
          totalValue: summary.totalValue,
          totalInvested: summary.totalInvested,
          totalProfit: summary.totalProfit,
          profitPercentage: summary.profitPercentage,
          allocationData: summary.allocationData,
          performanceData: chartPerformance,
          xirr: summary.xirr,
          ltpFetchedAt: summary.ltpFetchedAt,
          ltpFailedSymbols: summary.ltpFailedSymbols,
        }}
      />

      <DangerZone />
    </div>
  );
}
