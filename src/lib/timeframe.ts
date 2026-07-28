/**
 * Daily bars -> weekly / monthly bars.
 *
 * Long-term investors do not read daily charts. The same indicator behaves like
 * a completely different tool depending on the candle it sits on:
 *
 *   RSI(14) daily   -> fires ~20x a year, mostly noise
 *   RSI(14) weekly  -> fires 2-3x a year, and those are the ones that matter
 *   MACD monthly    -> roughly one signal every couple of years
 *
 * So resampling is not a convenience, it is what turns a day-trading library
 * into a positional one. Every existing strategy gains two more variants.
 */

export type Bars = {
  closes: number[];
  highs: number[];
  lows: number[];
  opens: number[];
  volumes: number[];
  dates: Date[];
};

export type Timeframe = 'daily' | 'weekly' | 'monthly';

/** ISO week key: weeks start Monday, so Sunday belongs to the week just ended. */
function weekKey(d: Date): string {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (t.getUTCDay() + 6) % 7; // Mon = 0
  t.setUTCDate(t.getUTCDate() - dayNum + 3); // nearest Thursday
  const isoYear = t.getUTCFullYear();
  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const week =
    1 + Math.round(((t.getTime() - jan4.getTime()) / 86400000 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Aggregate daily bars into a coarser timeframe.
 *
 * Each output bar takes the first open, the highest high, the lowest low, the
 * LAST close, and the summed volume of its period. Its date is the period's
 * last trading day — never a calendar boundary — so a signal on that bar is
 * dated to a day the market was actually open.
 *
 * The final period is included even when incomplete: an in-progress week is the
 * one a live signal has to fire on.
 */
export function resample(bars: Bars, timeframe: Timeframe): Bars {
  if (timeframe === 'daily') return bars;
  const keyOf = timeframe === 'weekly' ? weekKey : monthKey;

  const out: Bars = { closes: [], highs: [], lows: [], opens: [], volumes: [], dates: [] };
  if (bars.dates.length === 0) return out;

  let key = keyOf(bars.dates[0]);
  let open = bars.opens[0];
  let high = bars.highs[0];
  let low = bars.lows[0];
  let close = bars.closes[0];
  let volume = bars.volumes[0];
  let date = bars.dates[0];

  const flush = () => {
    out.opens.push(open);
    out.highs.push(high);
    out.lows.push(low);
    out.closes.push(close);
    out.volumes.push(volume);
    out.dates.push(date);
  };

  for (let i = 1; i < bars.dates.length; i++) {
    const k = keyOf(bars.dates[i]);
    if (k !== key) {
      flush();
      key = k;
      open = bars.opens[i];
      high = bars.highs[i];
      low = bars.lows[i];
      volume = 0;
    } else {
      if (bars.highs[i] > high) high = bars.highs[i];
      if (bars.lows[i] < low) low = bars.lows[i];
    }
    close = bars.closes[i];
    volume += bars.volumes[i];
    date = bars.dates[i];
  }
  flush();

  return out;
}

/** Trading periods per year, for annualising or sizing lookbacks. */
export function periodsPerYear(timeframe: Timeframe): number {
  return timeframe === 'daily' ? 252 : timeframe === 'weekly' ? 52 : 12;
}
