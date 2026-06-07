'use client';

import { useState, Fragment, useMemo, useEffect } from 'react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Activity, Play, Zap, CheckCircle2, TrendingUp, Settings2, ShieldCheck, Globe, Plus, Pin } from 'lucide-react';
import { DynamicBacktestResult, StrategyParams, SingleStrategyParams } from '@/lib/dynamic-backtester';
import { OptimizerResult } from '@/lib/optimizer';
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

export function BacktestLabClient({ initialWatchlist }: { initialWatchlist: WatchlistItem[] }) {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>(initialWatchlist);
  const [activeTab, setActiveTab] = useState<'custom' | 'optimizer' | 'batch'>('batch');
  const [symbol, setSymbol] = useState(initialWatchlist[0]?.symbol || '');
  
  // Expanded state for optimizer rows
  const [expandedOptCard, setExpandedOptCard] = useState<number | null>(null);
  
  // Custom Builder State
  const [stratType, setStratType] = useState<'RSI' | 'SMA' | 'EMA' | 'MACD' | 'BB' | 'STOCH' | 'ATR' | 'VWAP' | 'OBV' | 'ADX' | 'CCI' | 'PSAR' | 'ICHIMOKU'>('RSI');
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
  const [selectedIndex, setSelectedIndex] = useState<string>('nifty50');
  const [pinnedStrategies, setPinnedStrategies] = useState<{symbol: string, strategy: string}[]>([]);
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
  const [customResult, setCustomResult] = useState<DynamicBacktestResult | null>(null);

  // Optimizer State
  const [optLoading, setOptLoading] = useState(false);
  const [optResults, setOptResults] = useState<OptimizerResult[] | null>(null);

  // Batch Scanner State
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchResults, setBatchResults] = useState<any[] | null>(null);

  const displayedResults = useMemo(() => {
    if (!batchResults) return [];
    const copy = [...batchResults];
    
    if (batchSortBy === 'signal') {
      const priority: Record<string, number> = { 'NEW_BUY': 1, 'NEW_SELL': 2, 'HOLDING': 3, 'WAITING': 4 };
      copy.sort((a, b) => {
        const pA = priority[a.currentSignal || 'WAITING'] || 5;
        const pB = priority[b.currentSignal || 'WAITING'] || 5;
        if (pA !== pB) return pA - pB;
        if (b.winRate !== a.winRate) return b.winRate - a.winRate;
        return b.totalReturn - a.totalReturn;
      });
    } else {
      copy.sort((a, b) => {
        if (b.winRate !== a.winRate) return b.winRate - a.winRate;
        return b.totalReturn - a.totalReturn;
      });
    }
    return copy;
  }, [batchResults, batchSortBy]);

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
          setPinnedStrategies(data.pinned.map((p: any) => ({ symbol: p.symbol, strategy: p.strategyName })));
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
      } else {
        alert(data.error);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setOptLoading(false);
    }
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
            setBatchResults(prev => [...(prev || []), ...data.results]);
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
    <div className="space-y-6">
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
                <p className="text-sm text-slate-500">Run the entire Master Strategy Library simultaneously against all {watchlist.length} stocks in your Watchlist.</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                <Button onClick={() => handleRunBatch(watchlist.map(w => w.symbol))} disabled={batchLoading || watchlist.length === 0} className="bg-blue-600 hover:bg-blue-700 text-white shadow-md">
                  {batchLoading ? <span className="flex items-center gap-2"><Activity className="h-4 w-4 animate-spin" /> Scanning...</span> : <span className="flex items-center gap-2"><Zap className="h-4 w-4" /> Scan Watchlist</span>}
                </Button>
                
                <div className="flex shadow-md rounded-md">
                  <select 
                    value={selectedIndex}
                    onChange={(e) => setSelectedIndex(e.target.value)}
                    className="px-3 py-2 text-sm focus:outline-none border border-r-0 border-slate-300 bg-white text-slate-700 font-medium rounded-l-md"
                    disabled={batchLoading}
                  >
                    <option value="pinned">Pinned Symbols</option>
                    <option value="nifty50">Nifty 50</option>
                    <option value="nifty100">Nifty 100</option>
                    <option value="midcap150">Midcap 150</option>
                    <option value="smallcap250">Smallcap 250</option>
                    <option value="nifty500">Nifty 500 (All)</option>
                  </select>
                  <Button 
                    onClick={() => {
                      if (selectedIndex === 'pinned') {
                        const uniqueSymbols = Array.from(new Set(pinnedStrategies.map(p => p.symbol)));
                        handleRunBatch(uniqueSymbols);
                      } else if (selectedIndex === 'nifty50') handleRunBatch(NIFTY_50_SYMBOLS);
                      else if (selectedIndex === 'nifty100') handleRunBatch(NIFTY_100_SYMBOLS);
                      else if (selectedIndex === 'midcap150') handleRunBatch(NIFTY_MIDCAP_150_SYMBOLS);
                      else if (selectedIndex === 'smallcap250') handleRunBatch(NIFTY_SMALLCAP_250_SYMBOLS);
                      else handleRunBatch(NIFTY_500_SYMBOLS);
                    }} 
                    disabled={batchLoading} 
                    className="bg-indigo-600 hover:bg-indigo-700 text-white border-none rounded-l-none rounded-r-md px-4"
                  >
                    {batchLoading ? <span className="flex items-center"><Activity className="h-4 w-4 animate-spin mr-2" /> Scanning...</span> : <span className="flex items-center"><Globe className="h-4 w-4 mr-2" /> Scan Index</span>}
                  </Button>
                </div>
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

              {/* Sort Controls */}
              <div className="w-full md:w-1/3 ml-auto flex flex-col gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Sort Results By</label>
                  <select
                    value={batchSortBy}
                    onChange={(e) => setBatchSortBy(e.target.value as 'winRate' | 'signal')}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="winRate">Highest Win Rate</option>
                    <option value="signal">Live Signal (Buys First)</option>
                  </select>
                </div>
                
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
                        title="Click to sort by Win Rate"
                      >
                        Win Rate {batchSortBy === 'winRate' ? '↓' : '↕'}
                      </th>
                      <th className="px-5 py-3 text-right">Avg Return</th>
                      <th className="px-5 py-3 text-right">Total Trades</th>
                      <th className="px-5 py-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {displayedResults.filter(res => !showPinnedOnly || pinnedStrategies.some(p => p.symbol === res.symbol && p.strategy === res.strategyName)).map((res, idx) => {
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
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-bold ${res.winRate >= 80 ? 'bg-green-100 text-green-700' : 'bg-green-50 text-green-600'}`}>
                              {res.winRate.toFixed(1)}%
                            </span>
                          </td>
                          <td className={`px-5 py-4 text-right font-bold ${res.averageReturn > 0 ? 'text-green-600' : 'text-red-500'}`}>
                            {res.averageReturn > 0 ? '+' : ''}{res.averageReturn.toFixed(2)}%
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
                            <td colSpan={9} className="px-5 py-6">
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
                                              <td className="px-3 py-2 text-right text-slate-500 font-medium">
                                                {trade.exitDate ? Math.floor((new Date(trade.exitDate).getTime() - new Date(trade.entryDate).getTime()) / (1000 * 60 * 60 * 24)) : '-'}d
                                              </td>
                                            </tr>
                                          )) : (
                                            <tr>
                                              <td colSpan={5} className="px-3 py-4 text-center text-slate-500">No trades recorded.</td>
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
            )}
          </div>
        </Card>
      )}

      {/* TABS (Hide on Batch) */}
      {activeTab !== 'batch' && (
        <div className="flex gap-4 border-b border-slate-200">
          <button
            onClick={() => setActiveTab('custom')}
            className={`pb-3 px-4 font-semibold transition-colors ${activeTab === 'custom' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <span className="flex items-center gap-2"><Settings2 className="h-4 w-4" /> Custom Builder</span>
          </button>
          <button
            onClick={() => setActiveTab('optimizer')}
            className={`pb-3 px-4 font-semibold transition-colors ${activeTab === 'optimizer' ? 'border-b-2 border-yellow-500 text-yellow-600' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <span className="flex items-center gap-2"><Zap className="h-4 w-4" /> Confluence Auto-Optimizer</span>
          </button>
        </div>
      )}

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
                <ShieldCheck className="h-4 w-4" /> Strict 70%+ Win Rate Baseline
              </div>
              <p className="text-indigo-200 leading-relaxed text-lg font-medium">
                The engine will cross-pollinate hundreds of multiple indicators to find maximum confluence on <span className="font-bold text-white bg-indigo-800 px-2 py-1 rounded">{symbol || 'the stock'}</span>. All results below a 70% win rate will be destroyed. This may take 10-15 seconds.
              </p>
              <Button 
                onClick={handleRunOptimizer} 
                disabled={optLoading || !symbol}
                className="bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-500 hover:to-amber-600 text-amber-950 font-black px-8 py-6 text-lg w-full md:w-auto shadow-lg shadow-yellow-500/20 transition-all hover:scale-105"
              >
                {optLoading ? <span className="flex items-center gap-3"><Activity className="h-6 w-6 animate-spin" /> Cross-Pollinating Matrices...</span> : "Find 70%+ Win Rate Strategies"}
              </Button>
            </div>
          </Card>

          {optResults && (
            <Card className="overflow-hidden shadow-lg border-slate-200">
              <div className="p-5 border-b border-slate-100 bg-white flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-800">Top 100 Compound Strategies for {symbol}</h3>
                  <p className="text-sm text-slate-500 font-medium">Ranked by Average Return per Trade. Win Rate ≥ 70%.</p>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-xs">
                    <tr>
                      <th className="px-5 py-4 w-12 text-center">Rank</th>
                      <th className="px-5 py-4">Confluence Components (AND)</th>
                      <th className="px-5 py-4 text-center">Trades</th>
                      <th className="px-5 py-4 text-center">Win Rate</th>
                      <th className="px-5 py-4 text-right">Avg Return</th>
                      <th className="px-5 py-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {optResults.length === 0 ? (
                      <tr><td colSpan={6} className="text-center py-12 text-slate-400 font-medium">No compound strategies found with ≥ 70% win rate for this stock.</td></tr>
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
                              <td className="px-5 py-4 text-center font-medium text-slate-700">{res.stats.totalTrades}</td>
                              <td className="px-5 py-4 text-center">
                                <span className="inline-flex items-center justify-center bg-green-100 text-green-700 font-bold px-2.5 py-1 rounded-full text-xs border border-green-200">
                                  {res.stats.winRate.toFixed(1)}%
                                </span>
                              </td>
                              <td className="px-5 py-4 text-right">
                                <span className={`font-bold text-lg ${res.stats.averageReturn > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                  {res.stats.averageReturn > 0 ? '+' : ''}{res.stats.averageReturn.toFixed(1)}%
                                </span>
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
                                <td colSpan={6} className="p-0 border-b border-slate-200">
                                  <div className="bg-slate-900 border-x-4 border-yellow-400 p-0 max-h-80 overflow-y-auto">
                                    <table className="w-full text-xs text-left text-slate-300">
                                      <thead className="bg-slate-800 text-slate-400 font-semibold sticky top-0 uppercase tracking-wider text-[10px]">
                                        <tr>
                                          <th className="px-6 py-3">Entry Date</th>
                                          <th className="px-6 py-3">Exit Date</th>
                                          <th className="px-6 py-3 text-right">Days Held</th>
                                          <th className="px-6 py-3 text-right">Return %</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-800/50">
                                        {res.stats.trades.map((t, tIdx) => (
                                          <tr key={tIdx} className="hover:bg-slate-800 transition-colors">
                                            <td className="px-6 py-3">{new Date(t.entryDate).toLocaleDateString()}</td>
                                            <td className="px-6 py-3">{new Date(t.exitDate).toLocaleDateString()}</td>
                                            <td className="px-6 py-3 text-right text-slate-500">{t.holdingPeriodDays}d</td>
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
