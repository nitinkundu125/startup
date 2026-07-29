'use client';

import { useCallback, useEffect, useState } from 'react';
import { Activity, Plus, X } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

/**
 * Positions taken off Lab signals.
 *
 * A signal on its own cannot answer "when do I sell" — the app knew a strategy
 * fired, not that you acted, at what price, or in what size. Recording the
 * entry turns the backtest's numbers into yours, and keeps the exit rule
 * attached to the trade rather than buried in the strategy list.
 */

type Position = {
  id: string;
  symbol: string;
  strategyName: string;
  entryPrice: number;
  quantity: number;
  entryDate: string;
  stopLossPrice: number | null;
  exitPrice: number | null;
  exitDate: string | null;
  status: 'OPEN' | 'CLOSED';
  currentPrice: number | null;
  invested: number;
  currentValue: number | null;
  pnl: number | null;
  pnlPct: number | null;
  exitRule: string;
  stopBreached: boolean;
};

type Summary = {
  openCount: number;
  invested: number;
  currentValue: number;
  unrealisedPnl: number;
  pricedCount: number;
};

const money = (n: number) =>
  `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export function LabPositions({
  defaultSymbol = '',
  defaultStrategy = '',
  /** Bumped by the parent after recording a buy, to force a refetch. */
  refreshToken = 0,
}: { defaultSymbol?: string; defaultStrategy?: string; refreshToken?: number }) {
  const [positions, setPositions] = useState<Position[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showClosed, setShowClosed] = useState(false);

  const [form, setForm] = useState({
    symbol: defaultSymbol,
    strategyName: defaultStrategy,
    entryPrice: '',
    quantity: '',
    entryDate: new Date().toISOString().slice(0, 10),
    stopLossPrice: '',
  });

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/lab/positions');
      const data = await res.json();
      if (data.success) {
        setPositions(data.positions);
        setSummary(data.summary);
      }
    } catch {
      /* leave the last good view up rather than blanking it */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load, refreshToken]);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/lab/positions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!data.success) { setError(data.error ?? 'Could not record position'); return; }
      setShowForm(false);
      setForm({ ...form, symbol: '', entryPrice: '', quantity: '', stopLossPrice: '' });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setSaving(false);
    }
  }

  async function close(p: Position) {
    const suggested = p.currentPrice ?? p.entryPrice;
    const raw = window.prompt(`Exit price for ${p.symbol.replace('.NS', '')}?`, suggested.toFixed(2));
    if (!raw) return;
    await fetch(`/api/lab/positions/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exitPrice: raw }),
    });
    await load();
  }

  async function remove(p: Position) {
    if (!window.confirm(`Delete the ${p.symbol.replace('.NS', '')} position? This cannot be undone.`)) return;
    await fetch(`/api/lab/positions/${p.id}`, { method: 'DELETE' });
    await load();
  }

  const open = positions.filter((p) => p.status === 'OPEN');
  const closed = positions.filter((p) => p.status === 'CLOSED');
  const shown = showClosed ? closed : open;

  if (loading) {
    return (
      <Card className="p-6 mb-8 flex items-center gap-2 text-slate-500">
        <Activity className="h-4 w-4 animate-spin" /> Loading positions…
      </Card>
    );
  }

  return (
    <Card className="mb-8 p-0 overflow-hidden border-slate-200 shadow-sm">
      <div className="bg-slate-50 border-b border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800">My Positions</h2>
          {summary && summary.openCount > 0 && (
            <p className="text-sm text-slate-500">
              {summary.openCount} open · {money(summary.invested)} invested ·{' '}
              <span className={summary.unrealisedPnl >= 0 ? 'text-green-600 font-semibold' : 'text-red-500 font-semibold'}>
                {summary.unrealisedPnl >= 0 ? '+' : ''}{money(summary.unrealisedPnl)} unrealised
              </span>
              {/* Never imply a live figure for holdings whose quote failed. */}
              {summary.pricedCount < summary.openCount && (
                <span className="text-amber-600"> · {summary.openCount - summary.pricedCount} without a live price</span>
              )}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {closed.length > 0 && (
            <button
              onClick={() => setShowClosed((v) => !v)}
              className="text-sm font-medium text-slate-500 hover:text-slate-800 underline"
            >
              {showClosed ? `Open (${open.length})` : `Closed (${closed.length})`}
            </button>
          )}
          <Button onClick={() => setShowForm((v) => !v)} size="sm" className="gap-1 bg-slate-800 text-white hover:bg-slate-900">
            {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showForm ? 'Cancel' : 'I bought this'}
          </Button>
        </div>
      </div>

      {showForm && (
        <div className="p-4 border-b border-slate-200 bg-white">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            {([
              ['symbol', 'Symbol', 'text', 'RELIANCE.NS'],
              ['strategyName', 'Strategy', 'text', 'Turtle System 2 (55/20)'],
              ['entryPrice', 'Buy price', 'number', '1420'],
              ['quantity', 'Qty', 'number', '10'],
              ['entryDate', 'Date', 'date', ''],
              ['stopLossPrice', 'Stop (optional)', 'number', '1280'],
            ] as const).map(([key, label, type, ph]) => (
              <div key={key} className={key === 'strategyName' ? 'col-span-2' : ''}>
                <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">{label}</label>
                <input
                  type={type}
                  value={(form as Record<string, string>)[key]}
                  placeholder={ph}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ))}
          </div>
          {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
          <Button onClick={submit} disabled={saving} className="mt-3 bg-blue-600 text-white hover:bg-blue-700">
            {saving ? 'Saving…' : 'Record position'}
          </Button>
        </div>
      )}

      {shown.length === 0 ? (
        <div className="p-8 text-center text-slate-400">
          {showClosed ? 'No closed positions yet.' : 'No open positions. Record one when you act on a signal.'}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-white border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Symbol</th>
                <th className="px-4 py-3">Strategy &amp; exit rule</th>
                <th className="px-4 py-3 text-right">Entry</th>
                <th className="px-4 py-3 text-right">{showClosed ? 'Exit' : 'Now'}</th>
                <th className="px-4 py-3 text-right">Qty</th>
                <th className="px-4 py-3 text-right">P&amp;L</th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shown.map((p) => (
                <tr key={p.id} className={p.stopBreached ? 'bg-red-50' : 'hover:bg-slate-50'}>
                  <td className="px-4 py-3 font-bold text-slate-800">
                    {p.symbol.replace('.NS', '')}
                    {p.stopBreached && (
                      <span className="ml-2 text-xs font-bold text-red-600">STOP HIT</span>
                    )}
                    <div className="text-xs font-normal text-slate-400">
                      {new Date(p.entryDate).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-4 py-3 max-w-md">
                    <div className="font-medium text-blue-600">{p.strategyName}</div>
                    {/* The answer to "when do I sell", attached to the position. */}
                    <div className="text-xs text-slate-500 mt-0.5">Sell when: {p.exitRule}</div>
                    {p.stopLossPrice != null && (
                      <div className="text-xs text-slate-400">Stop: ₹{p.stopLossPrice.toFixed(2)}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">₹{p.entryPrice.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-800">
                    {showClosed
                      ? `₹${(p.exitPrice ?? 0).toFixed(2)}`
                      : p.currentPrice != null
                        ? `₹${p.currentPrice.toFixed(2)}`
                        : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">{p.quantity}</td>
                  <td className={`px-4 py-3 text-right font-bold ${p.pnl == null ? 'text-slate-400' : p.pnl >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {p.pnl == null ? '—' : (
                      <>
                        {p.pnl >= 0 ? '+' : ''}{money(p.pnl)}
                        <div className="text-xs font-normal">
                          {p.pnlPct! >= 0 ? '+' : ''}{p.pnlPct!.toFixed(1)}%
                        </div>
                      </>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center whitespace-nowrap">
                    {p.status === 'OPEN' && (
                      <button onClick={() => close(p)} className="text-blue-600 hover:text-blue-800 font-semibold text-xs underline mr-3">
                        Sold
                      </button>
                    )}
                    <button onClick={() => remove(p)} className="text-slate-400 hover:text-red-500 text-xs">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
