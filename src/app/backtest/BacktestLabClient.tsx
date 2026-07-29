'use client';

import { useState, Fragment, useMemo, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Activity, Zap, ShieldCheck, Plus, Settings2 } from 'lucide-react';
import type { StrategyParams, SingleStrategyParams } from '@/lib/dynamic-backtester';
import { MIN_OOS_TRADES } from '@/lib/backtest-constants';
import { LabTracked } from '@/components/LabTracked';
import { ScanFilters, EMPTY_FILTERS, type FilterValues } from '@/components/ScanFilters';
import { MASTER_STRATEGY_LIBRARY } from '@/lib/strategy-library';
import { NIFTY_500_SYMBOLS, NIFTY_50_SYMBOLS, NIFTY_100_SYMBOLS, NIFTY_MIDCAP_150_SYMBOLS, NIFTY_SMALLCAP_250_SYMBOLS } from '@/lib/nifty500';

type WatchlistItem = {
  id: string;
  symbol: string;
};


import { useBacktestStore } from '@/lib/backtest-store';

export function BacktestLabClient({ initialWatchlist }: { initialWatchlist: WatchlistItem[] }) {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>(initialWatchlist);
  
  const {
    scanMode, setScanMode,
    symbol, setSymbol,
    results: batchResults, setResults: setBatchResults, appendResults: appendBatchResults,
    selectedIndex, setSelectedIndex
  } = useBacktestStore();

  useEffect(() => {
    if (!symbol && initialWatchlist[0]?.symbol) {
      setSymbol(initialWatchlist[0].symbol);
    }
  }, [initialWatchlist, symbol, setSymbol]);
  
  // Expanded state for optimizer rows
  
  // Custom Builder State (Inputs are kept local to avoid massive refactor of 20 variables, they aren't critical to persist like the scan results)
  






  




  // Search State
  const [searchQuery, setSearchQuery] = useState(initialWatchlist[0]?.symbol || '');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Batch Search State
  const [newWatchlistSymbol, setNewWatchlistSymbol] = useState('');
  const [isAddingWatchlist, setIsAddingWatchlist] = useState(false);

  // Batch Expand State
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [expandedTrades, setExpandedTrades] = useState<Record<number, any[]>>({});
  const [loadingTrades, setLoadingTrades] = useState<Record<number, boolean>>({});

  // Batch Progress State
  const [scanProgress, setScanProgress] = useState(0);
  const [scanEta, setScanEta] = useState<number | null>(null);
  const [scanProcessedCount, setScanProcessedCount] = useState(0);
  const [scanTotalCount, setScanTotalCount] = useState(0);

  // Sorting
  const [batchSortBy, setBatchSortBy] = useState<'winRate' | 'signal'>('winRate');


  // Batch Scanner State
  const [batchLoading, setBatchLoading] = useState(false);
  /** Provenance of the scanned universe — synced from NSE, or the built-in list. */
  const [universeSource, setUniverseSource] = useState<string | null>(null);
  /** How many strategy/symbol pairs traded, before the server's per-symbol cap. */
  const [matchedTotal, setMatchedTotal] = useState(0);
  /** Rows actually rendered. The table is not virtualised, so this is a hard guard. */
  const [rowLimit, setRowLimit] = useState(200);
  /** Six result floors, fitted and held-back. 0 disables each. */
  const [filters, setFilters] = useState<FilterValues>(EMPTY_FILTERS);
  /**
   * Row the user is recording a buy against. Prefilled from the scan row so the
   * symbol, strategy and price are not retyped — retyping is where a position
   * gets attached to the wrong strategy and every later number goes wrong.
   */
  const [buyRow, setBuyRow] = useState<any | null>(null);
  const [buyQty, setBuyQty] = useState('');
  const [buyPrice, setBuyPrice] = useState('');
  const [buyStop, setBuyStop] = useState('');
  const [buySaving, setBuySaving] = useState(false);
  const [buyError, setBuyError] = useState<string | null>(null);
  /** Bumped after a save so the positions panel refetches. */
  const [positionsToken, setPositionsToken] = useState(0);

  function openBuy(res: any) {
    setBuyRow(res);
    setBuyPrice(res.lastClose ? String(res.lastClose.toFixed(2)) : '');
    setBuyQty('');
    setBuyStop('');
    setBuyError(null);
  }

  async function confirmBuy() {
    if (!buyRow) return;
    setBuySaving(true);
    setBuyError(null);
    try {
      const res = await fetch('/api/lab/positions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: buyRow.symbol,
          strategyName: buyRow.strategyName,
          entryPrice: buyPrice,
          quantity: buyQty,
          entryDate: new Date().toISOString(),
          stopLossPrice: buyStop || null,
        }),
      });
      const data = await res.json();
      if (!data.success) { setBuyError(data.error ?? 'Could not record'); return; }
      // No pinning step any more: the open position IS the tracked thing, and
      // the exit check walks open positions directly.
      setBuyRow(null);
      setPositionsToken((n) => n + 1);
    } catch (e) {
      setBuyError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setBuySaving(false);
    }
  }

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
  const filteredResults = displayedResults;
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

  // Pinned strategies removed — the open position is the tracked thing now.
  





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



  /**
   * Resolve the chosen universe, then scan it.
   *
   * Index membership comes from the server (synced monthly from NSE) rather
   * than the hardcoded arrays, so a reconstitution shows up without a code
   * change. The built-in list is the fallback if the lookup fails, so a network
   * blip degrades to a stale universe rather than an empty one.
   */
  async function handleScanClick() {
    // A single stock is a list of one — same pipeline, same table, no second
    // code path to keep in step.
    if (scanMode === 'single') {
      const one = symbol.trim().toUpperCase();
      if (!one) return;
      setUniverseSource('1 symbol');
      return handleRunBatch([one.includes('.') ? one : `${one}.NS`]);
    }
    if (selectedIndex === 'watchlist') return handleRunBatch(watchlist.map((w) => w.symbol));
    if (selectedIndex === 'pinned') {
      const held = await fetch('/api/lab/tracked').then(r => r.json()).catch(() => null);
      const symbols: string[] = held?.success ? [...new Set(held.rows.map((r: any) => r.symbol))] as string[] : [];
      return handleRunBatch(symbols);
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
            body: JSON.stringify({ symbols: chunk, ...filters })
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
          <p className="text-slate-500">Run every strategy against a list of stocks, or a single one.</p>
        </div>
        
        {/* Two ways to scan, and that is the whole choice. */}
        <div className="flex bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => setScanMode('list')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${scanMode === 'list' ? 'bg-white shadow text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Index or list
          </button>
          <button
            onClick={() => setScanMode('single')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${scanMode === 'single' ? 'bg-white shadow text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Single stock
          </button>
        </div>
      </div>

      {/* Confirm dialog for recording a buy. Everything except quantity is
          prefilled from the row, because retyping the strategy name is how a
          position ends up attached to the wrong one. */}
      {buyRow && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={() => !buySaving && setBuyRow(null)}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-800">
              Record buy — {String(buyRow.symbol).replace('.NS', '')}
            </h3>
            <p className="text-sm text-slate-500 mt-1">{buyRow.strategyName}</p>

            {buyRow.oosTotalTrades >= MIN_OOS_TRADES ? (
              <p className="text-xs text-slate-500 mt-2">
                Out-of-sample: {buyRow.oosWinRate.toFixed(0)}% win rate over {buyRow.oosTotalTrades} trades ·
                worst trade {(buyRow.oosMaxDrawdown ?? 0).toFixed(1)}%
              </p>
            ) : (
              <p className="text-xs text-amber-700 mt-2">
                Not validated out-of-sample — only {buyRow.oosTotalTrades ?? 0} held-back trade(s).
              </p>
            )}

            <div className="grid grid-cols-3 gap-3 mt-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Price</label>
                <input
                  type="number" value={buyPrice} onChange={(e) => setBuyPrice(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Qty</label>
                <input
                  type="number" value={buyQty} autoFocus onChange={(e) => setBuyQty(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Stop (opt)</label>
                <input
                  type="number" value={buyStop} onChange={(e) => setBuyStop(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>

            <p className="text-xs text-slate-400 mt-2">
              Price is the last close, not your fill — change it to what you actually paid.
              Pinning happens automatically so you get the sell signal.
            </p>

            {buyError && <p className="text-sm text-red-600 mt-3">{buyError}</p>}

            <div className="flex gap-2 mt-5">
              <Button
                onClick={confirmBuy}
                disabled={buySaving || !buyQty || !buyPrice}
                className="bg-green-600 text-white hover:bg-green-700 flex-1"
              >
                {buySaving ? 'Saving…' : 'Confirm — I bought this'}
              </Button>
              <Button onClick={() => setBuyRow(null)} disabled={buySaving} variant="secondary">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      <LabTracked refreshToken={positionsToken} />

      {/* Pinning is gone entirely. An open position is the only thing tracked,
          and the exit check walks open positions directly. */}

      {scanMode === 'single' && (
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

      {(
        <Card className="border-slate-200 shadow-sm p-0 overflow-hidden">
          <div className="bg-slate-50 border-b border-slate-100 flex flex-col gap-4 p-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between w-full gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-blue-500" />
                  {scanMode === 'single' ? 'Scan a stock' : 'Scan a list'}
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
                {scanMode === 'list' ? (
                  <select
                    value={selectedIndex}
                    onChange={(e) => setSelectedIndex(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm focus:outline-none border border-r-0 border-slate-300 bg-white text-slate-700 font-medium rounded-l-md"
                    disabled={batchLoading}
                  >
                    <option value="nifty50">Nifty 50</option>
                    <option value="nifty100">Nifty 100</option>
                    <option value="midcap150">Midcap 150</option>
                    <option value="smallcap250">Smallcap 250</option>
                    <option value="nifty500">Nifty 500</option>
                    <option value="watchlist">My Watchlist ({watchlist.length})</option>
                    <option value="pinned">My Holdings</option>
                  </select>
                ) : (
                  <input
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                    placeholder="RELIANCE.NS"
                    disabled={batchLoading}
                    className="flex-1 px-3 py-2 text-sm focus:outline-none border border-r-0 border-slate-300 bg-white text-slate-700 font-medium rounded-l-md"
                  />
                )}
                <Button
                  onClick={() => { void handleScanClick(); }}
                  disabled={
                    batchLoading ||
                    (scanMode === 'single' && !symbol.trim()) ||
                    (scanMode === 'list' && selectedIndex === 'watchlist' && watchlist.length === 0)
                  }
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

              <div className="w-full md:w-2/3 ml-auto">
                <ScanFilters values={filters} onChange={setFilters} disabled={batchLoading} />
              </div>

            </div>
          </div>
          
          <div className="p-0">
            {batchLoading && (
              <div className="p-12 text-center">
                <div className="max-w-md mx-auto bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                  <Activity className="h-10 w-10 animate-spin mx-auto mb-4 text-indigo-600" />
                  {/* Say what is actually running, from the real library size —
                      "3,000+" was invented and drifts every time the library changes. */}
                  <h3 className="font-bold text-slate-800 text-lg mb-1">
                    Running {MASTER_STRATEGY_LIBRARY.length} strategies
                    {scanTotalCount > 1 ? ` on ${scanTotalCount} stocks` : ''}
                  </h3>
                  <p className="text-slate-500 text-sm mb-6">
                    {scanTotalCount > 1
                      ? `${(MASTER_STRATEGY_LIBRARY.length * scanTotalCount).toLocaleString()} backtests over full history.`
                      : 'Full history, every strategy. Takes a few seconds.'}
                  </p>
                  
                  <div className="w-full bg-slate-100 rounded-full h-3 mb-2 overflow-hidden border border-slate-200 relative">
                    {scanTotalCount > 1 ? (
                      <div
                        className="bg-indigo-600 h-3 rounded-full transition-all duration-300 ease-out"
                        style={{ width: `${scanProgress}%` }}
                      />
                    ) : (
                      // One stock completes in a single step, so a percentage
                      // would sit at 0 then jump to 100. An indeterminate bar is
                      // the honest signal that work is happening.
                      <div className="h-3 w-1/3 rounded-full bg-indigo-600 animate-[pulse_1.2s_ease-in-out_infinite]" />
                    )}
                  </div>

                  {scanTotalCount > 1 && (
                    <div className="flex justify-between items-center text-xs font-bold text-slate-500 mb-4">
                      <span>{scanProcessedCount} / {scanTotalCount} stocks processed</span>
                      <span className="text-indigo-600">{Math.round(scanProgress)}%</span>
                    </div>
                  )}
                  
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
                      <th className="px-5 py-3 text-right" title="Worst any single trade went underwater, in the fitted window">Max DD <span className="normal-case text-slate-400">(fitted)</span></th>
                      <th className="px-5 py-3 text-right bg-indigo-50/60" title="Worst any single trade went underwater, in the held-back window">Max DD <span className="normal-case text-slate-400">(OOS)</span></th>
                      <th className="px-5 py-3 text-right">Total Trades</th>
                      <th className="px-5 py-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {visibleResults.map((res, idx) => {
                      return (
                      <Fragment key={`${res.symbol}-${res.strategyName}-${idx}`}>
                        <tr className="hover:bg-slate-50 transition-colors group">
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
                          <td className="px-5 py-4 text-right font-medium text-slate-500">
                            {res.maxDrawdown ? res.maxDrawdown.toFixed(1) : '0.0'}%
                          </td>
                          {/* Held-back drawdown. Same definition as the fitted
                              column so the two are directly comparable — a much
                              deeper OOS drawdown means the risk was understated. */}
                          <td className={`px-5 py-4 text-right font-bold bg-indigo-50/40 ${res.oosTotalTrades > 0 ? 'text-red-500' : 'text-slate-400'}`}>
                            {res.oosTotalTrades > 0
                              ? `${(res.oosMaxDrawdown ?? 0).toFixed(1)}%`
                              : '—'}
                          </td>
                          <td className="px-5 py-4 text-right text-slate-500 font-medium">
                            {res.totalTrades}
                          </td>
                          <td className="px-5 py-4 text-center whitespace-nowrap">
                            {/* The act of buying, recorded from the row itself.
                                Emphasised on a live BUY because that is the row
                                the user is deciding on; still available on the
                                others, since people buy late. */}
                            <button
                              onClick={() => openBuy(res)}
                              className={
                                res.currentSignal === 'NEW_BUY'
                                  ? 'mr-3 px-3 py-1.5 rounded bg-green-600 text-white text-xs font-bold hover:bg-green-700 shadow-sm'
                                  : 'mr-3 px-2 py-1 rounded text-xs font-semibold text-slate-500 hover:text-green-700 hover:bg-green-50 border border-slate-200'
                              }
                              title="Record that you actually bought this"
                            >
                              I bought
                            </button>
                            <button
                              onClick={() => toggleTradeDetails(idx, res.symbol, res.strategy)}
                              className="text-blue-500 hover:text-blue-700 font-semibold text-xs transition-colors"
                            >
                              {expandedRow === idx ? 'Close' : 'Trades'}
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


    </div>
  );
}
