'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/', label: 'Dashboard' },
  { href: '/holdings', label: 'Holdings' },
  { href: '/watchlist', label: 'Screener' },
  { href: '/backtest', label: 'Backtest Lab' },
  { href: '/upload', label: 'Import' },
] as const;

export function NavLinks({ hasData }: { hasData: boolean }) {
  const pathname = usePathname();

  const visible = hasData
    ? links
    : links.filter((l) => l.href === '/upload' || l.href === '/watchlist' || l.href === '/backtest');

  return (
    <div className="flex items-center gap-1">
      {visible.map(({ href, label }) => {
        const active =
          href === '/' ? pathname === '/' : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? 'bg-slate-100 text-[var(--color-foreground)]'
                : 'text-[var(--color-muted)] hover:bg-slate-50 hover:text-[var(--color-foreground)]'
            }`}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
