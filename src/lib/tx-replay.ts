import {
  preprocessCorporateActions,
  normalizeTxType,
  effectiveSplitRatio,
} from '@/lib/corporate-actions';
import { loadRegistryForSymbols } from '@/lib/ca-store';
import {
  dateFromDayKey,
  localDateKey,
  sortActionsForApply,
  type CorporateActionRegistry,
} from '@/lib/nse-corporate-actions';
import type { TradebookRow } from '@/lib/tradebook';
import type { TxInput } from '@/lib/portfolio';
import { parseSymbolAliases } from '@/lib/asset-identity';

type DbTx = {
  assetId: string;
  type: string;
  quantity: number;
  price: number;
  splitRatio: number | null;
  date: Date;
  tradeId: string | null;
  exchange: string | null;
  segment: string | null;
  series: string | null;
  auction: boolean;
  asset: {
    symbol: string;
    name: string;
    isin: string | null;
    symbolAliases: string;
    price: number;
    assetClass: string;
  };
};

/** One symbol = one FIFO stream (ISIN can change after split; assets merged in normalizeUserAssets). */
export function portfolioGroupKey(tx: DbTx): string {
  return tx.asset.symbol.trim().toUpperCase();
}

/** SPLIT is always derived from NSE registry on replay — never trust stored SPLIT rows. */
function isAlreadyPreprocessed(txs: DbTx[]): boolean {
  return txs.some((t) => {
    const u = t.type.toUpperCase();
    return u === 'DEMAT' || u === 'CA_BUY' || u === 'BONUS';
  });
}

function appendSyntheticCorporateActions(
  inputs: TxInput[],
  registry: CorporateActionRegistry,
  symbol: string,
  keeper: DbTx,
  aliases: string[]
): void {
  const byDay = registry.get(symbol.toUpperCase());
  if (!byDay) return;

  const existing = new Set(
    inputs
      .filter((i) => i.symbol.toUpperCase() === symbol.toUpperCase() && (i.type === 'SPLIT' || i.type === 'DIVIDEND'))
      .map((i) => `${localDateKey(i.date)}|${i.type}|${i.splitRatio ?? i.price}`)
  );

  for (const [dayKey, actions] of byDay) {
    for (const ca of sortActionsForApply(actions)) {
      if (ca.type === 'SPLIT' && ca.shareMultiplier && ca.shareMultiplier > 1) {
        const key = `${dayKey}|SPLIT|${ca.shareMultiplier}`;
        if (existing.has(key)) continue;
        existing.add(key);
        inputs.push({
          assetId: keeper.assetId,
          symbol: keeper.asset.symbol,
          name: keeper.asset.name,
          symbolAliases: aliases,
          isin: keeper.asset.isin,
          type: 'SPLIT',
          quantity: 0,
          price: 0,
          splitRatio: ca.shareMultiplier,
          date: dateFromDayKey(dayKey),
          currentPrice: keeper.asset.price,
          tradeId: null,
          assetClass: keeper.asset.assetClass,
        });
      } else if (ca.type === 'DIVIDEND' && ca.dividendAmount && ca.dividendAmount > 0) {
        const key = `${dayKey}|DIVIDEND|${ca.dividendAmount}`;
        if (existing.has(key)) continue;
        existing.add(key);
        inputs.push({
          assetId: keeper.assetId,
          symbol: keeper.asset.symbol,
          name: keeper.asset.name,
          symbolAliases: aliases,
          isin: keeper.asset.isin,
          type: 'DIVIDEND',
          quantity: 0,
          price: ca.dividendAmount,
          splitRatio: null,
          date: dateFromDayKey(dayKey),
          currentPrice: keeper.asset.price,
          tradeId: null,
          assetClass: keeper.asset.assetClass,
        });
      }
    }
  }
}

