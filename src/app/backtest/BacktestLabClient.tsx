'use client';

import { useState, Fragment, useMemo, useEffect } from 'react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Activity, Play, Zap, Settings2, ShieldCheck, Plus, Pin, Star, X } from 'lucide-react';
import type { StrategyParams, SingleStrategyParams } from '@/lib/dynamic-backtester';
import { MIN_OOS_TRADES } from '@/lib/backtest-constants';
import { NIFTY_500_SYMBOLS, NIFTY_50_SYMBOLS, NIFTY_100_SYMBOLS, NIFTY_MIDCAP_150_SYMBOLS, NIFTY_SMALLCAP_250_SYMBOLS } from '@/lib/nifty500';

type WatchlistItem = {
  id: string;
  symbol: string;
};

function renderCondition(cond: SingleStrategyParams): string {
  switch (cond.type) {
    case 'RSI': return `Period: ${cond.period}, OS: ${cond.oversold}, OB: ${cond.overbought}`;
    case 'SMA': return `Fast: ${cond.fastPeriod}, Slow: ${cond.slowPeriod}`;
    case 'EMA': return `Fast: ${cond.fastPeriod}, Slow: ${cond.slowPeriod}`;
    case 'MACD': return `Fast: ${cond.fastPeriod}, Slow: ${cond.slowPeriod}, Sig: ${cond.signalPeriod}`;
    case 'BB': return `Period: ${cond.period}, StdDev: ${cond.multiplier}`;
    case 'STOCH': return `Period: ${cond.period}, OS: ${cond.oversold}, OB: ${cond.overbought}`;
    case 'ATR': return `Period: ${cond.period}, Mult: ${cond.multiplier}`;
    case 'VWAP': return `Period: ${cond.period}`;
    case 'OBV': return `Period: ${cond.period}`;
    case 'ADX': return `Period: ${cond.period}, Thresh: ${cond.strongThreshold}`;
    case 'CCI': return `Period: ${cond.period}, OS: ${cond.oversold}, OB: ${cond.overbought}`;
    case 'PSAR': return `Step: ${cond.step}, Max: ${cond.maxStep}`;
    case 'ICHIMOKU': return `Tenkan: ${cond.tenkan}, Kijun: ${cond.kijun}, SenkouB: ${cond.senkouB}`;
    default: return '';
  }
}

import { useBacktestStore } from '@/lib/backtest-store';

