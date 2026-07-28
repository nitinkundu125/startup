/** Does ranking by win rate pick the profitable strategies? */
import { fetchYahooDailyCloses, toPriceSeries } from '../src/lib/index-history';
import { runDynamicBacktest } from '../src/lib/dynamic-backtester';
import { MASTER_STRATEGY_LIBRARY } from '../src/lib/strategy-library';

async function main() {
  const rows = await fetchYahooDailyCloses('RELIANCE.NS', new Date('2010-01-01'));
  const s = toPriceSeries(rows);
  const out: {name:string; win:number; avg:number; n:number}[] = [];
  for (const st of MASTER_STRATEGY_LIBRARY as any[]) {
    const r = runDynamicBacktest(st, s.closes, s.highs, s.lows, s.volumes, s.dates, s.opens);
    if (r.totalTrades >= 10) out.push({ name: st.name, win: r.winRate, avg: r.averageReturn, n: r.totalTrades });
  }
  const byWin = [...out].sort((a,b)=>b.win-a.win).slice(0,8);
  console.log('TOP 8 BY WIN RATE — and whether they actually make money:');
  for (const r of byWin) console.log(`  ${r.win.toFixed(0).padStart(3)}% win  ${r.avg>0?'+':''}${r.avg.toFixed(2)}%/trade  n=${String(r.n).padStart(3)}  ${r.avg<=0?'<-- LOSES MONEY  ':'                  '}${r.name.slice(0,40)}`);
  const byAvg = [...out].sort((a,b)=>b.avg-a.avg).slice(0,8);
  console.log('\nTOP 8 BY AVERAGE RETURN:');
  for (const r of byAvg) console.log(`  ${r.win.toFixed(0).padStart(3)}% win  ${r.avg>0?'+':''}${r.avg.toFixed(2)}%/trade  n=${String(r.n).padStart(3)}  ${r.name.slice(0,40)}`);
  const losers = out.filter(r => r.win >= 55 && r.avg <= 0).length;
  const winners = out.filter(r => r.win < 50 && r.avg > 0).length;
  console.log(`\nHigh win rate (>=55%) but LOSES money : ${losers} strategies`);
  console.log(`Low win rate (<50%) but MAKES money   : ${winners} strategies`);
}
main();
