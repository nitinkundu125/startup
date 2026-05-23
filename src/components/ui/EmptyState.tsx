import { type ReactNode } from 'react';

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      {icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-500">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-[var(--color-foreground)]">{title}</h3>
      {description && (
        <p className="mt-2 max-w-sm text-sm text-[var(--color-muted)]">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
