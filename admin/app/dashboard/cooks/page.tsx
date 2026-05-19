'use client';

import { useEffect, useState, useCallback } from 'react';
import { cooksAdminApi, AdminCook } from '@/lib/api';
import { DataTable, Column } from '@/components/DataTable';
import { Badge, statusVariant } from '@/components/Badge';
import { SearchBar } from '@/components/SearchBar';
import { Pagination } from '@/components/Pagination';
import { CheckCircle2, XCircle, ShieldCheck, ShieldOff, Star } from 'lucide-react';
import CookDetailModal from './CookDetailModal';

const LIMIT = 50;

export default function CooksPage() {
  const [cooks, setCooks] = useState<AdminCook[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<AdminCook | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { cooks, total } = await cooksAdminApi.list({
        q: q || undefined,
        status: (status as 'active' | 'suspended') || undefined,
        limit: LIMIT,
        offset,
      });
      setCooks(cooks);
      setTotal(total);
    } finally {
      setLoading(false);
    }
  }, [q, status, offset]);

  useEffect(() => { load(); }, [load]);

  async function toggleSuspend(cook: AdminCook) {
    const isSuspended = !cook.is_active;
    const reason = isSuspended
      ? undefined
      : window.prompt('Reason for suspension (optional):') ?? undefined;
    await cooksAdminApi.suspend(cook.id, !isSuspended, reason);
    load();
  }

  async function verify(cook: AdminCook) {
    await cooksAdminApi.verify(cook.id, {
      food_safety_verified: true,
      id_verified: true,
      verification_status: 'verified',
    });
    load();
  }

  const columns: Column<AdminCook>[] = [
    {
      key: 'name',
      header: 'Cook',
      render: r => (
        <div>
          <p className="font-medium text-gray-900">{r.display_name}</p>
          <p className="text-xs text-gray-400">@{r.username} · {r.phone}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: r => (
        <div className="flex flex-col gap-1">
          <Badge label={r.is_active ? 'Active' : 'Suspended'} variant={r.is_active ? 'green' : 'red'} />
          <Badge label={r.verification_status} variant={statusVariant(r.verification_status)} />
        </div>
      ),
    },
    {
      key: 'verified',
      header: 'Verified',
      render: r => (
        <div className="flex gap-2">
          <span title="Food safety">
            {r.food_safety_verified
              ? <CheckCircle2 size={16} className="text-green-500" />
              : <XCircle size={16} className="text-gray-300" />}
          </span>
          <span title="ID verified">
            {r.id_verified
              ? <CheckCircle2 size={16} className="text-green-500" />
              : <XCircle size={16} className="text-gray-300" />}
          </span>
        </div>
      ),
    },
    {
      key: 'rating',
      header: 'Rating',
      render: r => (
        <div className="flex items-center gap-1">
          <Star size={13} className="text-yellow-400 fill-yellow-400" />
          <span className="text-sm">{r.average_rating?.toFixed(1) ?? '—'}</span>
          <span className="text-xs text-gray-400">({r.total_orders})</span>
        </div>
      ),
    },
    {
      key: 'location',
      header: 'Location',
      render: r => <span className="text-sm text-gray-600">{r.location ?? '—'}</span>,
    },
    {
      key: 'joined',
      header: 'Joined',
      render: r => <span className="text-xs text-gray-400">{new Date(r.created_at).toLocaleDateString()}</span>,
    },
    {
      key: 'actions',
      header: '',
      render: r => (
        <div className="flex items-center gap-2">
          <button
            onClick={e => { e.stopPropagation(); verify(r); }}
            title="Verify cook"
            className="p-1.5 text-green-600 hover:bg-green-50 rounded-md transition-colors"
          >
            <ShieldCheck size={15} />
          </button>
          <button
            onClick={e => { e.stopPropagation(); toggleSuspend(r); }}
            title={r.is_active ? 'Suspend' : 'Reinstate'}
            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-md transition-colors"
          >
            {r.is_active ? <ShieldOff size={15} /> : <ShieldCheck size={15} />}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Cooks</h1>
        <p className="text-sm text-gray-500 mt-0.5">{total.toLocaleString()} total</p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <SearchBar value={q} onChange={v => { setQ(v); setOffset(0); }} placeholder="Search cooks…" />
        <select
          value={status}
          onChange={e => { setStatus(e.target.value); setOffset(0); }}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand/30"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      <DataTable
        columns={columns}
        rows={cooks}
        loading={loading}
        empty="No cooks found."
      />

      <Pagination offset={offset} limit={LIMIT} total={total} onChange={setOffset} />

      {selected && (
        <CookDetailModal
          cookId={selected.id}
          onClose={() => { setSelected(null); load(); }}
        />
      )}
    </div>
  );
}