export function BacktestLabClient({ initialWatchlist }: { initialWatchlist: WatchlistItem[] }) {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>(initialWatchlist);
  
  const {
    activeTab, setActiveTab,
    symbol, setSymbol,
    stratType, setStratType,
    customResult, setCustomResult,
    optResults, setOptResults,
    batchResults, setBatchResults, appendBatchResults,
    selectedIndex, setSelectedIndex
  } = useBacktestStore();

  useEffect(() => {
    if (!symbol && initialWatchlist[0]?.symbol) {
      setSymbol(initialWatchlist[0].symbol);
    }
  }, [initialWatchlist, symbol, setSymbol]);
  
  // Expanded state for optimizer rows
  const [expandedOptCard, setExpandedOptCard] = useState<number | null>(null);
  
  // Custom Builder State (Inputs are kept local to avoid massive refactor of 20 variables, they aren't critical to persist like the scan results)
  const [rsiPeriod, setRsiPeriod] = useState(14);
  const [rsiOversold, setRsiOversold] = useState(30);
  const [rsiOverbought, setRsiOverbought] = useState(70);
  
  const [smaFast, setSmaFast] = useState(50);
  const [smaSlow, setSmaSlow] = useState(200);

  const [macdFast, setMacdFast] = useState(12);
  const [macdSlow, setMacdSlow] = useState(26);
  const [macdSignal, setMacdSignal] = useState(9);

  const [bbPeriod, setBbPeriod] = useState(20);
  const [bbMultiplier, setBbMultiplier] = useState(2);

  const [stochPeriod, setStochPeriod] = useState(14);
  const [stochOversold, setStochOversold] = useState(20);
  const [stochOverbought, setStochOverbought] = useState(80);

  const [atrPeriod, setAtrPeriod] = useState(14);
  const [atrMultiplier, setAtrMultiplier] = useState(2);

  const [emaFast, setEmaFast] = useState(20);
  const [emaSlow, setEmaSlow] = useState(50);

  const [vwapPeriod, setVwapPeriod] = useState(20);
  const [obvPeriod, setObvPeriod] = useState(20);
  
  const [adxPeriod, setAdxPeriod] = useState(14);
  const [adxThreshold, setAdxThreshold] = useState(25);

  const [cciPeriod, setCciPeriod] = useState(20);
  const [cciOversold, setCciOversold] = useState(-100);
  const [cciOverbought, setCciOverbought] = useState(100);

  const [psarStep, setPsarStep] = useState(0.02);
  const [psarMax, setPsarMax] = useState(0.2);

  const [ichiTenkan, setIchiTenkan] = useState(9);
  const [ichiKijun, setIchiKijun] = useState(26);
  const [ichiSenkou, setIchiSenkou] = useState(52);

  // Search State
  const [searchQuery, setSearchQuery] = useState(initialWatchlist[0]?.symbol || '');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Batch Search State
  const [newWatchlistSymbol, setNewWatchlistSymbol] = useState('');
  const [isAddingWatchlist, setIsAddingWatchlist] = useState(false);

  // Batch Expand State
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [pinnedStrategies, setPinnedStrategies] = useState<any[]>([]);
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);
  const [expandedTrades, setExpandedTrades] = useState<Record<number, any[]>>({});
  const [loadingTrades, setLoadingTrades] = useState<Record<number, boolean>>({});

  // Batch Progress State
  const [scanProgress, setScanProgress] = useState(0);
  const [scanEta, setScanEta] = useState<number | null>(null);
  const [scanProcessedCount, setScanProcessedCount] = useState(0);
  const [scanTotalCount, setScanTotalCount] = useState(0);

  // Sorting
  const [batchSortBy, setBatchSortBy] = useState<'winRate' | 'signal'>('winRate');

  const [customLoading, setCustomLoading] = useState(false);

  // Optimizer State
  const [optLoading, setOptLoading] = useState(false);
  const [optMeta, setOptMeta] = useState<{
    strategiesTested: number;
    strategiesPassed: number;
    strategiesHeldUp: number;
    splitDate: string | null;
  } | null>(null);

  // Batch Scanner State
  const [batchLoading, setBatchLoading] = useState(false);
  /** Provenance of the scanned universe — synced from NSE, or the built-in list. */
  const [universeSource, setUniverseSource] = useState<string | null>(null);
  /** How many strategy/symbol pairs traded, before the server's per-symbol cap. */
  const [matchedTotal, setMatchedTotal] = useState(0);
  /** Rows actually rendered. The table is not virtualised, so this is a hard guard. */
  const [rowLimit, setRowLimit] = useState(200);

  const displayedResults = useMemo(() => {
    if (!batchResults) return [];
    const copy = [...batchResults];

    // Rank on the held-back window, never on the fitted one. Validated strategies
    // outrank unvalidated ones regardless of how good the fitted numbers look.
    type BatchRow = { heldUp?: boolean; oosTotalTrades?: number; oosWinRate?: number; oosAverageReturn?: number };
    const byOutOfSample = (a: BatchRow, b: BatchRow) => {
      const aHeld = a.heldUp ? 1 : 0;
      const bHeld = b.heldUp ? 1 : 0;
      if (aHeld !== bHeld) return bHeld - aHeld;
      const aN = a.oosTotalTrades ?? 0;
      const bN = b.oosTotalTrades ?? 0;
      if ((aN > 0) !== (bN > 0)) return bN > 0 ? 1 : -1;
      if ((b.oosWinRate ?? 0) !== (a.oosWinRate ?? 0)) return (b.oosWinRate ?? 0) - (a.oosWinRate ?? 0);
      return (b.oosAverageReturn ?? 0) - (a.oosAverageReturn ?? 0);
    };

    if (batchSortBy === 'signal') {
      const priority: Record<string, number> = { 'NEW_BUY': 1, 'NEW_SELL': 2, 'HOLDING': 3, 'WAITING': 4 };
      copy.sort((a, b) => {
        const pA = priority[a.currentSignal || 'WAITING'] || 5;
        const pB = priority[b.currentSignal || 'WAITING'] || 5;
        if (pA !== pB) return pA - pB;
        return byOutOfSample(a, b);
      });
    } else {
      copy.sort(byOutOfSample);
    }
    return copy;
  }, [batchResults, batchSortBy]);

  /**
   * Rows actually handed to the DOM.
   *
   * The table is a plain <table> with no virtualisation, so an unbounded map is
   * the difference between a page and a hung tab: a Nifty 500 scan matches tens
   * of thousands of pairs. The server already caps per symbol; this caps what
   * gets painted.
   */
  const filteredResults = useMemo(
    () =>
      displayedResults.filter(
        (res: any) =>
          !showPinnedOnly ||
          pinnedStrategies.some((p) => p.symbol === res.symbol && p.strategy === res.strategyName)
      ),
    [displayedResults, showPinnedOnly, pinnedStrategies]
  );
  const visibleResults = useMemo(
    () => filteredResults.slice(0, rowLimit),
    [filteredResults, rowLimit]
  );

  async function handleSearch(query: string) {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const res = await fetch(`/api/watchlist/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setSearchResults(data.results || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearching(false);
    }
  }

  useEffect(() => {
    const fetchWatchlist = async () => {
      try {
        const res = await fetch('/api/watchlist');
        const data = await res.json();
        setWatchlist(data.watchlist || []);
      } catch (err) {
        console.error('Failed to load watchlist', err);
      }
    };
    fetchWatchlist();
    
    // Load pinned strategies from backend
    const fetchPinned = async () => {
      try {
        const res = await fetch('/api/backtest/pinned');
        const data = await res.json();
        if (data.success && data.pinned) {
          setPinnedStrategies(data.pinned.map((p: any) => ({
            id: p.id,
            symbol: p.symbol,
            strategy: p.strategyName,
            lastSignal: p.lastSignal,
            signalDate: p.signalDate,
            isNewSignal: p.isNewSignal,
            statsJson: p.statsJson,
            lastUpdated: p.lastUpdated
          })));
        }
      } catch (err) {
        console.error('Failed to load pinned strategies', err);
      }
    };
    fetchPinned();
  }, []);

  const handleTogglePin = async (symbol: string, strategy: string) => {
    // Optimistic UI update
    setPinnedStrategies(prev => {
      const isPinned = prev.some(p => p.symbol === symbol && p.strategy === strategy);
      if (isPinned) {
        return prev.filter(p => !(p.symbol === symbol && p.strategy === strategy));
      } else {
        return [...prev, { symbol, strategy }];
      }
    });

    // Backend sync
    try {
      await fetch('/api/backtest/pinned', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, strategy })
      });
    } catch (err) {
      console.error('Failed to sync pinned strategy', err);
    }
  };

  const [runningCron, setRunningCron] = useState(false);

  const runDailyScript = async () => {
    setRunningCron(true);
    try {
      const res = await fetch('/api/cron/run-pinned', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        // Refresh pinned strategies to get new signals
        const res2 = await fetch('/api/backtest/pinned');
        const data2 = await res2.json();
        if (data2.success && data2.pinned) {
          setPinnedStrategies(data2.pinned.map((p: any) => ({
            id: p.id,
            symbol: p.symbol,
            strategy: p.strategyName,
            lastSignal: p.lastSignal,
            signalDate: p.signalDate,
            isNewSignal: p.isNewSignal,
            statsJson: p.statsJson,
            lastUpdated: p.lastUpdated
          })));
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setRunningCron(false);
    }
  };

  const ackSignal = async (id: string) => {
    setPinnedStrategies(prev => prev.map(p => p.id === id ? { ...p, isNewSignal: false } : p));
    try {
      await fetch('/api/backtest/pinned/ack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
    } catch (err) {
      console.error(err);
    }
  };

  async function handleAddWatchlist() {
    if (!newWatchlistSymbol) return;
    setIsAddingWatchlist(true);
    try {
      const res = await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: newWatchlistSymbol })
      });
      const data = await res.json();
      if (data.success) {
        setWatchlist([...watchlist, { id: data.watchlist.id, symbol: data.watchlist.symbol }]);
        setNewWatchlistSymbol('');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsAddingWatchlist(false);
    }
  }

  async function handleRunCustom(e: React.FormEvent) {
    e.preventDefault();
    if (!symbol) return;
    
    setCustomLoading(true);
    setCustomResult(null);

    let strategy: StrategyParams;
    if (stratType === 'RSI') {
      strategy = { type: 'RSI', period: rsiPeriod, oversold: rsiOversold, overbought: rsiOverbought };
    } else if (stratType === 'SMA') {
      strategy = { type: 'SMA', fastPeriod: smaFast, slowPeriod: smaSlow };
    } else if (stratType === 'EMA') {
      strategy = { type: 'EMA', fastPeriod: emaFast, slowPeriod: emaSlow };
    } else if (stratType === 'MACD') {
      strategy = { type: 'MACD', fastPeriod: macdFast, slowPeriod: macdSlow, signalPeriod: macdSignal };
    } else if (stratType === 'BB') {
      strategy = { type: 'BB', period: bbPeriod, multiplier: bbMultiplier };
    } else if (stratType === 'STOCH') {
      strategy = { type: 'STOCH', period: stochPeriod, smoothK: 3, smoothD: 3, oversold: stochOversold, overbought: stochOverbought };
    } else if (stratType === 'VWAP') {
      strategy = { type: 'VWAP', period: vwapPeriod };
    } else if (stratType === 'OBV') {
      strategy = { type: 'OBV', period: obvPeriod };
    } else if (stratType === 'ADX') {
      strategy = { type: 'ADX', period: adxPeriod, strongThreshold: adxThreshold };
    } else if (stratType === 'CCI') {
      strategy = { type: 'CCI', period: cciPeriod, oversold: cciOversold, overbought: cciOverbought };
    } else if (stratType === 'PSAR') {
      strategy = { type: 'PSAR', step: psarStep, maxStep: psarMax };
    } else if (stratType === 'ICHIMOKU') {
      strategy = { type: 'ICHIMOKU', tenkan: ichiTenkan, kijun: ichiKijun, senkouB: ichiSenkou };
    } else {
      strategy = { type: 'ATR', period: atrPeriod, multiplier: atrMultiplier };
    }

    try {
      const res = await fetch('/api/backtest/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, strategy })
      });
      const data = await res.json();
      if (data.success) {
        setCustomResult(data.stats);
      } else {
        alert(data.error);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCustomLoading(false);
    }
  }

  async function handleRunOptimizer() {
    if (!symbol) return;
    
    setOptLoading(true);
    setOptResults(null);

    try {
      const res = await fetch('/api/backtest/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol })
      });
      const data = await res.json();
      if (data.success) {
        setOptResults(data.results);
        setOptMeta({
          strategiesTested: data.strategiesTested ?? 0,
          strategiesPassed: data.strategiesPassed ?? 0,
          strategiesHeldUp: data.strategiesHeldUp ?? 0,
          splitDate: data.splitDate ?? null,
        });
      } else {
        alert(data.error);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setOptLoading(false);
    }
  }

  /**
   * Resolve the chosen universe, then scan it.
   *
   * Index membership comes from the server (synced monthly from NSE) rather
   * than the hardcoded arrays, so a reconstitution shows up without a code
   * change. The built-in list is the fallback if the lookup fails, so a network
   * blip degrades to a stale universe rather than an empty one.
   */
  async function handleScanClick() {
    if (selectedIndex === 'watchlist') return handleRunBatch(watchlist.map((w) => w.symbol));
    if (selectedIndex === 'pinned') {
      return handleRunBatch(Array.from(new Set(pinnedStrategies.map((p) => p.symbol))));
    }

    const builtin: Record<string, string[]> = {
      nifty50: NIFTY_50_SYMBOLS,
      nifty100: NIFTY_100_SYMBOLS,
      midcap150: NIFTY_MIDCAP_150_SYMBOLS,
      smallcap250: NIFTY_SMALLCAP_250_SYMBOLS,
      nifty500: NIFTY_500_SYMBOLS,
    };

    try {
      const res = await fetch(`/api/backtest/symbols?index=${encodeURIComponent(selectedIndex)}`);
      const data = await res.json();
      if (data?.success && Array.isArray(data.symbols) && data.symbols.length > 0) {
        setUniverseSource(
          data.source === 'nse-sync'
            ? `${data.count} symbols · synced ${data.staleDays === 0 ? 'today' : `${data.staleDays}d ago`}`
            : `${data.count} symbols · built-in list, never synced`
        );
        return handleRunBatch(data.symbols);
      }
    } catch {
      // fall through to the built-in list
    }
    setUniverseSource(`${(builtin[selectedIndex] ?? []).length} symbols · built-in list`);
    return handleRunBatch(builtin[selectedIndex] ?? NIFTY_500_SYMBOLS);
  }

  async function handleRunBatch(symbolsToScan: string[]) {
    if (symbolsToScan.length === 0) return;
    setBatchLoading(true);
    setBatchResults([]);
    setExpandedRow(null);
    setScanProgress(0);
    setScanProcessedCount(0);
    setScanTotalCount(symbolsToScan.length);
    setScanEta(null);
    setMatchedTotal(0);
    setRowLimit(200);
    
    const startTime = Date.now();
    const CHUNK_SIZE = 10;
    let processed = 0;
    
    try {
      for (let i = 0; i < symbolsToScan.length; i += CHUNK_SIZE) {
        const chunk = symbolsToScan.slice(i, i + CHUNK_SIZE);
        
        try {
          const res = await fetch('/api/backtest/batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ symbols: chunk })
          });
          
          const data = await res.json();
          
          if (data.success) {
            appendBatchResults(data.results);
            if (typeof data.matchedTotal === 'number') {
              setMatchedTotal((n) => n + data.matchedTotal);
            }
          }
        } catch (chunkError) {
          console.error("Chunk failed to load:", chunk, chunkError);
          // Silently continue to next chunk
        }
        
        processed += chunk.length;
        setScanProcessedCount(processed);
        setScanProgress((processed / symbolsToScan.length) * 100);
        
        // Calculate ETA
        const elapsed = Date.now() - startTime;
        const timePerSymbol = elapsed / processed;
        const remaining = symbolsToScan.length - processed;
        setScanEta(Math.round((timePerSymbol * remaining) / 1000));
      }
    } catch (e: any) {
      console.error(e);
      alert("Network error: " + e.message);
    } finally {
      setBatchLoading(false);
      setScanEta(null);
    }
  }

  async function toggleTradeDetails(idx: number, symbol: string, strategy: StrategyParams) {
    if (expandedRow === idx) {
      setExpandedRow(null);
      return;
    }
    setExpandedRow(idx);
    
    if (!expandedTrades[idx]) {
      setLoadingTrades(prev => ({ ...prev, [idx]: true }));
      try {
        const res = await fetch('/api/backtest/custom', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbol, strategy })
        });
        const data = await res.json();
        if (data.success) {
          setExpandedTrades(prev => ({ ...prev, [idx]: data.stats.trades }));
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingTrades(prev => ({ ...prev, [idx]: false }));
      }
    }
  }

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Zap className="h-6 w-6 text-yellow-500" />
            Quant Backtest Laboratory
          </h1>
          <p className="text-slate-500">Discover mechanical alpha using the Master Strategy Library.</p>
        </div>
        
        <div className="flex bg-slate-100 p-1 rounded-lg">
          <button 
            onClick={() => setActiveTab('batch')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'batch' ? 'bg-white shadow text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Batch Scanner
          </button>
          <button 
            onClick={() => setActiveTab('optimizer')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'optimizer' ? 'bg-white shadow text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Auto-Optimizer
          </button>
          <button 
            onClick={() => setActiveTab('custom')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'custom' ? 'bg-white shadow text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Custom Builder
          </button>
        </div>
      </div>

      {pinnedStrategies.length > 0 && (
        <Card className="bg-white border-slate-200 mb-8 overflow-hidden shadow-sm p-0">
          <div className="bg-slate-50 p-4 border-b border-slate-200 flex justify-between items-center">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
              Pinned Strategy Alerts
            </h2>
            <Button onClick={runDailyScript} disabled={runningCron} size="sm" variant="secondary" className="gap-2">
              <Activity className={`h-4 w-4 ${runningCron ? 'animate-spin' : ''}`} />
              {runningCron ? 'Scanning Live Prices...' : 'Run Daily Screener'}
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-white text-slate-500 font-medium border-b border-slate-100">
                <tr>
                  <th className="px-4 py-3">Symbol</th>
                  <th className="px-4 py-3">Strategy</th>
                  <th className="px-4 py-3">Live Signal</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...pinnedStrategies]
                  .sort((a, b) => (b.isNewSignal ? 1 : 0) - (a.isNewSignal ? 1 : 0))
                  .map((p) => (
                  <tr key={p.id || `${p.symbol}-${p.strategy}`} className={`transition-colors ${p.isNewSignal ? 'bg-yellow-50 hover:bg-yellow-100' : 'hover:bg-slate-50'}`}>
                    <td className="px-4 py-3 font-bold text-slate-800">{p.symbol}</td>
                    <td className="px-4 py-3 font-medium text-blue-600">{p.strategy}</td>
                    <td className="px-4 py-3">
                      {p.lastSignal ? (
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center justify-center font-bold px-2.5 py-1 rounded-full text-xs border ${p.lastSignal.includes('BUY') ? 'bg-green-100 text-green-700 border-green-200' : p.lastSignal.includes('SELL') ? 'bg-red-100 text-red-700 border-red-200' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                            {p.lastSignal}
                          </span>
                          {p.isNewSignal && (
                            <span className="flex h-3 w-3 relative">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-500"></span>
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-xs">Run scanner to evaluate</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {p.isNewSignal && (
                        <button onClick={() => ackSignal(p.id)} className="text-xs font-semibold text-slate-500 hover:text-slate-800 underline mr-4">
                          Dismiss Alert
                        </button>
                      )}
                      <button onClick={() => handleTogglePin(p.symbol, p.strategy)} className="text-slate-400 hover:text-red-500 transition-colors">
                        <X className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {activeTab !== 'batch' && (
        <Card className="bg-slate-50 border-slate-200">
          <div className="p-4 flex flex-col md:flex-row items-center gap-4">
            <label className="font-semibold text-slate-700 whitespace-nowrap">Target Stock:</label>
            <div className="relative w-full md:w-96">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search for any Indian stock (e.g. RELIANCE)..."
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {isSearching && (
                <Activity className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-slate-400" />
              )}
              
              {searchResults.length > 0 && searchQuery && (
                <div className="absolute z-10 mt-1 w-full rounded-md bg-white shadow-lg border border-slate-200 max-h-60 overflow-y-auto">
                  <ul className="py-1">
                    {searchResults.map((res) => (
                      <li
                        key={res.symbol}
                        onClick={() => {
                          setSymbol(res.symbol);
                          setSearchQuery(res.symbol);
                          setSearchResults([]);
                        }}
                        className="cursor-pointer px-4 py-2 hover:bg-slate-50 border-b border-slate-50 last:border-0"
                      >
                        <div className="font-medium text-slate-800">{res.symbol}</div>
                        <div className="text-xs text-slate-500">{res.name}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="text-xs font-bold text-slate-400 uppercase">OR</div>
            <select 
              value={symbol}
              onChange={(e) => { setSymbol(e.target.value); setSearchQuery(e.target.value); }}
              className="w-full md:w-64 rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="" disabled>Select from Watchlist...</option>
              {watchlist.map(w => (
                <option key={w.id} value={w.symbol}>{w.symbol}</option>
              ))}
            </select>
          </div>
        </Card>
      )}

      {activeTab === 'batch' && (
        <Card className="border-slate-200 shadow-sm p-0 overflow-hidden">
          <div className="bg-slate-50 border-b border-slate-100 flex flex-col gap-4 p-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between w-full gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-blue-500" />
                  Portfolio Batch Scanner
                </h2>
                <p className="text-sm text-slate-500">
                  Run the entire Master Strategy Library against your chosen universe.
                  {universeSource && (
                    // Say where the list came from. A built-in list that has
                    // never synced is a stale universe, and that should be
                    // visible rather than implied.
                    <span className="ml-1 text-slate-400">Last scan: {universeSource}.</span>
                  )}
                </p>
              </div>
              {/* One dropdown, one button. "Scan Watchlist" and "Scan Index"
                  were two buttons doing the same thing against different symbol
                  lists — the watchlist is now just another entry in the list. */}
              <div className="flex shadow-sm rounded-md w-full md:w-auto">
                <select
                  value={selectedIndex}
                  onChange={(e) => setSelectedIndex(e.target.value)}
                  className="flex-1 px-3 py-2 text-sm focus:outline-none border border-r-0 border-slate-300 bg-white text-slate-700 font-medium rounded-l-md"
                  disabled={batchLoading}
                >
                  <option value="watchlist">My Watchlist ({watchlist.length})</option>
                  <option value="pinned">Pinned Symbols</option>
                  <option value="nifty50">Nifty 50</option>
                  <option value="nifty100">Nifty 100</option>
                  <option value="midcap150">Midcap 150</option>
                  <option value="smallcap250">Smallcap 250</option>
                  <option value="nifty500">Nifty 500 (All)</option>
                </select>
                <Button
                  onClick={() => { void handleScanClick(); }}
                  disabled={batchLoading || (selectedIndex === 'watchlist' && watchlist.length === 0)}
                  className="bg-blue-600 hover:bg-blue-700 text-white border-none rounded-l-none rounded-r-md px-5 whitespace-nowrap"
                >
                  {batchLoading
                    ? <span className="flex items-center gap-2"><Activity className="h-4 w-4 animate-spin" /> Scanning…</span>
                    : <span className="flex items-center gap-2"><Zap className="h-4 w-4" /> Scan</span>}
                </Button>
              </div>
            </div>
            <div className="flex flex-col md:flex-row gap-6 w-full">
              {/* Quick Add to Watchlist */}
              <div className="w-full md:w-1/2 relative">
                <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Quick Add to Watchlist</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newWatchlistSymbol}
                    onChange={(e) => setNewWatchlistSymbol(e.target.value.toUpperCase())}
                    placeholder="e.g. ZOMATO.NS"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                  <Button onClick={handleAddWatchlist} disabled={!newWatchlistSymbol || isAddingWatchlist} className="bg-slate-800 text-white hover:bg-slate-900">
                    {isAddingWatchlist ? <Activity className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  {watchlist.map(w => (
                    <span key={w.id} className="inline-flex items-center px-2 py-1 bg-slate-200 text-slate-700 text-xs rounded-full font-medium shadow-sm">
                      {w.symbol}
                    </span>
                  ))}
                </div>
              </div>

              {/* Sort dropdown removed — the "Live Signal" and "Win Rate"
                  column headers are already click-to-sort and drive the same
                  state, so this was a second control for one setting. */}
              <div className="w-full md:w-1/3 ml-auto flex flex-col gap-3 justify-end">
                <label className="flex items-center gap-2 cursor-pointer mt-1">
                  <input 
                    type="checkbox" 
                    checked={showPinnedOnly}
                    onChange={(e) => setShowPinnedOnly(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                  />
                  <span className="text-sm font-medium text-slate-700">Show Pinned Strategies Only</span>
                </label>
              </div>
            </div>
          </div>
          
          <div className="p-0">
            {batchLoading && (
              <div className="p-12 text-center">
                <div className="max-w-md mx-auto bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                  <Activity className="h-10 w-10 animate-spin mx-auto mb-4 text-indigo-600" />
                  <h3 className="font-bold text-slate-800 text-lg mb-1">Simulating 3,000+ Strategies</h3>
                  <p className="text-slate-500 text-sm mb-6">Processing deep historical backtests across the requested pool. Sit tight.</p>
                  
                  <div className="w-full bg-slate-100 rounded-full h-3 mb-2 overflow-hidden border border-slate-200 relative">
                    <div 
                      className="bg-indigo-600 h-3 rounded-full transition-all duration-300 ease-out" 
                      style={{ width: `${scanProgress}%` }}
                    ></div>
                  </div>
                  
                  <div className="flex justify-between items-center text-xs font-bold text-slate-500 mb-4">
                    <span>{scanProcessedCount} / {scanTotalCount} Stocks Processed</span>
                    <span className="text-indigo-600">{Math.round(scanProgress)}%</span>
                  </div>
                  
                  {scanEta !== null && scanEta > 0 && (
                    <div className="bg-indigo-50 text-indigo-700 rounded-lg p-3 text-sm font-semibold flex items-center justify-center gap-2">
                      <Zap className="h-4 w-4" /> ETA: ~{scanEta} seconds remaining
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {!batchLoading && (!batchResults || batchResults.length === 0) && (
              <div className="p-12 text-center text-slate-400">
                <ShieldCheck className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p>Click a Scan button to find the absolute best Stock + Strategy combinations.</p>
              </div>
            )}

            {!batchLoading && batchResults && batchResults.length > 0 && (
              <>
              {/* The scan universe is today's index membership, so anything that
                  was delisted or demoted is missing from history. Results are an
                  upper bound, not an estimate. */}
              {/* Coverage, stated plainly. A capped table that looks complete is
                  how "top 10 of 130,000" gets mistaken for "these are the matches". */}
              <div className="mx-5 mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-600">
                <span className="font-semibold text-slate-800">
                  Showing {visibleResults.length.toLocaleString()} of {filteredResults.length.toLocaleString()} rows
                </span>
                {matchedTotal > filteredResults.length && (
                  <span className="text-slate-500">
                    · best 10 per stock, out of {matchedTotal.toLocaleString()} strategy/stock pairs that traded
                  </span>
                )}
                {filteredResults.length > visibleResults.length && (
                  <button
                    onClick={() => setRowLimit((n) => n + 500)}
                    className="ml-1 text-blue-600 hover:text-blue-800 font-semibold underline"
                  >
                    show 500 more
                  </button>
                )}
              </div>

              <div className="mx-5 mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <p className="font-semibold">Read these as an upper bound.</p>
                <p className="mt-1 text-amber-800">
                  The scan universe is the <strong>current</strong> index membership, so companies
                  that were delisted or dropped from the index never appear — every strategy looks
                  better than it would have in real time. Fitted columns were selected on;
                  only the <strong>OOS</strong> columns are evidence.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-5 py-3 w-10"></th>
                      <th className="px-5 py-3">Rank</th>
                      <th className="px-5 py-3">Symbol</th>
                      <th className="px-5 py-3">Strategy Name</th>
                      <th 
                        className="px-5 py-3 text-center cursor-pointer hover:bg-slate-200 transition-colors"
                        onClick={() => setBatchSortBy(prev => prev === 'signal' ? 'winRate' : 'signal')}
                        title="Click to toggle sorting by Live Signal"
                      >
                        Live Signal {batchSortBy === 'signal' ? '↓' : '↕'}
                      </th>
                      <th
                        className="px-5 py-3 text-right cursor-pointer hover:bg-slate-200 transition-colors"
                        onClick={() => setBatchSortBy('winRate')}
                        title="Win rate on the window the strategy was SELECTED on. Fitted — not evidence."
                      >
                        Win Rate <span className="normal-case text-slate-400">(fitted)</span> {batchSortBy === 'winRate' ? '↓' : '↕'}
                      </th>
                      <th className="px-5 py-3 text-right" title="Average return on the fitted window">Avg Return <span className="normal-case text-slate-400">(fitted)</span></th>
                      <th className="px-5 py-3 text-right bg-indigo-50/60" title="Win rate on held-back data the strategy was NOT selected on. This is the number that means something.">
                        OOS Win Rate
                      </th>
                      <th className="px-5 py-3 text-right bg-indigo-50/60" title="Average net return per trade on held-back data, after costs">
                        OOS Avg Return
                      </th>
                      <th className="px-5 py-3 text-right">Max Drawdown</th>
                      <th className="px-5 py-3 text-right">Total Trades</th>
                      <th className="px-5 py-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {visibleResults.map((res, idx) => {
                      const isPinned = pinnedStrategies.some(p => p.symbol === res.symbol && p.strategy === res.strategyName);
                      return (
                      <Fragment key={`${res.symbol}-${res.strategyName}-${idx}`}>
                        <tr className="hover:bg-slate-50 transition-colors group">
                          <td className="px-5 py-4">
                            <button 
                              onClick={() => handleTogglePin(res.symbol, res.strategyName)}
                              className={`p-1 rounded hover:bg-slate-200 transition-colors ${isPinned ? 'text-amber-500' : 'text-slate-300 group-hover:text-slate-400'}`}
                              title={isPinned ? "Unpin strategy" : "Pin this strategy"}
                            >
                              <Pin className={`h-4 w-4 ${isPinned ? 'fill-current' : ''}`} />
                            </button>
                          </td>
                          <td className="px-5 py-4 font-bold text-slate-400">#{idx + 1}</td>
                          <td className="px-5 py-4 font-bold text-slate-800">{res.symbol}</td>
                          <td className="px-5 py-4 font-medium text-blue-600">{res.strategyName}</td>
                          <td className="px-5 py-4 text-center">
                            {res.currentSignal === 'NEW_BUY' && <span className="inline-flex items-center px-2 py-1 rounded bg-green-500 text-white text-xs font-bold shadow-sm animate-pulse">🔥 BUY TODAY</span>}
                            {res.currentSignal === 'HOLDING' && <span className="inline-flex items-center px-2 py-1 rounded bg-blue-100 text-blue-700 text-xs font-bold">IN TRADE</span>}
                            {res.currentSignal === 'NEW_SELL' && <span className="inline-flex items-center px-2 py-1 rounded bg-red-500 text-white text-xs font-bold shadow-sm">SELL TODAY</span>}
                            {(!res.currentSignal || res.currentSignal === 'WAITING') && <span className="inline-flex items-center px-2 py-1 rounded bg-slate-100 text-slate-500 text-xs font-medium">WAITING</span>}
                          </td>
                          <td className="px-5 py-4 text-right">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
                              {res.winRate.toFixed(1)}%
                            </span>
                          </td>
                          <td className={`px-5 py-4 text-right font-medium ${res.averageReturn > 0 ? 'text-slate-500' : 'text-slate-400'}`}>
                            {res.averageReturn > 0 ? '+' : ''}{res.averageReturn.toFixed(2)}%
                          </td>
                          {/* Held-back window. Emphasised over the fitted columns because
                              the fitted ones were selected on and therefore prove nothing. */}
                          <td className="px-5 py-4 text-right bg-indigo-50/40">
                            {res.oosTotalTrades >= MIN_OOS_TRADES ? (
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-bold ${res.heldUp ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-600'}`}>
                                {res.oosWinRate.toFixed(1)}%
                              </span>
                            ) : (
                              <span
                                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700"
                                title={`Only ${res.oosTotalTrades} held-back trade(s) — too few to mean anything. A single winning trade is a 100% win rate.`}
                              >
                                {res.oosTotalTrades === 0 ? 'unvalidated' : `only ${res.oosTotalTrades} trade(s)`}
                              </span>
                            )}
                          </td>
                          <td className={`px-5 py-4 text-right font-bold bg-indigo-50/40 ${res.oosTotalTrades === 0 ? 'text-slate-400' : res.oosAverageReturn > 0 ? 'text-green-600' : 'text-red-500'}`}>
                            {res.oosTotalTrades > 0
                              ? `${res.oosAverageReturn > 0 ? '+' : ''}${res.oosAverageReturn.toFixed(2)}%`
                              : '—'}
                            {res.oosTotalTrades > 0 && (
                              <span className="block text-[10px] font-normal text-slate-400">{res.oosTotalTrades} trade(s)</span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-right font-bold text-red-500">
                            {res.maxDrawdown ? res.maxDrawdown.toFixed(2) : '0.00'}%
                          </td>
                          <td className="px-5 py-4 text-right text-slate-500 font-medium">
                            {res.totalTrades}
                          </td>
                          <td className="px-5 py-4 text-center">
                            <button 
                              onClick={() => toggleTradeDetails(idx, res.symbol, res.strategy)}
                              className="text-blue-500 hover:text-blue-700 font-semibold text-xs transition-colors"
                            >
                              {expandedRow === idx ? 'Close Details' : 'View Trades'}
                            </button>
                          </td>
                        </tr>
                        {expandedRow === idx && (
                          <tr className="bg-slate-50 border-b border-slate-200">
                            <td colSpan={12} className="px-5 py-6">
                              <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
                                <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                                  <Settings2 className="h-4 w-4 text-slate-500" /> 
                                  Strategy Configuration & Trade Log
                                </h3>
                                
                                {loadingTrades[idx] ? (
                                  <div className="py-8 text-center text-slate-500">
                                    <Activity className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-500" />
                                    <p className="text-sm">Fetching exact trade log from the engine...</p>
                                  </div>
                                ) : (
                                  <div>
                                    <div className="max-h-64 overflow-y-auto rounded border border-slate-100">
                                      <table className="w-full text-xs text-left">
                                        <thead className="bg-slate-100 text-slate-600 sticky top-0">
                                          <tr>
                                            <th className="px-3 py-2">Entry Date</th>
                                            <th className="px-3 py-2 text-right">Entry Price</th>
                                            <th className="px-3 py-2">Exit Date</th>
                                            <th className="px-3 py-2 text-right">Exit Price</th>
                                            <th className="px-3 py-2 text-right">Return</th>
                                            <th className="px-3 py-2 text-right">Max DD</th>
                                            <th className="px-3 py-2 text-right">Days Held</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                          {expandedTrades[idx]?.length > 0 ? expandedTrades[idx].map((trade: any, i: number) => (
                                            <tr key={i} className="hover:bg-slate-50">
                                              <td className="px-3 py-2">{new Date(trade.entryDate).toLocaleDateString()}</td>
                                              <td className="px-3 py-2 text-right font-medium">₹{trade.entryPrice.toFixed(2)}</td>
                                              <td className="px-3 py-2">{new Date(trade.exitDate).toLocaleDateString()}</td>
                                              <td className="px-3 py-2 text-right font-medium">₹{trade.exitPrice?.toFixed(2) || 'Open'}</td>
                                              <td className={`px-3 py-2 text-right font-bold ${trade.returnPct > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                {trade.returnPct > 0 ? '+' : ''}{trade.returnPct.toFixed(2)}%
                                              </td>
                                              <td className="px-3 py-2 text-right font-medium text-red-500">
                                                {trade.maxDrawdownPct ? trade.maxDrawdownPct.toFixed(2) : '0.00'}%
                                              </td>
                                              <td className="px-3 py-2 text-right text-slate-500 font-medium">
                                                {trade.exitDate ? Math.floor((new Date(trade.exitDate).getTime() - new Date(trade.entryDate).getTime()) / (1000 * 60 * 60 * 24)) : '-'}d
                                              </td>
                                            </tr>
                                          )) : (
                                            <tr>
                                              <td colSpan={7} className="px-3 py-4 text-center text-slate-500">No trades recorded.</td>
                                            </tr>
                                          )}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              </>
            )}
          </div>
        </Card>
      )}

      {/* Second tab bar removed — the header tabs already switch between all
          three views, and this rendered two of them again a few hundred pixels
          lower with different styling. */}

      {activeTab === 'custom' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-6">
            <Card>
              <CardHeader title="Build Strategy" />
              <div className="p-5 pt-0">
                <form onSubmit={handleRunCustom} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Indicator Type</label>
                    <select 
                      value={stratType} 
                      onChange={(e) => setStratType(e.target.value as any)}
                      className="w-full rounded border border-slate-300 p-2 text-sm"
                    >
                      <option value="RSI">RSI (Momentum Reversion)</option>
                      <option value="SMA">SMA (Trend Crossover)</option>
                      <option value="EMA">EMA (Fast Trend Crossover)</option>
                      <option value="MACD">MACD (Momentum Crossover)</option>
                      <option value="BB">Bollinger Bands (Momentum Breakout)</option>
                      <option value="STOCH">Stochastic (Momentum Reversion)</option>
                      <option value="ATR">ATR (Volatility Trail)</option>
                      <option value="VWAP">VWAP (Institutional Value)</option>
                      <option value="OBV">OBV (Volume Trend)</option>
                      <option value="ADX">ADX (Trend Strength)</option>
                      <option value="CCI">CCI (Cyclical Momentum)</option>
                      <option value="PSAR">Parabolic SAR (Trailing Reversal)</option>
                      <option value="ICHIMOKU">Ichimoku Cloud (Support Breakout)</option>
                    </select>
                  </div>

                  {stratType === 'RSI' && (
                    <div className="space-y-3 bg-slate-50 p-3 rounded border border-slate-100">
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">RSI Period (Days)</label>
                        <input type="number" value={rsiPeriod} onChange={(e) => setRsiPeriod(Number(e.target.value))} className="w-full p-2 border rounded text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-green-600 mb-1">Buy When RSI Crosses Below (Oversold)</label>
                        <input type="number" value={rsiOversold} onChange={(e) => setRsiOversold(Number(e.target.value))} className="w-full p-2 border border-green-200 rounded text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-red-600 mb-1">Sell When RSI Crosses Above (Overbought)</label>
                        <input type="number" value={rsiOverbought} onChange={(e) => setRsiOverbought(Number(e.target.value))} className="w-full p-2 border border-red-200 rounded text-sm" />
                      </div>
                    </div>
                  )}

                  {stratType === 'SMA' && (
                    <div className="space-y-3 bg-slate-50 p-3 rounded border border-slate-100">
                      <div>
                        <label className="block text-xs font-medium text-green-600 mb-1">Fast SMA Period (e.g. 50)</label>
                        <input type="number" value={smaFast} onChange={(e) => setSmaFast(Number(e.target.value))} className="w-full p-2 border border-green-200 rounded text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-red-600 mb-1">Slow SMA Period (e.g. 200)</label>
                        <input type="number" value={smaSlow} onChange={(e) => setSmaSlow(Number(e.target.value))} className="w-full p-2 border border-red-200 rounded text-sm" />
                      </div>
                      <p className="text-xs text-slate-500 italic mt-2">Buys when Fast SMA crosses above Slow. Sells when Fast crosses below Slow.</p>
                    </div>
                  )}

                  {stratType === 'EMA' && (
                    <div className="space-y-3 bg-slate-50 p-3 rounded border border-slate-100">
                      <div>
                        <label className="block text-xs font-medium text-green-600 mb-1">Fast EMA Period (e.g. 20)</label>
                        <input type="number" value={emaFast} onChange={(e) => setEmaFast(Number(e.target.value))} className="w-full p-2 border border-green-200 rounded text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-red-600 mb-1">Slow EMA Period (e.g. 50)</label>
                        <input type="number" value={emaSlow} onChange={(e) => setEmaSlow(Number(e.target.value))} className="w-full p-2 border border-red-200 rounded text-sm" />
                      </div>
                      <p className="text-xs text-slate-500 italic mt-2">Buys when Fast EMA crosses above Slow. Sells when Fast crosses below Slow. Reacts faster than SMA.</p>
                    </div>
                  )}

                  {stratType === 'MACD' && (
                    <div className="space-y-3 bg-slate-50 p-3 rounded border border-slate-100">
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Fast EMA Period (e.g. 12)</label>
                        <input type="number" value={macdFast} onChange={(e) => setMacdFast(Number(e.target.value))} className="w-full p-2 border rounded text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Slow EMA Period (e.g. 26)</label>
                        <input type="number" value={macdSlow} onChange={(e) => setMacdSlow(Number(e.target.value))} className="w-full p-2 border rounded text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Signal Line Period (e.g. 9)</label>
                        <input type="number" value={macdSignal} onChange={(e) => setMacdSignal(Number(e.target.value))} className="w-full p-2 border rounded text-sm" />
                      </div>
                      <p className="text-xs text-slate-500 italic mt-2">Buys when MACD crosses above Signal Line. Sells when MACD crosses below Signal Line.</p>
                    </div>
                  )}

                  {stratType === 'BB' && (
                    <div className="space-y-3 bg-slate-50 p-3 rounded border border-slate-100">
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Moving Average Period (e.g. 20)</label>
                        <input type="number" value={bbPeriod} onChange={(e) => setBbPeriod(Number(e.target.value))} className="w-full p-2 border rounded text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Standard Deviation Multiplier (e.g. 2.0)</label>
                        <input type="number" step="0.1" value={bbMultiplier} onChange={(e) => setBbMultiplier(Number(e.target.value))} className="w-full p-2 border rounded text-sm" />
                      </div>
                      <p className="text-xs text-slate-500 italic mt-2">Buys on Momentum Breakout (price closes above Upper Band). Sells on Reversion (price crosses below Middle Band).</p>
                    </div>
                  )}

                  {stratType === 'STOCH' && (
                    <div className="space-y-3 bg-slate-50 p-3 rounded border border-slate-100">
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Stochastic Period</label>
                        <input type="number" value={stochPeriod} onChange={(e) => setStochPeriod(Number(e.target.value))} className="w-full p-2 border rounded text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-green-600 mb-1">Oversold Threshold (e.g. 20)</label>
                        <input type="number" value={stochOversold} onChange={(e) => setStochOversold(Number(e.target.value))} className="w-full p-2 border border-green-200 rounded text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-red-600 mb-1">Overbought Threshold (e.g. 80)</label>
                        <input type="number" value={stochOverbought} onChange={(e) => setStochOverbought(Number(e.target.value))} className="w-full p-2 border border-red-200 rounded text-sm" />
                      </div>
                    </div>
                  )}

                  {stratType === 'ATR' && (
                    <div className="space-y-3 bg-slate-50 p-3 rounded border border-slate-100">
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">ATR Period (e.g. 14)</label>
                        <input type="number" value={atrPeriod} onChange={(e) => setAtrPeriod(Number(e.target.value))} className="w-full p-2 border rounded text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Trailing Stop Multiplier (e.g. 2.0)</label>
                        <input type="number" step="0.1" value={atrMultiplier} onChange={(e) => setAtrMultiplier(Number(e.target.value))} className="w-full p-2 border rounded text-sm" />
                      </div>
                      <p className="text-xs text-slate-500 italic mt-2">In Custom Builder, ATR alone will just buy immediately and trail the stop. Best used in Compound strategies.</p>
                    </div>
                  )}

                  {stratType === 'VWAP' && (
                    <div className="space-y-3 bg-slate-50 p-3 rounded border border-slate-100">
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Rolling VWAP Period (e.g. 20 days)</label>
                        <input type="number" value={vwapPeriod} onChange={(e) => setVwapPeriod(Number(e.target.value))} className="w-full p-2 border rounded text-sm" />
                      </div>
                      <p className="text-xs text-slate-500 italic mt-2">Buys when Price breaks above VWAP. Sells when Price drops below VWAP.</p>
                    </div>
                  )}

                  {stratType === 'OBV' && (
                    <div className="space-y-3 bg-slate-50 p-3 rounded border border-slate-100">
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">OBV Signal Line (SMA Period)</label>
                        <input type="number" value={obvPeriod} onChange={(e) => setObvPeriod(Number(e.target.value))} className="w-full p-2 border rounded text-sm" />
                      </div>
                      <p className="text-xs text-slate-500 italic mt-2">Buys when On-Balance Volume crosses above its moving average (Volume Breakout).</p>
                    </div>
                  )}

                  {stratType === 'ADX' && (
                    <div className="space-y-3 bg-slate-50 p-3 rounded border border-slate-100">
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">ADX Period</label>
                        <input type="number" value={adxPeriod} onChange={(e) => setAdxPeriod(Number(e.target.value))} className="w-full p-2 border rounded text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Strong Trend Threshold (e.g. 25)</label>
                        <input type="number" value={adxThreshold} onChange={(e) => setAdxThreshold(Number(e.target.value))} className="w-full p-2 border rounded text-sm" />
                      </div>
                      <p className="text-xs text-slate-500 italic mt-2">Buys when ADX &gt; Threshold AND +DI crosses above -DI. Sells when trend weakens.</p>
                    </div>
                  )}

                  {stratType === 'CCI' && (
                    <div className="space-y-3 bg-slate-50 p-3 rounded border border-slate-100">
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">CCI Period</label>
                        <input type="number" value={cciPeriod} onChange={(e) => setCciPeriod(Number(e.target.value))} className="w-full p-2 border rounded text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-green-600 mb-1">Oversold (e.g. -100)</label>
                        <input type="number" value={cciOversold} onChange={(e) => setCciOversold(Number(e.target.value))} className="w-full p-2 border border-green-200 rounded text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-red-600 mb-1">Overbought (e.g. 100)</label>
                        <input type="number" value={cciOverbought} onChange={(e) => setCciOverbought(Number(e.target.value))} className="w-full p-2 border border-red-200 rounded text-sm" />
                      </div>
                    </div>
                  )}

                  {stratType === 'PSAR' && (
                    <div className="space-y-3 bg-slate-50 p-3 rounded border border-slate-100">
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Acceleration Step (e.g. 0.02)</label>
                        <input type="number" step="0.01" value={psarStep} onChange={(e) => setPsarStep(Number(e.target.value))} className="w-full p-2 border rounded text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Max Acceleration (e.g. 0.2)</label>
                        <input type="number" step="0.01" value={psarMax} onChange={(e) => setPsarMax(Number(e.target.value))} className="w-full p-2 border rounded text-sm" />
                      </div>
                      <p className="text-xs text-slate-500 italic mt-2">Buys when price crosses above the PSAR dots. Sells when it crosses below.</p>
                    </div>
                  )}

                  {stratType === 'ICHIMOKU' && (
                    <div className="space-y-3 bg-slate-50 p-3 rounded border border-slate-100">
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Tenkan Period (e.g. 9)</label>
                        <input type="number" value={ichiTenkan} onChange={(e) => setIchiTenkan(Number(e.target.value))} className="w-full p-2 border rounded text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Kijun Period (e.g. 26)</label>
                        <input type="number" value={ichiKijun} onChange={(e) => setIchiKijun(Number(e.target.value))} className="w-full p-2 border rounded text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Senkou B Period (e.g. 52)</label>
                        <input type="number" value={ichiSenkou} onChange={(e) => setIchiSenkou(Number(e.target.value))} className="w-full p-2 border rounded text-sm" />
                      </div>
                      <p className="text-xs text-slate-500 italic mt-2">Buys when price breaks ABOVE the Kumo Cloud. Sells when it falls BELOW.</p>
                    </div>
                  )}

                  <Button type="submit" disabled={customLoading || !symbol} className="w-full bg-slate-900 hover:bg-slate-800 text-white">
                    {customLoading ? <span className="flex items-center gap-2"><Activity className="h-4 w-4 animate-spin" /> Backtesting Lifetime...</span> : <span className="flex items-center gap-2"><Play className="h-4 w-4" /> Run Custom Backtest</span>}
                  </Button>
                </form>
              </div>
            </Card>
          </div>

          <div className="lg:col-span-2">
            {!customResult ? (
              <div className="h-64 flex items-center justify-center border-2 border-dashed border-slate-200 rounded-xl text-slate-400 bg-slate-50">
                <p>Configure your strategy and click Run to see historical performance.</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <p className="text-xs text-slate-500 font-medium mb-1">Total Trades</p>
                    <p className="text-2xl font-bold text-slate-800">{customResult.totalTrades}</p>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <p className="text-xs text-slate-500 font-medium mb-1">Win Rate</p>
                    <p className={`text-2xl font-bold ${customResult.winRate >= 50 ? 'text-green-600' : 'text-red-500'}`}>{customResult.winRate.toFixed(1)}%</p>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <p className="text-xs text-slate-500 font-medium mb-1">Avg Return / Trade</p>
                    <p className={`text-2xl font-bold ${customResult.averageReturn >= 0 ? 'text-green-600' : 'text-red-500'}`}>{customResult.averageReturn > 0 ? '+' : ''}{customResult.averageReturn.toFixed(1)}%</p>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <p className="text-xs text-slate-500 font-medium mb-1">Max Drawdown</p>
                    <p className="text-2xl font-bold text-red-500">{customResult.maxDrawdown ? customResult.maxDrawdown.toFixed(1) : '0.0'}%</p>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm bg-gradient-to-br from-indigo-50 to-blue-50 border-blue-100">
                    <p className="text-xs text-blue-600 font-medium mb-1">Lifetime Gross Return</p>
                    <p className={`text-2xl font-bold ${customResult.totalReturn >= 0 ? 'text-indigo-700' : 'text-red-600'}`}>{customResult.totalReturn > 0 ? '+' : ''}{customResult.totalReturn.toFixed(1)}%</p>
                  </div>
                </div>

                <Card>
                  <CardHeader title="Chronological Trade Log" description="A fully transparent ledger of every simulated entry and exit." />
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 text-slate-500 font-medium border-y border-slate-200">
                        <tr>
                          <th className="px-4 py-3">Entry Date</th>
                          <th className="px-4 py-3">Entry Price</th>
                          <th className="px-4 py-3">Exit Date</th>
                          <th className="px-4 py-3">Exit Price</th>
                          <th className="px-4 py-3 text-right">Max DD</th>
                          <th className="px-4 py-3 text-right">Days Held</th>
                          <th className="px-4 py-3 text-right">Profit %</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {customResult.trades.length === 0 ? (
                          <tr><td colSpan={6} className="text-center py-6 text-slate-400">No trades triggered over lifetime.</td></tr>
                        ) : (
                          customResult.trades.map((t, idx) => (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="px-4 py-3">{new Date(t.entryDate).toLocaleDateString()}</td>
                              <td className="px-4 py-3">₹{t.entryPrice.toFixed(2)}</td>
                              <td className="px-4 py-3">{new Date(t.exitDate).toLocaleDateString()}</td>
                              <td className="px-4 py-3">₹{t.exitPrice.toFixed(2)}</td>
                              <td className="px-4 py-3 text-right text-red-500 font-medium">{t.maxDrawdownPct ? t.maxDrawdownPct.toFixed(2) : '0.00'}%</td>
                              <td className="px-4 py-3 text-right text-slate-500">{t.holdingPeriodDays}d</td>
                              <td className={`px-4 py-3 text-right font-semibold ${t.returnPct > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                {t.returnPct > 0 ? '+' : ''}{t.returnPct.toFixed(2)}%
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'optimizer' && (
        <div className="space-y-6">
          <Card className="bg-gradient-to-br from-indigo-900 via-slate-900 to-black text-white border-0 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-400 to-red-500"></div>
            <div className="p-8 md:p-12 text-center max-w-3xl mx-auto space-y-6">
              <div className="flex items-center justify-center gap-3">
                <ShieldCheck className="h-10 w-10 text-green-400" />
                <Zap className="h-12 w-12 text-yellow-400" />
              </div>
              <h2 className="text-3xl font-extrabold tracking-tight">Compound Holy Grail Finder</h2>
              <div className="inline-flex items-center gap-2 bg-green-500/20 text-green-300 px-4 py-2 rounded-full font-bold text-sm border border-green-500/30">
                <ShieldCheck className="h-4 w-4" /> Strict 67%+ Win Rate Baseline
              </div>
              <p className="text-indigo-200 leading-relaxed text-lg font-medium">
                The engine will cross-pollinate hundreds of multiple indicators to find maximum confluence on <span className="font-bold text-white bg-indigo-800 px-2 py-1 rounded">{symbol || 'the stock'}</span>. All results below a 67% win rate will be destroyed. This may take 10-15 seconds.
              </p>
              <Button 
                onClick={handleRunOptimizer} 
                disabled={optLoading || !symbol}
                className="bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-500 hover:to-amber-600 text-amber-950 font-black px-8 py-6 text-lg w-full md:w-auto shadow-lg shadow-yellow-500/20 transition-all hover:scale-105"
              >
                {optLoading ? <span className="flex items-center gap-3"><Activity className="h-6 w-6 animate-spin" /> Cross-Pollinating Matrices...</span> : "Find 67%+ Win Rate Strategies"}
              </Button>
            </div>
          </Card>

          {optResults && (
            <Card className="overflow-hidden shadow-lg border-slate-200">
              <div className="p-5 border-b border-slate-100 bg-white">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-extrabold text-slate-800">Strategies for {symbol}</h3>
                    <p className="text-sm text-slate-500 font-medium">
                      Selected on history up to the split date, ranked by performance on data after it.
                    </p>
                  </div>
                </div>

                {/* Selection ratio. Without it, "12 strategies cleared 67%" reads as
                    discovery when it may just be what 46 tries against one price
                    series produces by chance. */}
                {optMeta && (
                  <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    <p className="font-semibold">
                      {optMeta.strategiesTested} strategies tested → {optMeta.strategiesPassed} cleared
                      the 67% filter on the selection window → <span className="font-extrabold">{optMeta.strategiesHeldUp} stayed profitable on held-back data</span>.
                    </p>
                    <p className="mt-1 text-amber-800">
                      Testing {optMeta.strategiesTested} rules against one price series will always
                      surface some winners by chance. Only the held-back (OOS) columns are evidence.
                      {optMeta.splitDate && (
                        <> Split at {new Date(optMeta.splitDate).toLocaleDateString()}.</>
                      )}
                    </p>
                  </div>
                )}
              </div>


              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-xs">
                    <tr>
                      <th className="px-5 py-4 w-12 text-center">Rank</th>
                      <th className="px-5 py-4">Confluence Components (AND)</th>
                      <th className="px-5 py-4 text-center" title="Trades in the window the strategy was selected on">Trades <span className="normal-case text-slate-400">(fitted)</span></th>
                      <th className="px-5 py-4 text-center" title="Win rate on the window the strategy was selected on — fitted, not evidence">Win Rate <span className="normal-case text-slate-400">(fitted)</span></th>
                      <th className="px-5 py-4 text-center bg-indigo-50/60" title="Win rate on held-back data the strategy was NOT selected on">OOS Win Rate</th>
                      <th className="px-5 py-4 text-right bg-indigo-50/60" title="Average net return per trade on held-back data, after costs">OOS Avg Return</th>
                      <th className="px-5 py-4 text-right">Max DD</th>
                      <th className="px-5 py-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {optResults.length === 0 ? (
                      <tr><td colSpan={8} className="text-center py-12 text-slate-400 font-medium">No strategy cleared a 67% win rate on the selection window for this stock.</td></tr>
                    ) : (
                      optResults.map((res, idx) => {
                        const conditions = res.strategy.type === 'COMPOUND' ? res.strategy.conditions : [res.strategy];
                        
                        return (
                          <Fragment key={idx}>
                            <tr className={`hover:bg-slate-50 transition-colors ${idx === 0 ? 'bg-yellow-50/50' : 'bg-white'}`}>
                              <td className="px-5 py-4 text-center">
                                {idx === 0 ? <span className="flex items-center justify-center h-8 w-8 rounded-full bg-yellow-400 text-yellow-900 font-bold mx-auto">1</span> : <span className="font-semibold text-slate-400">#{idx + 1}</span>}
                              </td>
                              <td className="px-5 py-4">
                                {res.strategy.type === 'COMPOUND' && res.strategy.name && (
                                  <div className="font-bold text-slate-800 text-sm mb-2">{res.strategy.name}</div>
                                )}
                                <div className="space-y-1.5">
                                  {conditions.map((cond, cIdx) => (
                                    <div key={cIdx} className="flex items-center gap-2">
                                      <span className="bg-slate-100 text-slate-700 text-xs font-bold px-2 py-0.5 rounded border border-slate-200">
                                        {cond.type}
                                      </span>
                                      <span className="text-xs text-slate-600 font-medium">{renderCondition(cond as SingleStrategyParams)}</span>
                                    </div>
                                  ))}
                                </div>
                              </td>
                              <td className="px-5 py-4 text-center font-medium text-slate-500">{res.inSample.totalTrades}</td>
                              <td className="px-5 py-4 text-center">
                                <span className="inline-flex items-center justify-center bg-slate-100 text-slate-500 font-medium px-2.5 py-1 rounded-full text-xs border border-slate-200">
                                  {res.inSample.winRate.toFixed(1)}%
                                </span>
                              </td>
                              {/* Held-back window — the only columns here that are evidence. */}
                              <td className="px-5 py-4 text-center bg-indigo-50/40">
                                {res.outOfSample.totalTrades >= MIN_OOS_TRADES ? (
                                  <span className={`inline-flex items-center justify-center font-bold px-2.5 py-1 rounded-full text-xs border ${res.outOfSample.winRate >= 50 ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
                                    {res.outOfSample.winRate.toFixed(1)}%
                                  </span>
                                ) : (
                                  <span
                                    className="inline-flex items-center justify-center bg-amber-50 text-amber-700 font-medium px-2.5 py-1 rounded-full text-xs border border-amber-200"
                                    title={`Only ${res.outOfSample.totalTrades} held-back trade(s) — too few to mean anything.`}
                                  >
                                    {res.outOfSample.totalTrades === 0 ? 'unvalidated' : `only ${res.outOfSample.totalTrades}`}
                                  </span>
                                )}
                              </td>
                              <td className={`px-5 py-4 text-right font-bold bg-indigo-50/40 ${res.outOfSample.totalTrades === 0 ? 'text-slate-400' : res.outOfSample.averageReturn > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                {res.outOfSample.totalTrades > 0
                                  ? `${res.outOfSample.averageReturn > 0 ? '+' : ''}${res.outOfSample.averageReturn.toFixed(2)}%`
                                  : '—'}
                                {res.outOfSample.totalTrades > 0 && (
                                  <span className="block text-[10px] font-normal text-slate-400">{res.outOfSample.totalTrades} trade(s)</span>
                                )}
                              </td>
                              <td className="px-5 py-4 text-right font-bold text-red-500">
                                {res.stats.maxDrawdown ? res.stats.maxDrawdown.toFixed(2) : '0.00'}%
                              </td>
                              <td className="px-5 py-4 text-center">
                                <button 
                                  onClick={() => setExpandedOptCard(expandedOptCard === idx ? null : idx)}
                                  className={`text-xs font-bold px-3 py-1.5 rounded transition-colors ${expandedOptCard === idx ? 'bg-slate-200 text-slate-700' : 'bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200'}`}
                                >
                                  {expandedOptCard === idx ? 'Close' : 'View Trades'}
                                </button>
                              </td>
                            </tr>
                            
                            {/* Expandable Trade Ledger */}
                            {expandedOptCard === idx && (
                              <tr>
                                <td colSpan={8} className="p-0 border-b border-slate-200">
                                  <div className="bg-slate-900 border-x-4 border-yellow-400 p-0 max-h-80 overflow-y-auto">
                                    <table className="w-full text-xs text-left text-slate-300">
                                      <thead className="bg-slate-800 text-slate-400 font-semibold sticky top-0 uppercase tracking-wider text-[10px]">
                                        <tr>
                                          <th className="px-6 py-3">Entry Date</th>
                                          <th className="px-6 py-3">Exit Date</th>
                                          <th className="px-6 py-3 text-right">Max DD</th>
                                          <th className="px-6 py-3 text-right">Days Held</th>
                                          <th className="px-6 py-3 text-right">Return %</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-800/50">
                                        {res.stats.trades.map((t, tIdx) => (
                                          <tr key={tIdx} className="hover:bg-slate-800 transition-colors">
                                            <td className="px-6 py-3">{new Date(t.entryDate).toLocaleDateString()}</td>
                                            <td className="px-6 py-3">{new Date(t.exitDate).toLocaleDateString()}</td>
                                            <td className="px-6 py-3 text-right text-red-400 font-medium">{t.maxDrawdownPct ? t.maxDrawdownPct.toFixed(2) : '0.00'}%</td>
                                            <td className="px-6 py-3 text-right text-slate-400">{t.holdingPeriodDays}d</td>
                                            <td className={`px-6 py-3 text-right font-bold ${t.returnPct > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                              {t.returnPct > 0 ? '+' : ''}{t.returnPct.toFixed(2)}%
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
