import type { TradebookRow } from '@/lib/tradebook';
import {
  getActionsOnDate,
  sortActionsForApply,
  localDateKey,
  dateFromDayKey,
  type CorporateActionRegistry,
  type ParsedCorporateAction,
} from '@/lib/nse-corporate-actions';

/** Fallback only when NSE has no bonus on that date. */
export const BONUS_MAX_PRICE = 0.01;

const QTY_EPS = 1e-6;

export type TradeEventType = 'BUY' | 'SELL' | 'BONUS' | 'DEMAT' | 'SPLIT' | 'DIVIDEND';

const SPLIT_RATIO_CANDIDATES = [2, 3, 4, 5, 10, 20];

export type TradeEvent = {
  symbol: string;
  isin: string | null;
  tradeDate: Date;
  type: TradeEventType;
  quantity: number;
  price: number;
  exchange: string | null;
  segment: string | null;
  series: string | null;
  auction: boolean;
  tradeId: string | null;
  orderId: string | null;
  orderExecutionTime: Date | null;
  /** DEMAT: replace position with buyQty at preserved total cost */
  dematBuyQty?: number;
  dematPreservedCost?: number;
  splitRatio?: number;
  dividendAmount?: number;
};

export function isBonusTrade(row: TradebookRow): boolean {
  return row.type === 'BUY' && row.price < BONUS_MAX_PRICE;
}

function rowToEvent(row: TradebookRow, type: TradeEventType, extra?: Partial<TradeEvent>): TradeEvent {
  return {
    symbol: row.symbol,
    isin: row.isin,
    tradeDate: row.tradeDate,
    type,
    quantity: row.quantity,
    price: row.price,
    exchange: row.exchange,
    segment: row.segment,
    series: row.series,
    auction: row.auction,
    tradeId: row.tradeId,
    orderId: row.orderId,
    orderExecutionTime: row.orderExecutionTime,
    ...extra,
  };
}

type DayState = { qty: number; cost: number };

/** Infer stock split from price drop across ISIN change (e.g. Kotak 5:1). */
export function inferSplitRatio(oldPrice: number, newPrice: number): number | null {
  if (oldPrice <= 0 || newPrice <= 0) return null;
  const raw = oldPrice / newPrice;
  if (raw < 1.5) return null;
  for (const r of SPLIT_RATIO_CANDIDATES) {
    if (Math.abs(raw - r) / r < 0.2) return r;
  }
  const rounded = Math.round(raw);
  if (rounded >= 2 && Math.abs(raw - rounded) / rounded < 0.25) return rounded;
  return null;
}

function applySplitToSim(state: DayState, ratio: number): void {
  if (ratio > 1 && state.qty > QTY_EPS) {
    state.qty *= ratio;
  }
}

function applyNseBonusToSim(state: DayState, ca: ParsedCorporateAction): number {
  if (!ca.bonusRatio || state.qty <= QTY_EPS) return 0;
  const additional = state.qty * (ca.bonusRatio.bonus / ca.bonusRatio.held);
  state.qty += additional;
  return additional;
}

function symbolHasNseSplit(registry: CorporateActionRegistry | undefined, symbol: string): boolean {
  const byDay = registry?.get(symbol.toUpperCase());
  if (!byDay) return false;
  for (const acts of byDay.values()) {
    if (acts.some((a) => a.type === 'SPLIT')) return true;
  }
  return false;
}

function nseDedupeKey(ca: ParsedCorporateAction): string {
  const br = ca.bonusRatio
    ? `${ca.bonusRatio.bonus}:${ca.bonusRatio.held}`
    : '';
  return `${ca.type}|${localDateKey(ca.exDate)}|${ca.shareMultiplier ?? ''}|${br}`;
}

function pushNseCorporateEvents(
  symbol: string,
  symbolRows: TradebookRow[],
  dayKey: string,
  registry: CorporateActionRegistry | undefined,
  sim: DayState,
  events: TradeEvent[],
  appliedNse: Set<string>
): void {
  const refRow = symbolRows[0];
  const actions = sortActionsForApply(
    getActionsOnDate(registry, symbol, dateFromDayKey(dayKey))
  ).filter((ca) => localDateKey(ca.exDate) === dayKey);

  for (const ca of actions) {
    const dedupe = nseDedupeKey(ca);
    if (appliedNse.has(dedupe)) continue;
    appliedNse.add(dedupe);
    if (ca.type === 'BONUS' && ca.bonusRatio) {
      const additional = applyNseBonusToSim(sim, ca);
      if (additional > QTY_EPS) {
        events.push({
          ...rowToEvent(refRow, 'BONUS'),
          tradeDate: ca.exDate,
          quantity: additional,
          price: 0,
          tradeId: null,
          orderId: null,
        });
      }
    } else if (ca.type === 'SPLIT' && ca.shareMultiplier && ca.shareMultiplier > 1) {
      const splitEv: TradeEvent = {
        ...rowToEvent(refRow, 'SPLIT'),
        tradeDate: ca.exDate,
        quantity: 0,
        price: 0,
        splitRatio: ca.shareMultiplier,
        tradeId: null,
        orderId: null,
      };
      events.push(splitEv);
      applyEventToSim(sim, splitEv);
    } else if (ca.type === 'DIVIDEND' && ca.dividendAmount && ca.dividendAmount > 0) {
      const divEv: TradeEvent = {
        ...rowToEvent(refRow, 'DIVIDEND'),
        tradeDate: ca.exDate,
        quantity: 0,
        price: ca.dividendAmount,
        dividendAmount: ca.dividendAmount,
        tradeId: null,
        orderId: null,
      };
      events.push(divEv);
      // Dividends do not change the number of shares held or cost basis
    }
  }
}

