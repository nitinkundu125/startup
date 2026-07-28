import { fetchYahooDailyCloses } from './src/lib/index-history';
import { runDynamicBacktest, StrategyParams } from './src/lib/dynamic-backtester';
import { MASTER_STRATEGY_LIBRARY } from './src/lib/strategy-library';

async function test() {
  console.log("Testing RELIANCE.NS");
  const period1 = new Date('1990-01-01');
  const result = await fetchYahooDailyCloses('RELIANCE.NS', period1);
  console.log("Fetched", result.length, "days of data");
  
  const closes = result.map((r: any) => r.close);
  const highs = result.map((r: any) => r.high ?? r.close);
  const lows = result.map((r: any) => r.low ?? r.close);
  const volumes = result.map((r: any) => r.volume ?? 0);
  const dates = result.map((r: any) => new Date(r.date));
  
  let passed = 0;
  for (const strat of MASTER_STRATEGY_LIBRARY) {
    const stats = runDynamicBacktest(strat, closes, highs, lows, volumes, dates);
    if (stats.totalTrades >= 3 && stats.winRate >= 67) {
      passed++;
    }
  }
  console.log(`Passed 67% win rate threshold: ${passed}`);
}
test().catch(console.error);
