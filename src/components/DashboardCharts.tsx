'use client';

import { useMemo, useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from 'recharts';
import { formatINR } from '@/lib/format';

function formatAxisInr(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}
import {
  BENCHMARK_INDICES,
  BENCHMARK_CHART_COLORS,
  type BenchmarkId,
} from '@/lib/benchmark';

const CHART_COLORS = [
  '#0d9488',
  '#0369a1',
  '#7c3aed',
  '#c2410c',
  '#be185d',
  '#4f46e5',
  '#15803d',
  '#a16207',
];

function ChartEmpty({ message }: { message: string }) {
  return (
    <div className="flex h-[280px] items-center justify-center rounded-lg border border-dashed border-[var(--color-border)] bg-slate-50/80">
      <p className="text-sm text-[var(--color-muted)]">{message}</p>
    </div>
  );
}

const tooltipStyle = {
  backgroundColor: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  boxShadow: '0 4px 6px -1px rgb(15 23 42 / 0.08)',
  fontSize: '13px',
};

export function AllocationChart({ data }: { data: { name: string; value: number }[] }) {
  if (!data?.length) {
    return <ChartEmpty message="No allocation data yet" />;
  }

  const total = data.reduce((s, d) => s + d.value, 0);
  const topLegend = data.slice(0, 12);

  return (
    <div className="w-full">
      <div className="h-[240px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={64}
              outerRadius={96}
              paddingAngle={2}
              dataKey="value"
              nameKey="name"
              stroke="#fff"
              strokeWidth={2}
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => formatINR(Number(value))}
              labelFormatter={(name) => String(name)}
              contentStyle={tooltipStyle}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-4 grid max-h-32 grid-cols-2 gap-x-3 gap-y-1.5 overflow-y-auto sm:grid-cols-3">
        {topLegend.map((item, index) => (
          <li key={item.name} className="flex min-w-0 items-center gap-1.5 text-xs text-slate-600">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
            />
            <span className="truncate font-medium">{item.name}</span>
          </li>
        ))}
      </ul>
      {data.length > 12 && (
        <p className="mt-1 text-center text-xs text-[var(--color-muted)]">
          +{data.length - 12} more in Holdings
        </p>
      )}
      <p className="mt-3 border-t border-[var(--color-border)] pt-3 text-center text-sm font-medium text-[var(--color-foreground)]">
        Total current value {formatINR(total)}
      </p>
    </div>
  );
}


export type PerformanceChartRow = {
  date: string;
  value: number;
  invested?: number;
  nifty50?: number;
  nifty500?: number;
  midcap150?: number;
  smallcap250?: number;
};

const BENCHMARK_LABELS: Record<BenchmarkId, string> = {
  nifty50: 'Nifty 50',
  nifty500: 'Nifty 500',
  midcap150: 'Midcap 150',
  smallcap250: 'Smallcap 250',
};

export function PerformanceChart({ data }: { data: PerformanceChartRow[] }) {
  const benchmarksWithData = useMemo(() => {
    const set = new Set<BenchmarkId>();
    for (const b of BENCHMARK_INDICES) {
      if (data.some((row) => row[b.id] != null && row[b.id]! > 0)) set.add(b.id);
    }
    return set;
  }, [data]);

  const [enabled, setEnabled] = useState<Set<BenchmarkId>>(
    () => new Set<BenchmarkId>(BENCHMARK_INDICES.map((b) => b.id))
  );

  if (!data?.length) {
    return <ChartEmpty message="Import trades to see performance over time" />;
  }

  const toggleBenchmark = (id: BenchmarkId) => {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <span className="w-full text-xs font-medium text-[var(--color-muted)] sm:w-auto sm:py-1.5">
          Compare (same cash flows):
        </span>
        {BENCHMARK_INDICES.map((b) => {
          const on = enabled.has(b.id);
          const hasData = benchmarksWithData.has(b.id);
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => hasData && toggleBenchmark(b.id)}
              disabled={!hasData}
              title={hasData ? undefined : 'No price history for this index yet'}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                !hasData
                  ? 'cursor-not-allowed border-transparent bg-slate-50 text-slate-400'
                  : on
                    ? 'border-slate-300 bg-white text-slate-800 shadow-sm'
                    : 'border-transparent bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              <span
                className="h-2 w-2 rounded-full opacity-80"
                style={{ backgroundColor: BENCHMARK_CHART_COLORS[b.id] }}
              />
              {b.label}
            </button>
          );
        })}
      </div>
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, left: 8, bottom: 0 }}>
            <CartesianGrid stroke="#f1f5f9" strokeDasharray="4 4" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: '#64748b', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
            />
            <YAxis
              tick={{ fill: '#64748b', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => formatAxisInr(Number(v))}
              width={88}
            />
            <Tooltip
              formatter={(value, name) => [
                formatINR(Number(value)),
                BENCHMARK_LABELS[name as BenchmarkId] ??
                  (name === 'invested' ? 'Cost basis' : 'Your portfolio'),
              ]}
              contentStyle={tooltipStyle}
              labelStyle={{ color: '#64748b', marginBottom: 4 }}
            />
            <Legend
              verticalAlign="top"
              height={28}
              formatter={(value) => (
                <span className="text-xs text-slate-600">
                  {BENCHMARK_LABELS[value as BenchmarkId] ??
                    (value === 'invested' ? 'Cost basis' : 'Your portfolio')}
                </span>
              )}
            />
            <Line
              type="monotone"
              dataKey="value"
              name="value"
              stroke="#0d9488"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: '#0d9488' }}
            />
            {data[0]?.invested !== undefined && (
              <Line
                type="monotone"
                dataKey="invested"
                name="invested"
                stroke="#94a3b8"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
              />
            )}
            {BENCHMARK_INDICES.map(
              (b) =>
                enabled.has(b.id) &&
                benchmarksWithData.has(b.id) && (
                  <Line
                    key={b.id}
                    type="monotone"
                    dataKey={b.id}
                    name={b.id}
                    stroke={BENCHMARK_CHART_COLORS[b.id]}
                    strokeWidth={1.5}
                    dot={false}
                    strokeDasharray="4 3"
                    connectNulls
                  />
                )
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
