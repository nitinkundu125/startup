import { type ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';

type Tone = 'info' | 'success' | 'error' | 'warning';

const config: Record<
  Tone,
  { bg: string; border: string; icon: typeof Info; iconClass: string }
> = {
  info: {
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    icon: Info,
    iconClass: 'text-slate-600',
  },
  success: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    icon: CheckCircle2,
    iconClass: 'text-emerald-600',
  },
  error: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    icon: AlertCircle,
    iconClass: 'text-red-600',
  },
  warning: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    icon: AlertCircle,
    iconClass: 'text-amber-600',
  },
};

export function Alert({
  tone = 'info',
  title,
  children,
}: {
  tone?: Tone;
  title?: string;
  children: ReactNode;
}) {
  const { bg, border, icon: Icon, iconClass } = config[tone];
  return (
    <div className={`flex gap-3 rounded-lg border p-4 ${bg} ${border}`}>
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${iconClass}`} />
      <div className="min-w-0 text-sm">
        {title && <p className="font-semibold text-[var(--color-foreground)]">{title}</p>}
        <div className={title ? 'mt-1 text-[var(--color-muted)]' : 'text-[var(--color-muted)]'}>
          {children}
        </div>
      </div>
    </div>
  );
}
