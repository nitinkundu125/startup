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

/** In-sample bar a strategy must clear to be considered at all. */
export const MIN_IN_SAMPLE_TRADES = 3;
export const MIN_IN_SAMPLE_WIN_RATE = 67;
