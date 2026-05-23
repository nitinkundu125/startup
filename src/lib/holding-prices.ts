import type { Holding } from '@/lib/portfolio';

export function applyPricesToHoldings(
  holdings: Holding[],
  prices: Record<string, number>
): Holding[] {
  const map = new Map(
    Object.entries(prices).map(([k, v]) => [k.toUpperCase(), v])
  );

  return holdings.map((h) => {
    const ltp = map.get(h.symbol.toUpperCase());
    if (ltp == null) return h;
    const totalValue = h.quantity * ltp;
    return {
      ...h,
      currentPrice: ltp,
      unrealizedPnl: totalValue - h.totalInvested,
      liveLtp: true,
    };
  });
}

export function totalsFromHoldings(holdings: Holding[]) {
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
