'use client';

import { useEffect, useState, useCallback } from 'react';
import { ordersAdminApi, AdminOrder } from '@/lib/api';
import { DataTable, Column } from '@/components/DataTable';
import { Badge, statusVariant } from '@/components/Badge';
import { SearchBar } from '@/components/SearchBar';
import { Pagination } from '@/components/Pagination';
import { RotateCcw, RefreshCw } from 'lucide-react';

const LIMIT = 50;

const ALL_STATUSES = [
  'pending_payment','paid','confirmed','preparing','ready',
  'rider_assigned','picked_up','in_transit','delivered','cancelled','refunded',
];

function fmt(n: number) {
  return `₦${Number(n).toLocaleString()}`;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [offset, setOffset] = useState(0);
  const [actioning, setActioning] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ordersAdminApi.list({ q: q || undefined, status: status || undefined, limit: LIMIT, offset });
      setOrders(res.orders);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }, [q, status, offset]);

  useEffect(() => { load(); }, [load]);

  async function handleRefund(order: AdminOrder) {
    if (!window.confirm(`Refund order ${order.id.slice(0, 8)}? This cannot be undone.`)) return;
    const reason = window.prompt('Reason for refund:') ?? 'Admin refund';
    setActioning(order.id);
    try {
      await ordersAdminApi.refund(order.id, reason);
      load();
    } finally {
      setActioning(null);
    }
  }

  async function handleStatusChange(order: AdminOrder, newStatus: string) {
    setActioning(order.id);
    try {
      await ordersAdminApi.setStatus(order.id, newStatus);
      load();
    } finally {
      setActioning(null);
    }
  }

  const columns: Column<AdminOrder>[] = [
    {
      key: 'id',
      header: 'Order',
      render: r => (
        <div>
          <p className="font-mono text-xs text-gray-500">{r.id.slice(0, 8)}</p>
          <p className="text-sm font-medium text-gray-900 mt-0.5">{r.item_title || '—'}</p>
        </div>
      ),
    },
    {
      key: 'parties',
      header: 'Cook / Customer',
      render: r => (
        <div>
          <p className="text-sm text-gray-700">{r.cook_name}</p>
          <p className="text-xs text-gray-400">{r.customer_name} · {r.customer_phone}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: r => <Badge label={r.status.replace(/_/g, ' ')} variant={statusVariant(r.status)} />,
    },
    {
      key: 'amount',
      header: 'Amount',
      render: r => (
        <div>
          <p className="text-sm font-medium">{fmt(r.total_amount)}</p>
          <p className="text-xs text-gray-400">Fee: {fmt(r.platform_fee)}</p>
        </div>
      ),
    },
    {
      key: 'date',
      header: 'Date',
      render: r => (
        <span className="text-xs text-gray-400 whitespace-nowrap">
          {new Date(r.created_at).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: r => (
        <div className="flex items-center gap-1">
          <select
            value=""
            onChange={e => { if (e.target.value) handleStatusChange(r, e.target.value); }}
            disabled={actioning === r.id}
            className="text-xs border border-gray-200 rounded-md px-1.5 py-1 bg-white focus:outline-none"
          >
            <option value="">Set status</option>
            {ALL_STATUSES.filter(s => s !== r.status).map(s => (
              <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
            ))}
          </select>
          {r.status !== 'refunded' && r.status !== 'cancelled' && (
            <button
              onClick={() => handleRefund(r)}
              disabled={actioning === r.id}
              title="Refund"
              className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors disabled:opacity-40"
            >
              <RotateCcw size={14} />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Orders</h1>
        <p className="text-sm text-gray-500 mt-0.5">{total.toLocaleString()} total</p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <SearchBar value={q} onChange={v => { setQ(v); setOffset(0); }} placeholder="Search orders…" />
        <select
          value={status}
          onChange={e => { setStatus(e.target.value); setOffset(0); }}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none"
        >
          <option value="">All statuses</option>
          {ALL_STATUSES.map(s => (
            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <button onClick={load} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <DataTable columns={columns} rows={orders} loading={loading} empty="No orders found." />
      <Pagination offset={offset} limit={LIMIT} total={total} onChange={setOffset} />
    </div>
  );
}
