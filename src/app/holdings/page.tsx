export const dynamic = 'force-dynamic';

import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { HoldingsView } from '@/components/HoldingsView';
import { getPortfolioSummaryForUser, getRecentTransactions } from '@/lib/portfolio-data';
import { formatINR, formatQuantity } from '@/lib/format';
import { requirePortfolioData } from '@/lib/redirects';
import { DangerZone } from '@/components/DangerZone';

function txTypeBadge(type: string, splitRatio: number | null) {
  if (type === 'SPLIT' && splitRatio) {
    const label =
      splitRatio >= 1 ? `Split 1:${splitRatio}` : `Split ${Math.round(1 / splitRatio)}:1`;
    return <Badge tone="accent">{label}</Badge>;
  }
  if (type === 'BUY' || type === 'BONUS' || type === 'CA_BUY') {
    return <Badge tone="success">{type === 'CA_BUY' ? 'Demat' : type}</Badge>;
  }
  if (type === 'SELL') return <Badge tone="danger">SELL</Badge>;
  return <Badge>{type}</Badge>;
}

export default async function HoldingsPage() {
  const userId = await requirePortfolioData();
  const overallSummary = await getPortfolioSummaryForUser(userId, undefined, undefined);
  const stockSummary = await getPortfolioSummaryForUser(userId, undefined, 'STOCK');
  const mfSummary = await getPortfolioSummaryForUser(userId, [], 'MUTUAL_FUND');
  const usStockSummary = await getPortfolioSummaryForUser(userId, undefined, 'US_STOCK');
  const transactions = await getRecentTransactions(userId);

  return (
    <div className="space-y-8">
      <HoldingsView
        initialOverall={overallSummary}
        initialStocks={stockSummary}
        initialMf={mfSummary}
        initialUsStocks={usStockSummary}
      />

      <Card padding="none">
        <div className="border-b border-[var(--color-border)] px-5 py-4">
          <CardHeader
            title="Recent transactions"
            description="Last 100 trades from your import"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-slate-50/80">
                <th className="px-4 py-3 font-medium text-[var(--color-muted)]">Date</th>
                <th className="px-4 py-3 font-medium text-[var(--color-muted)]">Type</th>
                <th className="px-4 py-3 font-medium text-[var(--color-muted)]">Symbol</th>
                <th className="px-4 py-3 font-medium text-[var(--color-muted)]">Exchange</th>
                <th className="px-4 py-3 text-right font-medium text-[var(--color-muted)]">
                  Qty
                </th>
                <th className="px-4 py-3 text-right font-medium text-[var(--color-muted)]">
                  Price
                </th>
                <th className="px-4 py-3 text-right font-medium text-[var(--color-muted)]">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {transactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-slate-50/60">
                  <td className="whitespace-nowrap px-4 py-3 text-[var(--color-muted)]">
                    {new Date(tx.date).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="px-4 py-3">
                    {txTypeBadge(tx.type, tx.splitRatio)}
                  </td>
                  <td className="px-4 py-3 font-medium">{tx.asset.symbol}</td>
                  <td className="px-4 py-3 text-[var(--color-muted)]">
                    {tx.exchange ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatQuantity(tx.quantity)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatINR(tx.price)}
                  </td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">
                    {formatINR(tx.quantity * tx.price)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <DangerZone />
    </div>
  );
}
