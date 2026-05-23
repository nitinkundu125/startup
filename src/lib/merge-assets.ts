import { prisma } from '@/lib/prisma';
import {
  getCanonicalKey,
  mergeSymbolAliases,
  parseSymbolAliases,
} from '@/lib/asset-identity';

/** Merge duplicate assets with the same symbol (ISIN change after split, re-imports). */
export async function mergeDuplicateAssetsBySymbol(userId: string): Promise<number> {
  const assets = await prisma.asset.findMany({
    where: { userId },
    include: { _count: { select: { transactions: true } } },
  });

  const bySymbol = new Map<string, typeof assets>();
  for (const asset of assets) {
    const sym = asset.symbol.trim().toUpperCase();
    if (!bySymbol.has(sym)) bySymbol.set(sym, []);
    bySymbol.get(sym)!.push(asset);
  }

  let mergedCount = 0;

  for (const group of bySymbol.values()) {
    if (group.length < 2) continue;

    const sorted = [...group].sort((a, b) => {
      const txDiff = b._count.transactions - a._count.transactions;
      if (txDiff !== 0) return txDiff;
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    });

    const keeper = sorted[0];
    let aliases = parseSymbolAliases(keeper.symbolAliases);

    for (const duplicate of sorted.slice(1)) {
      aliases = mergeSymbolAliases(
        JSON.stringify(aliases),
        duplicate.symbol,
        keeper.symbol
      );
      for (const a of parseSymbolAliases(duplicate.symbolAliases)) {
        if (a.toUpperCase() !== keeper.symbol.toUpperCase()) aliases.push(a);
      }
      aliases = [...new Set(aliases)];

      await prisma.transaction.updateMany({
        where: { assetId: duplicate.id },
        data: { assetId: keeper.id },
      });

      await prisma.asset.delete({ where: { id: duplicate.id } });
      mergedCount++;
    }

    const latestIsin =
      sorted.find((a) => a.isin)?.isin ?? keeper.isin ?? null;

    await prisma.asset.update({
      where: { id: keeper.id },
      data: {
        isin: latestIsin,
        canonicalKey: getCanonicalKey(latestIsin, keeper.symbol),
        symbolAliases: JSON.stringify(aliases),
      },
    });
  }

  return mergedCount;
}

/** Merge duplicate assets that share the same ISIN (symbol rename / rebrand). */
export async function mergeDuplicateAssetsByIsin(userId: string): Promise<number> {
  const assets = await prisma.asset.findMany({
    where: { userId, isin: { not: null } },
    include: {
      transactions: { orderBy: { date: 'desc' }, take: 1 },
    },
  });

  const byIsin = new Map<string, typeof assets>();
  for (const asset of assets) {
    const isin = asset.isin!.trim().toUpperCase();
    if (!byIsin.has(isin)) byIsin.set(isin, []);
    byIsin.get(isin)!.push(asset);
  }

  let mergedCount = 0;

  for (const group of byIsin.values()) {
    if (group.length < 2) continue;

    const sorted = [...group].sort((a, b) => {
      const aDate = a.transactions[0]?.date?.getTime() ?? 0;
      const bDate = b.transactions[0]?.date?.getTime() ?? 0;
      return bDate - aDate;
    });

    const keeper = sorted[0];
    let aliases = parseSymbolAliases(keeper.symbolAliases);

    for (const duplicate of sorted.slice(1)) {
      aliases = mergeSymbolAliases(
        JSON.stringify(aliases),
        duplicate.symbol,
        keeper.symbol
      );
      for (const a of parseSymbolAliases(duplicate.symbolAliases)) {
        if (a.toUpperCase() !== keeper.symbol.toUpperCase()) aliases.push(a);
      }
      aliases = [...new Set(aliases)];

      await prisma.transaction.updateMany({
        where: { assetId: duplicate.id },
        data: { assetId: keeper.id },
      });

      await prisma.asset.delete({ where: { id: duplicate.id } });
      mergedCount++;
    }

    await prisma.asset.update({
      where: { id: keeper.id },
      data: {
        symbol: keeper.symbol,
        canonicalKey: getCanonicalKey(keeper.isin, keeper.symbol),
        symbolAliases: JSON.stringify(aliases),
      },
    });
  }

  return mergedCount;
}

/** Remove stored SPLIT rows (re-derived from NSE on every portfolio load). */
export async function purgeStoredSplitTransactions(userId: string): Promise<number> {
  const result = await prisma.transaction.deleteMany({
    where: { userId, type: 'SPLIT' },
  });
  return result.count;
}

/** Backfill canonicalKey and merge legacy symbol-only duplicates. */
export async function normalizeUserAssets(userId: string): Promise<number> {
  await purgeStoredSplitTransactions(userId);
  let merged = await mergeDuplicateAssetsBySymbol(userId);
  merged += await mergeDuplicateAssetsByIsin(userId);

  const assets = await prisma.asset.findMany({ where: { userId } });
  for (const asset of assets) {
    const canonicalKey = getCanonicalKey(asset.isin, asset.symbol);
    if (asset.canonicalKey !== canonicalKey) {
      await prisma.asset.update({
        where: { id: asset.id },
        data: { canonicalKey },
      });
    }
  }

  const remaining = await prisma.asset.findMany({ where: { userId } });
  const byKey = new Map<string, (typeof remaining)[0][]>();

  for (const asset of remaining) {
    if (!byKey.has(asset.canonicalKey)) byKey.set(asset.canonicalKey, []);
    byKey.get(asset.canonicalKey)!.push(asset);
  }

  for (const group of byKey.values()) {
    if (group.length < 2) continue;

    const sorted = [...group].sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
    );
    const keeper = sorted[0];

    for (const dup of sorted.slice(1)) {
      const aliases = mergeSymbolAliases(
        keeper.symbolAliases,
        dup.symbol,
        keeper.symbol
      );
      await prisma.transaction.updateMany({
        where: { assetId: dup.id },
        data: { assetId: keeper.id },
      });
      await prisma.asset.delete({ where: { id: dup.id } });
      await prisma.asset.update({
        where: { id: keeper.id },
        data: { symbolAliases: JSON.stringify(aliases) },
      });
      merged++;
    }
  }

  return merged;
}
