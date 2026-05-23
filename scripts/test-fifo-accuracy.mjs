/**
 * Accuracy check on user tradebooks — run: npx tsx scripts/test-fifo-accuracy.mjs
 */
import { readFileSync } from 'fs';
import { parseTradebookCsv } from '../src/lib/tradebook.ts';
import { preprocessCorporateActions } from '../src/lib/corporate-actions.ts';
import { buildPortfolioSummary } from '../src/lib/portfolio.ts';
import { runPortfolioDoctor } from '../src/lib/doctor.ts';

const files = ['24.csv', '25.csv', '26.csv'].map((f) =>
  `/Users/nitinkundu/Downloads/${f}`
);

let all = [];
for (const f of files) {
  try {
    const { rows } = parseTradebookCsv(readFileSync(f, 'utf8'));
    all = all.concat(rows);
  } catch (e) {
    console.warn('skip', f, e.message);
  }
}

const processed = preprocessCorporateActions(all);
console.log('Rows:', all.length, '→ processed:', processed.length);
const types = {};
for (const r of processed) types[r.type] = (types[r.type] || 0) + 1;
console.log('Types:', types);

const bySym = new Map();
for (const r of processed) {
  if (!bySym.has(r.symbol)) bySym.set(r.symbol, []);
  bySym.get(r.symbol).push(r);
}

const txs = [];
let id = 0;
for (const [symbol, rows] of bySym) {
  const assetId = `sym-${symbol}`;
  for (const r of rows.sort((a, b) => a.tradeDate - b.tradeDate)) {
    txs.push({
      assetId,
      symbol,
      name: symbol,
      type: r.type,
      quantity: r.quantity,
      price: r.price,
      splitRatio: r.splitRatio ?? null,
      date: r.tradeDate,
      currentPrice: rows[rows.length - 1].price,
      tradeId: r.tradeId,
    });
  }
}

const summary = buildPortfolioSummary(txs);
const doctor = runPortfolioDoctor(txs);

for (const sym of ['FCL', 'UJJIVANSFB', 'HDFCBANK', 'ETERNAL', 'ZOMATO']) {
  const h = summary.holdings.find((x) => x.symbol === sym);
  if (h) {
    console.log(
      `${sym}: qty=${h.quantity} invested=${h.totalInvested.toFixed(0)} avg=${h.avgBuyPrice.toFixed(2)} value=${(h.quantity * h.currentPrice).toFixed(0)}`
    );
  }
}

console.log('Doctor:', doctor.length, 'warnings');
const sellWarns = doctor.filter((w) => w.code === 'SELL_EXCEEDS_HOLDINGS');
console.log('Sell exceeds holdings:', sellWarns.length);
if (sellWarns.length) {
  console.log('  sample:', sellWarns.slice(0, 3).map((w) => w.symbol));
}
