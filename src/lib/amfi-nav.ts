export type AmfiRegistry = {
  isinToNav: Map<string, number>;
  nameToNav: Map<string, number>;
};

export async function fetchAmfiNavs(): Promise<AmfiRegistry> {
  const url = 'https://www.amfiindia.com/spages/NAVAll.txt';
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; PortfolioApp/1.0)',
    },
    // Avoid caching this in Next.js aggressive cache so we always get fresh NAVs when called manually
    cache: 'no-store',
  });
  
  if (!res.ok) {
    throw new Error(`Failed to fetch AMFI NAVs: ${res.status}`);
  }

  const text = await res.text();
  const lines = text.split(/\r?\n/);

  const isinToNav = new Map<string, number>();
  const nameToNav = new Map<string, number>();

  for (const line of lines) {
    const parts = line.split(';');
    // Scheme Code;ISIN Div Payout/ISIN Growth;ISIN Div Reinvestment;Scheme Name;Net Asset Value;Date
    if (parts.length >= 5) {
      const navStr = parts[4].trim();
      const nav = parseFloat(navStr);
      
      if (Number.isFinite(nav) && nav > 0) {
        const isinGrowth = parts[1]?.trim().toUpperCase();
        const isinReinv = parts[2]?.trim().toUpperCase();
        const schemeName = parts[3]?.trim().toUpperCase();

        if (isinGrowth && isinGrowth !== '-') isinToNav.set(isinGrowth, nav);
        if (isinReinv && isinReinv !== '-') isinToNav.set(isinReinv, nav);
        if (schemeName) nameToNav.set(schemeName, nav);
      }
    }
  }

  return { isinToNav, nameToNav };
}
