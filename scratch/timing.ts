import { fetchYahooDailyCloses, toPriceSeries } from '../src/lib/index-history';
import { runSplitBacktest } from '../src/lib/dynamic-backtester';
import { MASTER_STRATEGY_LIBRARY } from '../src/lib/strategy-library';
import { backtestStartDate } from '../src/lib/backtest-constants';

async function main() {
  const syms = ['RELIANCE.NS','INFY.NS','HDFCBANK.NS'];
  let fetchMs = 0, cpuMs = 0, rowsTotal = 0, passing = 0;
  for (const s of syms) {
    let t = Date.now();
    const rows = await fetchYahooDailyCloses(s, backtestStartDate());
    fetchMs += Date.now() - t;
    rowsTotal += rows.length;
    const p = toPriceSeries(rows);
    t = Date.now();
    for (const st of MASTER_STRATEGY_LIBRARY as any[]) {
      const r = runSplitBacktest(st, p.closes, p.highs, p.lows, p.volumes, p.dates, p.opens);
      if (r.full.totalTrades > 0) passing++;
    }
    cpuMs += Date.now() - t;
  }
  const n = syms.length;
  console.log(`avg bars/symbol      : ${Math.round(rowsTotal/n)}`);
  console.log(`avg Yahoo fetch      : ${Math.round(fetchMs/n)} ms`);
  console.log(`avg 277-strategy run : ${Math.round(cpuMs/n)} ms`);
  console.log(`avg total per symbol : ${Math.round((fetchMs+cpuMs)/n)} ms`);
  console.log(`results rows/symbol  : ~${Math.round(passing/n)}`);
  const per = (fetchMs+cpuMs)/n;
  console.log(`\nprojected Nifty 500 (sequential, no cache):`);
  console.log(`  ${Math.round(per*500/1000)} s  = ${(per*500/60000).toFixed(1)} minutes`);
  console.log(`  result rows: ~${Math.round(passing/n*500).toLocaleString()}`);
}
main();