function dbTxToTradebookRow(tx: DbTx, symbol: string): TradebookRow {
  const u = tx.type.toUpperCase();
  let type: TradebookRow['type'] = u === 'SELL' ? 'SELL' : 'BUY';
  if (u === 'BONUS') type = 'BONUS';
  if (u === 'SPLIT') type = 'SPLIT';
  if (u === 'DEMAT' || u === 'CA_BUY') type = 'CA_BUY';

  return {
    symbol,
    isin: tx.asset.isin,
    tradeDate: tx.date,
    exchange: tx.exchange,
    segment: tx.segment,
    series: tx.series,
    type,
    auction: tx.auction,
    quantity: tx.quantity,
    price: tx.price,
    tradeId: tx.tradeId,
    orderId: null,
    orderExecutionTime: null,
    splitRatio: tx.splitRatio ?? undefined,
  };
}

function processedRowToTxInput(
  row: TradebookRow,
  keeper: DbTx,
  allAliases: string[]
): TxInput {
  return {
    assetId: keeper.assetId,
    symbol: keeper.asset.symbol,
    name: keeper.asset.name,
    symbolAliases: allAliases,
    isin: keeper.asset.isin,
    type: normalizeTxType(
      row.type === 'CA_BUY' ? 'DEMAT' : row.type,
      row.quantity,
      row.price,
      row.splitRatio ?? null
    ),
    quantity: row.type === 'SPLIT' ? 0 : row.quantity,
    price: row.price,
    splitRatio: effectiveSplitRatio(row.type, row.quantity, row.splitRatio ?? null),
    date: row.tradeDate,
    currentPrice: keeper.asset.price,
    tradeId: row.tradeId,
    assetClass: keeper.asset.assetClass,
  };
}

function directDbToTxInput(tx: DbTx, allAliases: string[]): TxInput {
  return {
    assetId: tx.assetId,
    symbol: tx.asset.symbol,
    name: tx.asset.name,
    symbolAliases: allAliases,
    isin: tx.asset.isin,
    type: normalizeTxType(tx.type, tx.quantity, tx.price, tx.splitRatio),
    quantity: tx.quantity,
    price: tx.price,
    splitRatio: effectiveSplitRatio(tx.type, tx.quantity, tx.splitRatio),
    date: tx.date,
    currentPrice: tx.asset.price,
    tradeId: tx.tradeId,
    assetClass: tx.asset.assetClass,
  };
}

function collectAliases(txs: DbTx[]): string[] {
  const set = new Set<string>();
  for (const tx of txs) {
    set.add(tx.asset.symbol.toUpperCase());
    for (const a of parseSymbolAliases(tx.asset.symbolAliases)) {
      set.add(a.toUpperCase());
    }
  }
  return [...set];
}

/**
 * Build FIFO inputs: merge same-ISIN assets, re-run corporate actions on raw rows.
 */
export async function buildTxInputsFromDbTransactions(txs: DbTx[]): Promise<TxInput[]> {
  const symbols = [...new Set(txs.map((t) => t.asset.symbol))];
  const registry = await loadRegistryForSymbols(symbols);

  const byGroup = new Map<string, DbTx[]>();
  for (const tx of txs) {
    const key = portfolioGroupKey(tx);
    if (!byGroup.has(key)) byGroup.set(key, []);
    byGroup.get(key)!.push(tx);
  }

  const inputs: TxInput[] = [];

  for (const groupTxs of byGroup.values()) {
    const sorted = [...groupTxs].sort(
      (a, b) => a.date.getTime() - b.date.getTime()
    );
    const keeper = sorted[sorted.length - 1];
    const aliases = collectAliases(sorted);
    const symbol = keeper.asset.symbol;

    if (isAlreadyPreprocessed(sorted)) {
      for (const tx of sorted) {
        if (tx.type.toUpperCase() === 'SPLIT') continue;
        inputs.push(
          directDbToTxInput(
            { ...tx, assetId: keeper.assetId, asset: keeper.asset },
            aliases
          )
        );
      }
      appendSyntheticCorporateActions(inputs, registry, symbol, keeper, aliases);
      continue;
    }

    const rows = sorted
      .filter((tx) => tx.type.toUpperCase() !== 'SPLIT')
      .map((tx) => dbTxToTradebookRow(tx, symbol));
    const processed = preprocessCorporateActions(rows, registry);
    for (const row of processed) {
      inputs.push(processedRowToTxInput(row, keeper, aliases));
    }
  }

  return inputs.sort((a, b) => a.date.getTime() - b.date.getTime());
}
