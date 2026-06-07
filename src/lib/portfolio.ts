import {
  emptyPosition,
  addLot,
  addBonus,
  sellLots,
  applySplit,
  applyDematReset,
  avgCost,
  marketValue,
  unrealizedPnl,
  type FifoPosition,
} from '@/lib/fifo';
import { BONUS_MAX_PRICE } from '@/lib/corporate-actions';

export type TxInput = {
  assetId: string;
  symbol: string;
  name: string;
  symbolAliases?: string[];
  isin?: string | null;
  type: string;
  quantity: number;
  price: number;
  splitRatio?: number | null;
  date: Date;
  currentPrice: number;
  tradeId?: string | null;
  assetClass: string;
  benchmarkId?: string | null;
};

export type Holding = {
  assetId: string;
  symbol: string;
  name: string;
  symbolAliases: string[];
  isin: string | null;
  quantity: number;
  currentPrice: number;
  avgBuyPrice: number;
  totalInvested: number;
  unrealizedPnl: number;
  dividends: number;
  /** Quantity/avg from Zerodha holdings.csv when tradebook disagrees */
  brokerAdjusted?: boolean;
  /** Price from live NSE/Yahoo fetch */
  liveLtp?: boolean;
  assetClass: string;
  benchmarkId?: string | null;
  xirr?: number | null;
  benchmarkXirr?: number | null;
};

export type PortfolioSummary = {
  holdings: Holding[];
  totalValue: number;
  totalInvested: number;
  totalProfit: number;
  profitPercentage: number;
  allocationData: { name: string; value: number }[];
  performanceData: { date: string; value: number; invested: number }[];
  monthlyCashFlows: { month: string; invested: number; withdrawn: number; net: number }[];
  totalDividends: number;
};

type AssetMeta = {
  symbol: string;
  name: string;
  symbolAliases: string[];
  isin: string | null;
  currentPrice: number;
  assetClass: string;
  benchmarkId?: string | null;
};

/** Update mark-to-market price from a trade or corporate action (same rules for every symbol). */
function updateMarkPrice(markPrice: number, tx: TxInput, qtyAfterTx: number): number {
  const u = tx.type.toUpperCase();

  if ((u === 'BUY' || u === 'SELL') && tx.price >= BONUS_MAX_PRICE) {
    return tx.price;
  }

  if (u === 'SPLIT' && tx.splitRatio && tx.splitRatio > 1 && markPrice > 0) {
    return markPrice / tx.splitRatio;
  }

  if (u === 'BONUS' && markPrice > 0 && tx.quantity > 0 && qtyAfterTx > tx.quantity) {
    const qtyBefore = qtyAfterTx - tx.quantity;
    return markPrice * (qtyBefore / qtyAfterTx);
  }

  return markPrice;
}

function applyTxFifo(position: FifoPosition, tx: TxInput): void {
  const txType = tx.type.toUpperCase();

  if (txType === 'DIVIDEND') return;

  if (txType === 'BUY') {
    addLot(position, tx.quantity, tx.price, tx.date);
    return;
  }

  if (txType === 'BONUS' || (txType === 'BUY' && tx.price < BONUS_MAX_PRICE)) {
    addBonus(position, tx.quantity, tx.date);
    return;
  }

  if (txType === 'DEMAT' || txType === 'CA_BUY') {
    const preserved = tx.quantity * tx.price;
    applyDematReset(position, tx.quantity, preserved, tx.date);
    return;
  }

  if (txType === 'SPLIT') {
    const ratio = tx.splitRatio ?? 1;
    if (ratio > 0 && Number.isFinite(ratio)) {
      applySplit(position, ratio);
    }
    return;
  }

  if (txType === 'SELL') {
    sellLots(position, tx.quantity);
  }
}

function holdingFromPosition(
  assetId: string,
  meta: AssetMeta,
  position: FifoPosition
): Holding | null {
  if (position.quantity <= 1e-8) return null;
  const last = meta.currentPrice;
  return {
    assetId,
    symbol: meta.symbol,
    name: meta.name,
    symbolAliases: meta.symbolAliases,
    isin: meta.isin,
    quantity: position.quantity,
    currentPrice: last,
    avgBuyPrice: avgCost(position),
    totalInvested: position.totalCost,
    unrealizedPnl: unrealizedPnl(position, last),
    dividends: 0, // will be overridden by the caller
    assetClass: meta.assetClass,
    benchmarkId: meta.benchmarkId,
  };
}

