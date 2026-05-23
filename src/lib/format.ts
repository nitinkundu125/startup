export function formatINR(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value);
}

/** Shorter INR for chart axes (lakhs / crores) — avoids clipped tick labels. */
export function formatINRCompact(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '−' : '';
  if (abs >= 1e7) {
    const cr = abs / 1e7;
    return `${sign}₹${cr >= 10 ? cr.toFixed(1) : cr.toFixed(2)}Cr`;
  }
  if (abs >= 1e5) {
    const l = abs / 1e5;
    return `${sign}₹${l >= 10 ? l.toFixed(1) : l.toFixed(2)}L`;
  }
  if (abs >= 1e3) {
    return `${sign}₹${(abs / 1e3).toFixed(0)}k`;
  }
  return formatINR(value);
}

export function formatPercent(value: number, digits = 2): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(digits)}%`;
}

export function formatQuantity(value: number): string {
  if (Number.isInteger(value) || Math.abs(value - Math.round(value)) < 1e-6) {
    return String(Math.round(value));
  }
  return value.toFixed(4).replace(/\.?0+$/, '');
}
