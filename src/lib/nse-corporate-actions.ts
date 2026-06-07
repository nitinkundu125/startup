/**
 * NSE official corporate actions (public API).
 * https://www.nseindia.com/api/corporates-corporateActions
 */

export type CorporateActionType = 'BONUS' | 'SPLIT' | 'DIVIDEND' | 'OTHER';

export type ParsedCorporateAction = {
  symbol: string;
  exDate: Date;
  type: CorporateActionType;
  subject: string;
  source: 'NSE';
  /** SPLIT: multiply share count (e.g. 5 for 5:1 sub-division) */
  shareMultiplier?: number;
  /** BONUS: bonus shares per held shares (4:1 → bonus=4, held=1) */
  bonusRatio?: { bonus: number; held: number };
  /** DIVIDEND: cash dividend per share */
  dividendAmount?: number;
};

type NseRow = {
  symbol: string;
  subject: string;
  exDate: string;
  comp?: string;
};

const NSE_HOME = 'https://www.nseindia.com/';
const NSE_CA_API =
  'https://www.nseindia.com/api/corporates-corporateActions?index=equities';

let sessionCookie: string | null = null;
let sessionAt = 0;
const SESSION_TTL_MS = 5 * 60 * 1000;

async function refreshNseSession(): Promise<string> {
  const res = await fetch(NSE_HOME, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      Accept: 'text/html',
    },
    redirect: 'follow',
  });
  let parts: string[] = [];
  const setCookies = res.headers.getSetCookie?.() ?? [];
  if (setCookies.length > 0) {
    parts = setCookies.map((c) => c.split(';')[0]).filter(Boolean);
  } else {
    const raw = res.headers.get('set-cookie');
    if (raw) {
      parts = raw.split(/,(?=[^;]+?=)/).map((c) => c.trim().split(';')[0]);
    }
  }
  sessionCookie = parts.filter(Boolean).join('; ');
  sessionAt = Date.now();
  return sessionCookie;
}

export async function nseFetch(url: string): Promise<Response> {
  if (!sessionCookie || Date.now() - sessionAt > SESSION_TTL_MS) {
    await refreshNseSession();
  }
  let res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      Accept: 'application/json',
      Referer: NSE_HOME,
      Cookie: sessionCookie ?? '',
    },
  });
  if (res.status === 401 || res.status === 403) {
    await refreshNseSession();
    res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        Accept: 'application/json',
        Referer: NSE_HOME,
        Cookie: sessionCookie ?? '',
      },
    });
  }
  return res;
}

