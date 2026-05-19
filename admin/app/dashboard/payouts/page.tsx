'use client';

import { useEffect, useState, useCallback } from 'react';
import { payoutsApi, Payout } from '@/lib/api';
import { DataTable, Column } from '@/components/DataTable';
import { Badge, statusVariant } from '@/components/Badge';
import { Pagination } from '@/components/Pagination';
import { Check, Loader2 } from 'lucide-react';

const LIMIT = 50;

function fmt(n: number) {
  return `₦${Number(n).toLocaleString()}`;
}

export default function PayoutsPage() {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [total, setTotal] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'pending' | 'completed'>('pending');
  const [offset, setOffset] = useState(0);
  const [processing, setProcessing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await payoutsApi.list(tab, LIMIT, offset);
      setPayouts(res.payouts);
      setTotal(res.total);
      setTotalAmount(res.total_amount);
    } finally {
      setLoading(false);
    }
  }, [tab, offset]);

  useEffect(() => { load(); }, [load]);

  async function handleProcess(payout: Payout) {
    const ref = window.prompt('Enter bank reference (optional):') ?? undefined;
    setProcessing(payout.id);
    try {
      await payoutsApi.process(payout.id, ref);
      load();
    } finally {
      setProcessing(null);
    }
  }

  const columns: Column<Payout>[] = [
    {
      key: 'cook',
      header: 'Cook',
      render: r => (
        <div>
          <p className="font-medium text-gray-900">{r.cook_name}</p>
          <p className="text-xs text-gray-400">@{r.cook_username} · {r.cook_phone}</p>
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      render: r => (
        <span className="font-semibold text-gray-900">
          {r.currency_code} {Number(r.amount).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: r => <Badge label={r.status} variant={statusVariant(r.status)} />,
    },
    {
      key: 'ref',
      header: 'Bank Ref',
      render: r => <span className="text-xs font-mono text-gray-500">{r.bank_reference ?? '—'}</span>,
    },
    {
      key: 'date',
      header: 'Requested',
      render: r => <span className="text-xs text-gray-400">{new Date(r.created_at).toLocaleDateString()}</span>,
    },
    {
      key: 'processed',
      header: 'Processed',
      render: r => (
        <span className="text-xs text-gray-400">
          {r.processed_at ? new Date(r.processed_at).toLocaleDateString() : '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: r => tab === 'pending' ? (
        <button
          onClick={() => handleProcess(r)}
          disabled={processing === r.id}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-50 text-green-700 hover:bg-green-100 rounded-lg transition-colors disabled:opacity-50"
        >
          {processing === r.id
            ? <Loader2 size={13} className="animate-spin" />
            : <Check size={13} />}
          Mark paid
        </button>
      ) : null,
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Payouts</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {total.toLocaleString()} {tab} · Total: {fmt(totalAmount)}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {(['pending', 'completed'] as const).map(t => (
          <button
            key={t}
            onClick={() => { setTab(t); setOffset(0); }}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors capitalize ${
              tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <DataTable columns={columns} rows={payouts} loading={loading} empty={`No ${tab} payouts.`} />
      <Pagination offset={offset} limit={LIMIT} total={total} onChange={setOffset} />
    </div>
  );
}
