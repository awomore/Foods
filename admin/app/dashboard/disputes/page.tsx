'use client';

import { useEffect, useState, useCallback } from 'react';
import { disputesAdminApi, AdminDispute } from '@/lib/api';
import { DataTable, Column } from '@/components/DataTable';
import { Badge, statusVariant } from '@/components/Badge';
import { Pagination } from '@/components/Pagination';
import { AlertTriangle, ChevronsUp, RefreshCw, X } from 'lucide-react';

const LIMIT = 50;
const STATUSES = ['open', 'under_review', 'escalated', 'resolved'];

function fmt(n: number) {
  return `₦${Number(n).toLocaleString()}`;
}

function SlaCountdown({ deadline }: { deadline: string | null }) {
  if (!deadline) return <span className="text-xs text-gray-400">—</span>;
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return <span className="text-xs text-red-500 font-medium">Overdue</span>;
  const hours = Math.floor(diff / 3_600_000);
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  const urgent = hours < 4;
  return (
    <span className={`text-xs font-medium ${urgent ? 'text-orange-500' : 'text-gray-500'}`}>
      {hours}h {mins}m
    </span>
  );
}

interface ResolveModalProps {
  dispute: AdminDispute;
  onClose: () => void;
  onDone: () => void;
}

function ResolveModal({ dispute, onClose, onDone }: ResolveModalProps) {
  const [resolution, setResolution] = useState('');
  const [resolutionType, setResolutionType] = useState('no_refund');
  const [refundAmount, setRefundAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function submit() {
    if (!resolution.trim()) { setErr('Resolution notes required'); return; }
    setSaving(true);
    setErr('');
    try {
      await disputesAdminApi.resolve(dispute.id, {
        resolution: resolution.trim(),
        resolution_type: resolutionType,
        refund_amount: resolutionType === 'partial_refund' ? Number(refundAmount) : undefined,
      });
      onDone();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Resolve dispute</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {dispute.customer_name} vs {dispute.cook_name} · {fmt(dispute.order_total)}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Reason raised</label>
            <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{dispute.reason}</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Resolution type</label>
            <select
              value={resolutionType}
              onChange={e => setResolutionType(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/30"
            >
              <option value="no_refund">No refund — dismiss</option>
              <option value="full_refund">Full refund to customer</option>
              <option value="partial_refund">Partial refund</option>
            </select>
          </div>

          {resolutionType === 'partial_refund' && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Refund amount (₦)</label>
              <input
                type="number"
                value={refundAmount}
                onChange={e => setRefundAmount(e.target.value)}
                placeholder={`Max ${fmt(dispute.order_total)}`}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Resolution notes</label>
            <textarea
              value={resolution}
              onChange={e => setResolution(e.target.value)}
              rows={3}
              placeholder="Describe what was found and how it was resolved…"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/30 resize-none"
            />
          </div>

          {err && <p className="text-xs text-red-500">{err}</p>}

          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={saving}
              className="flex-1 px-4 py-2 text-sm font-medium bg-brand text-white rounded-lg hover:bg-brand/90 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Resolve'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DisputesPage() {
  const [disputes, setDisputes] = useState<AdminDispute[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('open');
  const [offset, setOffset] = useState(0);
  const [resolving, setResolving] = useState<AdminDispute | null>(null);
  const [actioning, setActioning] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await disputesAdminApi.list(status || undefined, LIMIT, offset);
      setDisputes(res.disputes);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }, [status, offset]);

  useEffect(() => { load(); }, [load]);

  async function handleEscalate(d: AdminDispute) {
    setActioning(d.id);
    try { await disputesAdminApi.escalate(d.id); load(); }
    finally { setActioning(null); }
  }

  const columns: Column<AdminDispute>[] = [
    {
      key: 'parties',
      header: 'Parties',
      render: r => (
        <div>
          <p className="text-sm font-medium text-gray-900">{r.customer_name}</p>
          <p className="text-xs text-gray-400">vs {r.cook_name}</p>
        </div>
      ),
    },
    {
      key: 'reason',
      header: 'Reason',
      render: r => (
        <p className="text-sm text-gray-700 max-w-xs truncate" title={r.reason}>{r.reason}</p>
      ),
    },
    {
      key: 'amount',
      header: 'Order value',
      render: r => <span className="text-sm font-medium">{fmt(r.order_total)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: r => <Badge label={r.status.replace(/_/g, ' ')} variant={statusVariant(r.status)} />,
    },
    {
      key: 'sla',
      header: 'SLA',
      render: r => <SlaCountdown deadline={r.sla_deadline} />,
    },
    {
      key: 'date',
      header: 'Opened',
      render: r => <span className="text-xs text-gray-400">{new Date(r.created_at).toLocaleDateString()}</span>,
    },
    {
      key: 'actions',
      header: '',
      render: r => r.status !== 'resolved' ? (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setResolving(r)}
            className="px-2.5 py-1.5 text-xs font-medium bg-green-50 text-green-700 hover:bg-green-100 rounded-md transition-colors"
          >
            Resolve
          </button>
          {r.status !== 'escalated' && (
            <button
              onClick={() => handleEscalate(r)}
              disabled={actioning === r.id}
              title="Escalate"
              className="p-1.5 text-orange-500 hover:bg-orange-50 rounded-md transition-colors disabled:opacity-40"
            >
              <ChevronsUp size={14} />
            </button>
          )}
        </div>
      ) : null,
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <AlertTriangle size={20} className="text-orange-500" />
            Disputes
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{total.toLocaleString()} {status || 'total'}</p>
        </div>
        <button onClick={load} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {(['open', 'under_review', 'escalated', 'resolved', ''] as const).map(s => (
          <button
            key={s || 'all'}
            onClick={() => { setStatus(s); setOffset(0); }}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${
              status === s ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {s ? s.replace(/_/g, ' ') : 'All'}
          </button>
        ))}
      </div>

      <DataTable columns={columns} rows={disputes} loading={loading} empty="No disputes found." />
      <Pagination offset={offset} limit={LIMIT} total={total} onChange={setOffset} />

      {resolving && (
        <ResolveModal
          dispute={resolving}
          onClose={() => setResolving(null)}
          onDone={() => { setResolving(null); load(); }}
        />
      )}
    </div>
  );
}
