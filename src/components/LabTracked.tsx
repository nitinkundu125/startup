'use client';

import { useCallback, useEffect, useState } from 'react';
import { Activity, Eye, Wallet } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

/**
 * Everything the user is tracking, in one list.
 *
 * Pinning and recording a buy used to be two panels for one idea. A bought
 * strategy appeared in both, and neither said whether the stock was actually
 * owned — so the same row meant "waiting to buy" or "waiting to sell" with no
 * way to tell which. One list, two states, and the state is the first thing
 * you see.
 */

type Row = {
  key: string;
  symbol: string;
  strategyName: string;
  state: 'WATCHING' | 'HOLDING';
  currentPrice: number | null;
  signal: string | null;
  isNewSignal: boolean;
  oosWinRate: number | null;
  oosTotalTrades: number | null;
  exitRule: string | null;
  position: {
    id: string;
    entryPrice: number;
    quantity: number;
    entryDate: string;
    stopLossPrice: number | null;
    invested: number | null;
    pnl: number | null;
    pnlPct: number | null;
    stopBreached: boolean;
  } | null;
};

type ClosedTrade = {
  id: string; symbol: string; strategyName: string;
  entryPrice: number; exitPrice: number | null; quantity: number;
  entryDate: string; exitDate: string | null; realised: number | null;
};

type Summary = {
  watching: number; holding: number; invested: number;
  unrealisedPnl: number; pricedCount: number; actionable: number;
};

