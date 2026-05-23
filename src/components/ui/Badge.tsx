import { type ReactNode } from 'react';

type Tone = 'neutral' | 'success' | 'danger' | 'warning' | 'accent';

const tones: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-700',
  success: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/10',
  danger: 'bg-red-50 text-red-700 ring-1 ring-red-600/10',
  warning: 'bg-amber-50 text-amber-800 ring-1 ring-amber-600/10',
  accent: 'bg-teal-50 text-teal-800 ring-1 ring-teal-600/10',
};

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
