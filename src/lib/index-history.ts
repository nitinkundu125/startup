export type DailyClose = { date: Date; close: number };

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

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PortfolioApp/1.0)' },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];

    const json = (await res.json()) as {
      chart?: {
        result?: {
          timestamp?: number[];
          indicators?: { quote?: { close?: (number | null)[] }[] };
        }[];
      };
    };

    const result = json.chart?.result?.[0];
    const timestamps = result?.timestamp ?? [];
    const closes = result?.indicators?.quote?.[0]?.close ?? [];

    const out: DailyClose[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const c = closes[i];
      if (c == null || !Number.isFinite(c) || c <= 0) continue;
      out.push({ date: new Date(timestamps[i] * 1000), close: c });
    }

    out.sort((a, b) => a.date.getTime() - b.date.getTime());
    return out;
  } catch {
    return [];
  }
}

export function monthEndDate(ym: string): Date {
  const [year, month] = ym.split('-').map(Number);
  return new Date(year, month, 0, 23, 59, 59, 999);
}

export { dayKey };
