'use client';

import { useEffect, useState } from 'react';
import { fraudAdminApi, FraudData, FraudSignal } from '@/lib/api';
import { ShieldAlert, RefreshCw, CheckCircle2, AlertTriangle, X } from 'lucide-react';

function fmt(n: number) {
  return `₦${Number(n).toLocaleString()}`;
}

function SeverityBadge({ level }: { level: string }) {
  const map: Record<string, string> = {
    critical: 'bg-red-100 text-red-700',
    high: 'bg-orange-100 text-orange-700',
    medium: 'bg-yellow-100 text-yellow-700',
    low: 'bg-gray-100 text-gray-600',
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${map[level] ?? map.low}`}>
      {level}
    </span>
  );
}

function RiskBadge({ level }: { level: string }) {
  const map: Record<string, string> = {
    critical: 'bg-red-100 text-red-700',
    high: 'bg-orange-100 text-orange-700',
    medium: 'bg-yellow-100 text-yellow-700',
    low: 'bg-green-100 text-green-700',
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${map[level] ?? map.low}`}>
      {level}
    </span>
  );
}

interface SignalResolveModalProps {
  signal: FraudSignal;
  onClose: () => void;
  onDone: () => void;
}

function SignalResolveModal({ signal, onClose, onDone }: SignalResolveModalProps) {
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    try {
      await fraudAdminApi.resolveSignal(signal.id, note || undefined);
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold">Resolve signal</h2>
            <p className="text-xs text-gray-500 mt-0.5">{signal.signal_type.replace(/_/g, ' ')} · {signal.full_name ?? signal.phone}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          rows={3}
          placeholder="Resolution note (optional)…"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none resize-none mb-4"
        />
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={saving} className="flex-1 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
            {saving ? 'Saving…' : 'Mark resolved'}
          </button>
        </div>
      </div>
    </div>
  );
}

type Tab = 'signals' | 'high_disputes' | 'velocity' | 'risk_users';

