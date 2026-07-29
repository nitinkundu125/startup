import { runOptimizer } from '../src/lib/optimizer';
async function main() {
  const cases = [
    { label: 'no filter',            f: {} },
    { label: 'maxDD 15%',            f: { maxDrawdown: 15 } },
    { label: 'maxDD 8%',             f: { maxDrawdown: 8 } },
    { label: 'winRate 70 + maxDD 15',f: { minWinRate: 70, maxDrawdown: 15 } },
    { label: 'winRate 70, trades 10, maxDD 15', f: { minWinRate: 70, minTrades: 10, maxDrawdown: 15 } },
  ];
  for (const c of cases) {
    const r = await runOptimizer('RELIANCE.NS', c.f as any);
    const worst = r.results.length
      ? Math.min(...r.results.map(x => x.inSample.maxDrawdown)).toFixed(1)
      : 'n/a';
    console.log(`${c.label.padEnd(28)} -> ${String(r.results.length).padStart(3)} strategies | deepest fitted DD kept: ${worst}%`);
  }
}
main();
