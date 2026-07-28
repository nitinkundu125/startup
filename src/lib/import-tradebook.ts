import { prisma } from '@/lib/prisma';
import { parseTradebookCsv, type TradebookRow } from '@/lib/tradebook';
import { preprocessCorporateActions } from '@/lib/corporate-actions';
import { syncCorporateActionsForSymbols } from '@/lib/ca-store';
import {
  getCanonicalKey,
  mergeIsinAliases,
  mergeSymbolAliases,
  parseSymbolAliases,
} from '@/lib/asset-identity';
import { normalizeUserAssets } from '@/lib/merge-assets';

export type FileImportResult = {
  fileName: string;
  imported: number;
  skipped: number;
  errors: string[];
};

export type ImportSummary = {
  files: FileImportResult[];
  totalImported: number;
  totalSkipped: number;
  assets: number;
  mergedRenames?: number;
};

async function getOrCreateAsset(userId: string, row: TradebookRow, assetClass: string): Promise<string> {
  const canonicalKey = getCanonicalKey(row.isin, row.symbol);

  const existing = await prisma.asset.findUnique({
    where: { userId_canonicalKey: { userId, canonicalKey } },
  });

  if (existing) {
    let aliases = parseSymbolAliases(existing.symbolAliases);
    if (existing.symbol.toUpperCase() !== row.symbol.toUpperCase()) {
      aliases = mergeSymbolAliases(
        JSON.stringify(aliases),
        existing.symbol,
        row.symbol
      );
    }
    if (row.isin && existing.isin && row.isin !== existing.isin) {
      aliases = [
        ...aliases,
        ...mergeIsinAliases(JSON.stringify(aliases), existing.isin).map(
          (i) => `ISIN:${i}`
        ),
      ];
    }

    await prisma.asset.update({
      where: { id: existing.id },
      data: {
        symbol: row.symbol,
        isin: row.isin ?? existing.isin,
        symbolAliases: JSON.stringify([...new Set(aliases)]),
        price: row.price,
        name: row.symbol,
        assetClass,
      },
    });
    return existing.id;
  }

  const asset = await prisma.asset.create({
    data: {
      userId,
      canonicalKey,
      symbol: row.symbol,
      isin: row.isin,
      symbolAliases: '[]',
      name: row.symbol,
      price: row.price,
      assetClass,
    },
  });
  return asset.id;
}

/**
 * Everything already in the DB for this user, loaded once.
 *
 * The import previously issued a duplicate-check query PER ROW plus an asset
 * lookup PER ROW, so a multi-year tradebook meant thousands of sequential round
 * trips. Two queries up front replace all of them.
 */
type DedupeIndex = {
  tradeIds: Set<string>;
  /** Composite key for rows that carry no trade_id. */
  fallbackKeys: Set<string>;
};

function fallbackKeyFor(canonicalKey: string, row: TradebookRow): string {
  return [canonicalKey, row.type, row.quantity, row.price, row.tradeDate.getTime()].join('|');
}

async function loadDedupeIndex(userId: string): Promise<DedupeIndex> {
  const existing = await prisma.transaction.findMany({
    where: { userId },
    select: {
      tradeId: true,
      type: true,
      quantity: true,
      price: true,
      date: true,
      asset: { select: { canonicalKey: true } },
    },
  });

  const tradeIds = new Set<string>();
  const fallbackKeys = new Set<string>();
  for (const tx of existing) {
    if (tx.tradeId) tradeIds.add(tx.tradeId);
    fallbackKeys.add(
      [tx.asset.canonicalKey, tx.type, tx.quantity, tx.price, tx.date.getTime()].join('|')
    );
  }
  return { tradeIds, fallbackKeys };
}

/** In-memory duplicate check. Records the row so later rows in the same file dedupe too. */
function claimRow(index: DedupeIndex, canonicalKey: string, row: TradebookRow): boolean {
  if (row.tradeId) {
    if (index.tradeIds.has(row.tradeId)) return false;
    index.tradeIds.add(row.tradeId);
    return true;
  }
  const key = fallbackKeyFor(canonicalKey, row);
  if (index.fallbackKeys.has(key)) return false;
  index.fallbackKeys.add(key);
  return true;
}

