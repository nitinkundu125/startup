import { type InputHTMLAttributes } from 'react';

export function Input({
  label,
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label
          htmlFor={props.id}
          className="block text-sm font-medium text-[var(--color-foreground)]"
        >
          {label}
        </label>
      )}
      <input
        className={`h-10 w-full rounded-lg border border-[var(--color-border-strong)] bg-white px-3 text-sm text-[var(--color-foreground)] shadow-sm transition-colors placeholder:text-[var(--color-muted-foreground)] focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 ${className}`}
        {...props}
      />
    </div>
  );
}
