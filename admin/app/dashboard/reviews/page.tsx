'use client';

import { useEffect, useState, useCallback } from 'react';
import { reviewsApi, Review } from '@/lib/api';
import { DataTable, Column } from '@/components/DataTable';
import { Badge } from '@/components/Badge';
import { SearchBar } from '@/components/SearchBar';
import { Pagination } from '@/components/Pagination';
import { Flag, Trash2, Star } from 'lucide-react';

const LIMIT = 50;

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [offset, setOffset] = useState(0);
  const [actioning, setActioning] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { reviews } = await reviewsApi.list({
        q: q || undefined,
        flagged: flaggedOnly || undefined,
        limit: LIMIT,
        offset,
      });
      setReviews(reviews);
    } finally {
      setLoading(false);
    }
  }, [q, flaggedOnly, offset]);

  useEffect(() => { load(); }, [load]);

  async function handleFlag(r: Review) {
    setActioning(r.id);
    try {
      await reviewsApi.flag(r.id, !r.is_flagged);
      load();
    } finally {
      setActioning(null);
    }
  }

  async function handleDelete(r: Review) {
    if (!window.confirm('Remove this review? This cannot be undone.')) return;
    setActioning(r.id);
    try {
      await reviewsApi.remove(r.id);
      load();
    } finally {
      setActioning(null);
    }
  }

  const columns: Column<Review>[] = [
    {
      key: 'rating',
      header: 'Rating',
      render: r => (
        <div className="flex items-center gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              size={13}
              className={i < r.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'}
            />
          ))}
        </div>
      ),
    },
    {
      key: 'comment',
      header: 'Comment',
      render: r => (
        <p className="text-sm text-gray-700 max-w-xs truncate">{r.comment || <span className="text-gray-400 italic">No comment</span>}</p>
      ),
    },
    {
      key: 'parties',
      header: 'Customer → Cook',
      render: r => (
        <div>
          <p className="text-sm text-gray-700">{r.customer_name}</p>
          <p className="text-xs text-gray-400">→ {r.cook_name}</p>
        </div>
      ),
    },
    {
      key: 'flag',
      header: 'Flagged',
      render: r => r.is_flagged ? <Badge label="Flagged" variant="red" /> : null,
    },
    {
      key: 'date',
      header: 'Date',
      render: r => <span className="text-xs text-gray-400">{new Date(r.created_at).toLocaleDateString()}</span>,
    },
    {
      key: 'actions',
      header: '',
      render: r => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleFlag(r)}
            disabled={actioning === r.id}
            title={r.is_flagged ? 'Unflag' : 'Flag'}
            className={`p-1.5 rounded-md transition-colors disabled:opacity-40 ${
              r.is_flagged
                ? 'text-red-500 hover:bg-red-50'
                : 'text-gray-400 hover:bg-gray-100'
            }`}
          >
            <Flag size={14} />
          </button>
          <button
            onClick={() => handleDelete(r)}
            disabled={actioning === r.id}
            title="Remove"
            className="p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 rounded-md transition-colors disabled:opacity-40"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Reviews</h1>
        <p className="text-sm text-gray-500 mt-0.5">{reviews.length} shown</p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <SearchBar value={q} onChange={v => { setQ(v); setOffset(0); }} placeholder="Search reviews…" />
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={flaggedOnly}
            onChange={e => { setFlaggedOnly(e.target.checked); setOffset(0); }}
            className="accent-brand"
          />
          Flagged only
        </label>
      </div>

      <DataTable columns={columns} rows={reviews} loading={loading} empty="No reviews found." />
    </div>
  );
}