export async function importTradebookFromCsv(
  userId: string,
  content: string,
  fileName: string,
  assetClass: string = 'STOCK'
): Promise<FileImportResult> {
  const { rows, errors, skipped: parseSkipped } = parseTradebookCsv(content);
  const symbols = [...new Set(rows.map((r) => r.symbol))];
  const { registry, errors: caErrors } = await syncCorporateActionsForSymbols(symbols);
  const processed = preprocessCorporateActions(rows, registry);
  if (caErrors.length) {
    errors.push(...caErrors.map((e) => `NSE CA: ${e}`));
  }

  if (processed.length === 0) {
    return { fileName, imported: 0, skipped: parseSkipped, errors };
  }

  let imported = 0;
  let skipped = parseSkipped;

  const dedupe = await loadDedupeIndex(userId);
  const touchedAssetIds = new Set<string>();

  for (const row of processed) {
    /** SPLIT is re-applied from NSE on replay; storing it causes duplicate splits. */
    if (row.type === 'SPLIT') {
      continue;
    }

    if (!claimRow(dedupe, getCanonicalKey(row.isin, row.symbol), row)) {
      skipped++;
      continue;
    }

    const assetId = await getOrCreateAsset(userId, row, assetClass);
    touchedAssetIds.add(assetId);
    await prisma.transaction.create({
      data: {
        userId,
        assetId,
        type: row.type === 'CA_BUY' ? 'DEMAT' : row.type,
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
    imported++;
  }

  await refreshAssetPrices(userId, touchedAssetIds);

  await prisma.importFile.create({
    data: {
      userId,
      fileName,
      imported,
      skipped,
    },
  });

  return { fileName, imported, skipped, errors };
}

/**
 * Set each touched asset's mark price to its most recent real trade.
 *
 * Was two queries per asset (find latest, then update) over EVERY asset the user
 * owns, even ones this import never touched. Now one query for the candidate
 * rows, reduced in memory, and one update per asset that actually changed.
 */
async function refreshAssetPrices(userId: string, assetIds?: Set<string>): Promise<void> {
  const scope = assetIds && assetIds.size > 0 ? { id: { in: [...assetIds] } } : {};
  const assets = await prisma.asset.findMany({
    where: { userId, ...scope },
    select: { id: true, price: true },
  });
  if (assets.length === 0) return;

  const rows = await prisma.transaction.findMany({
    where: {
      userId,
      assetId: { in: assets.map((a) => a.id) },
      type: { in: ['BUY', 'SELL'] },
      price: { gt: 0.01 },
    },
    select: { assetId: true, price: true, date: true },
    orderBy: { date: 'asc' },
  });

  // Ascending order means the last write per asset is the latest trade.
  const latest = new Map<string, number>();
  for (const r of rows) latest.set(r.assetId, r.price);

  await Promise.all(
    assets
      .filter((a) => {
        const p = latest.get(a.id);
        return p != null && p !== a.price;
      })
      .map((a) =>
        prisma.asset.update({ where: { id: a.id }, data: { price: latest.get(a.id)! } })
      )
  );
}

export async function importMultipleTradebooks(
  userId: string,
  files: { name: string; content: string }[],
  replace = false,
  assetClass = 'STOCK'
): Promise<ImportSummary> {
  if (replace) {
    await prisma.transaction.deleteMany({ where: { userId } });
    await prisma.asset.deleteMany({ where: { userId } });
    await prisma.importFile.deleteMany({ where: { userId } });
  }

  const results: FileImportResult[] = [];
  for (const file of files) {
    results.push(await importTradebookFromCsv(userId, file.content, file.name, assetClass));
  }

  const mergedRenames = await normalizeUserAssets(userId);

  const assetCount = await prisma.asset.count({ where: { userId } });

  return {
    files: results,
    totalImported: results.reduce((s, r) => s + r.imported, 0),
    totalSkipped: results.reduce((s, r) => s + r.skipped, 0),
    assets: assetCount,
    mergedRenames,
  };
}

export async function clearUserPortfolio(userId: string): Promise<void> {
  await prisma.transaction.deleteMany({ where: { userId } });
  await prisma.asset.deleteMany({ where: { userId } });
  await prisma.importFile.deleteMany({ where: { userId } });
  await prisma.user.update({
    where: { id: userId },
    data: { holdingsSnapshot: null, ltpSnapshot: null },
  });
}
