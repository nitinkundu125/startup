import { fetchYahooDailyCloses } from './src/lib/index-history';
import { runDynamicBacktest } from './src/lib/dynamic-backtester';
import { MASTER_STRATEGY_LIBRARY } from './src/lib/strategy-library';

async function test() {
  const symbol = "NTPC.NS";
  const result = await fetchYahooDailyCloses(symbol, new Date('1990-01-01'));
  const closes = result.map((r: any) => r.close);
  const dates = result.map((r: any) => new Date(r.date));
  
  const strat = MASTER_STRATEGY_LIBRARY.find(s => (s.type === 'COMPOUND' ? s.name : s.type) === "Pure RSI Reversion (10)")!;
  
  const resultFriday = result.slice(0, -1);
  const closesF = resultFriday.map((r: any) => r.close);
  const highsF = resultFriday.map((r: any) => r.high ?? r.close);
  const lowsF = resultFriday.map((r: any) => r.low ?? r.close);
  const volumesF = resultFriday.map((r: any) => r.volume ?? 0);
  const datesF = resultFriday.map((r: any) => new Date(r.date));
  
  const statsF = runDynamicBacktest(strat, closesF, highsF, lowsF, volumesF, datesF);
  console.log("Friday Signal:", statsF.currentSignal);
  
  const highs = result.map((r: any) => r.high ?? r.close);
  const lows = result.map((r: any) => r.low ?? r.close);
  const volumes = result.map((r: any) => r.volume ?? 0);
  const statsM = runDynamicBacktest(strat, closes, highs, lows, volumes, dates);
  console.log("Monday Signal:", statsM.currentSignal);
}
test().catch(console.error);
