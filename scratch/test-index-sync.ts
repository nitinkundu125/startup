import { syncIndex, getIndexSymbols, getIndexSymbolsAsOf, getSyncStatus, parseConstituentCsv } from '../src/lib/index-constituents';
import { NIFTY_50_SYMBOLS } from '../src/lib/nifty500';

async function main() {
  // Parser first, on a line with a comma inside the company name.
  const sample = 'Company Name,Industry,Symbol,Series,ISIN Code\n"Bajaj Finserv Ltd., Inc.",Financial Services,BAJAJFINSV,EQ,INE918I01026\nReliance Industries Ltd.,Oil Gas,RELIANCE,EQ,INE002A01018';
  console.log('parser (quoted comma):', JSON.stringify(parseConstituentCsv(sample)));

  console.log('\nsyncing nifty50 from NSE...');
  const r = await syncIndex('nifty50');
  console.log('  ok:', r.ok, '| count:', r.count, r.error ? `| error: ${r.error}` : '');
  if (r.ok) {
    console.log('  added:', r.added.length, '| removed:', r.removed.length);
    const live = await getIndexSymbols('nifty50');
    const builtin = new Set(NIFTY_50_SYMBOLS);
    const onlyLive = live.filter(s => !builtin.has(s));
    const onlyBuiltin = NIFTY_50_SYMBOLS.filter(s => !live.includes(s));
    console.log(`  from DB: ${live.length} symbols`);
    console.log('  in NSE but NOT in hardcoded file:', onlyLive.join(', ') || '(none)');
    console.log('  in hardcoded file but NOT in NSE:', onlyBuiltin.join(', ') || '(none)');
    const asOf = await getIndexSymbolsAsOf('nifty50', new Date());
    console.log('  point-in-time query (today):', asOf.length, 'symbols');
    const past = await getIndexSymbolsAsOf('nifty50', new Date('2020-01-01'));
    console.log('  point-in-time query (2020):', past.length, 'symbols  <- no history yet, as expected');
  }
  console.log('\nsync log:', JSON.stringify(await getSyncStatus(), null, 0));
}
main();
