import { prisma } from '@/lib/prisma';
import { buildPortfolioSummary, type PortfolioSummary } from '@/lib/portfolio';
import { runPortfolioDoctor, type DoctorWarning } from '@/lib/doctor';
import { buildTxInputsFromDbTransactions } from '@/lib/tx-replay';
import {
  reconcileHoldings,
  type ReconcileMismatch,
} from '@/lib/holdings-reconcile';
import { normalizeUserAssets, purgeStoredSplitTransactions } from '@/lib/merge-assets';
import { getSessionUserId } from '@/lib/session';
import {
  applyLiveLtpToHoldings,
  getLtpSnapshotForUser,
} from '@/lib/ltp-store';
import { portfolioCashFlows } from '@/lib/cashflows';
import { xirr } from '@/lib/xirr';
import {
  buildBenchmarkMonthValues,
  type BenchmarkId,
} from '@/lib/benchmark';

export type PerformanceChartPoint = {
  date: string;
  value: number;
  invested: number;
  nifty50?: number;
  nifty500?: number;
  midcap150?: number;
  smallcap250?: number;
};

export type PortfolioWithDoctor = PortfolioSummary & {
  doctorWarnings: DoctorWarning[];
  holdingsMismatches: ReconcileMismatch[];
  ltpFetchedAt: string | null;
  ltpFailedSymbols: string[];
  xirr: number | null;
  performanceChartData: PerformanceChartPoint[];
};

