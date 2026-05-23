import { type ButtonHTMLAttributes, type ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent';
type Size = 'sm' | 'md' | 'lg';

const variants: Record<Variant, string> = {
  primary:
    'bg-[var(--color-primary)] text-[var(--color-primary-foreground)] hover:bg-slate-800 shadow-sm',
  secondary:
    'bg-white text-[var(--color-foreground)] border border-[var(--color-border-strong)] hover:bg-slate-50 shadow-sm',
  ghost: 'bg-transparent text-[var(--color-muted)] hover:bg-slate-100 hover:text-[var(--color-foreground)]',
  danger:
    'bg-[var(--color-danger-muted)] text-[var(--color-danger)] border border-red-200 hover:bg-red-600 hover:text-white',
  accent:
    'bg-[var(--color-accent)] text-[var(--color-accent-foreground)] hover:bg-teal-700 shadow-sm',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-11 px-5 text-sm gap-2',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
