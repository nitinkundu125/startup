import { prisma } from '@/lib/prisma';
import {
  fetchLtpsForSymbols,
  fetchUsLtpsForSymbols,
  fetchUsYahooLtp,
  parseLtpSnapshot,
  type LtpSnapshot,
} from '@/lib/market-quotes';
import type { Holding } from '@/lib/portfolio';
import { fetchAmfiNavs } from '@/lib/amfi-nav';

export async function getLtpSnapshotForUser(userId: string): Promise<LtpSnapshot | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { ltpSnapshot: true },
  });
  return parseLtpSnapshot(user?.ltpSnapshot);
}

export async function refreshLtpsForUser(
  userId: string,
  stockSymbols: string[],
  mfAssets: { symbol: string; isin: string | null }[],
  usStockSymbols: string[]
): Promise<LtpSnapshot> {
  const prices: Record<string, number> = {};
  const failed: string[] = [];
  let usdInr: number | undefined;

  // 1. Fetch Indian Stocks
  if (stockSymbols.length > 0) {
    const stockResult = await fetchLtpsForSymbols(stockSymbols);
    Object.assign(prices, stockResult.prices);
    failed.push(...stockResult.failed);
  }

  // 2. Fetch Mutual Funds
  if (mfAssets.length > 0) {
    try {
      const { isinToNav, nameToNav } = await fetchAmfiNavs();
      for (const asset of mfAssets) {
        let nav: number | undefined;
        if (asset.isin) nav = isinToNav.get(asset.isin.toUpperCase());
        if (nav == null) nav = nameToNav.get(asset.symbol.toUpperCase());

        if (nav != null) {
          prices[asset.symbol] = nav;
        } else {
          failed.push(asset.symbol);
        }
      }
    } catch (e) {
      console.error('Failed to fetch MF NAVs', e);
      failed.push(...mfAssets.map((a) => a.symbol));
    }
  }

  // 3. Fetch US Stocks
  if (usStockSymbols.length > 0) {
    const usResult = await fetchUsLtpsForSymbols(usStockSymbols);
    Object.assign(prices, usResult.prices);
    failed.push(...usResult.failed);
    
    const rate = await fetchUsYahooLtp('INR=X');
    if (rate) usdInr = rate;
  }

  const snapshot: LtpSnapshot = {
    fetchedAt: new Date().toISOString(),
    prices,
    ...(failed.length > 0 ? { failed } : {}),
    ...(usdInr ? { usdInr } : {}),
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
  snapshot: LtpSnapshot | null,
  usdInrRate?: number
): { holdings: Holding[]; ltpFetchedAt: string | null } {
  if (!snapshot?.prices || Object.keys(snapshot.prices).length === 0) {
    return { holdings, ltpFetchedAt: null };
  }

  const priceMap = new Map(
    Object.entries(snapshot.prices).map(([k, v]) => [k.toUpperCase(), v])
  );

  const updated = holdings.map((h) => {
    let ltp = priceMap.get(h.symbol.toUpperCase());
    if (ltp == null) return h;
    
    if (h.assetClass === 'US_STOCK' && usdInrRate != null) {
      ltp = ltp * usdInrRate;
    }

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
