'use client';

import { useEffect, useState, useCallback } from 'react';
import { fleetEconomicsApi, type FleetEconomics } from '@/lib/api';
import { DollarSign, RefreshCw, Pencil, Check, X } from 'lucide-react';

function pct(rate: number) {
  return `${Math.round(rate * 100)}%`;
}

function CommissionEditor({
  current,
  onSave,
  isOverride,
}: {
  current: number;
  onSave: (rate: number | null) => Promise<void>;
  isOverride?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(Math.round(current * 100)));
  const [saving, setSaving] = useState(false);

  async function submit() {
    const parsed = parseFloat(value) / 100;
    if (isNaN(parsed) || parsed < 0 || parsed > 1) return;
    setSaving(true);
    try {
      await onSave(parsed);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <span className={`text-sm font-semibold ${isOverride ? 'text-brand' : 'text-gray-700'}`}>
          {pct(current)}
        </span>
        {isOverride && <span className="text-xs text-brand bg-brand/10 px-1.5 py-0.5 rounded">custom</span>}
        <button
          onClick={() => setEditing(true)}
          className="p-1 text-gray-400 hover:text-brand hover:bg-gray-100 rounded"
        >
          <Pencil size={12} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        min={0}
        max={100}
        step={1}
        value={value}
        onChange={e => setValue(e.target.value)}
        className="w-16 border border-gray-300 rounded px-2 py-0.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-brand/30"
        autoFocus
      />
      <span className="text-xs text-gray-500">%</span>
      <button
        onClick={submit}
        disabled={saving}
        className="p-1 text-green-600 hover:bg-green-50 rounded disabled:opacity-40"
      >
        <Check size={13} />
      </button>
      <button
        onClick={() => { setValue(String(Math.round(current * 100))); setEditing(false); }}
        className="p-1 text-gray-400 hover:bg-gray-100 rounded"
      >
        <X size={13} />
      </button>
    </div>
  );
}

export default function FleetEconomicsPage() {
  const [data, setData] = useState<FleetEconomics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fleetEconomicsApi.get();
      setData(res);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function updateOperator(id: string, rate: number | null) {
    if (rate === null) return;
    const res = await fleetEconomicsApi.updateOperator(id, rate);
    setData(prev => prev ? {
      ...prev,
      operators: prev.operators.map(o => o.id === id ? { ...o, commission_rate: res.operator.commission_rate } : o),
    } : prev);
  }

  async function updateRider(id: string, rate: number | null) {
    const res = await fleetEconomicsApi.updateRider(id, rate);
    setData(prev => prev ? {
      ...prev,
      solo_riders: prev.solo_riders.map(r => r.id === id
        ? { ...r, commission_rate: res.rider.commission_rate ?? data?.platform_default_rate ?? 0.15, has_override: res.rider.commission_rate !== null }
        : r),
    } : prev);
  }

  if (loading) return <div className="py-20 text-center text-sm text-gray-400">Loading fleet economics…</div>;
  if (error) return <div className="py-20 text-center text-sm text-red-500">{error}</div>;
  if (!data) return null;

  const { summary, operators, solo_riders, platform_default_rate } = data;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <DollarSign size={20} className="text-brand" />
            Fleet Economics
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Platform commission on rider delivery fees · Default: {pct(platform_default_rate)}
          </p>
        </div>
        <button onClick={load} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Revenue summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
          <p className="text-xs font-medium text-gray-500 mb-1">Rider gross (last 30 days)</p>
          <p className="text-2xl font-bold text-gray-900">
            ₦{Number(summary.total_month_gross).toLocaleString()}
          </p>
          <p className="text-xs text-gray-400 mt-1">Total delivery fees earned by riders</p>
        </div>
        <div className="bg-white border border-brand/20 rounded-xl p-5 shadow-sm bg-brand/5">
          <p className="text-xs font-medium text-gray-500 mb-1">Platform revenue (last 30 days)</p>
          <p className="text-2xl font-bold text-brand">
            ₦{Number(summary.total_month_platform_revenue).toLocaleString()}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {summary.total_month_gross > 0
              ? `${Math.round((summary.total_month_platform_revenue / summary.total_month_gross) * 100)}% effective take rate`
              : 'No deliveries yet'}
          </p>
        </div>
      </div>

      {/* Fleet operators */}
      {operators.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">Fleet Operators</h2>
            <p className="text-xs text-gray-400">Commission rate applies to all riders under the operator</p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-500">Operator</th>
                <th className="text-right px-5 py-2.5 text-xs font-medium text-gray-500">Riders</th>
                <th className="text-right px-5 py-2.5 text-xs font-medium text-gray-500">Month gross</th>
                <th className="text-right px-5 py-2.5 text-xs font-medium text-gray-500">Platform rev</th>
                <th className="text-right px-5 py-2.5 text-xs font-medium text-gray-500">Commission</th>
              </tr>
            </thead>
            <tbody>
              {operators.map((op, i) => (
                <tr key={op.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                  <td className="px-5 py-3">
                    <p className="font-medium text-gray-900">{op.business_name}</p>
                    {op.contact_phone && <p className="text-xs text-gray-400">{op.contact_phone}</p>}
                  </td>
                  <td className="px-5 py-3 text-right text-gray-600">{op.rider_count}</td>
                  <td className="px-5 py-3 text-right text-gray-700">₦{Number(op.month_gross).toLocaleString()}</td>
                  <td className="px-5 py-3 text-right text-brand font-medium">₦{Number(op.month_platform_revenue).toLocaleString()}</td>
                  <td className="px-5 py-3 text-right">
                    <CommissionEditor
                      current={op.commission_rate}
                      onSave={rate => updateOperator(op.id, rate)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Solo riders */}
      {solo_riders.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">Solo Riders</h2>
            <p className="text-xs text-gray-400">Individual riders not under an operator — can have custom commission overrides</p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-500">Rider</th>
                <th className="text-right px-5 py-2.5 text-xs font-medium text-gray-500">Deliveries</th>
                <th className="text-right px-5 py-2.5 text-xs font-medium text-gray-500">Month gross</th>
                <th className="text-right px-5 py-2.5 text-xs font-medium text-gray-500">Commission</th>
              </tr>
            </thead>
            <tbody>
              {solo_riders.map((r, i) => (
                <tr key={r.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                  <td className="px-5 py-3">
                    <p className="font-medium text-gray-900">{r.full_name}</p>
                    <p className="text-xs text-gray-400">{r.phone} · {r.vehicle_type}</p>
                  </td>
                  <td className="px-5 py-3 text-right text-gray-600">{r.total_deliveries}</td>
                  <td className="px-5 py-3 text-right text-gray-700">₦{Number(r.month_gross).toLocaleString()}</td>
                  <td className="px-5 py-3 text-right">
                    <CommissionEditor
                      current={r.commission_rate}
                      isOverride={r.has_override}
                      onSave={rate => updateRider(r.id, rate)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {operators.length === 0 && solo_riders.length === 0 && (
        <div className="bg-white border border-gray-100 rounded-xl py-16 text-center shadow-sm">
          <DollarSign size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No approved riders yet</p>
          <p className="text-xs text-gray-400 mt-1">Commission data will appear once riders are approved</p>
        </div>
      )}
    </div>
  );
}
