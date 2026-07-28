import { fetchYahooDailyCloses } from './src/lib/index-history';
import { runDynamicBacktest } from './src/lib/dynamic-backtester';
import { MASTER_STRATEGY_LIBRARY } from './src/lib/strategy-library';

async function test() {
  const symbol = "NTPC.NS";
  const result = await fetchYahooDailyCloses(symbol, new Date('1990-01-01'));
  
  // Friday data
  const resultFriday = result.slice(0, -1);
  const closes = resultFriday.map((r: any) => r.close);
  const highs = resultFriday.map((r: any) => r.high ?? r.close);
  const lows = resultFriday.map((r: any) => r.low ?? r.close);
  const volumes = resultFriday.map((r: any) => r.volume ?? 0);
  const dates = resultFriday.map((r: any) => new Date(r.date));
  
  console.log("Last date in Friday array:", dates[dates.length-1]);
  
  for (const strat of MASTER_STRATEGY_LIBRARY) {
    const stats = runDynamicBacktest(strat, closes, highs, lows, volumes, dates);
    if (stats.currentSignal === 'NEW_BUY') {
      console.log(`Strat: ${strat.type === 'COMPOUND' ? strat.name : strat.type}, Signal: ${stats.currentSignal}`);
    }
  }
}
test().catch(console.error);
