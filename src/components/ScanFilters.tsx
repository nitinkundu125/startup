'use client';

import { useCallback, useEffect, useState } from 'react';
import { Save, Trash2, Check } from 'lucide-react';

/**
 * Scan filters, with named presets.
 *
 * Six numbers retyped before every scan is friction, and friction means people
 * scan with whatever was left from last time. Presets make a filter a thing you
 * define once and reuse.
 *
 * Fitted and held-back floors are separated because they measure different
 * windows. The distinction is in each group's tooltip; the UI states it once and
 * then gets out of the way.
 */

export type FilterValues = {
  minWinRate: number; minTrades: number; maxDrawdown: number;
  oosMinWinRate: number; oosMinTrades: number; oosMaxDrawdown: number;
  /** Best N strategies kept per stock. 0 = all of them. */
  topPerSymbol: number;
};

export const EMPTY_FILTERS: FilterValues = {
  minWinRate: 0, minTrades: 0, maxDrawdown: 0,
  oosMinWinRate: 0, oosMinTrades: 0, oosMaxDrawdown: 0,
  topPerSymbol: 10,
};

type Preset = FilterValues & { id: string; name: string };

const FIELDS: { key: keyof FilterValues; label: string; hint: string }[] = [
  { key: 'minWinRate', label: 'Min win rate %', hint: 'Fitted win rate floor' },
  { key: 'minTrades', label: 'Min trades', hint: 'Fitted trade count floor' },
  { key: 'maxDrawdown', label: 'Max DD %', hint: 'Positive number: 20 keeps nothing worse than −20%' },
  { key: 'oosMinWinRate', label: 'Min win rate %', hint: 'Held-back win rate floor' },
  { key: 'oosMinTrades', label: 'Min trades', hint: 'Held-back trade count floor' },
  { key: 'oosMaxDrawdown', label: 'Max DD %', hint: 'Held-back drawdown ceiling' },
];

export function ScanFilters({
  values,
  onChange,
  disabled,
}: {
  values: FilterValues;
  onChange: (v: FilterValues) => void;
  disabled?: boolean;
}) {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [selected, setSelected] = useState('');
  const [naming, setNaming] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch('/api/lab/filters', { signal });
      const data = await res.json();
      if (!signal?.aborted && data.success) setPresets(data.filters);
    } catch { /* presets are a convenience; never block the scanner */ }
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    const id = setTimeout(() => void load(ac.signal), 0);
    return () => { clearTimeout(id); ac.abort(); };
  }, [load]);

  const set = (key: keyof FilterValues, raw: string) => {
    const cap = key === 'topPerSymbol' ? 1000 : key.toLowerCase().includes('trades') ? 10_000 : 100;
    onChange({ ...values, [key]: Math.min(cap, Math.max(0, Number(raw) || 0)) });
    setSelected(''); // edited by hand — no longer "the preset"
  };

  const applyPreset = (id: string) => {
    setSelected(id);
    if (!id) return onChange(EMPTY_FILTERS);
    const p = presets.find((x) => x.id === id);
    if (!p) return;
    onChange({
      minWinRate: p.minWinRate, minTrades: p.minTrades, maxDrawdown: p.maxDrawdown,
      oosMinWinRate: p.oosMinWinRate, oosMinTrades: p.oosMinTrades, oosMaxDrawdown: p.oosMaxDrawdown,
      topPerSymbol: p.topPerSymbol ?? 10,
    });
  };

  async function save() {
    const name = draftName.trim();
    if (!name) return setError('Give it a name');
    setError(null);
    const res = await fetch('/api/lab/filters', {
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
  }

  async function remove() {
    const p = presets.find((x) => x.id === selected);
    if (!p || !window.confirm(`Delete the filter "${p.name}"?`)) return;
    await fetch(`/api/lab/filters?id=${p.id}`, { method: 'DELETE' });
    setSelected('');
    onChange(EMPTY_FILTERS);
    await load();
  }

  const active = FIELDS.some((f) => values[f.key] > 0) || values.topPerSymbol !== 10;
  const current = presets.find((p) => p.id === selected);
  // Loaded a preset then changed a number — say so, rather than showing a name
  // that no longer matches what will run.
  const dirty = Boolean(current) && FIELDS.some((f) => current![f.key] !== values[f.key]);

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-end gap-2 mb-3">
        <div className="flex-1 min-w-[180px]">
          <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Saved filter</label>
          <select
            value={selected}
            onChange={(e) => applyPreset(e.target.value)}
            disabled={disabled}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">No filter — show everything</option>
            {presets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        <div className="w-32">
          <label
            className="text-xs font-semibold text-slate-500 uppercase mb-1 block"
            title="Best N strategies kept per stock, ranked out-of-sample. 0 keeps all of them."
          >
            Top per stock
          </label>
          <input
            type="number" min={0} max={1000} disabled={disabled}
            value={values.topPerSymbol}
            onChange={(e) => set('topPerSymbol', e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {naming ? (
          <div className="flex items-end gap-2">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Name</label>
              <input
                autoFocus value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && save()}
                placeholder="Safe & steady"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button onClick={save} className="px-3 py-2 rounded-md bg-slate-800 text-white text-sm font-medium hover:bg-slate-900">Save</button>
            <button onClick={() => { setNaming(false); setError(null); }} className="px-2 py-2 text-sm text-slate-500 hover:text-slate-800">Cancel</button>
          </div>
        ) : (
          <>
            <button
              onClick={() => { setDraftName(current?.name ?? ''); setNaming(true); }}
              disabled={disabled || !active}
              title={active ? 'Save these values as a named filter' : 'Set a value first'}
              className="px-3 py-2 rounded-md border border-slate-300 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 flex items-center gap-1.5"
            >
              {justSaved ? <Check className="h-4 w-4 text-green-600" /> : <Save className="h-4 w-4" />}
              {current ? 'Save as / update' : 'Save filter'}
            </button>
            {current && (
              <button
                onClick={remove} disabled={disabled}
                className="px-3 py-2 rounded-md border border-slate-300 bg-white text-sm text-slate-500 hover:text-red-600 hover:border-red-200"
                title={`Delete "${current.name}"`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </>
        )}
      </div>

      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
      {dirty && (
        <p className="text-xs text-amber-600 mb-2">
          Modified from “{current!.name}” — save to keep these values.
        </p>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {([
          ['Fitted window', 0, 'Measured on the data used to pick the strategy'],
          ['Held-back window (OOS)', 3, 'Measured on data the strategy was not picked on. Filtering here uses that data to select, so survivors are no longer purely out-of-sample.'],
        ] as const).map(([title, offset, tip]) => (
          <div key={title} className={`rounded-lg border p-3 ${offset ? 'border-indigo-200 bg-indigo-50/40' : 'border-slate-200'}`}>
            <p className="text-xs font-bold uppercase tracking-wide mb-2 text-slate-600" title={tip}>{title}</p>
            <div className="grid grid-cols-3 gap-2">
              {FIELDS.slice(offset, offset + 3).map((f) => (
                <div key={f.key}>
                  <label className="text-[10px] font-semibold text-slate-500 uppercase mb-1 block" title={f.hint}>
                    {f.label}
                  </label>
                  <input
                    type="number" min={0} disabled={disabled}
                    value={values[f.key]}
                    onChange={(e) => set(f.key, e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-400 mt-2">
        {values.topPerSymbol > 0
          ? `Best ${values.topPerSymbol} per stock. Zero disables a field; Max DD is entered positive.`
          : 'Every strategy that cleared the filters, for every stock. Zero disables a field.'}
      </p>
    </div>
  );
}
