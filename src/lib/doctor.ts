import {
  emptyPosition,
  addLot,
  addBonus,
  sellLots,
  applySplit,
  applyDematReset,
  type FifoPosition,
} from '@/lib/fifo';
import { BONUS_MAX_PRICE } from '@/lib/corporate-actions';
import type { TxInput } from '@/lib/portfolio';

export type DoctorWarning = {
  level: 'error' | 'warn';
  code: string;
  message: string;
  symbol?: string;
};

const QTY_EPS = 1e-6;

function applyTxForDoctor(position: FifoPosition, tx: TxInput): void {
  const txType = tx.type.toUpperCase();
  if (txType === 'BUY') {
    addLot(position, tx.quantity, tx.price, tx.date);
  } else if (txType === 'BONUS' || (txType === 'BUY' && tx.price < BONUS_MAX_PRICE)) {
    addBonus(position, tx.quantity, tx.date);
  } else if (txType === 'DEMAT' || txType === 'CA_BUY') {
    applyDematReset(position, tx.quantity, tx.quantity * tx.price, tx.date);
  } else if (txType === 'SPLIT' && tx.splitRatio) {
    applySplit(position, tx.splitRatio);
  } else if (txType === 'SELL') {
    sellLots(position, tx.quantity);
  }
}

/**
 * Portfolio doctor — inspired by Paisa's doctor checks.
 * Flags data issues that make displayed numbers unreliable.
 */
export function runPortfolioDoctor(transactions: TxInput[]): DoctorWarning[] {
  const warnings: DoctorWarning[] = [];
  const sorted = [...transactions].sort(
    (a, b) => a.date.getTime() - b.date.getTime()
  );

  const tradeIds = new Map<string, string>();
  for (const tx of sorted) {
    const tid = (tx as TxInput & { tradeId?: string | null }).tradeId;
    if (!tid) continue;
    if (tradeIds.has(tid)) {
      warnings.push({
        level: 'error',
        code: 'DUPLICATE_TRADE_ID',
        message: `Duplicate trade_id "${tid}" — one row may be ignored on import.`,
        symbol: tx.symbol,
      });
    } else {
      tradeIds.set(tid, tx.symbol);
    }
  }

  const byAsset = new Map<string, TxInput[]>();
  for (const tx of sorted) {
    if (!byAsset.has(tx.assetId)) byAsset.set(tx.assetId, []);
    byAsset.get(tx.assetId)!.push(tx);
  }

  for (const [, txs] of byAsset) {
    const position = emptyPosition();
    const symbol = txs[0]?.symbol ?? '?';

    for (const tx of txs) {
      const before = position.quantity;
      const txType = tx.type.toUpperCase();

      if (txType === 'SELL' && tx.quantity > before + QTY_EPS) {
        warnings.push({
          level: 'warn',
          code: 'SELL_EXCEEDS_HOLDINGS',
          message: `Sell of ${tx.quantity} ${symbol} on ${tx.date.toISOString().slice(0, 10)} exceeds holdings (${before.toFixed(2)}). May be a demat/split not in CSV — quantity was capped.`,
          symbol,
        });
      }

      applyTxForDoctor(position, tx);

      if (position.quantity < -QTY_EPS) {
        warnings.push({
          level: 'error',
          code: 'NEGATIVE_QUANTITY',
          message: `Negative holdings for ${symbol} after ${tx.date.toISOString().slice(0, 10)}.`,
          symbol,
        });
      }
    }

    if (position.quantity > QTY_EPS && position.totalCost < -0.01) {
      warnings.push({
        level: 'error',
        code: 'NEGATIVE_COST',
        message: `Negative cost basis for ${symbol}.`,
        symbol,
      });
    }
  }

  const bonusBuys = sorted.filter(
    (t) =>
      t.type.toUpperCase() === 'BUY' &&
      t.price > BONUS_MAX_PRICE &&
      t.price <= 0.05
  );
  if (bonusBuys.length > 0) {
    warnings.push({
      level: 'warn',
      code: 'LOW_PRICE_BUY',
      message: `${bonusBuys.length} buy(s) with price ₹0.01–₹0.05 were not treated as bonus. Only price < ₹${BONUS_MAX_PRICE} is auto-detected.`,
      symbol: bonusBuys[0].symbol,
    });
  }

  return warnings;
}
