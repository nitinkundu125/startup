import Link from 'next/link';
import { BarChart3 } from 'lucide-react';
import { requireUser, userHasPortfolioData } from '@/lib/auth';
import { LogoutButton } from '@/components/LogoutButton';
import { NavLinks } from '@/components/NavLinks';

export async function NavBar() {
  const user = await requireUser();

  if (!user) {
    return (
      <header className="sticky top-0 z-50 border-b border-[var(--color-border)] bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center px-4 sm:px-6 lg:px-8">
          <Link href="/login" className="flex items-center gap-2.5 font-semibold text-[var(--color-foreground)]">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-primary)] text-white">
              <BarChart3 className="h-4 w-4" />
            </span>
            <span className="hidden sm:inline">Portfolio</span>
          </Link>
        </div>
      </header>
    );
  }

  const hasData = await userHasPortfolioData(user.id);

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--color-border)] bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          href={hasData ? '/' : '/upload'}
          className="flex items-center gap-2.5 font-semibold text-[var(--color-foreground)]"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-primary)] text-white">
            <BarChart3 className="h-4 w-4" />
          </span>
          <span className="hidden sm:inline">Portfolio</span>
        </Link>

        <nav className="flex items-center gap-2 sm:gap-4">
          <NavLinks hasData={hasData} />
          <div className="hidden h-6 w-px bg-[var(--color-border)] sm:block" />
          <span className="hidden max-w-[140px] truncate text-xs text-[var(--color-muted)] md:inline">
            {user.email}
          </span>
          <LogoutButton />
        </nav>
      </div>
    </header>
  );
}
