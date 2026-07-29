import { create } from 'zustand';
import type { OptimizerResult } from './optimizer';

/**
 * Lab state.
 *
 * There is one operation — run every strategy over some stocks — with two ways
 * to choose the stocks. The separate custom-builder and optimizer views are
 * gone, and their state with them.
 */
interface BacktestState {
  /** Two ways to scan: a named list, or one stock. */
  scanMode: 'list' | 'single';
  setScanMode: (mode: 'list' | 'single') => void;

  /** Target when scanMode is 'single'. */
  symbol: string;
  setSymbol: (symbol: string) => void;

  /** Target when scanMode is 'list'. */
  selectedIndex: string;
  setSelectedIndex: (idx: string) => void;

  /** Results stream in per chunk, so they append rather than replace. */
  results: OptimizerResult[] | null;
  setResults: (results: OptimizerResult[] | null) => void;
  appendResults: (results: OptimizerResult[]) => void;
}

export const useBacktestStore = create<BacktestState>((set) => ({
  scanMode: 'list',
  setScanMode: (scanMode) => set({ scanMode }),

  symbol: '',
  setSymbol: (symbol) => set({ symbol }),

  selectedIndex: 'nifty50',
  setSelectedIndex: (selectedIndex) => set({ selectedIndex }),

  results: null,
  setResults: (results) => set({ results }),
  appendResults: (rows) =>
    set((state) => ({ results: [...(state.results ?? []), ...rows] })),
}));
