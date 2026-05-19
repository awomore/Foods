'use client';

import { useEffect, useState } from 'react';
import { cooksAdminApi, AdminCookDetail, CookStats, Payout, OrderSummary } from '@/lib/api';
import { Badge, statusVariant } from '@/components/Badge';
import { X, Star, CheckCircle2, XCircle } from 'lucide-react';

function fmt(n: number) {
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `₦${(n / 1_000).toFixed(1)}K`;
  return `₦${n}`;
}

export default function CookDetailModal({ cookId, onClose }: { cookId: string; onClose: () => void }) {
  const [data, setData] = useState<{
    cook: AdminCookDetail;
    stats: CookStats;
    recent_payouts: Payout[];
    recent_orders: OrderSummary[];
  } | null>(null);

  useEffect(() => {
    cooksAdminApi.get(cookId).then(setData);
  }, [cookId]);

  if (!data) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8 text-gray-400">Loading…</div>
      </div>
    );
  }

  const { cook, stats, recent_payouts, recent_orders } = data;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-900">{cook.display_name}</h2>
            <p className="text-xs text-gray-400">@{cook.username}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Status row */}
          <div className="flex flex-wrap gap-2">
            <Badge label={cook.is_active ? 'Active' : 'Suspended'} variant={cook.is_active ? 'green' : 'red'} />
            <Badge label={cook.verification_status} variant={statusVariant(cook.verification_status)} />
            {cook.is_live && <Badge label="Live" variant="green" />}
          </div>

          {/* Verifications */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 text-sm">
              {cook.food_safety_verified
                ? <CheckCircle2 size={16} className="text-green-500" />
                : <XCircle size={16} className="text-gray-300" />}
              Food safety cert
            </div>
            <div className="flex items-center gap-2 text-sm">
              {cook.id_verified
                ? <CheckCircle2 size={16} className="text-green-500" />
                : <XCircle size={16} className="text-gray-300" />}
              ID verified
            </div>
          </div>

          {/* Contact */}
          <div className="text-sm space-y-1 text-gray-600">
            <p><span className="text-gray-400">Phone:</span> {cook.phone}</p>
            {cook.email && <p><span className="text-gray-400">Email:</span> {cook.email}</p>}
            <p><span className="text-gray-400">Location:</span> {cook.location ?? '—'}</p>
            <p><span className="text-gray-400">Joined:</span> {new Date(cook.joined_at).toLocaleDateString()}</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-lg font-semibold text-gray-900">{stats.total_orders}</p>
              <p className="text-xs text-gray-400">Orders</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-lg font-semibold text-gray-900">{fmt(stats.total_earned)}</p>
              <p className="text-xs text-gray-400">Earned</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <div className="flex items-center justify-center gap-1">
                <Star size={13} className="text-yellow-400 fill-yellow-400" />
                <p className="text-lg font-semibold text-gray-900">{cook.average_rating?.toFixed(1) ?? '—'}</p>
              </div>
              <p className="text-xs text-gray-400">Rating</p>
            </div>
          </div>

          {/* Recent orders */}
          {recent_orders.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Recent orders</h3>
              <div className="space-y-1.5">
                {recent_orders.map(o => (
                  <div key={o.id} className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-2">
                    <span className="text-gray-500 font-mono text-xs">{o.id.slice(0, 8)}</span>
                    <Badge label={o.status} variant={statusVariant(o.status)} />
                    <span className="font-medium">₦{o.total_amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent payouts */}
          {recent_payouts.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Recent payouts</h3>
              <div className="space-y-1.5">
                {recent_payouts.map(p => (
                  <div key={p.id} className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-2">
                    <span className="text-xs text-gray-400">{new Date(p.created_at).toLocaleDateString()}</span>
                    <Badge label={p.status} variant={statusVariant(p.status)} />
                    <span className="font-medium">{p.currency_code} {Number(p.amount).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