function applyEventToSim(state: DayState, ev: TradeEvent): void {
  if (ev.type === 'BUY') {
    state.qty += ev.quantity;
    state.cost += ev.quantity * ev.price;
  } else if (ev.type === 'BONUS') {
    state.qty += ev.quantity;
  } else if (ev.type === 'DEMAT' && ev.dematBuyQty) {
    state.qty = ev.dematBuyQty;
  } else if (ev.type === 'SPLIT' && ev.splitRatio) {
    applySplitToSim(state, ev.splitRatio);
  } else if (ev.type === 'SELL' && state.qty > QTY_EPS) {
    const sq = Math.min(ev.quantity, state.qty);
    const avg = state.cost / state.qty;
    state.qty -= sq;
    state.cost -= sq * avg;
    if (state.qty <= QTY_EPS) {
      state.qty = 0;
      state.cost = 0;
    }
  }
}

/**
 * Conservative corporate-action handling (inspired by Paisa — no aggressive split guessing).
 * - BONUS: price < ₹0.01 only
 * - DEMAT: sell qty clearly exceeds holdings + same-day buy with ~same total value (ISIN change)
 * - Otherwise: literal BUY/SELL; sells clamped at FIFO layer
 */
export function tradebookToEvents(
  rows: TradebookRow[],
  registry?: CorporateActionRegistry
): TradeEvent[] {
  const sorted = [...rows].sort((a, b) => a.tradeDate.getTime() - b.tradeDate.getTime());
  const bySymbol = new Map<string, TradebookRow[]>();

  for (const row of sorted) {
    if (!bySymbol.has(row.symbol)) bySymbol.set(row.symbol, []);
    bySymbol.get(row.symbol)!.push(row);
  }

  const events: TradeEvent[] = [];

  for (const symbolRows of bySymbol.values()) {
    const symbol = symbolRows[0]?.symbol ?? '';
    const sim: DayState = { qty: 0, cost: 0 };
    const appliedNse = new Set<string>();
    const byDay = new Map<string, TradebookRow[]>();
    let lastIsin: string | null = symbolRows[0]?.isin ?? null;
    let lastOldIsinPrice = 0;

    for (const row of symbolRows) {
      const dk = localDateKey(row.tradeDate);
      if (!byDay.has(dk)) byDay.set(dk, []);
      byDay.get(dk)!.push(row);
    }

    const regByDay = registry?.get(symbol.toUpperCase());
    const firstTradeDayKey = localDateKey(symbolRows[0].tradeDate);
    const allDayKeys = new Set(byDay.keys());
    if (regByDay) {
      for (const dk of regByDay.keys()) {
        if (dk < firstTradeDayKey) continue;
        if (regByDay.get(dk)?.some((a) => a.type === 'BONUS' || a.type === 'SPLIT')) {
          allDayKeys.add(dk);
        }
      }
    }

    const sortedDayKeys = [...allDayKeys].sort();

    for (const dayKey of sortedDayKeys) {
      const dayRows = byDay.get(dayKey) ?? [];
      pushNseCorporateEvents(
        symbol,
        symbolRows,
        dayKey,
        registry,
        sim,
        events,
        appliedNse
      );

      if (dayRows.length === 0) {
        continue;
      }
      const dayIsin =
        dayRows.find((r) => r.isin)?.isin ?? dayRows[0]?.isin ?? lastIsin;

      const daySells = dayRows.filter((r) => r.type === 'SELL');
      const dayBuys = dayRows.filter((r) => r.type === 'BUY' && !isBonusTrade(r));
      const totalSellQty = daySells.reduce((s, r) => s + r.quantity, 0);
      const sellVal = daySells.reduce((s, r) => s + r.quantity * r.price, 0);
      const buyVal = dayBuys.reduce((s, r) => s + r.quantity * r.price, 0);
      const totalBuyQty = dayBuys.reduce((s, r) => s + r.quantity, 0);

      const valueMatch =
        Math.abs(sellVal - buyVal) / Math.max(sellVal, buyVal, 1) < 0.05;
      /** Oversized sell + smaller same-day buy = ISIN/demat transfer (FCL-style). */
      const oversizedDemat =
        totalSellQty > sim.qty + QTY_EPS &&
        totalBuyQty > QTY_EPS &&
        totalSellQty > totalBuyQty * 1.5;
      /** Must have prior holdings — avoids same-day round-trips (YES/IIFL/HDFC). */
      const hadHoldingsBeforeDay = sim.qty > QTY_EPS;
      const isDematDay =
        hadHoldingsBeforeDay &&
        dayBuys.length > 0 &&
        totalSellQty > sim.qty + QTY_EPS &&
        (valueMatch || oversizedDemat);

      /** Fallback split guess on ISIN change — only if NSE has no split on this day. */
      if (
        !isDematDay &&
        dayRows.length > 0 &&
        !symbolHasNseSplit(registry, symbol) &&
        dayIsin &&
        lastIsin &&
        dayIsin !== lastIsin &&
        sim.qty > QTY_EPS &&
        lastOldIsinPrice > 0 &&
        dayRows.length > 0
      ) {
        const refRow = dayRows.find((r) => r.isin === dayIsin) ?? dayRows[0];
        const ratio = inferSplitRatio(lastOldIsinPrice, refRow.price);
        if (ratio) {
          const splitEv: TradeEvent = {
            ...rowToEvent(refRow, 'SPLIT'),
            quantity: 0,
            price: 0,
            splitRatio: ratio,
            tradeId: null,
            orderId: null,
          };
          events.push(splitEv);
          applyEventToSim(sim, splitEv);
        }
        lastIsin = dayIsin;
      }

      if (isDematDay) {
        for (const row of dayRows) {
          if (isBonusTrade(row)) {
            const ev = rowToEvent(row, 'BONUS');
            events.push(ev);
            applyEventToSim(sim, ev);
          }
        }
        const preserved = sim.cost;
        const dematEv: TradeEvent = {
          ...rowToEvent(dayBuys[0], 'DEMAT'),
          quantity: 0,
          price: 0,
          dematBuyQty: totalBuyQty,
          dematPreservedCost: preserved,
          tradeId: null,
          orderId: null,
        };
        events.push(dematEv);
        sim.qty = totalBuyQty;
        sim.cost = preserved;
        if (dayIsin) lastIsin = dayIsin;
        const lastRow = dayRows[dayRows.length - 1];
        if (lastRow?.price > 0) lastOldIsinPrice = lastRow.price;
        continue;
      }

      for (const row of dayRows) {
        if (isBonusTrade(row)) {
          const nseBonusToday = getActionsOnDate(
            registry,
            symbol,
            row.tradeDate
          ).some((a) => a.type === 'BONUS');
          if (!nseBonusToday) {
            const ev = rowToEvent(row, 'BONUS');
            events.push(ev);
            applyEventToSim(sim, ev);
          }
          continue;
        }
        if (row.type === 'SELL') {
          const ev = rowToEvent(row, 'SELL');
          events.push(ev);
          applyEventToSim(sim, ev);
          continue;
        }
        if (row.type === 'BUY') {
          const ev = rowToEvent(row, 'BUY');
          events.push(ev);
          applyEventToSim(sim, ev);
        }
      }

      const lastRow = dayRows[dayRows.length - 1];
      if (lastRow?.isin) lastIsin = lastRow.isin;
      if (lastRow && lastRow.price > 0) lastOldIsinPrice = lastRow.price;
    }
  }

  events.sort((a, b) => a.tradeDate.getTime() - b.tradeDate.getTime());
  return events;
}

