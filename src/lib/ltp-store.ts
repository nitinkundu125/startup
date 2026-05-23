import { prisma } from '@/lib/prisma';
import {
  fetchLtpsForSymbols,
  parseLtpSnapshot,
  type LtpSnapshot,
} from '@/lib/market-quotes';
import type { Holding } from '@/lib/portfolio';

export async function getLtpSnapshotForUser(userId: string): Promise<LtpSnapshot | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { ltpSnapshot: true },
  });
  return parseLtpSnapshot(user?.ltpSnapshot);
}

export async function refreshLtpsForUser(
  userId: string,
  symbols: string[]
): Promise<LtpSnapshot> {
  const { prices, failed } = await fetchLtpsForSymbols(symbols);
  const snapshot: LtpSnapshot = {
    fetchedAt: new Date().toISOString(),
    prices,
    ...(failed.length > 0 ? { failed } : {}),
  };

  await prisma.user.update({
    where: { id: userId },
    data: { ltpSnapshot: JSON.stringify(snapshot) },
  });

  for (const [symbol, price] of Object.entries(prices)) {
    await prisma.asset.updateMany({
      where: { userId, symbol },
      data: { price },
    });
  }

  return snapshot;
}

export function applyLiveLtpToHoldings(
  holdings: Holding[],
  snapshot: LtpSnapshot | null
): { holdings: Holding[]; ltpFetchedAt: string | null } {
  if (!snapshot?.prices || Object.keys(snapshot.prices).length === 0) {
    return { holdings, ltpFetchedAt: null };
  }

  const priceMap = new Map(
    Object.entries(snapshot.prices).map(([k, v]) => [k.toUpperCase(), v])
  );

  const updated = holdings.map((h) => {
    const ltp = priceMap.get(h.symbol.toUpperCase());
    if (ltp == null) return h;
    const totalValue = h.quantity * ltp;
    return {
      ...h,
      currentPrice: ltp,
      unrealizedPnl: totalValue - h.totalInvested,
      liveLtp: true,
    };
  });

  return { holdings: updated, ltpFetchedAt: snapshot.fetchedAt };
}

export async function clearLtpSnapshot(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { ltpSnapshot: null },
  });
}
