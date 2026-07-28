import { fetchYahooDailyCloses, toPriceSeries } from '../src/lib/index-history';
import { runDynamicBacktest } from '../src/lib/dynamic-backtester';
import { MASTER_STRATEGY_LIBRARY } from '../src/lib/strategy-library';
import { resample } from '../src/lib/timeframe';

async function main() {
  const rows = await fetchYahooDailyCloses('RELIANCE.NS', new Date('2010-01-01'));
  const s = toPriceSeries(rows);
  console.log(`RELIANCE daily bars: ${s.dates.length}`);
  for (const tf of ['weekly','monthly'] as const) {
    const r = resample({...s}, tf);
    console.log(`  resampled ${tf.padEnd(7)}: ${r.dates.length} bars  last=${r.dates[r.dates.length-1].toISOString().slice(0,10)} close=${r.closes[r.closes.length-1].toFixed(1)}`);
  }

  let traded = 0, zero = 0;
  const zeroNames: string[] = [];
  const byTf: Record<string, {n:number; traded:number}> = {};
  for (const st of MASTER_STRATEGY_LIBRARY as any[]) {
    const tf = st.timeframe ?? 'daily';
    byTf[tf] ??= {n:0, traded:0};
    byTf[tf].n++;
    const res = runDynamicBacktest(st, s.closes, s.highs, s.lows, s.volumes, s.dates, s.opens);
    if (res.totalTrades > 0) { traded++; byTf[tf].traded++; } else { zero++; if (zeroNames.length < 12) zeroNames.push(st.name); }
  }
  console.log(`\nstrategies producing >=1 trade: ${traded}/${MASTER_STRATEGY_LIBRARY.length}  (zero: ${zero})`);
  for (const [tf,v] of Object.entries(byTf)) console.log(`  ${tf.padEnd(8)} ${v.traded}/${v.n}`);
  if (zeroNames.length) console.log('\n  sample of zero-trade strategies:'), zeroNames.forEach(n => console.log('   -', n));

  console.log('\n--- named systems on RELIANCE ---');
  for (const st of (MASTER_STRATEGY_LIBRARY as any[]).filter(x => x.source).slice(0, 12)) {
    const r = runDynamicBacktest(st, s.closes, s.highs, s.lows, s.volumes, s.dates, s.opens);
    console.log(`  ${st.name.padEnd(34).slice(0,34)} ${String(r.totalTrades).padStart(3)}t  win ${r.winRate.toFixed(0).padStart(3)}%  avg ${r.averageReturn>0?'+':''}${r.averageReturn.toFixed(2)}%  ${r.currentSignal}`);
  }
}
main();
