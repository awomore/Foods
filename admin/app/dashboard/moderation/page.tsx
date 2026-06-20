'use client';

import { useEffect, useState, useCallback } from 'react';
import { moderationAdminApi, FlaggedReview, ReportedPost } from '@/lib/api';
import { Flag, RefreshCw, Star, CheckCheck, Trash2 } from 'lucide-react';

export default function ModerationPage() {
  const [reviews, setReviews] = useState<FlaggedReview[]>([]);
  const [posts, setPosts] = useState<ReportedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'reviews' | 'posts'>('reviews');
  const [actioning, setActioning] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await moderationAdminApi.list();
      setReviews(res.flagged_reviews);
      setPosts(res.reported_posts ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function dismissReview(id: string) {
    setActioning(id);
    try { await moderationAdminApi.dismissReview(id); load(); }
    finally { setActioning(null); }
  }

  async function deleteReview(id: string) {
    if (!window.confirm('Permanently delete this review?')) return;
    setActioning(id);
    try { await moderationAdminApi.deleteReview(id); load(); }
    finally { setActioning(null); }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Flag size={20} className="text-red-500" />
            Moderation
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {reviews.length} flagged review{reviews.length !== 1 ? 's' : ''} · {posts.length} reported post{posts.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={load} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {(['reviews', 'posts'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${
              tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'reviews' ? `Reviews (${reviews.length})` : `Posts (${posts.length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-20 text-center text-sm text-gray-400">Loading…</div>
      ) : tab === 'reviews' ? (
        reviews.length === 0 ? (
          <div className="py-20 text-center text-sm text-gray-400">No flagged reviews.</div>
        ) : (
          <div className="space-y-3">
            {reviews.map(r => (
              <div key={r.id} className="bg-white border border-red-100 rounded-xl p-4 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            size={13}
                            className={i < r.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'}
                          />
                        ))}
                      </div>
                      <span className="text-xs text-gray-500">
                        for <span className="font-medium">{r.cook_name}</span>
                        {' '}by {r.reporter_name}
                      </span>
                    </div>
                    {r.comment && (
                      <p className="text-sm text-gray-700 mb-2">"{r.comment}"</p>
                    )}
                    {r.report_reason && (
                      <p className="text-xs text-red-600 bg-red-50 inline-block px-2 py-0.5 rounded">
                        Flagged: {r.report_reason}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(r.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => dismissReview(r.id)}
                      disabled={actioning === r.id}
                      title="Dismiss flag (keep review)"
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-gray-50 text-gray-600 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-40"
                    >
                      <CheckCheck size={13} /> Dismiss
                    </button>
                    <button
                      onClick={() => deleteReview(r.id)}
                      disabled={actioning === r.id}
                      title="Delete review permanently"
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 rounded-md transition-colors disabled:opacity-40"
                    >
                      <Trash2 size={13} /> Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        posts.length === 0 ? (
          <div className="py-20 text-center text-sm text-gray-400">No reported posts.</div>
        ) : (
          <div className="space-y-3">
            {posts.map(p => (
              <div key={p.id} className="bg-white border border-orange-100 rounded-xl p-4 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-orange-600 bg-orange-50 px-2 py-0.5 rounded capitalize">
                        {p.post_type.replace(/_/g, ' ')}
                      </span>
                      <span className="text-xs text-gray-500">by {p.cook_name}</span>
                    </div>
                    {p.body && (
                      <p className="text-sm text-gray-700 line-clamp-3">"{p.body}"</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(p.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
