/**
 * FIFO lot accounting — ported from Paisa (internal/accounting/accounting.go).
 * Source of truth for quantity, cost basis, and average price.
 */

export type Lot = {
  quantity: number;
  price: number;
  date: Date;
};

export type FifoPosition = {
  lots: Lot[];
  quantity: number;
  totalCost: number;
};

const QTY_EPS = 1e-8;

export function emptyPosition(): FifoPosition {
  return { lots: [], quantity: 0, totalCost: 0 };
}

export function avgCost(position: FifoPosition): number {
  if (position.quantity <= QTY_EPS) return 0;
  return position.totalCost / position.quantity;
}

/** Add shares at given price (BUY). */
export function addLot(position: FifoPosition, quantity: number, price: number, date: Date): void {
  if (quantity <= QTY_EPS) return;
  position.lots.push({ quantity, price, date });
  position.quantity += quantity;
  position.totalCost += quantity * price;
}

/**
 * Bonus shares: add at ₹0 cost so total invested is unchanged (avg cost falls).
 * Matches Zerodha holdings export after a 1:1 bonus.
 */
export function addBonus(position: FifoPosition, quantity: number, date: Date): void {
  if (quantity <= QTY_EPS) return;
  addLot(position, quantity, 0, date);
}

/**
 * Stock split: multiply lot quantities, divide per-share price; total cost unchanged.
 */
export function applySplit(position: FifoPosition, ratio: number): void {
  if (ratio <= 0 || !Number.isFinite(ratio) || position.quantity <= QTY_EPS) return;
  for (const lot of position.lots) {
    lot.quantity *= ratio;
    lot.price /= ratio;
  }
  position.quantity *= ratio;
}

/**
 * Demat / ISIN change: replace position with new quantity at preserved total cost.
 */
export function applyDematReset(
  position: FifoPosition,
  newQuantity: number,
  preservedCost: number,
  date: Date
): void {
  position.lots = [];
  position.quantity = 0;
  position.totalCost = 0;
  if (newQuantity <= QTY_EPS) return;
  const price = preservedCost / newQuantity;
  addLot(position, newQuantity, price, date);
}

/** SELL: consume FIFO lots. Returns quantity actually sold (capped to holdings). */
export function sellLots(position: FifoPosition, quantity: number): number {
  if (quantity <= QTY_EPS || position.quantity <= QTY_EPS) return 0;

  const toSell = Math.min(quantity, position.quantity);
  let remaining = toSell;

  while (remaining > QTY_EPS && position.lots.length > 0) {
    const first = position.lots[0];
    if (first.quantity > remaining + QTY_EPS) {
      const costRemoved = remaining * first.price;
      first.quantity -= remaining;
      position.quantity -= remaining;
      position.totalCost -= costRemoved;
      remaining = 0;
    } else {
      remaining -= first.quantity;
      position.quantity -= first.quantity;
      position.totalCost -= first.quantity * first.price;
      position.lots.shift();
    }
  }

  if (position.quantity <= QTY_EPS) {
    position.quantity = 0;
    position.totalCost = 0;
    position.lots = [];
  }

  return toSell;
}

export function marketValue(position: FifoPosition, lastPrice: number): number {
  return position.quantity * lastPrice;
}

export function unrealizedPnl(position: FifoPosition, lastPrice: number): number {
  return marketValue(position, lastPrice) - position.totalCost;
}
