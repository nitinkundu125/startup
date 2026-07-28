import { create } from 'zustand';
import { DynamicBacktestResult } from './dynamic-backtester';
import { OptimizerResult } from './optimizer';

interface BacktestState {
  activeTab: 'custom' | 'optimizer' | 'batch';
  setActiveTab: (tab: 'custom' | 'optimizer' | 'batch') => void;

  symbol: string;
  setSymbol: (symbol: string) => void;

  stratType: 'RSI' | 'SMA' | 'EMA' | 'MACD' | 'BB' | 'STOCH' | 'ATR' | 'VWAP' | 'OBV' | 'ADX' | 'CCI' | 'PSAR' | 'ICHIMOKU';
  setStratType: (type: any) => void;

  customResult: DynamicBacktestResult | null;
  setCustomResult: (result: DynamicBacktestResult | null) => void;

  optResults: OptimizerResult[] | null;
  setOptResults: (results: OptimizerResult[] | null) => void;

  batchResults: any[] | null;
  setBatchResults: (results: any[] | null) => void;
  appendBatchResults: (results: any[]) => void;
  
  selectedIndex: string;
  setSelectedIndex: (idx: string) => void;
}

export const useBacktestStore = create<BacktestState>((set) => ({
  activeTab: 'batch',
  setActiveTab: (activeTab) => set({ activeTab }),

  symbol: '',
  setSymbol: (symbol) => set({ symbol }),

  stratType: 'RSI',
  setStratType: (stratType) => set({ stratType }),

  customResult: null,
  setCustomResult: (customResult) => set({ customResult }),

  optResults: null,
  setOptResults: (optResults) => set({ optResults }),

  batchResults: null,
  setBatchResults: (batchResults) => set({ batchResults }),
  appendBatchResults: (results) => set((state) => ({ 
    batchResults: [...(state.batchResults || []), ...results] 
  })),

  selectedIndex: 'nifty50',
  setSelectedIndex: (selectedIndex) => set({ selectedIndex }),
}));
