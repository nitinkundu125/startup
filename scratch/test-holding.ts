import { fetchYahooDailyCloses } from './src/lib/index-history';
import { runDynamicBacktest } from './src/lib/dynamic-backtester';
import { MASTER_STRATEGY_LIBRARY } from './src/lib/strategy-library';

async function test() {
  const symbol = "TCS.NS";
  const result = await fetchYahooDailyCloses(symbol, new Date('1990-01-01'));
  const closes = result.map((r: any) => r.close);
  const highs = result.map((r: any) => r.high ?? r.close);
  const lows = result.map((r: any) => r.low ?? r.close);
  const volumes = result.map((r: any) => r.volume ?? 0);
  const dates = result.map((r: any) => new Date(r.date));
  
  for (const strat of MASTER_STRATEGY_LIBRARY) {
    const stats = runDynamicBacktest(strat, closes, highs, lows, volumes, dates);
    if (stats.currentSignal === 'HOLDING' || stats.currentSignal === 'NEW_BUY' || stats.currentSignal === 'NEW_SELL') {
      console.log(`Strat: ${strat.type === 'COMPOUND' ? strat.name : strat.type}, Signal: ${stats.currentSignal}`);
    }
  }
}
test().catch(console.error);