const money = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export function LabTracked({
  refreshToken = 0,
  onBuy,
}: {
  refreshToken?: number;
  /** Opens the parent's prefilled buy dialog, so there is one buy flow. */
  onBuy?: (symbol: string, strategyName: string, price: number | null) => void;
}) {
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
    // Aborted on unmount so a slow response cannot set state on a gone
    // component, and a rapid refreshToken change cannot land out of order.
    const ac = new AbortController();
    // Queued rather than called inline: starting the fetch synchronously inside
    // the effect makes its first setState part of the same commit, which React
    // flags as a cascading render.
    const id = setTimeout(() => void load(ac.signal), 0);
    return () => { clearTimeout(id); ac.abort(); };
  }, [load, refreshToken]);

  async function sold(r: Row) {
    if (!r.position) return;
    const suggested = (r.currentPrice ?? r.position.entryPrice).toFixed(2);
    const price = window.prompt(`Exit price for ${r.symbol.replace('.NS', '')}?`, suggested);
    if (!price) return;
    setBusy(r.key);
    await fetch(`/api/lab/positions/${r.position.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exitPrice: price }),
    });
    // Selling returns the row to WATCHING rather than removing it — the setup
    // may well fire again, and silently dropping it would end the alerts the
    // user never asked to stop.
    await load();
    setBusy(null);
  }

  async function untrack(r: Row) {
    if (r.state === 'HOLDING' && !window.confirm(
      `${r.symbol.replace('.NS', '')} is an open position. Stop tracking it? You will not be told when to sell.`
    )) return;
    setBusy(r.key);
    await fetch('/api/backtest/pinned', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol: r.symbol, strategy: r.strategyName }),
    });
    await load();
    setBusy(null);
  }

  if (loading) {
    return (
      <Card className="p-6 mb-8 flex items-center gap-2 text-slate-500">
        <Activity className="h-4 w-4 animate-spin" /> Loading…
      </Card>
    );
  }

  if (rows.length === 0 && closed.length === 0) {
    return (
      <Card className="p-8 mb-8 text-center text-slate-400 border-dashed">
        Nothing tracked yet. Scan below, then <strong>watch</strong> a setup or record that you
        <strong> bought</strong> one.
      </Card>
    );
  }

  return (
    <Card className="mb-8 p-0 overflow-hidden border-slate-200 shadow-sm">
      <div className="bg-slate-50 border-b border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Tracking</h2>
          {summary && (
            <p className="text-sm text-slate-500">
              {summary.holding} holding · {summary.watching} watching
              {summary.holding > 0 && (
                <>
                  {' · '}{money(summary.invested)} invested ·{' '}
                  <span className={summary.unrealisedPnl >= 0 ? 'text-green-600 font-semibold' : 'text-red-500 font-semibold'}>
                    {summary.unrealisedPnl >= 0 ? '+' : ''}{money(summary.unrealisedPnl)}
                  </span>
                </>
              )}
              {summary.holding > summary.pricedCount && (
                <span className="text-amber-600"> · {summary.holding - summary.pricedCount} unpriced</span>
              )}
            </p>
          )}
        </div>
        {closed.length > 0 && (
          <button onClick={() => setShowClosed((v) => !v)} className="text-sm font-medium text-slate-500 hover:text-slate-800 underline">
            {showClosed ? 'Back to tracking' : `Closed trades (${closed.length})`}
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
            const urgent =
              (r.state === 'HOLDING' && (r.signal === 'NEW_SELL' || r.position?.stopBreached)) ||
              (r.state === 'WATCHING' && r.signal === 'NEW_BUY');
            return (
              <div key={r.key} className={`p-4 flex flex-wrap items-center gap-4 ${urgent ? 'bg-amber-50' : 'hover:bg-slate-50'}`}>
                {/* State first — a filled wallet means you own it, an eye means
                    you are only waiting. The same row otherwise looks identical
                    whether the next action is buy or sell. */}
                <div className="w-32 shrink-0">
                  {r.state === 'HOLDING' ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700 bg-indigo-100 px-2 py-1 rounded">
                      <Wallet className="h-3.5 w-3.5" /> HOLDING
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-1 rounded">
                      <Eye className="h-3.5 w-3.5" /> WATCHING
                    </span>
                  )}
                </div>

                <div className="min-w-[180px] flex-1">
                  <div className="font-bold text-slate-800">{r.symbol.replace('.NS', '')}</div>
                  <div className="text-xs text-blue-600">{r.strategyName}</div>
                  {r.state === 'HOLDING' && r.exitRule && (
                    <div className="text-xs text-slate-400 mt-0.5">Sell when: {r.exitRule}</div>
                  )}
                </div>

                <div className="w-40 shrink-0">
                  {r.signal === 'NEW_BUY' && <span className="px-2 py-1 rounded bg-green-500 text-white text-xs font-bold">🔥 BUY NOW</span>}
                  {r.signal === 'NEW_SELL' && <span className="px-2 py-1 rounded bg-red-500 text-white text-xs font-bold">SELL NOW</span>}
                  {r.signal === 'HOLDING' && <span className="text-xs text-slate-500">in trade</span>}
                  {(!r.signal || r.signal === 'WAITING') && <span className="text-xs text-slate-400">waiting</span>}
                  {r.position?.stopBreached && <div className="text-xs font-bold text-red-600 mt-1">STOP HIT</div>}
                </div>

                <div className="w-44 shrink-0 text-right">
                  {r.position ? (
                    <>
                      <div className={`font-bold ${(r.position.pnl ?? 0) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {r.position.pnl == null ? '—' : `${r.position.pnl >= 0 ? '+' : ''}${money(r.position.pnl)}`}
                        {r.position.pnlPct != null && (
                          <span className="text-xs font-normal"> ({r.position.pnlPct >= 0 ? '+' : ''}{r.position.pnlPct.toFixed(1)}%)</span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400">
                        {r.position.quantity} @ ₹{r.position.entryPrice.toFixed(2)}
                      </div>
                    </>
                  ) : (
                    <div className="text-xs text-slate-400">
                      {r.oosTotalTrades ? `${r.oosWinRate?.toFixed(0)}% OOS · ${r.oosTotalTrades} trades` : 'no stats yet'}
                    </div>
                  )}
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  {r.state === 'WATCHING' ? (
                    <Button
                      size="sm"
                      disabled={busy === r.key}
                      onClick={() => onBuy?.(r.symbol, r.strategyName, r.currentPrice)}
                      className="bg-green-600 text-white hover:bg-green-700"
                    >
                      I bought
                    </Button>
                  ) : (
                    <Button size="sm" disabled={busy === r.key} onClick={() => sold(r)} variant="secondary">
                      I sold
                    </Button>
                  )}
                  <button onClick={() => untrack(r)} disabled={busy === r.key} className="text-xs text-slate-400 hover:text-red-500">
                    remove
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
