export const TRADEBOOK_HEADERS = [
  'symbol',
  'isin',
  'trade_date',
  'exchange',
  'segment',
  'series',
  'trade_type',
  'auction',
  'quantity',
  'price',
  'trade_id',
  'order_id',
  'order_execution_time',
] as const;

export type TradeType = 'BUY' | 'SELL' | 'BONUS' | 'SPLIT' | 'CA_BUY' | 'DIVIDEND';

export type TradebookRow = {
  symbol: string;
  isin: string | null;
  tradeDate: Date;
  exchange: string | null;
  segment: string | null;
  series: string | null;
  type: TradeType;
  auction: boolean;
  quantity: number;
  price: number;
  tradeId: string | null;
  orderId: string | null;
  orderExecutionTime: Date | null;
  splitRatio?: number;
};

export type ParseResult = {
  rows: TradebookRow[];
  errors: string[];
  skipped: number;
};

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  fields.push(current.trim());
  return fields;
}

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, '_');
}

function parseTradeType(value: string): TradeType | null {
  const v = value.trim().toLowerCase();
  if (v === 'buy' || v === 'b') return 'BUY';
  if (v === 'sell' || v === 's') return 'SELL';
  if (v === 'bonus') return 'BONUS';
  if (v === 'split') return 'SPLIT';
  return null;
}

function parseDate(value: string, fallback?: string): Date | null {
  const raw = (value || fallback || '').trim();
  if (!raw) return null;
  const iso = raw.includes('T') ? raw : `${raw}T00:00:00`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseBoolean(value: string): boolean {
  return value.trim().toLowerCase() === 'true';
}

function rowKey(row: TradebookRow): string {
  return [
    row.tradeId ?? '',
    row.symbol,
    row.tradeDate.toISOString(),
    row.type,
    row.quantity,
    row.price,
    row.orderId ?? '',
  ].join('|');
}

export function parseTradebookCsv(content: string): ParseResult {
  const lines = content
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const errors: string[] = [];
  const rows: TradebookRow[] = [];
  let skipped = 0;

  if (lines.length < 2) {
    return { rows: [], errors: ['File is empty or has no data rows.'], skipped: 0 };
  }

  const headers = parseCsvLine(lines[0]).map(normalizeHeader);
  const required = ['symbol', 'trade_type', 'quantity', 'price'];
  for (const col of required) {
    if (!headers.includes(col)) {
      errors.push(`Missing required column: ${col}`);
    }
  }
  if (errors.length > 0) {
    return { rows: [], errors, skipped: 0 };
  }

  const idx = (name: string) => headers.indexOf(name);
  const seen = new Set<string>();
  const tradeIdCounts = new Map<string, number>();

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCsvLine(lines[i]);
    if (fields.length < headers.length) {
      errors.push(`Row ${i + 1}: not enough columns`);
      continue;
    }

    const symbol = fields[idx('symbol')]?.trim().toUpperCase();
    if (!symbol) {
      errors.push(`Row ${i + 1}: missing symbol`);
      continue;
    }

    const tradeType = parseTradeType(fields[idx('trade_type')] ?? '');
    if (!tradeType) {
      errors.push(`Row ${i + 1}: invalid trade_type`);
      continue;
    }

    const quantity = parseFloat(fields[idx('quantity')] ?? '');
    const price = parseFloat(fields[idx('price')] ?? '');
    if (!Number.isFinite(quantity) || quantity <= 0) {
      errors.push(`Row ${i + 1}: invalid quantity`);
      continue;
    }
    const isBonusRow =
      tradeType === 'BONUS' || (tradeType === 'BUY' && price < 0.01);
    if (!Number.isFinite(price) || price < 0) {
      errors.push(`Row ${i + 1}: invalid price`);
      continue;
    }
    if (!isBonusRow && tradeType !== 'SPLIT' && price === 0) {
      errors.push(`Row ${i + 1}: invalid price`);
      continue;
    }

    const tradeDate =
      parseDate(fields[idx('trade_date')] ?? '') ??
      parseDate('', fields[idx('order_execution_time')] ?? '');
    if (!tradeDate) {
      errors.push(`Row ${i + 1}: invalid trade_date`);
      continue;
    }

    const tradeIdRaw = fields[idx('trade_id')]?.trim();
    const tradeId = tradeIdRaw ? tradeIdRaw : null;

    const row: TradebookRow = {
      symbol,
      isin: fields[idx('isin')]?.trim() || null,
      tradeDate,
      exchange: fields[idx('exchange')]?.trim() || null,
      segment: fields[idx('segment')]?.trim() || null,
      series: fields[idx('series')]?.trim() || null,
      type: tradeType,
      auction: parseBoolean(fields[idx('auction')] ?? 'false'),
      quantity,
      price,
      tradeId,
      orderId: fields[idx('order_id')]?.trim() || null,
      orderExecutionTime: parseDate(fields[idx('order_execution_time')] ?? ''),
    };

    const key = rowKey(row);
    if (seen.has(key)) {
      skipped++;
      continue;
    }
    seen.add(key);

    if (row.tradeId) {
      const count = (tradeIdCounts.get(row.tradeId) || 0) + 1;
      tradeIdCounts.set(row.tradeId, count);
      if (count > 1) {
        row.tradeId = `${row.tradeId}-${count}`;
      }
    }

    rows.push(row);
  }

  rows.sort((a, b) => a.tradeDate.getTime() - b.tradeDate.getTime());
  return { rows, errors, skipped };
}

export { preprocessCorporateActions } from '@/lib/corporate-actions';
