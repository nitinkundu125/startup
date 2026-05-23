/**
 * Compare tradebook-derived qty vs Zerodha holdings export.
 */

export type BrokerHolding = {
  symbol: string;
  quantity: number;
  avgCost: number;
  /** Last traded price from Zerodha holdings export (LTP column). */
  ltp?: number;
};

export function parseHoldingsCsv(content: string): BrokerHolding[] {
  const lines = content
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const out: BrokerHolding[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',').map((p) => p.replace(/^"|"$/g, '').trim());
    if (parts.length < 3) continue;
    const symbol = parts[0].toUpperCase();
    const quantity = parseFloat(parts[1]);
    const avgCost = parseFloat(parts[2]);
    const ltp = parts.length > 3 ? parseFloat(parts[3]) : NaN;
    if (!symbol || !Number.isFinite(quantity) || quantity <= 0) continue;
    out.push({
      symbol,
      quantity,
      avgCost: Number.isFinite(avgCost) ? avgCost : 0,
      ltp: Number.isFinite(ltp) && ltp > 0 ? ltp : undefined,
    });
  }
  return out;
}

export type ReconcileMismatch = {
  symbol: string;
  brokerQty: number;
  computedQty: number;
  diff: number;
  brokerAvgCost: number;
  computedAvgCost: number;
};

export function reconcileHoldings(
  broker: BrokerHolding[],
  computed: { symbol: string; quantity: number; avgBuyPrice: number }[]
): ReconcileMismatch[] {
  const bySym = new Map(computed.map((h) => [h.symbol.toUpperCase(), h]));
  const mismatches: ReconcileMismatch[] = [];

  for (const b of broker) {
    const c = bySym.get(b.symbol);
    if (!c) {
      mismatches.push({
        symbol: b.symbol,
        brokerQty: b.quantity,
        computedQty: 0,
        diff: -b.quantity,
        brokerAvgCost: b.avgCost,
        computedAvgCost: 0,
      });
      continue;
    }
    const diff = c.quantity - b.quantity;
    if (Math.abs(diff) > 0.01) {
      mismatches.push({
        symbol: b.symbol,
        brokerQty: b.quantity,
        computedQty: c.quantity,
        diff,
        brokerAvgCost: b.avgCost,
        computedAvgCost: c.avgBuyPrice,
      });
    }
  }
  return mismatches.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
}