/** Convert events back to tradebook rows for DB import (skips phantom demat sells). */
export function eventsToTradebookRows(events: TradeEvent[]): TradebookRow[] {
  const out: TradebookRow[] = [];
  for (const ev of events) {
    if (ev.type === 'DEMAT' && ev.dematBuyQty && ev.dematBuyQty > QTY_EPS) {
      const cost = ev.dematPreservedCost ?? 0;
      out.push({
        symbol: ev.symbol,
        isin: ev.isin,
        tradeDate: ev.tradeDate,
        exchange: ev.exchange,
        segment: ev.segment,
        series: ev.series,
        type: 'CA_BUY',
        auction: ev.auction,
        quantity: ev.dematBuyQty,
        price: cost / ev.dematBuyQty,
        tradeId: ev.tradeId,
        orderId: ev.orderId,
        orderExecutionTime: ev.orderExecutionTime,
      });
      continue;
    }
    if (ev.type === 'SPLIT' && ev.splitRatio) {
      out.push({
        symbol: ev.symbol,
        isin: ev.isin,
        tradeDate: ev.tradeDate,
        exchange: ev.exchange,
        segment: ev.segment,
        series: ev.series,
        type: 'SPLIT',
        auction: ev.auction,
        quantity: 0,
        price: 0,
        splitRatio: ev.splitRatio,
        tradeId: ev.tradeId,
        orderId: ev.orderId,
        orderExecutionTime: ev.orderExecutionTime,
      });
      continue;
    }
    if (ev.type === 'BONUS') {
      out.push({
        symbol: ev.symbol,
        isin: ev.isin,
        tradeDate: ev.tradeDate,
        exchange: ev.exchange,
        segment: ev.segment,
        series: ev.series,
        type: 'BONUS',
        auction: ev.auction,
        quantity: ev.quantity,
        price: 0,
        tradeId: ev.tradeId,
        orderId: ev.orderId,
        orderExecutionTime: ev.orderExecutionTime,
      });
      continue;
    }
    if (ev.type === 'DIVIDEND' && ev.dividendAmount) {
      out.push({
        symbol: ev.symbol,
        isin: ev.isin,
        tradeDate: ev.tradeDate,
        exchange: ev.exchange,
        segment: ev.segment,
        series: ev.series,
        type: 'DIVIDEND',
        auction: ev.auction,
        quantity: 0,
        price: ev.dividendAmount,
        tradeId: ev.tradeId,
        orderId: ev.orderId,
        orderExecutionTime: ev.orderExecutionTime,
      });
      continue;
    }
    if (ev.type === 'BUY' || ev.type === 'SELL') {
      out.push({
        symbol: ev.symbol,
        isin: ev.isin,
        tradeDate: ev.tradeDate,
        exchange: ev.exchange,
        segment: ev.segment,
        series: ev.series,
        type: ev.type,
        auction: ev.auction,
        quantity: ev.quantity,
        price: ev.price,
        tradeId: ev.tradeId,
        orderId: ev.orderId,
        orderExecutionTime: ev.orderExecutionTime,
      });
    }
  }
  return out;
}

