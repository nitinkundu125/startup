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
 * In-sample bar a strategy must clear to be considered at all.
 *
 * Was 3. With ~46 strategies scanned per symbol, a 3-trade minimum lets far too
 * much through the first gate — 3 trades clears 67% on two wins and a loss, and
 * across 46 attempts that happens constantly. The out-of-sample check catches
 * most of it downstream, but filtering earlier means the held-back window is
 * spent on candidates that were plausible to begin with.
 */
export const MIN_IN_SAMPLE_TRADES = 8;
export const MIN_IN_SAMPLE_WIN_RATE = 67;

/**
 * How far back to pull history for a backtest.
 *
 * Previously every caller asked for everything since 1990. Combined with a scan
 * universe of TODAY's index members, that meant judging strategies over decades
 * in which the universe bore no resemblance to the current one — the further
 * back the window reaches, the more the survivorship bias compounds. A bounded
 * window keeps the universe roughly contemporaneous with the test.
 *
 * Override with BACKTEST_LOOKBACK_YEARS. Set it to 0 for genuinely all history,
 * accepting the bias that comes with it.
 */
export function backtestLookbackYears(): number {
  const raw = process.env.BACKTEST_LOOKBACK_YEARS;
  if (raw === undefined || raw.trim() === '') return 15;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return 15;
  return parsed;
}

/** Start date for history fetches. 0 lookback means "everything available". */
export function backtestStartDate(): Date {
  const years = backtestLookbackYears();
  if (years === 0) return new Date('1990-01-01');
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d;
}
