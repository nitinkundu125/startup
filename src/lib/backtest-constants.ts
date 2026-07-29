/**
 * Thresholds shared by the server-side scanners and the client that renders
 * their output.
 *
 * Deliberately dependency-free: importing these from optimizer.ts would pull the
 * strategy library, every indicator and the Yahoo fetch layer into the browser
 * bundle just to read an integer.
 */

/**
 * Held-back trades required before an out-of-sample win rate means anything.
 *
 * Below this the result is reported as insufficient rather than as a score. A
 * strategy with one held-back trade that happened to win shows a 100% win rate,
 * which is a coin flip wearing a rosette.
 */
export const MIN_OOS_TRADES = 3;

/** Out-of-sample win rate a strategy must hold to count as validated. */
export const HELD_UP_MIN_WIN_RATE = 50;

/**
 * Suggested starting floors, offered to the user rather than imposed.
 *
 * These were hardcoded and applied invisibly in the batch scanner while the
 * optimizer applied nothing, so the two tabs disagreed about the same stock.
 * Both now take the floors from the request and default to 0 — nothing hidden.
 * Kept here as sensible values to preset a UI control with.
 *
 * Why 8 and not 3: three trades clears a 67% win rate on two wins and a loss,
 * and across ~277 strategies that happens constantly.
 */
export const SUGGESTED_MIN_TRADES = 8;
export const SUGGESTED_MIN_WIN_RATE = 67;

/**
 * How far back to pull history for a backtest.
 *
 * Default is 0 — every bar the stock has, back to listing. The request start is
 * set well before any Indian listing, so the provider returns the full series
 * from the IPO date and no truncation happens here.
 *
 * The tradeoff, stated once so it is not forgotten: the scan universe is TODAY's
 * index membership, so the further back the window reaches, the more
 * survivorship bias compounds — you are testing decades in which the universe
 * looked nothing like the current one. Full history buys more trades and
 * tighter statistics at the cost of a rosier picture.
 *
 * Set BACKTEST_LOOKBACK_YEARS to a positive number to bound the window.
 */
export function backtestLookbackYears(): number {
  const raw = process.env.BACKTEST_LOOKBACK_YEARS;
  if (raw === undefined || raw.trim() === '') return 0;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
}

/** Predates every Indian listing, so the provider returns from the IPO onward. */
const INCEPTION = new Date('1980-01-01');

/** Start date for history fetches. 0 lookback means the stock's entire history. */
export function backtestStartDate(): Date {
  const years = backtestLookbackYears();
  if (years === 0) return INCEPTION;
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d;
}
