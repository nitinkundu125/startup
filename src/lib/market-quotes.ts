import { nseFetch } from '@/lib/nse-corporate-actions';

export type LtpSnapshot = {
  fetchedAt: string;
  prices: Record<string, number>;
  failed?: string[];
  usdInr?: number;
};

const NSE_QUOTE =
  'https://www.nseindia.com/api/quote-equity?symbol=';

/** Zerodha symbols that need NSE series suffix on Yahoo. */
const YAHOO_OVERRIDES: Record<string, string> = {
  GOLDCASE: 'GOLDCASE.NS',
};

function yahooTicker(symbol: string): string {
  const upper = symbol.toUpperCase();
  return YAHOO_OVERRIDES[upper] ?? `${upper}.NS`;
}

export async function fetchNseLtp(symbol: string): Promise<number | null> {
  const sym = symbol.trim().toUpperCase();
  if (!sym) return null;

  const res = await nseFetch(`${NSE_QUOTE}${encodeURIComponent(sym)}`);
  if (!res.ok) return null;

  try {
    const data = (await res.json()) as {
      priceInfo?: { lastPrice?: number | string; last_price?: number | string };
    };
    const raw = data?.priceInfo?.lastPrice ?? data?.priceInfo?.last_price;
    const price = typeof raw === 'string' ? parseFloat(raw) : raw;
    return price != null && Number.isFinite(price) && price > 0 ? price : null;
  } catch {
    return null;
  }
}

export async function fetchYahooLtp(symbol: string): Promise<number | null> {
  const ticker = yahooTicker(symbol);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PortfolioApp/1.0)' },
      next: { revalidate: 0 },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      chart?: { result?: { meta?: { regularMarketPrice?: number } }[] };
    };
    const price = json.chart?.result?.[0]?.meta?.regularMarketPrice;
    return price != null && Number.isFinite(price) && price > 0 ? price : null;
  } catch {
    return null;
  }
}

export async function fetchLtpForSymbol(symbol: string): Promise<number | null> {
  const nse = await fetchNseLtp(symbol);
  if (nse != null) return nse;
  return fetchYahooLtp(symbol);
}

const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 120;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function fetchLtpsForSymbols(symbols: string[]): Promise<{
  prices: Record<string, number>;
  failed: string[];
}> {
  const unique = [...new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))];
  const prices: Record<string, number> = {};
  const failed: string[] = [];

  for (let i = 0; i < unique.length; i += BATCH_SIZE) {
    const batch = unique.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (sym) => {
        const ltp = await fetchLtpForSymbol(sym);
        if (ltp != null) {
          prices[sym] = ltp;
        } else {
          failed.push(sym);
        }
      })
    );
    if (i + BATCH_SIZE < unique.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  return { prices, failed };
}

export async function fetchUsYahooLtp(symbol: string): Promise<number | null> {
  const ticker = symbol.toUpperCase();
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PortfolioApp/1.0)' },
      next: { revalidate: 0 },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      chart?: { result?: { meta?: { regularMarketPrice?: number } }[] };
    };
    const price = json.chart?.result?.[0]?.meta?.regularMarketPrice;
    return price != null && Number.isFinite(price) && price > 0 ? price : null;
  } catch {
    return null;
  }
}

export async function fetchUsLtpsForSymbols(symbols: string[]): Promise<{
  prices: Record<string, number>;
  failed: string[];
}> {
  const unique = [...new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))];
  const prices: Record<string, number> = {};
  const failed: string[] = [];

  for (let i = 0; i < unique.length; i += BATCH_SIZE) {
    const batch = unique.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (sym) => {
        const ltp = await fetchUsYahooLtp(sym);
        if (ltp != null) {
          prices[sym] = ltp;
        } else {
          failed.push(sym);
        }
      })
    );
    if (i + BATCH_SIZE < unique.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  return { prices, failed };
}

export function parseLtpSnapshot(raw: string | null | undefined): LtpSnapshot | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as LtpSnapshot;
    if (!parsed?.fetchedAt || !parsed.prices || typeof parsed.prices !== 'object') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
