'use client';

import { useEffect, useState, useCallback } from 'react';
import { dispatchAnalyticsApi, type DispatchAnalytics } from '@/lib/api';
import { BarChart3, RefreshCw, Bike, AlertCircle, Clock, CheckCircle2, XCircle } from 'lucide-react';

function StatCard({ label, value, sub, icon: Icon, highlight = false }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; highlight?: boolean;
}) {
  return (
    <div className={`bg-white border rounded-xl p-4 shadow-sm ${highlight ? 'border-amber-300 bg-amber-50' : 'border-gray-100'}`}>
      <div className="flex items-center gap-2 text-gray-500 mb-2">
        <Icon size={15} className={highlight ? 'text-amber-500' : 'text-brand'} />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${highlight ? 'text-amber-700' : 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function DispatchAnalyticsPage() {
  const [data, setData] = useState<DispatchAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await dispatchAnalyticsApi.get();
      setData(res);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="py-20 text-center text-sm text-gray-400">Loading dispatch analytics…</div>;
  if (error) return <div className="py-20 text-center text-sm text-red-500">{error}</div>;
  if (!data) return null;

  const { summary, daily_volume, top_riders, unassigned_count } = data;
  const completionRate = summary.total_dispatched > 0
    ? Math.round((summary.completed / summary.total_dispatched) * 100)
    : 0;

  const maxVol = Math.max(...daily_volume.map(d => d.foods_network + d.off_platform), 1);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <BarChart3 size={20} className="text-brand" />
            Dispatch Analytics
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Last 30 days · FOODS Network + off-platform deliveries</p>
        </div>
        <button onClick={load} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total dispatched" value={summary.total_dispatched} icon={Bike} />
        <StatCard
          label="Unassigned (last 2h)"
          value={unassigned_count}
          sub="Orders ready but no rider claimed"
          icon={AlertCircle}
          highlight={unassigned_count > 0}
        />
        <StatCard
          label="Avg delivery time"
          value={summary.avg_delivery_minutes != null ? `${summary.avg_delivery_minutes}m` : '—'}
          sub="From dispatch to delivered"
          icon={Clock}
        />
        <StatCard
          label="Completion rate"
          value={`${completionRate}%`}
          sub={`${summary.completed} delivered · ${summary.cancelled} cancelled`}
          icon={CheckCircle2}
        />
      </div>

      {/* Network split */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500 mb-1">FOODS Network</p>
          <p className="text-2xl font-bold text-gray-900">{summary.foods_network_count}</p>
          <p className="text-xs text-gray-400">
            {summary.total_dispatched > 0
              ? `${Math.round((summary.foods_network_count / summary.total_dispatched) * 100)}% of orders`
              : '—'}
          </p>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500 mb-1">Off-platform (own rider)</p>
          <p className="text-2xl font-bold text-gray-900">{summary.off_platform_count}</p>
          <p className="text-xs text-gray-400">
            {summary.total_dispatched > 0
              ? `${Math.round((summary.off_platform_count / summary.total_dispatched) * 100)}% of orders`
              : '—'}
          </p>
        </div>
      </div>

      {/* Daily volume chart (bar) */}
      {daily_volume.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Daily dispatch volume (last 14 days)</h2>
          <div className="flex items-end gap-1.5 h-32">
            {daily_volume.map(d => {
              const total = d.foods_network + d.off_platform;
              const pct = Math.round((total / maxVol) * 100);
              const fnPct = total > 0 ? Math.round((d.foods_network / total) * 100) : 0;
              return (
                <div key={d.day} className="flex-1 flex flex-col items-center gap-1 group relative">
                  <div
                    className="w-full rounded-t overflow-hidden flex flex-col-reverse"
                    style={{ height: `${Math.max(pct, 4)}%` }}
                    title={`${d.day}: ${total} orders (${d.foods_network} FOODS + ${d.off_platform} own)`}
                  >
                    <div className="bg-brand opacity-80" style={{ height: `${fnPct}%` }} />
                    <div className="bg-gray-300" style={{ height: `${100 - fnPct}%` }} />
                  </div>
                  <span className="text-[9px] text-gray-400 hidden sm:block">
                    {new Date(d.day).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
                  </span>
                  {/* Tooltip */}
                  <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block z-10 bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                    {total} orders · {d.delivered} delivered
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <div className="w-3 h-3 rounded bg-brand opacity-80" /> FOODS Network
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <div className="w-3 h-3 rounded bg-gray-300" /> Off-platform
            </div>
          </div>
        </div>
      )}

      {/* Top riders */}
      {top_riders.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Top riders (this month)</h2>
          <div className="space-y-2">
            {top_riders.map((r, i) => (
              <div key={r.full_name + i} className="flex items-center gap-3">
                <span className="w-6 text-xs font-semibold text-gray-400 text-right">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900 truncate">{r.full_name}</p>
                    <span className="text-xs text-gray-400 capitalize bg-gray-100 px-1.5 py-0.5 rounded">
                      {r.vehicle_type}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">
                    {r.month_deliveries} this month · {r.total_deliveries} all-time
                  </p>
                </div>
                <p className="text-sm font-semibold text-gray-700 flex-shrink-0">
                  ₦{r.month_gross.toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
