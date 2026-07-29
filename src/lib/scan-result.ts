import type { StrategyParams } from './dynamic-backtester';

/**
 * One row of scan output: a strategy measured on a stock.
 *
 * Lives here rather than next to either producer because scanning one stock and
 * scanning five hundred emit exactly the same thing. It was briefly declared
 * twice — once in the batch route and once in the optimizer — which is how two
 * result tables drifted apart in the first place.
 */
export type ScanRow = {
  symbol: string;
  strategyName: string;

  /** Fitted (selection) window. */
  totalTrades: number;
  profitableTrades: number;
  winRate: number;
  averageReturn: number;
  totalReturn: number;
  /** Worst single-trade drawdown, %. Deepest a position went underwater. */
  maxDrawdown: number;
  /** Worst peak-to-trough of the compounded equity curve, %. */
  equityMaxDrawdown: number;

  /** Held-back window. Same definitions, so the pairs are comparable. */
  oosTotalTrades: number;
  oosWinRate: number;
  oosAverageReturn: number;
  oosTotalReturn: number;
  oosMaxDrawdown: number;
  oosEquityMaxDrawdown: number;

  /** Stayed profitable on data it was not selected on. */
  heldUp: boolean;
  splitDate: string | null;
  strategy: StrategyParams;
  currentSignal?: 'NEW_BUY' | 'NEW_SELL' | 'HOLDING' | 'WAITING';
  /** Most recent close, used to prefill the buy form. Not a live quote. */
  lastClose?: number;
  /** Strategies that traded on this symbol. Set on the first row only. */
  matchedTotal?: number;
};
