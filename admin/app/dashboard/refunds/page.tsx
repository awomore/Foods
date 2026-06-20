'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { DataTable, Column } from '@/components/DataTable';
import { Pagination } from '@/components/Pagination';
import { RotateCcw, RefreshCw } from 'lucide-react';

const LIMIT = 50;

function fmt(n: number) {
  return `₦${Number(n).toLocaleString()}`;
}

interface Refund {
  dispute_id: string;
  refund_amount: number | null;
  resolution_type: string;
  resolved_at: string;
  order_id: string;
  total_amount: number;
  payment_tx_ref: string | null;
  customer_name: string;
  customer_phone: string;
}

export default function RefundsPage() {
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ refunds: Refund[]; total: number }>(
        `/admin/refunds?limit=${LIMIT}&offset=${offset}`
      );
      setRefunds(res.refunds);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }, [offset]);

  useEffect(() => { load(); }, [load]);

  const columns: Column<Refund>[] = [
    {
      key: 'customer',
      header: 'Customer',
      render: r => (
        <div>
          <p className="font-medium text-gray-900">{r.customer_name}</p>
          <p className="text-xs text-gray-400">{r.customer_phone}</p>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: r => (
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
          r.resolution_type === 'full_refund' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
        }`}>
          {r.resolution_type.replace(/_/g, ' ')}
        </span>
      ),
    },
    {
      key: 'refund',
      header: 'Refund amount',
      render: r => (
        <div>
          <p className="font-semibold text-gray-900">
            {r.resolution_type === 'full_refund' ? fmt(r.total_amount) : fmt(r.refund_amount ?? 0)}
          </p>
          <p className="text-xs text-gray-400">of {fmt(r.total_amount)}</p>
        </div>
      ),
    },
    {
      key: 'ref',
      header: 'Tx ref',
      render: r => (
        <span className="text-xs font-mono text-gray-500">{r.payment_tx_ref ?? '—'}</span>
      ),
    },
    {
      key: 'date',
      header: 'Resolved',
      render: r => (
        <span className="text-xs text-gray-400">{new Date(r.resolved_at).toLocaleDateString()}</span>
      ),
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <RotateCcw size={20} className="text-blue-500" />
            Refunds
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{total.toLocaleString()} resolved</p>
        </div>
        <button onClick={load} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <DataTable columns={columns} rows={refunds} loading={loading} empty="No refunds yet." />
      <Pagination offset={offset} limit={LIMIT} total={total} onChange={setOffset} />
    </div>
  );
}
