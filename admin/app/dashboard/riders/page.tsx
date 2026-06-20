'use client';

import { useEffect, useState, useCallback } from 'react';
import { ridersAdminApi, FleetOperator, RiderProfile } from '@/lib/api';
import { Badge, statusVariant } from '@/components/Badge';
import { Truck, RefreshCw, CheckCircle2, XCircle, ShieldOff } from 'lucide-react';

type Tab = 'operators' | 'riders';

function ActionButtons({
  id,
  status,
  actioning,
  onReview,
}: {
  id: string;
  status: string;
  actioning: string | null;
  onReview: (id: string, status: string, reason?: string) => void;
}) {
  const isPending = status === 'pending';
  const isSuspended = status === 'suspended';

  return (
    <div className="flex items-center gap-1.5 flex-shrink-0">
      {(isPending || isSuspended) && (
        <button
          onClick={() => onReview(id, 'approved')}
          disabled={actioning === id}
          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-green-50 text-green-700 hover:bg-green-100 rounded-md disabled:opacity-40"
        >
          <CheckCircle2 size={13} /> Approve
        </button>
      )}
      {isPending && (
        <button
          onClick={() => {
            const reason = window.prompt('Rejection reason:');
            if (reason !== null) onReview(id, 'rejected', reason || undefined);
          }}
          disabled={actioning === id}
          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 rounded-md disabled:opacity-40"
        >
          <XCircle size={13} /> Reject
        </button>
      )}
      {status === 'approved' && (
        <button
          onClick={() => {
            const reason = window.prompt('Suspension reason (optional):') ?? undefined;
            onReview(id, 'suspended', reason || undefined);
          }}
          disabled={actioning === id}
          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-gray-50 text-gray-600 hover:bg-gray-100 rounded-md disabled:opacity-40"
        >
          <ShieldOff size={13} /> Suspend
        </button>
      )}
    </div>
  );
}

export default function RidersPage() {
  const [tab, setTab] = useState<Tab>('operators');
  const [operators, setOperators] = useState<FleetOperator[]>([]);
  const [riders, setRiders] = useState<RiderProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [actioning, setActioning] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'operators') {
        const res = await ridersAdminApi.listOperators(filterStatus || undefined);
        setOperators(res.fleet_operators);
      } else {
        const res = await ridersAdminApi.listRiders(filterStatus || undefined);
        setRiders(res.riders);
      }
    } finally {
      setLoading(false);
    }
  }, [tab, filterStatus]);

  useEffect(() => { load(); }, [load]);

  async function reviewOperator(id: string, status: string, reason?: string) {
    setActioning(id);
    try { await ridersAdminApi.reviewOperator(id, status, reason); load(); }
    finally { setActioning(null); }
  }

  async function reviewRider(id: string, status: string, reason?: string) {
    setActioning(id);
    try { await ridersAdminApi.reviewRider(id, status, reason); load(); }
    finally { setActioning(null); }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Truck size={20} className="text-brand" />
            Riders / Fleet
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {tab === 'operators' ? `${operators.length} fleet operators` : `${riders.length} riders`}
          </p>
        </div>
        <button onClick={load} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {(['operators', 'riders'] as const).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setFilterStatus(''); }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${
                tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'operators' ? 'Fleet operators' : 'Individual riders'}
            </button>
          ))}
        </div>
        <select
          value={filterStatus}
          onChange={e => { setFilterStatus(e.target.value); }}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      {loading ? (
        <div className="py-20 text-center text-sm text-gray-400">Loading…</div>
      ) : tab === 'operators' ? (
        operators.length === 0 ? (
          <div className="py-20 text-center text-sm text-gray-400">No fleet operators found.</div>
        ) : (
          <div className="space-y-2">
            {operators.map(op => (
              <div key={op.id} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className="text-sm font-semibold text-gray-900">{op.business_name}</p>
                    <span className="text-xs text-gray-400 capitalize">{op.business_type}</span>
                    <Badge label={op.status} variant={statusVariant(op.status)} />
                  </div>
                  <p className="text-xs text-gray-500">
                    {op.applicant_name}
                    {op.applicant_email ? ` · ${op.applicant_email}` : ''}
                    {' '}· {op.rider_count} rider{op.rider_count !== 1 ? 's' : ''}
                  </p>
                  {op.rejection_reason && (
                    <p className="text-xs text-red-500 mt-0.5">Reason: {op.rejection_reason}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-0.5">
                    Applied {new Date(op.created_at).toLocaleDateString()}
                    {op.approved_at ? ` · Approved ${new Date(op.approved_at).toLocaleDateString()}` : ''}
                  </p>
                </div>
                <ActionButtons
                  id={op.id}
                  status={op.status}
                  actioning={actioning}
                  onReview={reviewOperator}
                />
              </div>
            ))}
          </div>
        )
      ) : (
        riders.length === 0 ? (
          <div className="py-20 text-center text-sm text-gray-400">No riders found.</div>
        ) : (
          <div className="space-y-2">
            {riders.map(r => (
              <div key={r.id} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className="text-sm font-semibold text-gray-900">{r.applicant_name}</p>
                    <span className="text-xs text-gray-500 capitalize bg-gray-100 px-2 py-0.5 rounded">
                      {r.vehicle_type}
                    </span>
                    <Badge label={r.status} variant={statusVariant(r.status)} />
                  </div>
                  <p className="text-xs text-gray-500">
                    {r.applicant_email ?? '—'}
                    {r.fleet_name ? ` · Fleet: ${r.fleet_name}` : ' · Independent'}
                  </p>
                  {r.rejection_reason && (
                    <p className="text-xs text-red-500 mt-0.5">Reason: {r.rejection_reason}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-0.5">
                    Applied {new Date(r.created_at).toLocaleDateString()}
                  </p>
                </div>
                <ActionButtons
                  id={r.id}
                  status={r.status}
                  actioning={actioning}
                  onReview={reviewRider}
                />
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
