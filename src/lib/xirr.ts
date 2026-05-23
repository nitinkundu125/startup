export type CashFlow = { date: Date; amount: number };

function yearFraction(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
}

/**
 * Money-weighted annualized return (XIRR) via Newton–Raphson with bisection fallback.
 * `amount` negative = outflow (investment), positive = inflow (sale / terminal value).
 */
export function xirr(flows: CashFlow[], guess = 0.1): number | null {
  if (flows.length < 2) return null;

  const sorted = [...flows].sort((a, b) => a.date.getTime() - b.date.getTime());
  const t0 = sorted[0].date;

  const hasNeg = sorted.some((f) => f.amount < -1e-6);
  const hasPos = sorted.some((f) => f.amount > 1e-6);
  if (!hasNeg || !hasPos) return null;

  const terms = sorted.map((f) => ({
    y: yearFraction(t0, f.date),
    amount: f.amount,
  }));

  const npv = (rate: number) =>
    terms.reduce((sum, t) => sum + t.amount / Math.pow(1 + rate, t.y), 0);

  const dnpv = (rate: number) =>
    terms.reduce((sum, t) => {
      if (t.y === 0) return sum;
      return sum - (t.y * t.amount) / Math.pow(1 + rate, t.y + 1);
    }, 0);

  let rate = guess;
  for (let i = 0; i < 64; i++) {
    const f = npv(rate);
    const df = dnpv(rate);
    if (!Number.isFinite(f) || !Number.isFinite(df) || Math.abs(df) < 1e-14) break;
    const next = rate - f / df;
    if (!Number.isFinite(next) || next <= -0.999999) break;
    if (Math.abs(next - rate) < 1e-9) {
      return Math.abs(f) < 1e-4 ? next : null;
    }
    rate = next;
  }

  let lo = -0.9999;
  let hi = 10;
  let fLo = npv(lo);
  let fHi = npv(hi);
  if (fLo * fHi > 0) return null;

  for (let i = 0; i < 128; i++) {
    const mid = (lo + hi) / 2;
    const fMid = npv(mid);
    if (Math.abs(fMid) < 1e-6) return mid;
    if (fLo * fMid <= 0) {
      hi = mid;
      fHi = fMid;
    } else {
      lo = mid;
      fLo = fMid;
    }
  }

  return Math.abs(npv((lo + hi) / 2)) < 1e-3 ? (lo + hi) / 2 : null;
}