function snapshotFromPositions(
  positions: Map<string, FifoPosition>,
  meta: Map<string, AssetMeta>
): { value: number; invested: number } {
  let value = 0;
  let invested = 0;
  positions.forEach((pos, assetId) => {
    const m = meta.get(assetId);
    if (!m || pos.quantity <= 1e-8) return;
    value += marketValue(pos, m.currentPrice);
    invested += pos.totalCost;
  });
  return { value, invested };
}

export function buildPortfolioSummary(transactions: TxInput[]): PortfolioSummary {
  const sorted = [...transactions].sort((a, b) => {
    const t = a.date.getTime() - b.date.getTime();
    if (t !== 0) return t;
    const order: Record<string, number> = { DIVIDEND: 0, SPLIT: 1, BONUS: 2, DEMAT: 3, CA_BUY: 3, SELL: 4, BUY: 5 };
    const oa = order[a.type.toUpperCase()] ?? 99;
    const ob = order[b.type.toUpperCase()] ?? 99;
    return oa - ob;
  });

  const positions = new Map<string, FifoPosition>();
  const meta = new Map<string, AssetMeta>();
  const monthEnds = new Map<string, { value: number; invested: number }>();
  const dividendsByAsset = new Map<string, number>();

  for (const tx of sorted) {
    if (!positions.has(tx.assetId)) {
      positions.set(tx.assetId, emptyPosition());
      dividendsByAsset.set(tx.assetId, 0);
      meta.set(tx.assetId, {
        symbol: tx.symbol,
        name: tx.name,
        symbolAliases: tx.symbolAliases ?? [],
        isin: tx.isin ?? null,
        currentPrice: tx.currentPrice,
        assetClass: tx.assetClass,
        benchmarkId: tx.benchmarkId,
      });
    }

    const m = meta.get(tx.assetId)!;
    const pos = positions.get(tx.assetId)!;
    
    if (tx.type.toUpperCase() === 'DIVIDEND') {
      if (pos.quantity > 0 && tx.price > 0) {
        const earned = pos.quantity * tx.price;
        dividendsByAsset.set(tx.assetId, dividendsByAsset.get(tx.assetId)! + earned);
      }
    } else {
      applyTxFifo(pos, tx);
      m.currentPrice = updateMarkPrice(m.currentPrice, tx, pos.quantity);
    }

    const monthKey = `${tx.date.getFullYear()}-${String(tx.date.getMonth() + 1).padStart(2, '0')}`;
    monthEnds.set(monthKey, snapshotFromPositions(positions, meta));
  }

  const holdings: Holding[] = [];
  positions.forEach((pos, assetId) => {
    const m = meta.get(assetId)!;
    const h = holdingFromPosition(assetId, m, pos);
    if (h) {
      h.dividends = dividendsByAsset.get(assetId) ?? 0;
      holdings.push(h);
    }
  });

  const cashFlowsMap = new Map<string, { invested: number; withdrawn: number }>();
  for (const tx of sorted) {
    if (tx.quantity <= 0 || tx.price <= 0) continue;
    const u = tx.type.toUpperCase();
    if (u === 'BUY' || u === 'SELL') {
      const monthKey = `${tx.date.getFullYear()}-${String(tx.date.getMonth() + 1).padStart(2, '0')}`;
      const curr = cashFlowsMap.get(monthKey) || { invested: 0, withdrawn: 0 };
      if (u === 'BUY') {
        curr.invested += tx.quantity * tx.price;
      } else {
        curr.withdrawn += tx.quantity * tx.price;
      }
      cashFlowsMap.set(monthKey, curr);
    }
  }

  const monthlyCashFlows = Array.from(cashFlowsMap.entries())
    .map(([month, data]) => ({
      month,
      invested: data.invested,
      withdrawn: data.withdrawn,
      net: data.invested - data.withdrawn,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  holdings.sort((a, b) => b.quantity * b.currentPrice - a.quantity * a.currentPrice);

  const { value: totalValue, invested: totalInvested } = snapshotFromPositions(
    positions,
    meta
  );
  const totalProfit = totalValue - totalInvested;
  const profitPercentage =
    totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;

  const allocationData = holdings
    .map((h) => ({
      name: h.symbol,
      value: h.quantity * h.currentPrice,
    }))
    .sort((a, b) => b.value - a.value);

  const performanceData = Array.from(monthEnds.entries()).map(([date, snap]) => ({
    date,
    value: snap.value,
    invested: snap.invested,
  }));

  const totalDividends = Array.from(dividendsByAsset.values()).reduce((a, b) => a + b, 0);

  return {
    holdings,
    totalValue,
    totalInvested,
    totalProfit,
    totalDividends,
    profitPercentage,
    allocationData,
    performanceData,
    monthlyCashFlows,
  };
}
