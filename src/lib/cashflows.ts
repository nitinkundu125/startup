import { BONUS_MAX_PRICE } from '@/lib/corporate-actions';
import type { CashFlow } from '@/lib/xirr';
import type { TxInput } from '@/lib/portfolio';

/** BUY (−) and SELL (+) cash flows plus terminal portfolio value at `asOf`. */
export function portfolioCashFlows(
  transactions: TxInput[],
  terminalValue: number,
  asOf: Date = new Date()
): CashFlow[] {
  const flows: CashFlow[] = [];

  for (const tx of transactions) {
    const type = tx.type.toUpperCase();
    if (type === 'BUY' && tx.price >= BONUS_MAX_PRICE) {
      const amount = tx.quantity * tx.price;
      if (amount > 0) flows.push({ date: tx.date, amount: -amount });
    } else if (type === 'SELL') {
      const amount = tx.quantity * tx.price;
      if (amount > 0) flows.push({ date: tx.date, amount });
    }
  }

  if (terminalValue > 0) {
    flows.push({ date: asOf, amount: terminalValue });
  }

  flows.sort((a, b) => a.date.getTime() - b.date.getTime());
  return flows;
}
