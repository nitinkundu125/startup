export type DailyClose = {
  date: Date;
  close: number;
  high?: number;
  low?: number;
  open?: number;
  volume?: number;
};

const YAHOO_CHART = 'https://query1.finance.yahoo.com/v8/finance/chart/';

function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Last available close on or before `onOrBefore` (sorted ascending by date). */
export function closeOnOrBefore(series: DailyClose[], onOrBefore: Date): number | null {
  if (!series.length) return null;
  const target = onOrBefore.getTime();
  let lo = 0;
  let hi = series.length - 1;
  let best = -1;

  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const t = series[mid].date.getTime();
    if (t <= target) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  if (best < 0) return null;
  const price = series[best].close;
  return price > 0 && Number.isFinite(price) ? price : null;
}

export async function fetchYahooDailyCloses(
  yahooSymbol: string,
  start: Date,
  end: Date = new Date()
): Promise<DailyClose[]> {
  const period1 = Math.floor(start.getTime() / 1000) - 86400 * 7;
  const period2 = Math.floor(end.getTime() / 1000) + 86400;

  const url =
    `${YAHOO_CHART}${encodeURIComponent(yahooSymbol)}` +
    `?interval=1d&period1=${period1}&period2=${period2}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PortfolioApp/1.0)' },
      next: { revalidate: 3600 },
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    
    if (!res.ok) return [];

    const json = (await res.json()) as {
      chart?: {
        result?: {
          timestamp?: number[];
          indicators?: {
            quote?: { close?: (number | null)[]; high?: (number | null)[]; low?: (number | null)[]; open?: (number | null)[]; volume?: (number | null)[] }[];
            adjclose?: { adjclose?: (number | null)[] }[];
          };
        }[];
      };
    };

    const result = json.chart?.result?.[0];
    const timestamps = result?.timestamp ?? [];
    const closes = result?.indicators?.quote?.[0]?.close ?? [];
    const highs = result?.indicators?.quote?.[0]?.high ?? [];
    const lows = result?.indicators?.quote?.[0]?.low ?? [];
    const opens = result?.indicators?.quote?.[0]?.open ?? [];
    const volumes = result?.indicators?.quote?.[0]?.volume ?? [];
    // Yahoo's `close` is split-adjusted but NOT dividend-adjusted, which
    // understates total return for dividend payers. `adjclose` adjusts for both.
    // The whole bar is scaled by adjclose/close rather than swapping the close
    // alone — mixing an adjusted close with unadjusted highs and lows would
    // corrupt every indicator that reads more than one of them (ATR, Stochastic,
    // CCI, Ichimoku, PSAR).
    const adjCloses = result?.indicators?.adjclose?.[0]?.adjclose ?? [];

    const out: DailyClose[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const c = closes[i];
      if (c == null || !Number.isFinite(c) || c <= 0) continue;

      const adj = adjCloses[i];
      const factor =
        adj != null && Number.isFinite(adj) && adj > 0 ? adj / c : 1;

      out.push({
        date: new Date(timestamps[i] * 1000),
        close: c * factor,
        high: (highs[i] ?? c) * factor,
        low: (lows[i] ?? c) * factor,
        open: (opens[i] ?? c) * factor,
        volume: volumes[i] ?? 0
      });
    }

    out.sort((a, b) => a.date.getTime() - b.date.getTime());
    return out;
  } catch {
    return [];
  }
}

export type PriceSeries = {
  closes: number[];
  highs: number[];
  lows: number[];
  opens: number[];
  volumes: number[];
  dates: Date[];
};

/**
 * Columnar view of a daily bar series, as the backtester wants it.
 *
 * Five call sites were each re-deriving this with `(r: any) => ...` maps, which
 * is how `opens` came to be dropped everywhere and fills ended up on the signal
 * bar's own close.
 */
export function toPriceSeries(rows: DailyClose[]): PriceSeries {
  return {
    closes: rows.map((r) => r.close),
    highs: rows.map((r) => r.high ?? r.close),
    lows: rows.map((r) => r.low ?? r.close),
    opens: rows.map((r) => r.open ?? r.close),
    volumes: rows.map((r) => r.volume ?? 0),
    dates: rows.map((r) => new Date(r.date)),
  };
}

export function monthEndDate(ym: string): Date {
  const [year, month] = ym.split('-').map(Number);
  return new Date(year, month, 0, 23, 59, 59, 999);
}

export { dayKey };
