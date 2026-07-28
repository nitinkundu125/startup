import { fetchYahooDailyCloses } from './src/lib/index-history';
import { runDynamicBacktest } from './src/lib/dynamic-backtester';
import { MASTER_STRATEGY_LIBRARY } from './src/lib/strategy-library';

async function test() {
  const symbol = "NTPC.NS";
  const result = await fetchYahooDailyCloses(symbol, new Date('1990-01-01'));
  
  const resultFriday = result.slice(0, -1);
  const closesF = resultFriday.map((r: any) => r.close);
  const highsF = resultFriday.map((r: any) => r.high ?? r.close);
  const lowsF = resultFriday.map((r: any) => r.low ?? r.close);
  const volumesF = resultFriday.map((r: any) => r.volume ?? 0);
  const datesF = resultFriday.map((r: any) => new Date(r.date));

  const strats = MASTER_STRATEGY_LIBRARY.filter(s => (s.type === 'COMPOUND' ? s.name : s.type) === "Pure RSI Reversion (10)");
  console.log(`Found ${strats.length} strategies named Pure RSI Reversion (10)`);
  
  strats.forEach((strat, i) => {
    const statsF = runDynamicBacktest(strat, closesF, highsF, lowsF, volumesF, datesF);
    console.log(`Strat ${i} Friday Signal:`, statsF.currentSignal);
    
    // Now run Monday
    const closes = result.map((r: any) => r.close);
    const highs = result.map((r: any) => r.high ?? r.close);
    const lows = result.map((r: any) => r.low ?? r.close);
    const volumes = result.map((r: any) => r.volume ?? 0);
    const dates = result.map((r: any) => new Date(r.date));
    const statsM = runDynamicBacktest(strat, closes, highs, lows, volumes, dates);
    console.log(`Strat ${i} Monday Signal:`, statsM.currentSignal);
  });
}
test().catch(console.error);
