import { type ReactNode } from 'react';

export function StatCard({
  label,
  value,
  subValue,
  icon,
  trend,
}: {
  label: string;
  value: string;
  subValue?: ReactNode;
  icon?: ReactNode;
  trend?: 'up' | 'down' | 'neutral';
}) {
  const trendColor =
    trend === 'up'
      ? 'text-[var(--color-success)]'
      : trend === 'down'
        ? 'text-[var(--color-danger)]'
        : 'text-[var(--color-muted)]';

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-sm)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-muted)]">
            {label}
          </p>
          <p className="mt-2 break-words text-xl font-semibold leading-tight tabular-nums tracking-tight sm:text-2xl">
            {value}
          </p>
          {subValue && (
            <div className={`mt-1.5 text-sm font-medium ${trendColor}`}>{subValue}</div>
          )}
        </div>
        {icon && (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