/** Legacy entry: preprocess rows before import. */
export function preprocessCorporateActions(
  rows: TradebookRow[],
  registry?: CorporateActionRegistry
): TradebookRow[] {
  return eventsToTradebookRows(tradebookToEvents(rows, registry));
}

export type { CorporateActionRegistry };

export function normalizeTxType(
  type: string,
  quantity: number,
  price: number,
  splitRatio: number | null
): string {
  const u = type.toUpperCase();
  if (u === 'CA_BUY' || u === 'DEMAT') return 'DEMAT';
  if (u === 'BUY' && price < BONUS_MAX_PRICE) return 'BONUS';
  if (u === 'SPLIT' && splitRatio) return 'SPLIT';
  if (u === 'DIVIDEND') return 'DIVIDEND';
  return u;
}

export function effectiveSplitRatio(
  type: string,
  _quantity: number,
  splitRatio: number | null
): number | null {
  if (type.toUpperCase() === 'SPLIT' && splitRatio) return splitRatio;
  return null;
}

/** Map stored DB transaction to trade event for FIFO replay. */
export function dbTxToEvent(tx: {
  type: string;
  quantity: number;
  price: number;
  date: Date;
  splitRatio: number | null;
  asset: { symbol: string; isin: string | null };
}): TradeEvent {
  const upper = tx.type.toUpperCase();
  if (upper === 'BONUS' || (upper === 'BUY' && tx.price < BONUS_MAX_PRICE)) {
    return {
      symbol: tx.asset.symbol,
      isin: tx.asset.isin,
      tradeDate: tx.date,
      type: 'BONUS',
      quantity: tx.quantity,
      price: 0,
      exchange: null,
      segment: null,
      series: null,
      auction: false,
      tradeId: null,
      orderId: null,
      orderExecutionTime: null,
    };
  }
  if (upper === 'DEMAT' || upper === 'CA_BUY') {
    const qty = tx.quantity;
    return {
      symbol: tx.asset.symbol,
      isin: tx.asset.isin,
      tradeDate: tx.date,
      type: 'DEMAT',
      quantity: qty,
      price: tx.price,
      exchange: null,
      segment: null,
      series: null,
      auction: false,
      tradeId: null,
      orderId: null,
      orderExecutionTime: null,
      dematBuyQty: qty > QTY_EPS ? qty : undefined,
      dematPreservedCost: qty > QTY_EPS ? qty * tx.price : undefined,
    };
  }
  return {
    symbol: tx.asset.symbol,
    isin: tx.asset.isin,
    tradeDate: tx.date,
    type: upper === 'SELL' ? 'SELL' : 'BUY',
    quantity: tx.quantity,
    price: tx.price,
    exchange: null,
    segment: null,
    series: null,
    auction: false,
    tradeId: null,
    orderId: null,
    orderExecutionTime: null,
  };
}
