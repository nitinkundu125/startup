import type { ScanRow } from './scan-result';

/**
 * Result floors, applied to a completed scan.
 *
 * These used to travel with the scan request and be applied on the server, which
 * meant changing any number cost a full re-scan of every stock — and, because the
 * values were part of the cache key, threw away the day's cached results on the
 * way. Scan once, filter as often as you like.
 *
 * Every field is a floor except the drawdowns, which are ceilings entered as
 * positive numbers. 0 disables a field: taking it literally would reject
 * everything, since a real strategy always goes underwater at some point.
 */
export type FilterValues = {
  minWinRate: number; minTrades: number; maxDrawdown: number;
  oosMinWinRate: number; oosMinTrades: number; oosMaxDrawdown: number;
};

export const EMPTY_FILTERS: FilterValues = {
  minWinRate: 0, minTrades: 0, maxDrawdown: 0,
  oosMinWinRate: 0, oosMinTrades: 0, oosMaxDrawdown: 0,
};

export const FILTER_FIELDS: {
  key: keyof FilterValues;
  label: string;
  suffix: string;
  hint: string;
  group: 'fitted' | 'oos';
}[] = [
  { key: 'minWinRate', label: 'Win rate at least', suffix: '%', group: 'fitted',
    hint: 'Share of trades that made money, in the window used to pick the strategy' },
  { key: 'minTrades', label: 'Trades at least', suffix: '', group: 'fitted',
    hint: 'Fewer trades means the win rate is based on less evidence' },
  { key: 'maxDrawdown', label: 'Drawdown no worse than', suffix: '%', group: 'fitted',
    hint: 'Worst a single trade went underwater. Enter 20 for −20%' },
  { key: 'oosMinWinRate', label: 'Win rate at least', suffix: '%', group: 'oos',
    hint: 'Same measure, on data the strategy was not selected on' },
  { key: 'oosMinTrades', label: 'Trades at least', suffix: '', group: 'oos',
    hint: 'How many trades the held-back window actually produced' },
  { key: 'oosMaxDrawdown', label: 'Drawdown no worse than', suffix: '%', group: 'oos',
    hint: 'Worst single-trade drawdown in the held-back window' },
];

/** How many floors are switched on. Drives the badge on the Filters button. */
export function activeFilterCount(v: FilterValues): number {
  return FILTER_FIELDS.reduce((n, f) => n + (v[f.key] > 0 ? 1 : 0), 0);
}

/**
 * Does this row clear every active floor?
 *
 * Drawdowns are stored negative and compared by magnitude, so a −18% worst trade
 * clears a ceiling of 20.
 */
export function matchesFilters(row: ScanRow, f: FilterValues): boolean {
  if (f.minTrades > 0 && row.totalTrades < f.minTrades) return false;
  if (f.minWinRate > 0 && row.winRate < f.minWinRate) return false;
  if (f.maxDrawdown > 0 && Math.abs(row.maxDrawdown) > f.maxDrawdown) return false;

  if (f.oosMinTrades > 0 && row.oosTotalTrades < f.oosMinTrades) return false;
  if (f.oosMinWinRate > 0) {
    // No held-back trades means there is no win rate to clear, so a row with
    // none cannot satisfy a win-rate floor.
    if (row.oosTotalTrades === 0 || row.oosWinRate < f.oosMinWinRate) return false;
  }
  if (f.oosMaxDrawdown > 0 && Math.abs(row.oosMaxDrawdown) > f.oosMaxDrawdown) return false;

  return true;
}
