/**
 * Quick simulation test — run: npx tsx scripts/test-corporate-actions.mjs
 */
import { readFileSync } from 'fs';
import { parseTradebookCsv } from '../src/lib/tradebook.ts';
import { preprocessCorporateActions } from '../src/lib/corporate-actions.ts';

function parseCsv(path) {
  return parseTradebookCsv(readFileSync(path, 'utf8'));
}

function simulate(processed) {
  const bySym = new Map();
  for (const r of processed) {
    if (!bySym.has(r.symbol)) bySym.set(r.symbol, []);
    bySym.get(r.symbol).push(r);
  }
  for (const [sym, rows] of bySym) {
    let qty = 0,
      inv = 0;
    for (const r of rows.sort((a, b) => a.tradeDate - b.tradeDate)) {
      const t = r.type;
      if (t === 'BUY') {
        qty += r.quantity;
        inv += r.quantity * r.price;
      } else if (t === 'BONUS' || t === 'CA_BUY') {
        qty += r.quantity;
      } else if (t === 'SPLIT') {
        qty *= r.splitRatio ?? 1;
      } else if (t === 'SELL') {
        const sq = Math.min(r.quantity, qty);
        if (qty > 0) {
          const avg = inv / qty;
          qty -= sq;
          inv -= sq * avg;
        }
      }
    }
    if (['FCL', 'UJJIVANSFB', 'HDFCBANK'].includes(sym)) {
      console.log(`${sym}: qty=${qty.toFixed(0)} invested=${inv.toFixed(0)} avg=${qty ? (inv / qty).toFixed(2) : 0}`);
    }
  }
}

const files = ['24.csv', '25.csv', '26.csv'].map((f) =>
  `/Users/nitinkundu/Downloads/${f}`
);

let all = [];
for (const f of files) {
  try {
    const { rows } = parseCsv(f);
    all = all.concat(rows);
  } catch (e) {
    console.warn('skip', f, e.message);
  }
}

const processed = preprocessCorporateActions(all);
console.log('Processed', processed.length, 'from', all.length);
const types = {};
for (const r of processed) types[r.type] = (types[r.type] || 0) + 1;
console.log('Types:', types);
simulate(processed);
