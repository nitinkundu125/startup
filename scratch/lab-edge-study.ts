/**
 * Does the Lab have an edge?
 *
 * Runs the real engine over a real universe and asks one question: do strategies
 * selected on the training window still work on data they were never fitted to?
 *
 * The comparison that matters is in-sample vs out-of-sample. If a strategy
 * clears 67% in-sample and lands near 50% out-of-sample, the selection found
 * noise. Buy-and-hold over the same window is the benchmark any of this has to
 * beat to be worth running.
 *
 *   npx tsx scratch/lab-edge-study.ts
 */
import { fetchYahooDailyCloses, toPriceSeries } from '../src/lib/index-history';
import { runSplitBacktest } from '../src/lib/dynamic-backtester';
import { MASTER_STRATEGY_LIBRARY } from '../src/lib/strategy-library';
import { NIFTY_50_SYMBOLS } from '../src/lib/nifty500';
import {
  MIN_IN_SAMPLE_TRADES,
  MIN_IN_SAMPLE_WIN_RATE,
  MIN_OOS_TRADES,
  backtestStartDate,
} from '../src/lib/backtest-constants';

type Row = {
  symbol: string;
  strategy: string;
  isWin: number;
  isTrades: number;
  isAvg: number;
  oosWin: number;
  oosTrades: number;
  oosAvg: number;
};

const UNIVERSE = NIFTY_50_SYMBOLS.slice(0, 30);

function mean(xs: number[]) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;
}
function median(xs: number[]) {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

async function main() {
const selected: Row[] = [];
const buyHold: { symbol: string; oosReturnPct: number }[] = [];
let symbolsWithData = 0;

console.log(`Universe: ${UNIVERSE.length} symbols x ${MASTER_STRATEGY_LIBRARY.length} strategies`);
console.log(`Selection bar: >=${MIN_IN_SAMPLE_TRADES} trades and >=${MIN_IN_SAMPLE_WIN_RATE}% win rate, in-sample only\n`);

for (const [i, symbol] of UNIVERSE.entries()) {
  process.stdout.write(`\r  scanning ${i + 1}/${UNIVERSE.length} ${symbol.padEnd(16)}`);
  let rows;
  try {
    rows = await fetchYahooDailyCloses(symbol, backtestStartDate());
  } catch {
    continue;
  }
  if (!rows || rows.length < 400) continue;
  symbolsWithData++;

  const s = toPriceSeries(rows);

  for (const strat of MASTER_STRATEGY_LIBRARY) {
    const split = runSplitBacktest(strat, s.closes, s.highs, s.lows, s.volumes, s.dates, s.opens);
    const { inSample, outOfSample, splitDate } = split;

    if (
      inSample.totalTrades < MIN_IN_SAMPLE_TRADES ||
      inSample.winRate < MIN_IN_SAMPLE_WIN_RATE
    ) {
      continue;
    }

    selected.push({
      symbol,
      strategy: strat.type === 'COMPOUND' ? strat.name ?? '?' : strat.type,
      isWin: inSample.winRate,
      isTrades: inSample.totalTrades,
      isAvg: inSample.averageReturn,
      oosWin: outOfSample.winRate,
      oosTrades: outOfSample.totalTrades,
      oosAvg: outOfSample.averageReturn,
    });

    // Buy-and-hold over the same held-back window, recorded once per symbol.
    if (splitDate && !buyHold.some((b) => b.symbol === symbol)) {
      const cut = s.dates.findIndex((d) => d.getTime() >= splitDate.getTime());
      if (cut > 0) {
        const from = s.closes[cut];
        const to = s.closes[s.closes.length - 1];
        buyHold.push({ symbol, oosReturnPct: ((to - from) / from) * 100 });
      }
    }
  }
}

console.log('\n');
console.log('='.repeat(66));
console.log(`Symbols with usable history : ${symbolsWithData}`);
console.log(`Strategy/symbol pairs tested: ${symbolsWithData * MASTER_STRATEGY_LIBRARY.length}`);
console.log(`Passed the in-sample filter : ${selected.length}`);

const validated = selected.filter((r) => r.oosTrades >= MIN_OOS_TRADES);
console.log(`Of those, enough OOS trades : ${validated.length}`);

if (validated.length) {
  const isWins = validated.map((r) => r.isWin);
  const oosWins = validated.map((r) => r.oosWin);
  const isAvgs = validated.map((r) => r.isAvg);
  const oosAvgs = validated.map((r) => r.oosAvg);

  console.log('\n--- WIN RATE: what selection promised vs what happened ---');
  console.log(`  in-sample      mean ${mean(isWins).toFixed(1)}%   median ${median(isWins).toFixed(1)}%`);
  console.log(`  out-of-sample  mean ${mean(oosWins).toFixed(1)}%   median ${median(oosWins).toFixed(1)}%`);
  console.log(`  decay          ${(mean(isWins) - mean(oosWins)).toFixed(1)} points`);

  console.log('\n--- AVG NET RETURN PER TRADE (after costs) ---');
  console.log(`  in-sample      mean ${mean(isAvgs).toFixed(2)}%`);
  console.log(`  out-of-sample  mean ${mean(oosAvgs).toFixed(2)}%`);

  const stillGood = validated.filter((r) => r.oosWin >= 50 && r.oosAvg > 0);
  console.log(
    `\n  Still profitable out-of-sample: ${stillGood.length}/${validated.length} ` +
      `(${((stillGood.length / validated.length) * 100).toFixed(0)}%)`
  );

  const bh = buyHold.map((b) => b.oosReturnPct);
  console.log(`\n--- BENCHMARK over the same held-back window ---`);
  console.log(`  buy & hold     mean ${mean(bh).toFixed(1)}%   median ${median(bh).toFixed(1)}%  (n=${bh.length})`);

  console.log('\n--- TOP 10 BY OUT-OF-SAMPLE AVG RETURN ---');
  [...validated]
    .sort((a, b) => b.oosAvg - a.oosAvg)
    .slice(0, 10)
    .forEach((r, i) => {
      console.log(
        `  ${String(i + 1).padStart(2)}. ${r.symbol.replace('.NS', '').padEnd(12)} ` +
          `IS ${r.isWin.toFixed(0).padStart(3)}%/${String(r.isTrades).padStart(2)}t  ->  ` +
          `OOS ${r.oosWin.toFixed(0).padStart(3)}%/${String(r.oosTrades).padStart(2)}t  ` +
          `${r.oosAvg > 0 ? '+' : ''}${r.oosAvg.toFixed(2)}%/trade   ${r.strategy.slice(0, 30)}`
      );
    });
}
console.log('='.repeat(66));
}
main();
