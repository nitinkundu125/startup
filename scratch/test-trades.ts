import { fetchYahooDailyCloses } from './src/lib/index-history';
import { runDynamicBacktest } from './src/lib/dynamic-backtester';
import { MASTER_STRATEGY_LIBRARY } from './src/lib/strategy-library';

async function test() {
  const symbol = "NTPC.NS";
  const period1 = new Date('1990-01-01');
  const result = await fetchYahooDailyCloses(symbol, period1);
  const closes = result.map((r: any) => r.close);
  const highs = result.map((r: any) => r.high ?? r.close);
  const lows = result.map((r: any) => r.low ?? r.close);
  const volumes = result.map((r: any) => r.volume ?? 0);
  const dates = result.map((r: any) => new Date(r.date));
  
  const strat = MASTER_STRATEGY_LIBRARY.find(s => {
    const name = s.type === 'COMPOUND' ? (s.name || 'Custom Compound') : `Single ${s.type}`;
    return name === "Pure RSI Reversion (10)";
  });
  
  const stats = runDynamicBacktest(strat!, closes, highs, lows, volumes, dates);
  const trades = stats.trades.slice(-5);
  console.log("Last 5 trades:");
  console.dir(trades, {depth: null});
  console.log("Current Signal:", stats.currentSignal);
}
test();
