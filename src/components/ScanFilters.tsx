'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-fetch';
import { SlidersHorizontal, Save, Trash2, Check, Activity, X } from 'lucide-react';
import {
  EMPTY_FILTERS,
  FILTER_FIELDS,
  activeFilterCount,
  type FilterValues,
} from '@/lib/scan-filters';

/**
 * Filters over a finished scan.
 *
 * They used to be part of the scan request, so changing a number meant scanning
 * five hundred stocks again. Now the scan returns everything once and this
 * narrows it in the browser, which is why the panel can show a live match count:
 * you can see a floor is too strict before committing to it.
 *
 * Collapsed by default. Six number boxes permanently occupying the top of the
 * results is a form to fill in; a button with a count is a control you reach for.
 */

type Preset = FilterValues & { id: string; name: string };

export function ScanFilters({
  values,
  onChange,
  matchCount,
  totalCount,
}: {
  values: FilterValues;
  onChange: (v: FilterValues) => void;
  /** Rows clearing the current floors, and rows in the scan. */
  matchCount: number;
  totalCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [selected, setSelected] = useState('');
  const [naming, setNaming] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [busy, setBusy] = useState<null | 'loading' | 'saving' | 'deleting'>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!signal?.aborted) setBusy('loading');
    try {
      const res = await apiFetch('/api/lab/filters', { signal });
      const data = await res.json();
      if (!signal?.aborted && data.success) setPresets(data.filters);
    } catch { /* presets are a convenience; never block the results */ }
    finally { if (!signal?.aborted) setBusy(null); }
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    const id = setTimeout(() => void load(ac.signal), 0);
    return () => { clearTimeout(id); ac.abort(); };
  }, [load]);

  const active = activeFilterCount(values);

  const set = (key: keyof FilterValues, raw: string) => {
    const cap = key.toLowerCase().includes('trades') ? 10_000 : 100;
    onChange({ ...values, [key]: Math.min(cap, Math.max(0, Number(raw) || 0)) });
    setSelected(''); // hand-edited — no longer "the preset"
  };

  const applyPreset = (p: Preset | null) => {
    if (!p) { setSelected(''); onChange(EMPTY_FILTERS); return; }
    setSelected(p.id);
    onChange({
      minWinRate: p.minWinRate, minTrades: p.minTrades, maxDrawdown: p.maxDrawdown,
      oosMinWinRate: p.oosMinWinRate, oosMinTrades: p.oosMinTrades, oosMaxDrawdown: p.oosMaxDrawdown,
    });
  };

  async function save() {
    const name = draftName.trim();
    if (!name) return setError('Give it a name');
    if (busy) return;
    setError(null);
    setBusy('saving');
    try {
      const res = await apiFetch('/api/lab/filters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, ...values }),
      });
      const data = await res.json();
      if (!data.success) return setError(data.error ?? 'Could not save');
      setNaming(false);
      setDraftName('');
      await load();
      setSelected(data.filter.id);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setBusy(null);
    }
  }

  async function remove(p: Preset) {
    if (busy || !window.confirm(`Delete the filter "${p.name}"?`)) return;
    setBusy('deleting');
    try {
      await apiFetch(`/api/lab/filters?id=${p.id}`, { method: 'DELETE' });
      if (selected === p.id) { setSelected(''); onChange(EMPTY_FILTERS); }
      await load();
    } finally {
      setBusy(null);
    }
  }

  const groups = [
    {
      id: 'fitted' as const,
      title: 'Fitted window',
      tip: 'Measured on the data used to pick the strategy.',
    },
    {
      id: 'oos' as const,
      title: 'Held-back window',
      tip: 'Measured on data the strategy was not picked on. Filtering here uses that data to select, so survivors are no longer purely out-of-sample.',
    },
  ];

  return (
    <div className="border-b border-slate-200 bg-slate-50/60">
      <div className="flex flex-wrap items-center gap-2 px-5 py-3">
        <button
          onClick={() => setOpen((v) => !v)}
          className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
            active > 0
              ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
              : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filters
          {active > 0 && (
            <span className="rounded-full bg-indigo-600 px-1.5 text-xs font-bold text-white">{active}</span>
          )}
        </button>

        {/* Saved filters as chips. A dropdown hides how many there are and takes
            two clicks to apply one. */}
        {presets.map((p) => (
          <span
            key={p.id}
            className={`group inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium ${
              selected === p.id
                ? 'border-indigo-300 bg-indigo-100 text-indigo-800'
                : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            <button onClick={() => applyPreset(selected === p.id ? null : p)}>{p.name}</button>
            <button
              onClick={() => remove(p)}
              title={`Delete "${p.name}"`}
              className="opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-600"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </span>
        ))}

        <div className="ml-auto flex items-center gap-3 text-sm">
          {active > 0 ? (
            <>
              <span className="font-semibold text-slate-800">
                {matchCount.toLocaleString()}
                <span className="font-normal text-slate-500"> of {totalCount.toLocaleString()} rows</span>
              </span>
              <button
                onClick={() => { onChange(EMPTY_FILTERS); setSelected(''); }}
                className="inline-flex items-center gap-1 text-slate-500 underline hover:text-slate-800"
              >
                <X className="h-3.5 w-3.5" /> Clear
              </button>
            </>
          ) : (
            <span className="text-slate-500">{totalCount.toLocaleString()} rows</span>
          )}
        </div>
      </div>

      {open && (
        <div className="border-t border-slate-200 bg-white px-5 py-4">
          <div className="grid gap-5 md:grid-cols-2">
            {groups.map((g) => (
              <div key={g.id}>
                <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-600" title={g.tip}>
                  {g.title}
                </p>
                <div className="space-y-2.5">
                  {FILTER_FIELDS.filter((f) => f.group === g.id).map((f) => (
                    <label key={f.key} className="flex items-center gap-3 text-sm" title={f.hint}>
                      <span className="flex-1 text-slate-600">{f.label}</span>
                      <span className="relative">
                        <input
                          type="number"
                          min={0}
                          value={values[f.key] || ''}
                          placeholder="any"
                          onChange={(e) => set(f.key, e.target.value)}
                          className={`w-24 rounded-md border px-2 py-1.5 text-right text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-500/30 ${
                            values[f.key] > 0
                              ? 'border-indigo-300 bg-indigo-50 font-semibold text-indigo-900'
                              : 'border-slate-300 bg-white'
                          }`}
                        />
                        {f.suffix && (
                          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                            {f.suffix}
                          </span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
            <p className="text-xs text-slate-500">
              Leave a box empty for no limit. Drawdown is entered positive — 20 keeps nothing worse than −20%.
            </p>
            <div className="ml-auto flex items-center gap-2">
              {naming ? (
                <>
                  <input
                    autoFocus
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && save()}
                    placeholder="Safe & steady"
                    className="rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  />
                  <button
                    onClick={save}
                    disabled={busy !== null}
                    className="inline-flex items-center gap-1.5 rounded-md bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50"
                  >
                    {busy === 'saving' && <Activity className="h-3.5 w-3.5 animate-spin" />}
                    Save
                  </button>
                  <button
                    onClick={() => { setNaming(false); setError(null); }}
                    className="px-2 py-1.5 text-sm text-slate-500 hover:text-slate-800"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={() => { setDraftName(presets.find((p) => p.id === selected)?.name ?? ''); setNaming(true); }}
                  disabled={active === 0}
                  title={active > 0 ? 'Save these values as a named filter' : 'Set a value first'}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                >
                  {justSaved ? <Check className="h-4 w-4 text-green-600" /> : <Save className="h-4 w-4" />}
                  Save as filter
                </button>
              )}
            </div>
          </div>

          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}
