import { type ReactNode } from 'react';

export function Card({
  children,
  className = '',
  padding = 'default',
}: {
  children: ReactNode;
  className?: string;
  padding?: 'none' | 'default' | 'lg';
}) {
  const pad =
    padding === 'none' ? '' : padding === 'lg' ? 'p-6 md:p-8' : 'p-5 md:p-6';
  return (
    <div
      className={`rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)] ${pad} ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-base font-semibold tracking-tight text-[var(--color-foreground)]">
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-sm text-[var(--color-muted)]">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
