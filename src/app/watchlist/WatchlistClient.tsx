'use client';

import { useState, useEffect, useRef } from 'react';
import { apiFetch } from '@/lib/api-fetch';
import { useRouter } from 'next/navigation';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Plus, Trash2, Activity, Play, TrendingUp, TrendingDown, Search } from 'lucide-react';

type WatchlistItem = {
  id: string;
  symbol: string;
};

type ScreenerSignal = {
  id: string;
  symbol: string;
  type: string;
  rule: string;
  price: number;
  date: Date;
  description: string;
};

type SearchResult = {
  symbol: string;
  name: string;
  exchange: string;
};

export function WatchlistClient({
  initialWatchlist,
  initialSignals
}: {
  initialWatchlist: WatchlistItem[];
  initialSignals: ScreenerSignal[];
}) {
  const router = useRouter();
  const [symbolInput, setSymbolInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [screening, setScreening] = useState(false);
  
  // Search State
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleSearch(query: string) {
    setSymbolInput(query);
    
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    
    if (query.trim().length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    setShowDropdown(true);
    setIsSearching(true);

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await apiFetch(`/api/watchlist/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (data.results) {
          setSearchResults(data.results);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearching(false);
      }
    }, 300); // 300ms debounce
  }

  async function handleAddSymbol(symbolToAdd: string) {
    if (!symbolToAdd) return;
    setLoading(true);
    setShowDropdown(false);
    
    try {
      // Ensure NSE suffix if it's an Indian stock without exchange suffix
      let finalSymbol = symbolToAdd.trim().toUpperCase();
      if (!finalSymbol.includes('.')) {
        finalSymbol += '.NS';
      }

      await apiFetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: finalSymbol })
      });
      setSymbolInput('');
      setSearchResults([]);
      router.refresh();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleRemoveSymbol(symbol: string) {
    try {
      await apiFetch('/api/watchlist', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol })
      });
      router.refresh();
    } catch (err) {
      console.error(err);
    }
  }

  async function handleRunScreener() {
    setScreening(true);
    try {
      await apiFetch('/api/cron/run-screener', { method: 'POST' });
      router.refresh();
    } catch (err) {
      console.error(err);
    } finally {
      setScreening(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* LEFT COLUMN: Watchlist Management */}
      <div className="lg:col-span-1 space-y-6">
        <Card>
          <CardHeader title="Your Watchlist" />
          <div>
            <div className="relative mb-4" ref={dropdownRef}>
              <form onSubmit={(e) => { e.preventDefault(); handleAddSymbol(symbolInput); }} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={symbolInput}
                    onChange={(e) => handleSearch(e.target.value)}
                    onFocus={() => { if (searchResults.length > 0) setShowDropdown(true); }}
                    placeholder="Search company name..."
                    className="w-full rounded-md border border-slate-300 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoComplete="off"
                  />
                </div>
                <Button type="submit" disabled={loading || !symbolInput}>
                  <Plus className="h-4 w-4" />
                </Button>
              </form>

              {/* Autocomplete Dropdown */}
              {showDropdown && (symbolInput.trim().length >= 2) && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg overflow-hidden">
                  {isSearching ? (
                    <div className="p-3 text-sm text-slate-500 flex items-center justify-center">
                      <Activity className="h-4 w-4 animate-spin mr-2" /> Searching...
                    </div>
                  ) : searchResults.length === 0 ? (
                    <div className="p-3 text-sm text-slate-500 text-center">No matching stocks found</div>
                  ) : (
                    <ul className="max-h-60 overflow-y-auto">
                      {searchResults.map((result) => (
                        <li 
                          key={result.symbol}
                          onClick={() => handleAddSymbol(result.symbol)}
                          className="px-3 py-2 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0 flex justify-between items-center group"
                        >
                          <div className="flex flex-col truncate pr-2">
                            <span className="text-sm font-semibold text-slate-900 truncate">{result.name}</span>
                            <span className="text-xs text-slate-500">{result.exchange}</span>
                          </div>
                          <span className="text-xs font-mono font-medium text-slate-400 group-hover:text-blue-600 shrink-0">
                            {result.symbol}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            <ul className="space-y-2">
              {initialWatchlist.length === 0 ? (
                <p className="text-sm text-slate-500 py-4 text-center">No stocks in your watchlist.</p>
              ) : (
                initialWatchlist.map((item) => (
                  <li key={item.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="font-semibold text-slate-800">{item.symbol}</span>
                    <button onClick={() => handleRemoveSymbol(item.symbol)} className="text-slate-400 hover:text-red-500 transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-indigo-50 to-blue-50 border-blue-100">
          <div className="pt-2">
            <h3 className="font-semibold text-blue-900 mb-2">Run Screener Engine</h3>
            <p className="text-sm text-blue-700 mb-4 leading-relaxed">
              Manually trigger the screener to fetch the latest 10-year OHLC data for your watchlist and compute trading signals.
            </p>
            <Button 
              onClick={handleRunScreener} 
              disabled={screening || initialWatchlist.length === 0}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              {screening ? (
                <span className="flex items-center gap-2"><Activity className="h-4 w-4 animate-spin" /> Scanning Market...</span>
              ) : (
                <span className="flex items-center gap-2"><Play className="h-4 w-4" /> Run Screener Now</span>
              )}
            </Button>
          </div>
        </Card>
      </div>

      {/* RIGHT COLUMN: Signal Feed */}
      <div className="lg:col-span-2">
        <Card className="h-full min-h-[500px]">
          <CardHeader title="Trading Signals Feed" description="Recent BUY/SELL signals generated by the algorithmic screener." />
          <ul className="divide-y divide-slate-100">
            {initialSignals.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                <Activity className="h-12 w-12 mb-3 opacity-20" />
                <p>No signals yet. Add stocks and run the screener.</p>
              </div>
            ) : (
              initialSignals.map((sig) => (
                <li key={sig.id} className="p-4 hover:bg-slate-50 transition-colors flex gap-4">
                  <div className="mt-1 shrink-0">
                    {sig.type === 'BUY' ? (
                      <div className="bg-green-100 text-green-700 p-2 rounded-full">
                        <TrendingUp className="h-5 w-5" />
                      </div>
                    ) : (
                      <div className="bg-red-100 text-red-700 p-2 rounded-full">
                        <TrendingDown className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-1">
                      <div>
                        <span className="font-bold text-slate-900 mr-2">{sig.symbol}</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${sig.type === 'BUY' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {sig.type}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-slate-500">₹{sig.price.toFixed(2)}</span>
                    </div>
                    <p className="text-sm font-medium text-slate-700 mb-1">{sig.rule.replace(/_/g, ' ')}</p>
                    {(() => {
                      const parts = sig.description.split('\nHistorical Edge:');
                      const baseDescription = parts[0];
                      const edgeText = parts.length > 1 ? parts[1].trim() : null;

                      return (
                        <>
                          <p className="text-sm text-slate-500">{baseDescription}</p>
                          {edgeText && (
                            <div className="mt-2 bg-indigo-50 border border-indigo-100 rounded-md p-2.5 text-xs text-indigo-800 font-medium flex items-start gap-2 shadow-sm">
                              <Activity className="h-4 w-4 shrink-0 mt-0.5 text-indigo-500" />
                              <span className="leading-snug">
                                <span className="font-bold">Historical Edge:</span> {edgeText}
                              </span>
                            </div>
                          )}
                        </>
                      );
                    })()}
                    <p className="text-xs text-slate-400 mt-2">{new Date(sig.date).toLocaleDateString('en-IN', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</p>
                  </div>
                </li>
              ))
            )}
          </ul>
        </Card>
      </div>
    </div>
  );
}
