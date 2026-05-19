'use client';

import { useEffect, useState, useCallback } from 'react';
import { customersApi, AdminCustomer } from '@/lib/api';
import { DataTable, Column } from '@/components/DataTable';
import { Badge } from '@/components/Badge';
import { SearchBar } from '@/components/SearchBar';
import { Pagination } from '@/components/Pagination';
import { ShieldOff, ShieldCheck } from 'lucide-react';

const LIMIT = 50;

export default function CustomersPage() {
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [offset, setOffset] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await customersApi.list({ q: q || undefined, limit: LIMIT, offset });
      setCustomers(res.customers);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }, [q, offset]);

  useEffect(() => { load(); }, [load]);

  async function toggleSuspend(c: AdminCustomer) {
    await customersApi.suspend(c.id, c.is_active);
    load();
  }

  const columns: Column<AdminCustomer>[] = [
    {
      key: 'name',
      header: 'Customer',
      render: r => (
        <div>
          <p className="font-medium text-gray-900">{r.full_name || '—'}</p>
          <p className="text-xs text-gray-400">{r.phone}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: r => <Badge label={r.is_active ? 'Active' : 'Suspended'} variant={r.is_active ? 'green' : 'red'} />,
    },
    {
      key: 'orders',
      header: 'Orders',
      render: r => <span className="text-sm font-medium">{Number(r.total_orders).toLocaleString()}</span>,
    },
    {
      key: 'spent',
      header: 'Total spent',
      render: r => <span className="text-sm">₦{Number(r.total_spent).toLocaleString()}</span>,
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
        <button
          onClick={() => toggleSuspend(r)}
          title={r.is_active ? 'Suspend' : 'Reinstate'}
          className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-md transition-colors"
        >
          {r.is_active ? <ShieldOff size={15} /> : <ShieldCheck size={15} />}
        </button>
      ),
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Customers</h1>
        <p className="text-sm text-gray-500 mt-0.5">{total.toLocaleString()} total</p>
      </div>

      <SearchBar value={q} onChange={v => { setQ(v); setOffset(0); }} placeholder="Search customers…" />

      <DataTable columns={columns} rows={customers} loading={loading} empty="No customers found." />
      <Pagination offset={offset} limit={LIMIT} total={total} onChange={setOffset} />
    </div>
  );
}
