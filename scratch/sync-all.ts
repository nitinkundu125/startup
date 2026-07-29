import { syncAllIndices, getSyncStatus } from '../src/lib/index-constituents';
import * as B from '../src/lib/nifty500';
const builtin: Record<string,string[]> = {
  nifty50: B.NIFTY_50_SYMBOLS, nifty100: B.NIFTY_100_SYMBOLS,
  midcap150: B.NIFTY_MIDCAP_150_SYMBOLS, smallcap250: B.NIFTY_SMALLCAP_250_SYMBOLS,
  nifty500: B.NIFTY_500_SYMBOLS,
};
async function main() {
  const results = await syncAllIndices();
  console.log('index         ok   NSE  hardcoded   drift');
  for (const r of results) {
    const bi = builtin[r.indexId] ?? [];
    const biSet = new Set(bi);
    const drift = r.ok ? `+${r.added.filter(s=>!biSet.has(s)).length} / -${bi.filter(s=>!r.added.includes(s) && false).length}` : '-';
    console.log(`${r.indexId.padEnd(13)} ${r.ok?'yes':'NO '}  ${String(r.count).padStart(4)}  ${String(bi.length).padStart(9)}   ${r.error ?? ''}`);
  }
}
main();
