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
  BarChart,
  Bar,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  ReferenceLine,
} from 'recharts';
import { formatINR, formatUSD } from '@/lib/format';

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

export function AllocationChart({ data, currency = 'INR' }: { data: { name: string; value: number }[]; currency?: 'USD' | 'INR' }) {
  const displayFormat = currency === 'USD' ? formatUSD : formatINR;
  
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
              formatter={(value) => displayFormat(Number(value))}
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
        Total current value {displayFormat(total)}
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

export function CashFlowChart({ data }: { data: { month: string; invested: number; withdrawn: number; net: number }[] }) {
  if (!data?.length) {
    return <ChartEmpty message="Import trades to see your cash flows over time" />;
  }

  const chartData = data.map((d) => ({
    ...d,
    withdrawnNegative: d.withdrawn > 0 ? -d.withdrawn : 0,
  }));

  const totalInvested = data.reduce((sum, d) => sum + d.invested, 0);
  const totalWithdrawn = data.reduce((sum, d) => sum + d.withdrawn, 0);
  const netTotal = totalInvested - totalWithdrawn;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 8, right: 12, left: 8, bottom: 0 }}>
            <CartesianGrid stroke="#f8fafc" strokeDasharray="3 3" vertical={false} />
            <ReferenceLine y={0} stroke="#94a3b8" strokeWidth={1} />
            <XAxis
              dataKey="month"
              tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => {
                const [y, m] = v.split('-');
                const d = new Date(Number(y), Number(m) - 1, 1);
                return d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
              }}
              dy={8}
            />
            <YAxis
              tick={{ fill: '#64748b', fontSize: 10, fontWeight: 500 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => formatAxisInr(Number(v))}
              width={76}
              dx={-4}
            />
            <Tooltip
              formatter={(value: any, name: any) => [
                formatINR(Math.abs(value)),
                name === 'invested' ? 'Invested' : name === 'withdrawnNegative' ? 'Withdrawn' : 'Net Flow',
              ]}
              labelFormatter={(v) => {
                const [y, m] = v.split('-');
                const d = new Date(Number(y), Number(m) - 1, 1);
                return <span className="font-semibold text-slate-800">{d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</span>;
              }}
              contentStyle={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(8px)',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
                padding: '10px 14px',
              }}
              itemStyle={{ padding: '2px 0', fontSize: '13px' }}
            />
            <Legend
              verticalAlign="top"
              height={32}
              iconType="circle"
              wrapperStyle={{ fontSize: '12px', fontWeight: 500, color: '#64748b' }}
              formatter={(value) => (
                <span className="text-slate-600 ml-1">
                  {value === 'invested' ? 'Invested' : value === 'withdrawnNegative' ? 'Withdrawn' : 'Net Flow'}
                </span>
              )}
            />
            <Bar dataKey="invested" name="invested" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={32} stackId="a" />
            <Bar dataKey="withdrawnNegative" name="withdrawnNegative" fill="#f43f5e" radius={[0, 0, 4, 4]} maxBarSize={32} stackId="a" />
            <Line
              type="monotone"
              dataKey="net"
              name="net"
              stroke="#0f172a"
              strokeWidth={2}
              dot={{ r: 3, fill: '#ffffff', stroke: '#0f172a', strokeWidth: 2 }}
              activeDot={{ r: 5, fill: '#0f172a', stroke: '#ffffff', strokeWidth: 2 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Summary Table Sidebar */}
      <div className="flex flex-col border-t lg:border-t-0 lg:border-l border-slate-100 pt-4 lg:pt-0 lg:pl-6">
        <h4 className="text-sm font-semibold text-slate-900 mb-4 tracking-tight">All-Time Summary</h4>
        <div className="space-y-4">
          <div>
            <p className="text-xs text-slate-500 font-medium">Total Invested</p>
            <p className="text-lg font-semibold text-emerald-600">{formatINR(totalInvested)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Total Withdrawn</p>
            <p className="text-lg font-semibold text-rose-600">{formatINR(totalWithdrawn)}</p>
          </div>
          <div className="pt-3 border-t border-slate-100">
            <p className="text-xs text-slate-500 font-medium">Net Capital Flow</p>
            <p className={`text-xl font-bold tracking-tight ${netTotal >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
              {formatINR(netTotal)}
            </p>
          </div>
        </div>

        <h4 className="text-sm font-semibold text-slate-900 mt-8 mb-3 tracking-tight">Recent Months</h4>
        <div className="overflow-y-auto pr-2 space-y-2.5 max-h-[120px] scrollbar-thin scrollbar-thumb-slate-200">
          {[...data].reverse().slice(0, 12).map((d) => {
            const [y, m] = d.month.split('-');
            const dateObj = new Date(Number(y), Number(m) - 1, 1);
            const monthStr = dateObj.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
            return (
              <div key={d.month} className="flex justify-between items-center text-sm group">
                <span className="text-slate-500 font-medium">{monthStr}</span>
                <span className={`font-semibold ${d.net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {d.net >= 0 ? '+' : ''}{formatINR(d.net)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
