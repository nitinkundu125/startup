/**
 * NSE index constituents — monthly sync and point-in-time reads.
 *
 * The symbol lists in nifty500.ts are typed out by hand. NSE reconstitutes its
 * indices twice a year and companies also leave through mergers and delistings,
 * so a static file drifts silently: a dropped ticker just returns zero bars and
 * disappears from results rather than raising anything.
 *
 * Each sync records membership PERIODS, so the history accumulates. That is the
 * long game — after a couple of years these rows can answer "who was in the
 * Nifty 50 in March 2027", which is the only real fix for survivorship bias.
 */
import { prisma } from '@/lib/prisma';
import { nseFetch } from '@/lib/nse-corporate-actions';
import {
  NIFTY_50_SYMBOLS,
  NIFTY_100_SYMBOLS,
  NIFTY_MIDCAP_150_SYMBOLS,
  NIFTY_SMALLCAP_250_SYMBOLS,
  NIFTY_500_SYMBOLS,
} from '@/lib/nifty500';

export type IndexId = 'nifty50' | 'nifty100' | 'midcap150' | 'smallcap250' | 'nifty500';

const NSE_ARCHIVE = 'https://nsearchives.nseindia.com/content/indices';

export const INDEX_SOURCES: Record<IndexId, { csv: string; label: string; fallback: string[] }> = {
  nifty50:     { csv: `${NSE_ARCHIVE}/ind_nifty50list.csv`,         label: 'Nifty 50',        fallback: NIFTY_50_SYMBOLS },
  nifty100:    { csv: `${NSE_ARCHIVE}/ind_nifty100list.csv`,        label: 'Nifty 100',       fallback: NIFTY_100_SYMBOLS },
  midcap150:   { csv: `${NSE_ARCHIVE}/ind_niftymidcap150list.csv`,  label: 'Nifty Midcap 150', fallback: NIFTY_MIDCAP_150_SYMBOLS },
  smallcap250: { csv: `${NSE_ARCHIVE}/ind_niftysmallcap250list.csv`, label: 'Nifty Smallcap 250', fallback: NIFTY_SMALLCAP_250_SYMBOLS },
  nifty500:    { csv: `${NSE_ARCHIVE}/ind_nifty500list.csv`,        label: 'Nifty 500',       fallback: NIFTY_500_SYMBOLS },
};

export type ParsedConstituent = { symbol: string; company: string; industry: string };

/**
 * Parse an NSE constituent CSV.
 * Header is `Company Name,Industry,Symbol,Series,ISIN Code`, but the company
 * name frequently contains commas, so fields must be split with quote awareness
 * rather than on every comma.
 */
export function parseConstituentCsv(text: string): ParsedConstituent[] {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const header = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const iSymbol = header.findIndex((h) => h === 'symbol');
  const iCompany = header.findIndex((h) => h.includes('company'));
  const iIndustry = header.findIndex((h) => h.includes('industry'));
  if (iSymbol < 0) return [];

  const out: ParsedConstituent[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const raw = (cells[iSymbol] ?? '').trim().toUpperCase();
    if (!raw) continue;
    out.push({
      symbol: `${raw}.NS`, // Yahoo convention, matching the rest of the app
      company: (cells[iCompany] ?? '').trim(),
      industry: (cells[iIndustry] ?? '').trim(),
    });
  }
  return out;
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      cells.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells;
}

export type SyncResult = {
  indexId: IndexId;
  ok: boolean;
  count: number;
  added: string[];
  removed: string[];
  error?: string;
};

