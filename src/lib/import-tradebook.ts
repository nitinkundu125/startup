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

async function getOrCreateAsset(userId: string, row: TradebookRow): Promise<string> {
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
    },
  });
  return asset.id;
}

async function transactionExists(userId: string, row: TradebookRow): Promise<boolean> {
  if (row.tradeId) {
    const existing = await prisma.transaction.findUnique({
      where: { userId_tradeId: { userId, tradeId: row.tradeId } },
    });
    return !!existing;
  }

  const canonicalKey = getCanonicalKey(row.isin, row.symbol);

  const existing = await prisma.transaction.findFirst({
    where: {
      userId,
      type: row.type,
      quantity: row.quantity,
      price: row.price,
      date: row.tradeDate,
      asset: { canonicalKey },
    },
  });
  return !!existing;
}

export async function importTradebookFromCsv(
  userId: string,
  content: string,
  fileName: string
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

  for (const row of processed) {
    /** SPLIT is re-applied from NSE on replay; storing it causes duplicate splits. */
    if (row.type === 'SPLIT') {
      continue;
    }

    if (await transactionExists(userId, row)) {
      skipped++;
      continue;
    }

    const assetId = await getOrCreateAsset(userId, row);
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

  await refreshAssetPrices(userId);

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

async function refreshAssetPrices(userId: string): Promise<void> {
  const assets = await prisma.asset.findMany({ where: { userId } });

  for (const asset of assets) {
    const lastTx = await prisma.transaction.findFirst({
      where: {
        assetId: asset.id,
        type: { in: ['BUY', 'SELL'] },
        price: { gt: 0.01 },
      },
      orderBy: { date: 'desc' },
    });
    if (lastTx) {
      await prisma.asset.update({
        where: { id: asset.id },
        data: { price: lastTx.price },
      });
    }
  }
}

export async function importMultipleTradebooks(
  userId: string,
  files: { name: string; content: string }[],
  replace = false
): Promise<ImportSummary> {
  if (replace) {
    await prisma.transaction.deleteMany({ where: { userId } });
    await prisma.asset.deleteMany({ where: { userId } });
    await prisma.importFile.deleteMany({ where: { userId } });
  }

  const results: FileImportResult[] = [];
  for (const file of files) {
    results.push(await importTradebookFromCsv(userId, file.content, file.name));
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