export default function FraudPage() {
  const [data, setData] = useState<FraudData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('signals');
  const [resolvingSignal, setResolvingSignal] = useState<FraudSignal | null>(null);
  const [actioning, setActioning] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try { setData(await fraudAdminApi.get()); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function updateRisk(userId: string, risk_level: string) {
    setActioning(userId);
    try { await fraudAdminApi.updateRiskLevel(userId, risk_level); load(); }
    finally { setActioning(null); }
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'signals', label: 'Signals' },
    { key: 'high_disputes', label: 'High disputes' },
    { key: 'velocity', label: 'Velocity' },
    { key: 'risk_users', label: 'Risk users' },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <ShieldAlert size={20} className="text-red-500" />
            Fraud
          </h1>
          {data && (
            <p className="text-sm text-gray-500 mt-0.5">
              30-day refund rate: <span className="font-medium text-gray-700">{data.refund_rate?.rate ?? 0}%</span>
              {' '}({data.refund_rate?.refunded ?? 0} of {data.refund_rate?.total ?? 0} orders)
            </p>
          )}
        </div>
        <button onClick={load} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Summary cards */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
            <p className="text-xs text-gray-500">Open signals</p>
            <p className="text-2xl font-semibold text-gray-900 mt-1">{data.fraud_signals.length}</p>
          </div>
          <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
            <p className="text-xs text-gray-500">High-dispute cooks</p>
            <p className="text-2xl font-semibold text-gray-900 mt-1">{data.high_dispute_cooks.length}</p>
          </div>
          <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
            <p className="text-xs text-gray-500">Velocity breaches</p>
            <p className="text-2xl font-semibold text-gray-900 mt-1">{data.velocity_breaches.length}</p>
          </div>
          <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
            <p className="text-xs text-gray-500">High-risk users</p>
            <p className="text-2xl font-semibold text-red-600 mt-1">{data.high_risk_users.length}</p>
          </div>
        </div>
      )}

      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-20 text-center text-sm text-gray-400">Loading…</div>
      ) : !data ? null : tab === 'signals' ? (
        <div className="space-y-2">
          {data.fraud_signals.length === 0 ? (
            <div className="py-20 text-center text-sm text-gray-400">No open fraud signals.</div>
          ) : data.fraud_signals.map(s => (
            <div key={s.id} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <SeverityBadge level={s.severity} />
                  <span className="text-sm font-medium text-gray-900 capitalize">{s.signal_type.replace(/_/g, ' ')}</span>
                </div>
                <p className="text-xs text-gray-500">
                  {s.full_name ?? '—'} · {s.phone ?? '—'} · {new Date(s.created_at).toLocaleDateString()}
                </p>
                {s.account_risk_level && (
                  <p className="text-xs text-gray-400 mt-0.5">Risk level: {s.account_risk_level}</p>
                )}
              </div>
              <button
                onClick={() => setResolvingSignal(s)}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-green-50 text-green-700 hover:bg-green-100 rounded-md flex-shrink-0"
              >
                <CheckCircle2 size={13} /> Resolve
              </button>
            </div>
          ))}
        </div>
      ) : tab === 'high_disputes' ? (
        <div className="space-y-2">
          {data.high_dispute_cooks.length === 0 ? (
            <div className="py-20 text-center text-sm text-gray-400">No high-dispute cooks in last 30 days.</div>
          ) : (
            <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Cook', 'Disputes (30d)', 'Reliability score', 'Rating'].map(h => (
                      <th key={h} className="text-left text-xs font-medium text-gray-500 px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.high_dispute_cooks.map(c => (
                    <tr key={c.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-medium text-gray-900">{c.display_name}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-red-600 font-semibold">
                          <AlertTriangle size={13} /> {c.dispute_count}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{c.reliability_score ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{c.average_rating?.toFixed(1) ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data.large_orders.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Large orders (last 7 days, &gt;₦500k)</h3>
              <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      {['Customer', 'Cook', 'Amount', 'Status', 'Date'].map(h => (
                        <th key={h} className="text-left text-xs font-medium text-gray-500 px-4 py-3">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.large_orders.map(o => (
                      <tr key={o.id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3 text-gray-700">{o.customer_name}</td>
                        <td className="px-4 py-3 text-gray-700">{o.cook_name}</td>
                        <td className="px-4 py-3 font-semibold text-gray-900">{fmt(o.total_amount)}</td>
                        <td className="px-4 py-3 text-gray-500 capitalize">{o.status.replace(/_/g, ' ')}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs">{new Date(o.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : tab === 'velocity' ? (
        <div className="space-y-4">
          {data.velocity_breaches.length === 0 && data.payout_abuse.length === 0 && data.duplicate_accounts.length === 0 ? (
            <div className="py-20 text-center text-sm text-gray-400">No velocity anomalies detected.</div>
          ) : null}

          {data.velocity_breaches.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Customers — 5+ orders in 24h</h3>
              <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      {['Customer', 'Phone', 'Orders', 'Total spent'].map(h => (
                        <th key={h} className="text-left text-xs font-medium text-gray-500 px-4 py-3">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.velocity_breaches.map(v => (
                      <tr key={v.id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3 font-medium text-gray-900">{v.full_name}</td>
                        <td className="px-4 py-3 text-gray-500">{v.phone}</td>
                        <td className="px-4 py-3 font-semibold text-orange-600">{v.order_count}</td>
                        <td className="px-4 py-3 text-gray-700">{fmt(v.total_spent)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {data.payout_abuse.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Payout abuse — 3+ payouts in 7 days</h3>
              <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      {['Cook', 'Payout count', 'Total withdrawn', 'Last payout'].map(h => (
                        <th key={h} className="text-left text-xs font-medium text-gray-500 px-4 py-3">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.payout_abuse.map((p, i) => (
                      <tr key={i} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3 font-medium text-gray-900">{p.display_name}</td>
                        <td className="px-4 py-3 font-semibold text-orange-600">{p.payout_count}</td>
                        <td className="px-4 py-3 text-gray-700">{fmt(p.total_withdrawn)}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs">{new Date(p.last_payout).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {data.duplicate_accounts.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Possible duplicate accounts</h3>
              <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      {['Phone prefix', 'Accounts', 'Names'].map(h => (
                        <th key={h} className="text-left text-xs font-medium text-gray-500 px-4 py-3">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.duplicate_accounts.map((d, i) => (
                      <tr key={i} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3 font-mono text-gray-700">{d.phone_base}</td>
                        <td className="px-4 py-3 font-semibold text-orange-600">{d.account_count}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{d.names.join(', ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div>
          {data.high_risk_users.length === 0 ? (
            <div className="py-20 text-center text-sm text-gray-400">No high-risk users.</div>
          ) : (
            <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['User', 'Phone', 'Risk level', 'Fraud flagged', 'Actions'].map(h => (
                      <th key={h} className="text-left text-xs font-medium text-gray-500 px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.high_risk_users.map(u => (
                    <tr key={u.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-medium text-gray-900">{u.full_name}</td>
                      <td className="px-4 py-3 text-gray-500">{u.phone}</td>
                      <td className="px-4 py-3"><RiskBadge level={u.account_risk_level} /></td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium ${u.fraud_flagged ? 'text-red-600' : 'text-gray-400'}`}>
                          {u.fraud_flagged ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value=""
                          onChange={e => { if (e.target.value) updateRisk(u.id, e.target.value); }}
                          disabled={actioning === u.id}
                          className="text-xs border border-gray-200 rounded-md px-1.5 py-1 bg-white focus:outline-none disabled:opacity-40"
                        >
                          <option value="">Set risk level</option>
                          {['low', 'medium', 'high', 'critical'].filter(l => l !== u.account_risk_level).map(l => (
                            <option key={l} value={l} className="capitalize">{l}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {resolvingSignal && (
        <SignalResolveModal
          signal={resolvingSignal}
          onClose={() => setResolvingSignal(null)}
          onDone={() => { setResolvingSignal(null); load(); }}
        />
      )}
    </div>
  );
}
