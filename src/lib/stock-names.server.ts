import { prisma } from './prisma';

/**
 * Company-name lookup. Server only — see the note in stock-names.ts.
 *
 * Names are attached when a response is built, never stored alongside cached
 * results: the scan cache holds result rows as JSON, and baking a label into
 * them would mean discarding a day of scanning just to reword it.
 */

/**
 * symbol -> company name, for the symbols asked about.
 *
 * A symbol can appear in several indices at once (every Nifty 50 member is also
 * in the Nifty 500) and across membership periods, so rows are deduplicated by
 * symbol. Symbols with no name are simply absent; callers fall back to the
 * ticker via displayStock.
 */
export async function getStockNames(symbols: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(symbols)];
  if (unique.length === 0) return {};

  const rows = await prisma.indexMembership.findMany({
    where: { symbol: { in: unique }, NOT: { company: null } },
    select: { symbol: true, company: true },
    distinct: ['symbol'],
  });

  const out: Record<string, string> = {};
  for (const r of rows) {
    if (r.company) out[r.symbol] = r.company;
  }
  return out;
}
