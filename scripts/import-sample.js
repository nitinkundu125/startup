const { readFileSync } = require('fs');
const { join } = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function parseCsvLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') { inQuotes = !inQuotes; continue; }
    if (char === ',' && !inQuotes) { fields.push(current.trim()); current = ''; continue; }
    current += char;
  }
  fields.push(current.trim());
  return fields;
}

function parseTradeType(value) {
  const v = value.trim().toLowerCase();
  if (v === 'buy' || v === 'b') return 'BUY';
  if (v === 'sell' || v === 's') return 'SELL';
  return null;
}

function parseDate(value) {
  if (!value?.trim()) return null;
  const raw = value.trim();
  const iso = raw.includes('T') ? raw : `${raw}T00:00:00`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function main() {
  const path = join(__dirname, '../public/samples/sample01.csv');
  const content = readFileSync(path, 'utf8');
  const lines = content.replace(/^\uFEFF/, '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const headers = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const idx = (name) => headers.indexOf(name);

  await prisma.transaction.deleteMany();
  await prisma.asset.deleteMany();

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCsvLine(lines[i]);
    const symbol = fields[idx('symbol')]?.trim().toUpperCase();
    const type = parseTradeType(fields[idx('trade_type')] ?? '');
    const quantity = parseFloat(fields[idx('quantity')] ?? '');
    const price = parseFloat(fields[idx('price')] ?? '');
    const tradeDate = parseDate(fields[idx('trade_date')] ?? '') ?? parseDate(fields[idx('order_execution_time')] ?? '');
    if (!symbol || !type || !tradeDate || !(quantity > 0) || !(price >= 0)) continue;
    rows.push({
      symbol,
      isin: fields[idx('isin')]?.trim() || null,
      type,
      quantity,
      price,
      tradeDate,
      exchange: fields[idx('exchange')]?.trim() || null,
      segment: fields[idx('segment')]?.trim() || null,
      series: fields[idx('series')]?.trim() || null,
      auction: (fields[idx('auction')] ?? '').toLowerCase() === 'true',
      tradeId: fields[idx('trade_id')]?.trim() || null,
      orderId: fields[idx('order_id')]?.trim() || null,
      orderExecutionTime: parseDate(fields[idx('order_execution_time')] ?? ''),
    });
  }

  rows.sort((a, b) => a.tradeDate - b.tradeDate);
  const latestPrice = new Map();
  for (const r of rows) latestPrice.set(r.symbol, r.price);

  const assetIds = new Map();
  for (const [symbol, price] of latestPrice) {
    const row = rows.find((r) => r.symbol === symbol);
    const asset = await prisma.asset.create({
      data: { symbol, isin: row.isin, name: symbol, price },
    });
    assetIds.set(symbol, asset.id);
  }

  for (const row of rows) {
    await prisma.transaction.create({
      data: {
        assetId: assetIds.get(row.symbol),
        type: row.type,
        quantity: row.quantity,
        price: row.price,
        date: row.tradeDate,
        exchange: row.exchange,
        segment: row.segment,
        series: row.series,
        auction: row.auction,
        tradeId: row.tradeId,
        orderId: row.orderId,
        orderExecutionTime: row.orderExecutionTime,
      },
    });
  }

  console.log(`Imported ${rows.length} trades, ${assetIds.size} assets from sample01.csv`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
