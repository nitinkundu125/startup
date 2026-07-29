import { fetchYahooDailyCloses, toPriceSeries } from '../src/lib/index-history';
import { runSplitBacktest } from '../src/lib/dynamic-backtester';
import { MASTER_STRATEGY_LIBRARY } from '../src/lib/strategy-library';
import { backtestStartDate, MIN_OOS_TRADES, MIN_IN_SAMPLE_TRADES, MIN_IN_SAMPLE_WIN_RATE, HELD_UP_MIN_WIN_RATE } from '../src/lib/backtest-constants';

const CAP = 10;
async function main() {
  const syms = ['RELIANCE.NS','INFY.NS','HDFCBANK.NS','TATAMOTORS.NS','SUNPHARMA.NS'];
  let matched = 0, kept = 0, heldUp = 0, buys = 0, ms = 0;
  for (const sym of syms) {
    const rows = await fetchYahooDailyCloses(sym, backtestStartDate());
    if (!rows.length) continue;
    const p = toPriceSeries(rows);
    const t = Date.now();
    const rs: any[] = [];
    for (const st of MASTER_STRATEGY_LIBRARY as any[]) {
      const sp = runSplitBacktest(st, p.closes, p.highs, p.lows, p.volumes, p.dates, p.opens);
      if (sp.full.totalTrades === 0) continue;
      if (sp.inSample.totalTrades < MIN_IN_SAMPLE_TRADES || sp.inSample.winRate < MIN_IN_SAMPLE_WIN_RATE) continue;
      rs.push({ held: sp.outOfSample.totalTrades >= MIN_OOS_TRADES && sp.outOfSample.winRate >= HELD_UP_MIN_WIN_RATE,
                sig: sp.outOfSample.currentSignal, oosWin: sp.outOfSample.winRate, n: sp.outOfSample.totalTrades });
    }
    ms += Date.now() - t;
    matched += rs.length;
    rs.sort((a,b) => (a.held===b.held ? b.oosWin-a.oosWin : (a.held?-1:1)));
    const top = rs.slice(0, CAP);
    kept += top.length;
    heldUp += top.filter(r=>r.held).length;
    buys += top.filter(r=>r.sig==='NEW_BUY').length;
  }
  const n = syms.length;
  console.log(`per symbol: ${(matched/n).toFixed(0)} matched -> ${(kept/n).toFixed(0)} returned`);
  console.log(`\nPROJECTED NIFTY 500 SCAN`);
  console.log(`  matched pairs      : ~${Math.round(matched/n*500).toLocaleString()}`);
  console.log(`  rows returned      : ~${Math.round(kept/n*500).toLocaleString()}   (was ~130,000)`);
  console.log(`  rows painted       : 200 initially`);
  console.log(`  validated (heldUp) : ~${Math.round(heldUp/n*500).toLocaleString()}`);
  console.log(`  BUY TODAY signals  : ~${Math.round(buys/n*500).toLocaleString()}`);
}
main();