/** Fetch one index and fold it into the membership table. */
export async function syncIndex(indexId: IndexId): Promise<SyncResult> {
  const src = INDEX_SOURCES[indexId];
  const now = new Date();

  let parsed: ParsedConstituent[] = [];
  try {
    const res = await nseFetch(src.csv);
    if (!res.ok) throw new Error(`NSE returned ${res.status}`);
    parsed = parseConstituentCsv(await res.text());
    if (parsed.length === 0) throw new Error('CSV parsed to zero rows');
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await prisma.indexSyncLog.upsert({
      where: { indexId },
      update: { syncedAt: now, ok: false, error, count: 0 },
      create: { indexId, syncedAt: now, ok: false, error, count: 0 },
    });
    return { indexId, ok: false, count: 0, added: [], removed: [], error };
  }

  // A partial download would look like a mass delisting. Refuse rather than
  // mark two thirds of an index inactive on the strength of a truncated file.
  const expected = src.fallback.length;
  if (parsed.length < expected * 0.5) {
    const error = `Only ${parsed.length} rows for ${indexId}, expected ~${expected} — refusing to apply a likely-truncated download`;
    await prisma.indexSyncLog.upsert({
      where: { indexId },
      update: { syncedAt: now, ok: false, error, count: parsed.length },
      create: { indexId, syncedAt: now, ok: false, error, count: parsed.length },
    });
    return { indexId, ok: false, count: parsed.length, added: [], removed: [], error };
  }

  const incoming = new Map(parsed.map((p) => [p.symbol, p]));
  const existingActive = await prisma.indexMembership.findMany({
    where: { indexId, active: true },
  });
  const activeBySymbol = new Map(existingActive.map((m) => [m.symbol, m]));

  const added: string[] = [];
  const removed: string[] = [];

  for (const [symbol, info] of incoming) {
    const current = activeBySymbol.get(symbol);
    if (current) {
      await prisma.indexMembership.update({
        where: { id: current.id },
        data: { lastSeen: now, company: info.company || current.company, industry: info.industry || current.industry },
      });
    } else {
      // New, or rejoining after a spell out — either way a fresh period.
      await prisma.indexMembership.create({
        data: { indexId, symbol, company: info.company, industry: info.industry, firstSeen: now, lastSeen: now, active: true },
      });
      added.push(symbol);
    }
  }

  for (const [symbol, row] of activeBySymbol) {
    if (incoming.has(symbol)) continue;
    // Left the index. lastSeen already marks the final sync that saw it.
    await prisma.indexMembership.update({ where: { id: row.id }, data: { active: false } });
    removed.push(symbol);
  }

  await prisma.indexSyncLog.upsert({
    where: { indexId },
    update: { syncedAt: now, ok: true, error: null, count: incoming.size, added: added.length, removed: removed.length },
    create: { indexId, syncedAt: now, ok: true, count: incoming.size, added: added.length, removed: removed.length },
  });

  return { indexId, ok: true, count: incoming.size, added, removed };
}

export async function syncAllIndices(): Promise<SyncResult[]> {
  const out: SyncResult[] = [];
  // Sequential — NSE rate-limits, and this runs once a month.
  for (const id of Object.keys(INDEX_SOURCES) as IndexId[]) {
    out.push(await syncIndex(id));
    await new Promise((r) => setTimeout(r, 800));
  }
  return out;
}

/**
 * Current members of an index.
 * Falls back to the hardcoded list when the table is empty (fresh database, or
 * every sync so far has failed) so the scanner never returns nothing.
 */
export async function getIndexSymbols(indexId: IndexId): Promise<string[]> {
  try {
    const rows = await prisma.indexMembership.findMany({
      where: { indexId, active: true },
      select: { symbol: true },
      orderBy: { symbol: 'asc' },
    });
    if (rows.length > 0) return rows.map((r) => r.symbol);
  } catch {
    // Table missing (migration not applied yet) — fall through.
  }
  return INDEX_SOURCES[indexId].fallback;
}

/**
 * Members as of a past date — the point-in-time query.
 *
 * Only as good as the history collected so far: before the first sync there are
 * no rows, so this returns nothing rather than pretending. That is the honest
 * answer, and it is why the sync is worth running from now on.
 */
export async function getIndexSymbolsAsOf(indexId: IndexId, asOf: Date): Promise<string[]> {
  const rows = await prisma.indexMembership.findMany({
    where: {
      indexId,
      firstSeen: { lte: asOf },
      OR: [
        // Still a member, so the period runs to the present — `lastSeen` is only
        // the most recent sync and is always slightly in the past. Requiring
        // lastSeen >= asOf alone returned nothing even for "as of now".
        { active: true },
        // Left the index: it counts only if asOf falls inside its window.
        { lastSeen: { gte: asOf } },
      ],
    },
    select: { symbol: true },
    orderBy: { symbol: 'asc' },
  });
  return rows.map((r) => r.symbol);
}

export async function getSyncStatus() {
  try {
    return await prisma.indexSyncLog.findMany({ orderBy: { indexId: 'asc' } });
  } catch {
    return [];
  }
}
