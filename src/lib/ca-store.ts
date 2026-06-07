import { prisma } from '@/lib/prisma';
import {
  fetchNseCorporateActions,
  buildRegistry,
  type CorporateActionRegistry,
  type ParsedCorporateAction,
  localDateKey,
  dateFromDayKey,
} from '@/lib/nse-corporate-actions';

function normalizeExDate(d: Date): Date {
  return dateFromDayKey(localDateKey(d));
}

const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function toDbRow(a: ParsedCorporateAction) {
  return {
    symbol: a.symbol,
    exDate: normalizeExDate(a.exDate),
    actionType: a.type,
    subject: a.subject,
    ratioNum: a.bonusRatio?.bonus ?? null,
    ratioDen: a.bonusRatio?.held ?? null,
    shareMultiplier: a.shareMultiplier ?? null,
    dividendAmount: a.dividendAmount ?? null,
    source: a.source,
  };
}

function fromDbRow(row: {
  symbol: string;
  exDate: Date;
  actionType: string;
  subject: string;
  ratioNum: number | null;
  ratioDen: number | null;
  shareMultiplier: number | null;
  dividendAmount: number | null;
  source: string;
}): ParsedCorporateAction {
  const type = row.actionType as ParsedCorporateAction['type'];
  return {
    symbol: row.symbol,
    exDate: normalizeExDate(row.exDate),
    type,
    subject: row.subject,
    source: row.source as 'NSE',
    shareMultiplier: row.shareMultiplier ?? undefined,
    dividendAmount: row.dividendAmount ?? undefined,
    bonusRatio:
      row.ratioNum != null && row.ratioDen != null
        ? { bonus: row.ratioNum, held: row.ratioDen }
        : undefined,
  };
}

export async function upsertCorporateActions(
  actions: ParsedCorporateAction[]
): Promise<number> {
  let count = 0;
  for (const a of actions) {
    await prisma.corporateAction.upsert({
      where: {
        symbol_actionType_subject: {
          symbol: a.symbol,
          actionType: a.type,
          subject: a.subject,
        },
      },
      create: toDbRow(a),
      update: {
        exDate: normalizeExDate(a.exDate),
        ratioNum: a.bonusRatio?.bonus ?? null,
        ratioDen: a.bonusRatio?.held ?? null,
        shareMultiplier: a.shareMultiplier ?? null,
        dividendAmount: a.dividendAmount ?? null,
        fetchedAt: new Date(),
      },
    });
    count++;
  }
  return count;
}

export async function loadRegistryForSymbols(
  symbols: string[]
): Promise<CorporateActionRegistry> {
  const unique = [...new Set(symbols.map((s) => s.trim().toUpperCase()))];
  if (unique.length === 0) return new Map();

  const rows = await prisma.corporateAction.findMany({
    where: { symbol: { in: unique } },
    orderBy: { exDate: 'asc' },
  });

  return buildRegistry(rows.map(fromDbRow));
}

export async function syncCorporateActionsForSymbols(
  symbols: string[],
  force = false
): Promise<{ registry: CorporateActionRegistry; synced: number; errors: string[] }> {
  const unique = [...new Set(symbols.map((s) => s.trim().toUpperCase()))];
  const errors: string[] = [];
  let synced = 0;

  for (const symbol of unique) {
    try {
      const existing = await prisma.corporateAction.findFirst({
        where: { symbol },
        orderBy: { fetchedAt: 'desc' },
      });
      const stale =
        !existing ||
        Date.now() - existing.fetchedAt.getTime() > CACHE_MAX_AGE_MS;

      if (!force && !stale) continue;

      const actions = await fetchNseCorporateActions(symbol);
      synced += await upsertCorporateActions(actions);
      await new Promise((r) => setTimeout(r, 300));
    } catch (e) {
      errors.push(
        `${symbol}: ${e instanceof Error ? e.message : 'fetch failed'}`
      );
    }
  }

  const registry = await loadRegistryForSymbols(unique);
  return { registry, synced, errors };
}

export { localDateKey };
