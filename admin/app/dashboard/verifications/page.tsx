'use client';

import { useEffect, useState, useCallback } from 'react';
import { verificationsAdminApi, VerificationSubmission } from '@/lib/api';
import { DataTable, Column } from '@/components/DataTable';
import { Badge, statusVariant } from '@/components/Badge';
import { Pagination } from '@/components/Pagination';
import { BadgeCheck, RefreshCw, CheckCircle2, XCircle, ExternalLink } from 'lucide-react';

const LIMIT = 50;

export default function VerificationsPage() {
  const [submissions, setSubmissions] = useState<VerificationSubmission[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('pending');
  const [offset, setOffset] = useState(0);
  const [actioning, setActioning] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await verificationsAdminApi.list(status, LIMIT, offset);
      setSubmissions(res.submissions);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }, [status, offset]);

  useEffect(() => { load(); }, [load]);

  async function handleApprove(s: VerificationSubmission) {
    const notes = window.prompt('Approval notes (optional):') ?? undefined;
    const expires = window.prompt('Expiry date YYYY-MM-DD (optional):') ?? undefined;
    setActioning(s.id);
    try {
      await verificationsAdminApi.approve(s.id, notes || undefined, expires || undefined);
      load();
    } finally {
      setActioning(null);
    }
  }

  async function handleReject(s: VerificationSubmission) {
    const notes = window.prompt('Rejection reason (required):');
    if (!notes) return;
    setActioning(s.id);
    try {
      await verificationsAdminApi.reject(s.id, notes);
      load();
    } finally {
      setActioning(null);
    }
  }

  const columns: Column<VerificationSubmission>[] = [
    {
      key: 'cook',
      header: 'Cook',
      render: r => (
        <div className="flex items-center gap-3">
          {r.cook_avatar && (
            <img src={r.cook_avatar} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
          )}
          <div>
            <p className="text-sm font-medium text-gray-900">{r.cook_name}</p>
            <p className="text-xs text-gray-400">{r.phone}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Document type',
      render: r => (
        <span className="text-sm text-gray-700 capitalize">{r.document_type.replace(/_/g, ' ')}</span>
      ),
    },
    {
      key: 'document',
      header: 'Document',
      render: r => r.document_url ? (
        <a
          href={r.document_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-brand hover:underline"
        >
          View <ExternalLink size={11} />
        </a>
      ) : <span className="text-xs text-gray-400">No file</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: r => <Badge label={r.status} variant={statusVariant(r.status)} />,
    },
    {
      key: 'submitted',
      header: 'Submitted',
      render: r => <span className="text-xs text-gray-400">{new Date(r.submitted_at).toLocaleDateString()}</span>,
    },
    {
      key: 'expires',
      header: 'Expires',
      render: r => (
        <span className="text-xs text-gray-400">
          {r.expires_at ? new Date(r.expires_at).toLocaleDateString() : '—'}
        </span>
      ),
    },
    {
      key: 'notes',
      header: 'Notes',
      render: r => (
        <span className="text-xs text-gray-500 max-w-xs truncate block" title={r.review_notes ?? ''}>
          {r.review_notes ?? '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: r => status === 'pending' ? (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => handleApprove(r)}
            disabled={actioning === r.id}
            title="Approve"
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-green-50 text-green-700 hover:bg-green-100 rounded-md transition-colors disabled:opacity-40"
          >
            <CheckCircle2 size={13} /> Approve
          </button>
          <button
            onClick={() => handleReject(r)}
            disabled={actioning === r.id}
            title="Reject"
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 rounded-md transition-colors disabled:opacity-40"
          >
            <XCircle size={13} /> Reject
          </button>
        </div>
      ) : null,
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <BadgeCheck size={20} className="text-brand" />
            Verifications
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{total.toLocaleString()} {status}</p>
        </div>
        <button onClick={load} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {(['pending', 'approved', 'rejected'] as const).map(s => (
          <button
            key={s}
            onClick={() => { setStatus(s); setOffset(0); }}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${
              status === s ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <DataTable
        columns={columns}
        rows={submissions}
        loading={loading}
        empty={`No ${status} verification submissions.`}
      />
      <Pagination offset={offset} limit={LIMIT} total={total} onChange={setOffset} />
    </div>
  );
}
