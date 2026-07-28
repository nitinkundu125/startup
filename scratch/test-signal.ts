import { fetchYahooDailyCloses } from './src/lib/index-history';
import { runDynamicBacktest } from './src/lib/dynamic-backtester';
import { MASTER_STRATEGY_LIBRARY } from './src/lib/strategy-library';

async function test() {
  const symbol = "NTPC.NS";
  const period1 = new Date('1990-01-01');
  const result = await fetchYahooDailyCloses(symbol, period1);
  console.log(`Fetched ${result.length} days of data for ${symbol}`);
  
  // Let's look at the last 5 dates
  const last5 = result.slice(-5);
  for (const r of last5) {
    console.log(`Date: ${r.date}, Close: ${r.close}`);
  }

  const closes = result.map((r: any) => r.close);
  const highs = result.map((r: any) => r.high ?? r.close);
  const lows = result.map((r: any) => r.low ?? r.close);
  const volumes = result.map((r: any) => r.volume ?? 0);
  const dates = result.map((r: any) => new Date(r.date));
  
  const strat = MASTER_STRATEGY_LIBRARY.find(s => {
    const name = s.type === 'COMPOUND' ? (s.name || 'Custom Compound') : `Single ${s.type}`;
    return name === "Pure RSI Reversion (10)";
  });
  
  if (!strat) {
    console.log("Strategy not found");
    return;
  }
  
  const stats = runDynamicBacktest(strat, closes, highs, lows, volumes, dates);
  console.log("Current Signal:", stats.currentSignal);
  console.log("Last Signal Date:", stats.lastSignalDate);
  
  // Let's run backtest up to yesterday to see what it was
  const closesYesterday = closes.slice(0, -1);
  const highsYesterday = highs.slice(0, -1);
  const lowsYesterday = lows.slice(0, -1);
  const volumesYesterday = volumes.slice(0, -1);
  const datesYesterday = dates.slice(0, -1);
  const statsYesterday = runDynamicBacktest(strat, closesYesterday, highsYesterday, lowsYesterday, volumesYesterday, datesYesterday);
  console.log("Signal if ran yesterday:", statsYesterday.currentSignal);
  
  // Let's run backtest up to day before yesterday
  const closes2 = closes.slice(0, -2);
  const highs2 = highs.slice(0, -2);
  const lows2 = lows.slice(0, -2);
  const volumes2 = volumes.slice(0, -2);
  const dates2 = dates.slice(0, -2);
  const stats2 = runDynamicBacktest(strat, closes2, highs2, lows2, volumes2, dates2);
  console.log("Signal if ran 2 days ago:", stats2.currentSignal);
}

test().catch(console.error);
