'use client';

import { useEffect, useState } from 'react';
import { slaAdminApi, SlaAdminDashboard } from '@/lib/api';
import { Timer, RefreshCw, AlertTriangle, Clock, ShieldAlert } from 'lucide-react';

function StatCard({
  label,
  value,
  sub,
  accent = 'gray',
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: 'gray' | 'red' | 'orange' | 'green' | 'blue';
}) {
  const colors: Record<string, string> = {
    gray: 'text-gray-900',
    red: 'text-red-600',
    orange: 'text-orange-500',
    green: 'text-green-600',
    blue: 'text-blue-600',
  };
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className={`text-2xl font-semibold mt-1 ${colors[accent]}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function DeliveryPage() {
  const [data, setData] = useState<SlaAdminDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  async function load() {
    setLoading(true);
    setErr('');
    try {
      setData(await slaAdminApi.dashboard());
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Timer size={20} className="text-brand" />
            Delivery / SLA
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">30-day performance snapshot</p>
        </div>
        <button onClick={load} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {err && (
        <div className="bg-red-50 text-red-600 text-sm rounded-xl px-4 py-3">{err}</div>
      )}

      {loading ? (
        <div className="py-20 text-center text-sm text-gray-400">Loading…</div>
      ) : !data ? null : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
            <StatCard
              label="Orders (30d)"
              value={(data.sla_breaches.total ?? 0).toLocaleString()}
              accent="blue"
            />
            <StatCard
              label="SLA breached"
              value={(data.sla_breaches.breached ?? 0).toLocaleString()}
              sub={`${data.sla_breaches.breach_rate ?? 0}% breach rate`}
              accent={Number(data.sla_breaches.breach_rate) > 10 ? 'red' : 'orange'}
            />
            <StatCard
              label="Avg delivery time"
              value={data.avg_delivery_minutes ? `${data.avg_delivery_minutes}m` : '—'}
              sub="accepted → delivered"
              accent={Number(data.avg_delivery_minutes) > 60 ? 'red' : 'green'}
            />
            <StatCard
              label="Open dispute windows"
              value={(data.dispute_window.dispute_window_open ?? 0).toLocaleString()}
              sub="delivered, window not closed"
              accent={Number(data.dispute_window.dispute_window_open) > 0 ? 'orange' : 'green'}
            />
            <StatCard
              label="Reliability penalties"
              value={(data.penalty_stats.total_penalties ?? 0).toLocaleString()}
              sub={`${data.penalty_stats.total_deductions} pts deducted`}
              accent="gray"
            />
          </div>

          {/* Breach rate meter */}
          <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                <AlertTriangle size={15} className="text-orange-400" />
                SLA breach rate (30d)
              </h2>
              <span className={`text-sm font-semibold ${
                Number(data.sla_breaches.breach_rate) > 15 ? 'text-red-600' :
                Number(data.sla_breaches.breach_rate) > 5 ? 'text-orange-500' : 'text-green-600'
              }`}>
                {data.sla_breaches.breach_rate ?? 0}%
              </span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2.5">
              <div
                className={`h-2.5 rounded-full transition-all ${
                  Number(data.sla_breaches.breach_rate) > 15 ? 'bg-red-500' :
                  Number(data.sla_breaches.breach_rate) > 5 ? 'bg-orange-400' : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(100, Number(data.sla_breaches.breach_rate ?? 0))}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-1.5">
              <span>0% (target)</span>
              <span>10% (warn)</span>
              <span>20%+</span>
            </div>
          </div>

          {/* Delivery time guide */}
          <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5 mb-3">
              <Clock size={15} className="text-blue-400" />
              Delivery SLA thresholds
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              {[
                { label: 'Acceptance', target: '15 min', from: 'Payment confirmed' },
                { label: 'Preparation', target: '30 min', from: 'Order accepted' },
                { label: 'Total delivery', target: '60 min', from: 'Order accepted' },
                { label: 'Chef service', target: '24 h', from: 'Event start' },
              ].map(({ label, target, from }) => (
                <div key={label} className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs font-medium text-gray-700">{label}</p>
                  <p className="text-base font-semibold text-brand mt-0.5">{target}</p>
                  <p className="text-xs text-gray-400">from {from}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Top breaching cooks */}
          <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5 mb-3">
              <ShieldAlert size={15} className="text-red-400" />
              Top breaching cooks (30d)
            </h2>
            {data.top_breaching_cooks.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">No SLA breaches recorded this period.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-medium text-gray-500 pb-2">Cook</th>
                    <th className="text-left text-xs font-medium text-gray-500 pb-2">Username</th>
                    <th className="text-right text-xs font-medium text-gray-500 pb-2">Breaches</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.top_breaching_cooks.map((c, i) => (
                    <tr key={i} className="hover:bg-gray-50/50">
                      <td className="py-2.5 font-medium text-gray-900">{c.display_name}</td>
                      <td className="py-2.5 text-gray-500">@{c.username}</td>
                      <td className="py-2.5 text-right">
                        <span className={`font-semibold ${c.breach_count >= 5 ? 'text-red-600' : 'text-orange-500'}`}>
                          {c.breach_count}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
