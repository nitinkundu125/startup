/**
 * Sync NSE corporate actions for symbols in tradebooks.
 * npx tsx scripts/sync-corporate-actions.mjs KOTAKBANK FCL
 */
import { syncCorporateActionsForSymbols } from '../src/lib/ca-store.ts';

const symbols = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['KOTAKBANK', 'FCL', 'HDFCBANK', 'UJJIVANSFB', 'IIFL'];

const { synced, errors, registry } = await syncCorporateActionsForSymbols(symbols, true);
console.log('Synced', synced, 'actions');
for (const sym of symbols) {
  const days = registry.get(sym.toUpperCase());
  if (!days) {
    console.log(sym, ': none');
    continue;
  }
  for (const [day, acts] of days) {
    for (const a of acts) {
      console.log(sym, day, a.type, a.shareMultiplier ?? a.bonusRatio ?? '');
    }
  }
}
if (errors.length) console.error('Errors:', errors);
