'use client';

import { useEffect, useState } from 'react';
import { riderEarningsApi, type RiderEarningsRow } from '@/lib/api';
import { Badge, statusVariant } from '@/components/Badge';
import { TrendingUp, RefreshCw, Truck } from 'lucide-react';

function fmt(n: number) {
  return `₦${Number(n).toLocaleString()}`;
}

export default function RiderEarningsPage() {
  const [riders, setRiders] = useState<RiderEarningsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');

  async function load() {
    setLoading(true);
    setErr('');
    try {
      const res = await riderEarningsApi.list();
      setRiders(res.riders);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = riders.filter(r =>
    !q || r.full_name.toLowerCase().includes(q.toLowerCase()) ||
    r.phone.includes(q) || (r.fleet_name ?? '').toLowerCase().includes(q.toLowerCase())
  );

  const totalWeekGross   = riders.reduce((s, r) => s + Number(r.week_gross), 0);
  const totalAllTimeGross = riders.reduce((s, r) => s + Number(r.all_time_gross), 0);
  const activeCount      = riders.filter(r => r.status === 'approved' && r.is_available).length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <TrendingUp size={20} className="text-brand" />
            Rider Earnings
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {riders.length} riders · {activeCount} online now
          </p>
        </div>
        <button onClick={load} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {err && <div className="bg-red-50 text-red-600 text-sm rounded-xl px-4 py-3">{err}</div>}

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'This week (platform)', value: fmt(totalWeekGross) },
          { label: 'All time (platform)',  value: fmt(totalAllTimeGross) },
          { label: 'Riders online now',    value: String(activeCount) },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
            <p className="text-xs font-medium text-gray-500">{label}</p>
            <p className="text-2xl font-semibold text-gray-900 mt-1">{value}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <input
        type="text"
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder="Search by name, phone or fleet…"
        className="w-full max-w-xs border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
      />

      {/* Table */}
      {loading ? (
        <div className="py-20 text-center text-sm text-gray-400">Loading…</div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Rider</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Fleet</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Status</th>
                <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">This week</th>
                <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">All time</th>
                <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Deliveries</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-sm text-gray-400">
                    No riders found.
                  </td>
                </tr>
              ) : filtered.map(r => (
                <tr key={r.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <Truck size={14} className="text-gray-400" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{r.full_name}</p>
                        <p className="text-xs text-gray-400">{r.phone} · <span className="capitalize">{r.vehicle_type}</span></p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {r.fleet_name ?? <span className="text-gray-300">Solo</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <Badge label={r.status} variant={statusVariant(r.status)} />
                      {r.status === 'approved' && (
                        <span className={`text-xs font-medium ${r.is_available ? 'text-green-600' : 'text-gray-400'}`}>
                          {r.is_available ? 'Online' : 'Offline'}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="font-semibold text-gray-900">{fmt(Number(r.week_gross))}</p>
                    <p className="text-xs text-gray-400">{r.week_deliveries} trips</p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="font-semibold text-gray-900">{fmt(Number(r.all_time_gross))}</p>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">
                    {r.total_deliveries.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
