'use client';

import { useCallback, useEffect, useState } from 'react';
import { Activity } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

/**
 * Open positions.
 *
 * Watching setups you do not own was removed — a signal only matters once money
 * is behind it, and buy opportunities come from scanning rather than a standing
 * watchlist. This list answers one question: what do I hold, and should I sell
 * any of it?
 */

type Row = {
  id: string;
  symbol: string;
  strategyName: string;
  currentPrice: number | null;
  entryPrice: number;
  quantity: number;
  entryDate: string;
  stopLossPrice: number | null;
  invested: number;
  pnl: number | null;
  pnlPct: number | null;
  stopBreached: boolean;
  signal: string | null;
  oosWinRate: number | null;
  oosTotalTrades: number | null;
  exitRule: string | null;
  neverChecked: boolean;
};

type ClosedTrade = {
  id: string; symbol: string; strategyName: string;
  entryPrice: number; exitPrice: number | null; quantity: number;
  exitDate: string | null; realised: number | null;
};

type Summary = {
  holding: number; invested: number; unrealisedPnl: number;
  pricedCount: number; needsAction: number;
};

const money = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export function LabTracked({ refreshToken = 0 }: { refreshToken?: number }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [closed, setClosed] = useState<ClosedTrade[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showClosed, setShowClosed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch('/api/lab/tracked', { signal });
      const data = await res.json();
      if (signal?.aborted) return;
      if (data.success) { setRows(data.rows); setSummary(data.summary); setClosed(data.closed ?? []); }
    } catch {
      /* keep the last good view rather than blanking it */
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    // Queued rather than called inline: starting the fetch synchronously inside
    // the effect makes its first setState part of the same commit.
    const id = setTimeout(() => void load(ac.signal), 0);
    return () => { clearTimeout(id); ac.abort(); };
  }, [load, refreshToken]);

  async function sold(r: Row) {
    const suggested = (r.currentPrice ?? r.entryPrice).toFixed(2);
    const price = window.prompt(`Exit price for ${r.symbol.replace('.NS', '')}?`, suggested);
    if (!price) return;
    setBusy(r.id);
    await fetch(`/api/lab/positions/${r.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exitPrice: price }),
    });
    await load();
    setBusy(null);
  }

  async function remove(r: Row) {
    if (!window.confirm(`Delete the ${r.symbol.replace('.NS', '')} position? This cannot be undone.`)) return;
    setBusy(r.id);
    await fetch(`/api/lab/positions/${r.id}`, { method: 'DELETE' });
    await load();
    setBusy(null);
  }

  if (loading) {
    return (
      <Card className="p-6 mb-8 flex items-center gap-2 text-slate-500">
        <Activity className="h-4 w-4 animate-spin" /> Loading positions…
      </Card>
    );
  }

  if (rows.length === 0 && closed.length === 0) {
    return (
      <Card className="p-8 mb-8 text-center text-slate-400 border-dashed">
        No open positions. Scan below and use <strong>I bought</strong> on a row when you act on a signal.
      </Card>
    );
  }

  return (
    <Card className="mb-8 p-0 overflow-hidden border-slate-200 shadow-sm">
      <div className="bg-slate-50 border-b border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800">
            My Holdings
            {summary && summary.needsAction > 0 && (
              <span className="ml-2 text-xs font-bold text-white bg-red-500 px-2 py-0.5 rounded-full align-middle">
                {summary.needsAction} need action
              </span>
            )}
          </h2>
          {summary && summary.holding > 0 && (
            <p className="text-sm text-slate-500">
              {summary.holding} open · {money(summary.invested)} invested ·{' '}
              <span className={summary.unrealisedPnl >= 0 ? 'text-green-600 font-semibold' : 'text-red-500 font-semibold'}>
                {summary.unrealisedPnl >= 0 ? '+' : ''}{money(summary.unrealisedPnl)}
              </span>
              {summary.holding > summary.pricedCount && (
                <span className="text-amber-600"> · {summary.holding - summary.pricedCount} unpriced</span>
              )}
            </p>
          )}
        </div>
        {closed.length > 0 && (
          <button onClick={() => setShowClosed((v) => !v)} className="text-sm font-medium text-slate-500 hover:text-slate-800 underline">
            {showClosed ? `Open (${rows.length})` : `Closed trades (${closed.length})`}
          </button>
        )}
      </div>

      {showClosed ? (
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-slate-500 uppercase bg-white border-b border-slate-200">
            <tr>
              <th className="px-4 py-3">Symbol</th><th className="px-4 py-3">Strategy</th>
              <th className="px-4 py-3 text-right">In</th><th className="px-4 py-3 text-right">Out</th>
              <th className="px-4 py-3 text-right">Realised</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {closed.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-3 font-bold text-slate-800">{c.symbol.replace('.NS', '')}</td>
                <td className="px-4 py-3 text-slate-500">{c.strategyName}</td>
                <td className="px-4 py-3 text-right text-slate-600">₹{c.entryPrice.toFixed(2)}</td>
                <td className="px-4 py-3 text-right text-slate-600">₹{(c.exitPrice ?? 0).toFixed(2)}</td>
                <td className={`px-4 py-3 text-right font-bold ${(c.realised ?? 0) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {(c.realised ?? 0) >= 0 ? '+' : ''}{money(c.realised ?? 0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="divide-y divide-slate-100">
          {rows.map((r) => {
            const urgent = r.stopBreached || r.signal === 'NEW_SELL';
            return (
              <div key={r.id} className={`p-4 flex flex-wrap items-center gap-4 ${urgent ? 'bg-red-50' : 'hover:bg-slate-50'}`}>
                <div className="min-w-[200px] flex-1">
                  <div className="font-bold text-slate-800">{r.symbol.replace('.NS', '')}</div>
                  <div className="text-xs text-blue-600">{r.strategyName}</div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {r.quantity} @ ₹{r.entryPrice.toFixed(2)} · {new Date(r.entryDate).toLocaleDateString()}
                    {r.stopLossPrice != null && ` · stop ₹${r.stopLossPrice.toFixed(2)}`}
                  </div>
                </div>

                <div className="w-40 shrink-0">
                  {r.stopBreached ? (
                    <span className="px-2 py-1 rounded bg-red-600 text-white text-xs font-bold">🛑 STOP HIT</span>
                  ) : r.signal === 'NEW_SELL' ? (
                    <span className="px-2 py-1 rounded bg-red-500 text-white text-xs font-bold">SELL NOW</span>
                  ) : r.neverChecked ? (
                    // "Not checked" and "no signal" must not look the same.
                    <span className="text-xs text-amber-600" title="The exit check has not run since you opened this">
                      not checked yet
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">hold</span>
                  )}
                </div>

                <div className="w-40 shrink-0 text-right">
                  <div className={`font-bold ${(r.pnl ?? 0) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {r.pnl == null ? '—' : `${r.pnl >= 0 ? '+' : ''}${money(r.pnl)}`}
                    {r.pnlPct != null && (
                      <span className="text-xs font-normal"> ({r.pnlPct >= 0 ? '+' : ''}{r.pnlPct.toFixed(1)}%)</span>
                    )}
                  </div>
                  {r.currentPrice != null && (
                    <div className="text-xs text-slate-400">now ₹{r.currentPrice.toFixed(2)}</div>
                  )}
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  <Button size="sm" disabled={busy === r.id} onClick={() => sold(r)}
                    className={urgent ? 'bg-red-600 text-white hover:bg-red-700' : ''}
                    variant={urgent ? undefined : 'secondary'}>
                    I sold
                  </Button>
                  <button onClick={() => remove(r)} disabled={busy === r.id} className="text-xs text-slate-400 hover:text-red-500">
                    delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
