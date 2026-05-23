/** Use symbol as canonical key — ISIN can change after bonus/split (e.g. FCL). */
export function getCanonicalKey(_isin: string | null | undefined, symbol: string): string {
  return `SYM:${symbol.trim().toUpperCase()}`;
}

export function parseSymbolAliases(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((s): s is string => typeof s === 'string' && s.length > 0)
      : [];
  } catch {
    return [];
  }
}

export function mergeSymbolAliases(
  existing: string | null | undefined,
  previousSymbol: string,
  newSymbol: string
): string[] {
  const aliases = new Set(parseSymbolAliases(existing));
  const prev = previousSymbol.trim().toUpperCase();
  const next = newSymbol.trim().toUpperCase();
  if (prev && prev !== next) aliases.add(prev);
  return [...aliases].sort();
}

export function mergeIsinAliases(
  existing: string | null | undefined,
  previousIsin: string | null | undefined
): string[] {
  const aliases = new Set<string>();
  if (existing) {
    try {
      const parsed = JSON.parse(existing);
      if (Array.isArray(parsed)) parsed.forEach((s) => aliases.add(s));
    } catch {
      /* ignore */
    }
  }
  if (previousIsin?.trim()) aliases.add(previousIsin.trim().toUpperCase());
  return [...aliases].sort();
}

export function formatAssetLabel(
  symbol: string,
  aliases: string[],
  isin?: string | null
): { title: string; subtitle: string } {
  const uniqueAliases = aliases.filter((a) => a.toUpperCase() !== symbol.toUpperCase());
  const subtitle =
    uniqueAliases.length > 0
      ? `Formerly ${uniqueAliases.join(', ')}${isin ? ` · ${isin}` : ''}`
      : isin ?? symbol;
  return { title: symbol, subtitle };
}
