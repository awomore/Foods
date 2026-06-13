'use client';

import { useEffect, useState } from 'react';
import { statsApi, StatsOverview, ChartRow } from '@/lib/api';
import { StatsCard } from '@/components/StatsCard';
import {
  Users, ChefHat, ShoppingBag, CircleDollarSign,
  Wallet, BadgeCheck, RefreshCw,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

const DAYS_OPTIONS = [7, 14, 30, 90];

function fmt(n: number) {
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `₦${(n / 1_000).toFixed(1)}K`;
  return `₦${n}`;
}

export default function OverviewPage() {
  const [stats, setStats] = useState<StatsOverview | null>(null);
  const [chart, setChart] = useState<ChartRow[]>([]);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);

  useEffect(() => {
    statsApi.overview()
      .then(setStats)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setChartLoading(true);
    statsApi.chart(days)
      .then(({ chart }) => setChart(chart))
      .finally(() => setChartLoading(false));
  }, [days]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Overview</h1>
          <p className="text-sm text-gray-500 mt-0.5">Platform performance at a glance</p>
        </div>
        <button
          onClick={() => { setLoading(true); statsApi.overview().then(setStats).finally(() => setLoading(false)); }}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          title="Refresh"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        <StatsCard
          icon={Users}
          label="Active users"
          value={loading ? '—' : (stats?.total_users ?? 0).toLocaleString()}
          accent="blue"
        />
        <StatsCard
          icon={ChefHat}
          label="Active cooks"
          value={loading ? '—' : (stats?.total_active_cooks ?? 0).toLocaleString()}
          sub={stats ? `${stats.pending_verifications} pending verification` : undefined}
          accent="brand"
        />
        <StatsCard
          icon={ShoppingBag}
          label="Total orders"
          value={loading ? '—' : (stats?.total_orders ?? 0).toLocaleString()}
          sub={stats ? `${stats.orders_by_status['pending_payment'] ?? 0} pending payment` : undefined}
          accent="yellow"
        />
        <StatsCard
          icon={CircleDollarSign}
          label="Platform revenue"
          value={loading ? '—' : fmt(stats?.platform_revenue ?? 0)}
          accent="green"
        />
        <StatsCard
          icon={Wallet}
          label="Pending payouts"
          value={loading ? '—' : fmt(stats?.pending_payout_amount ?? 0)}
          sub={stats ? `${stats.pending_payout_count} requests` : undefined}
          accent="yellow"
        />
        <StatsCard
          icon={BadgeCheck}
          label="Pending verifications"
          value={loading ? '—' : (stats?.pending_verifications ?? 0).toLocaleString()}
          accent="brand"
        />
      </div>

      {/* Order status breakdown */}
      {stats && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Orders by status</h2>
          <div className="flex flex-wrap gap-3">
            {Object.entries(stats.orders_by_status).map(([status, count]) => (
              <div key={status} className="text-center">
                <p className="text-lg font-semibold text-gray-900">{count}</p>
                <p className="text-xs text-gray-400 capitalize">{status.replace(/_/g, ' ')}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Revenue + orders chart */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700">Orders & Revenue</h2>
          <div className="flex gap-1">
            {DAYS_OPTIONS.map(d => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                  days === d
                    ? 'bg-brand text-white'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>
        {chartLoading ? (
          <div className="h-64 flex items-center justify-center text-gray-400 text-sm">Loading…</div>
        ) : chart.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-gray-400 text-sm">No data</div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chart} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="gradRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#FF6B35" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#FF6B35" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="day"
                tickFormatter={v => v.slice(5)}
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                yAxisId="rev"
                orientation="right"
                tickFormatter={v => fmt(Number(v))}
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                yAxisId="ord"
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(value: number, name: string) =>
                  name === 'revenue' ? [fmt(value), 'Revenue'] : [value, 'Orders']
                }
                labelFormatter={l => `Date: ${l}`}
              />
              <Area
                yAxisId="rev"
                type="monotone"
                dataKey="revenue"
                stroke="#FF6B35"
                fill="url(#gradRev)"
                strokeWidth={2}
                dot={false}
              />
              <Area
                yAxisId="ord"
                type="monotone"
                dataKey="orders"
                stroke="#3b82f6"
                fill="none"
                strokeWidth={2}
                dot={false}
                strokeDasharray="4 2"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
