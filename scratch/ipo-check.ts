import { fetchYahooDailyCloses, toPriceSeries } from '../src/lib/index-history';
import { backtestStartDate, backtestLookbackYears } from '../src/lib/backtest-constants';
import { runDynamicBacktest } from '../src/lib/dynamic-backtester';
import { MASTER_STRATEGY_LIBRARY } from '../src/lib/strategy-library';

async function main() {
  console.log('lookback years :', backtestLookbackYears(), '(0 = full history)');
  console.log('request start  :', backtestStartDate().toISOString().slice(0,10), '\n');

  // Mix of old listings and recent IPOs to prove we get each one's real start.
  for (const sym of ['RELIANCE.NS','INFY.NS','TCS.NS','ZOMATO.NS','JIOFIN.NS','HYUNDAI.NS']) {
    const rows = await fetchYahooDailyCloses(sym, backtestStartDate());
    if (!rows.length) { console.log(`  ${sym.padEnd(14)} no data`); continue; }
    const first = rows[0].date.toISOString().slice(0,10);
    const yrs = ((rows[rows.length-1].date.getTime() - rows[0].date.getTime())/(365.25*864e5)).toFixed(1);
    console.log(`  ${sym.replace('.NS','').padEnd(12)} first bar ${first}  ${String(rows.length).padStart(5)} bars  ${yrs.padStart(5)} yrs`);
  }

  const rows = await fetchYahooDailyCloses('RELIANCE.NS', backtestStartDate());
  const s = toPriceSeries(rows);
  let traded = 0, totalTrades = 0;
  for (const st of MASTER_STRATEGY_LIBRARY as any[]) {
    const r = runDynamicBacktest(st, s.closes, s.highs, s.lows, s.volumes, s.dates, s.opens);
    if (r.totalTrades > 0) { traded++; totalTrades += r.totalTrades; }
  }
  console.log(`\nRELIANCE full history: ${traded}/${MASTER_STRATEGY_LIBRARY.length} strategies fire, ${totalTrades} trades total`);
}
main();