/** Parse NSE date "14-Jan-2026" */
export function parseNseDate(value: string): Date | null {
  const raw = value?.trim();
  if (!raw || raw === '-') return null;
  const m = raw.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (m) {
    const months: Record<string, number> = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
    };
    const mon = months[m[2].toLowerCase()];
    if (mon === undefined) return null;
    return new Date(Date.UTC(Number(m[3]), mon, Number(m[1])));
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Parse NSE subject line into structured corporate action. */
export function parseNseSubject(
  symbol: string,
  subject: string,
  exDate: Date
): ParsedCorporateAction | null {
  const s = subject.trim();
  const base: ParsedCorporateAction = {
    symbol: symbol.toUpperCase(),
    exDate,
    type: 'OTHER',
    subject: s,
    source: 'NSE',
  };

  const bonusMatch = s.match(/bonus\s*(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)/i);
  if (bonusMatch) {
    return {
      ...base,
      type: 'BONUS',
      bonusRatio: {
        bonus: parseFloat(bonusMatch[1]),
        held: parseFloat(bonusMatch[2]),
      },
    };
  }

  if (/face value split|sub-division|stock split/i.test(s)) {
    const fromTo = s.match(
      /from\s*rs?\s*([\d.]+)\s*\/?-?\s*per share\s*to\s*(?:re?\s*)?rs?\s*([\d.]+)/i
    );
    if (fromTo) {
      const from = parseFloat(fromTo[1]);
      const to = parseFloat(fromTo[2]);
      if (from > 0 && to > 0 && from > to) {
        return {
          ...base,
          type: 'SPLIT',
          shareMultiplier: from / to,
        };
      }
    }
    const fromToShort = s.match(/from\s*rs?\s*([\d.]+).*?to\s*re?\s*([\d.]+)/i);
    if (fromToShort) {
      const from = parseFloat(fromToShort[1]);
      const to = parseFloat(fromToShort[2]);
      if (from > 0 && to > 0 && from > to) {
        return {
          ...base,
          type: 'SPLIT',
          shareMultiplier: from / to,
        };
      }
    }
    const ratioMatch = s.match(/(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)/);
    if (ratioMatch) {
      const a = parseFloat(ratioMatch[1]);
      const b = parseFloat(ratioMatch[2]);
      if (a > b) {
        return { ...base, type: 'SPLIT', shareMultiplier: a / b };
      }
    }
  }

  if (/dividend/i.test(s)) {
    let dividendAmount: number | undefined;
    const match = s.match(/(?:rs?\.?|rupees?)\s*([\d.]+)/i);
    if (match) {
      const val = parseFloat(match[1]);
      if (val > 0) dividendAmount = val;
    }
    return { ...base, type: 'DIVIDEND', dividendAmount };
  }

  return null;
}

export function parseNseRows(rows: NseRow[]): ParsedCorporateAction[] {
  const out: ParsedCorporateAction[] = [];
  for (const row of rows) {
    const exDate = parseNseDate(row.exDate);
    if (!exDate || !row.symbol) continue;
    const parsed = parseNseSubject(row.symbol, row.subject, exDate);
    if (parsed && parsed.type !== 'OTHER') {
      out.push(parsed);
    }
  }
  return out.sort((a, b) => a.exDate.getTime() - b.exDate.getTime());
}

/** Fetch corporate actions for one symbol from NSE. */
export async function fetchNseCorporateActions(
  symbol: string
): Promise<ParsedCorporateAction[]> {
  const sym = symbol.trim().toUpperCase();
  const url = `${NSE_CA_API}&symbol=${encodeURIComponent(sym)}`;
  const res = await nseFetch(url);
  if (!res.ok) {
    throw new Error(`NSE API ${res.status} for ${sym}`);
  }
  const text = await res.text();
  let data: NseRow[];
  try {
    data = JSON.parse(text) as NseRow[];
  } catch {
    throw new Error(`NSE returned non-JSON for ${sym}`);
  }
  if (!Array.isArray(data)) return [];
  return parseNseRows(data);
}

export function localDateKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parse YYYY-MM-DD as noon UTC (matches NSE ex-dates). */
export function dateFromDayKey(dayKey: string): Date {
  const [y, m, d] = dayKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

/** Index by symbol → date key → actions on that ex-date */
export type CorporateActionRegistry = Map<
  string,
  Map<string, ParsedCorporateAction[]>
>;

export function buildRegistry(
  actions: ParsedCorporateAction[]
): CorporateActionRegistry {
  const seen = new Set<string>();
  const reg: CorporateActionRegistry = new Map();
  for (const a of actions) {
    const dk = localDateKey(a.exDate);
    const dedupe = `${a.symbol}|${a.type}|${dk}|${a.shareMultiplier ?? ''}|${a.bonusRatio?.bonus ?? ''}:${a.bonusRatio?.held ?? ''}|${a.dividendAmount ?? ''}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    if (!reg.has(a.symbol)) reg.set(a.symbol, new Map());
    const byDay = reg.get(a.symbol)!;
    if (!byDay.has(dk)) byDay.set(dk, []);
    byDay.get(dk)!.push(a);
  }
  return reg;
}

export function getActionsOnDate(
  registry: CorporateActionRegistry | undefined,
  symbol: string,
  date: Date
): ParsedCorporateAction[] {
  if (!registry) return [];
  const byDay = registry.get(symbol.toUpperCase());
  if (!byDay) return [];
  return byDay.get(localDateKey(date)) ?? [];
}

/** Apply order: bonus before split (same ex-date). */
export function sortActionsForApply(
  actions: ParsedCorporateAction[]
): ParsedCorporateAction[] {
  const order: Record<CorporateActionType, number> = {
    BONUS: 0,
    SPLIT: 1,
    DIVIDEND: 2,
    OTHER: 3,
  };
  return [...actions].sort((a, b) => order[a.type] - order[b.type]);
}