async function getBrokerHoldingsForUser(
  userId: string
): Promise<{ symbol: string; quantity: number; avgCost: number; ltp?: number }[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { holdingsSnapshot: true },
  });
  if (!user?.holdingsSnapshot) return [];
  try {
    const parsed = JSON.parse(user.holdingsSnapshot);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function applyBrokerLtp(
  holdings: PortfolioSummary['holdings'],
  broker: { symbol: string; quantity: number; avgCost: number; ltp?: number }[]
): PortfolioSummary['holdings'] {
  const brokerMap = new Map(broker.map((b) => [b.symbol.toUpperCase(), b]));
  return holdings.map((h) => {
    const b = brokerMap.get(h.symbol.toUpperCase());
    if (!b?.ltp) return h;
    const totalValue = h.quantity * b.ltp;
    return {
      ...h,
      currentPrice: b.ltp,
      unrealizedPnl: totalValue - h.totalInvested,
    };
  });
}

function recalcPortfolioTotals(
  holdings: PortfolioSummary['holdings']
): Pick<PortfolioSummary, 'totalValue' | 'totalInvested' | 'totalProfit' | 'profitPercentage' | 'allocationData'> {
  let totalValue = 0;
  let totalInvested = 0;
  for (const h of holdings) {
    totalValue += h.quantity * h.currentPrice;
    totalInvested += h.totalInvested;
  }
  const totalProfit = totalValue - totalInvested;
  return {
    totalValue,
    totalInvested,
    totalProfit,
    profitPercentage:
      totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0,
    allocationData: holdings
      .map((h) => ({ name: h.symbol, value: h.quantity * h.currentPrice }))
      .sort((a, b) => b.value - a.value),
  };
}

export async function getPortfolioSummaryForUser(
  userId: string,
  brokerHoldings?: { symbol: string; quantity: number; avgCost: number; ltp?: number }[]
): Promise<PortfolioWithDoctor> {
  await purgeStoredSplitTransactions(userId);
  await normalizeUserAssets(userId);

  const broker =
    brokerHoldings ?? (await getBrokerHoldingsForUser(userId));

  const transactions = await prisma.transaction.findMany({
    where: { userId },
    include: { asset: true },
    orderBy: { date: 'asc' },
  });

  const txInputs = await buildTxInputsFromDbTransactions(transactions);

  let summary = buildPortfolioSummary(txInputs);
  const holdingsMismatches = broker.length
    ? reconcileHoldings(
        broker,
        summary.holdings.map((h) => ({
          symbol: h.symbol,
          quantity: h.quantity,
          avgBuyPrice: h.avgBuyPrice,
        }))
      )
    : [];

  if (broker.length > 0) {
    const brokerMap = new Map(broker.map((b) => [b.symbol.toUpperCase(), b]));
    const mismatchSyms = new Set(holdingsMismatches.map((m) => m.symbol.toUpperCase()));
    const holdingSyms = new Set(summary.holdings.map((h) => h.symbol.toUpperCase()));

    let adjustedHoldings = summary.holdings.map((h) => {
      const b = brokerMap.get(h.symbol.toUpperCase());
      if (!b || !mismatchSyms.has(h.symbol.toUpperCase())) return h;
      const totalInvested = b.quantity * b.avgCost;
      const price = b.ltp ?? h.currentPrice;
      return {
        ...h,
        quantity: b.quantity,
        avgBuyPrice: b.avgCost,
        currentPrice: price,
        totalInvested,
        unrealizedPnl: b.quantity * price - totalInvested,
        brokerAdjusted: true,
      };
    });

    adjustedHoldings = applyBrokerLtp(adjustedHoldings, broker);

    for (const b of broker) {
      if (!holdingSyms.has(b.symbol.toUpperCase()) && b.quantity > 0) {
        adjustedHoldings.push({
          assetId: `broker-${b.symbol}`,
          symbol: b.symbol,
          name: b.symbol,
          symbolAliases: [],
          isin: null,
          quantity: b.quantity,
          currentPrice: b.avgCost,
          avgBuyPrice: b.avgCost,
          totalInvested: b.quantity * b.avgCost,
          unrealizedPnl: 0,
          brokerAdjusted: true,
        });
      }
    }

    summary = {
      ...summary,
      holdings: adjustedHoldings,
      ...recalcPortfolioTotals(adjustedHoldings),
    };
  } else if (broker.some((b) => b.ltp)) {
    const withLtp = applyBrokerLtp(summary.holdings, broker);
    summary = { ...summary, holdings: withLtp, ...recalcPortfolioTotals(withLtp) };
  }

  const ltpSnapshot = await getLtpSnapshotForUser(userId);
  const { holdings: withLiveLtp, ltpFetchedAt } = applyLiveLtpToHoldings(
    summary.holdings,
    ltpSnapshot
  );
  if (ltpFetchedAt) {
    summary = {
      ...summary,
      holdings: withLiveLtp,
      ...recalcPortfolioTotals(withLiveLtp),
    };
  }

  const monthKeys = summary.performanceData.map((p) => p.date);
  const benchmarkMaps = await buildBenchmarkMonthValues(txInputs, monthKeys);

  const performanceChartData: PerformanceChartPoint[] = summary.performanceData.map(
    (p) => {
      const row: PerformanceChartPoint = {
        date: p.date,
        value: p.value,
        invested: p.invested,
      };
      for (const id of ['nifty50', 'nifty500', 'midcap150', 'smallcap250'] as BenchmarkId[]) {
        const v = benchmarkMaps[id]?.get(p.date);
        if (v != null && v > 0) row[id] = v;
      }
      return row;
    }
  );

  const cashFlows = portfolioCashFlows(txInputs, summary.totalValue);
  const xirrRate = xirr(cashFlows);

  const doctorWarnings = runPortfolioDoctor(txInputs);
  for (const m of holdingsMismatches) {
    if (Math.abs(m.diff) >= 0.5) {
      doctorWarnings.push({
        level: 'warn',
        code: 'BROKER_QTY_MISMATCH',
        symbol: m.symbol,
        message: `Tradebook shows ${m.computedQty} shares but broker holdings show ${m.brokerQty} (diff ${m.diff > 0 ? '+' : ''}${m.diff.toFixed(0)}). Display uses broker qty where holdings.csv was uploaded.`,
      });
    }
  }

  return {
    ...summary,
    doctorWarnings,
    holdingsMismatches,
    ltpFetchedAt,
    ltpFailedSymbols: ltpSnapshot?.failed ?? [],
    xirr: xirrRate,
    performanceChartData,
  };
}

export async function getPortfolioSummary(): Promise<PortfolioSummary | null> {
  const userId = await getSessionUserId();
  if (!userId) return null;
  return getPortfolioSummaryForUser(userId);
}

export async function getRecentTransactions(userId: string, limit = 100) {
  return prisma.transaction.findMany({
    where: { userId },
    include: { asset: true },
    orderBy: { date: 'desc' },
    take: limit,
  });
}

export async function getImportHistory(userId: string) {
  return prisma.importFile.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}

export function formatMonthLabel(ym: string): string {
  const [year, month] = ym.split('-');
  const d = new Date(Number(year), Number(month) - 1, 1);
  return d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
}
