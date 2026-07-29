/**
 * Turning a symbol into something a human reads.
 *
 * A ticker is a lookup key, not a label: "M&MFIN" is not recognisable the way
 * "Mahindra & Mahindra Financial Services Ltd." is. The monthly index sync
 * already stores a name for every constituent, so the data was there all along
 * and only the UI was showing keys.
 *
 * Deliberately free of any database import — client components use displayStock,
 * and pulling Prisma in here would drag it into the browser bundle. The lookup
 * lives in stock-names.server.ts.
 */

/** Ticker without its exchange suffix. `RELIANCE.NS` reads better as `RELIANCE`. */
export function bareSymbol(symbol: string): string {
  return symbol.replace(/\.(NS|BO)$/i, '');
}

/**
 * What to show the user for a symbol.
 *
 * Falls back to the bare ticker, which is not a rare path: scanning a single
 * stock accepts anything Yahoo knows, including symbols in no index we sync.
 */
export function displayStock(symbol: string, name?: string | null): string {
  const trimmed = name?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : bareSymbol(symbol);
}
