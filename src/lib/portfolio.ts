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
  /** Quantity/avg from Zerodha holdings.csv when tradebook disagrees */
  brokerAdjusted?: boolean;
  /** Price from live NSE/Yahoo fetch */
  liveLtp?: boolean;
  assetClass: string;
};

export type PortfolioSummary = {
  holdings: Holding[];
  totalValue: number;
  totalInvested: number;
  totalProfit: number;
  profitPercentage: number;
  allocationData: { name: string; value: number }[];
  performanceData: { date: string; value: number; invested: number }[];
};

type AssetMeta = {
  symbol: string;
  name: string;
  symbolAliases: string[];
  isin: string | null;
  currentPrice: number;
  assetClass: string;
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
    assetClass: meta.assetClass,
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
  const sorted = [...transactions].sort(
    (a, b) => a.date.getTime() - b.date.getTime()
  );

  const positions = new Map<string, FifoPosition>();
  const meta = new Map<string, AssetMeta>();
  const monthEnds = new Map<string, { value: number; invested: number }>();

  for (const tx of sorted) {
    if (!positions.has(tx.assetId)) {
      positions.set(tx.assetId, emptyPosition());
      meta.set(tx.assetId, {
        symbol: tx.symbol,
        name: tx.name,
        symbolAliases: tx.symbolAliases ?? [],
        isin: tx.isin ?? null,
        currentPrice: tx.currentPrice,
        assetClass: tx.assetClass,
      });
    }

    const m = meta.get(tx.assetId)!;
    const pos = positions.get(tx.assetId)!;
    applyTxFifo(pos, tx);
    m.currentPrice = updateMarkPrice(m.currentPrice, tx, pos.quantity);

    const monthKey = `${tx.date.getFullYear()}-${String(tx.date.getMonth() + 1).padStart(2, '0')}`;
    monthEnds.set(monthKey, snapshotFromPositions(positions, meta));
  }

  const holdings: Holding[] = [];
  positions.forEach((pos, assetId) => {
    const m = meta.get(assetId)!;
    const h = holdingFromPosition(assetId, m, pos);
    if (h) holdings.push(h);
  });

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

  return {
    holdings,
    totalValue,
    totalInvested,
    totalProfit,
    profitPercentage,
    allocationData,
    performanceData,
  };
}
