'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Settings, RefreshCw } from 'lucide-react';

interface PlatformSettings {
  platform_fee_rate: number;
  min_order_amount: number;
  max_delivery_radius: number;
  dispute_sla_hours: number;
  escrow_hold_days: number;
  max_refund_days: number;
}

function Row({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-start justify-between py-4 border-b border-gray-100 last:border-0">
      <div>
        <p className="text-sm font-medium text-gray-900">{label}</p>
        {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
      </div>
      <span className="text-sm font-semibold text-gray-800 bg-gray-50 px-3 py-1 rounded-lg">{value}</span>
    </div>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try { setSettings(await api.get<PlatformSettings>('/admin/settings')); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Settings size={20} className="text-gray-500" />
            Platform Settings
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Read-only — change via Railway environment variables</p>
        </div>
        <button onClick={load} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-gray-400">Loading…</div>
      ) : !settings ? null : (
        <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-5">
          <Row
            label="Platform fee rate"
            value={`${(settings.platform_fee_rate * 100).toFixed(2)}%`}
            hint="PLATFORM_FEE_RATE env var"
          />
          <Row
            label="Minimum order amount"
            value={`₦${settings.min_order_amount.toLocaleString()}`}
            hint="MIN_ORDER_AMOUNT env var"
          />
          <Row
            label="Maximum delivery radius"
            value={`${settings.max_delivery_radius} km`}
            hint="MAX_DELIVERY_RADIUS_KM env var"
          />
          <Row
            label="Dispute SLA window"
            value={`${settings.dispute_sla_hours} hours`}
            hint="DISPUTE_SLA_HOURS env var"
          />
          <Row
            label="Escrow hold period"
            value={`${settings.escrow_hold_days} days`}
            hint="ESCROW_HOLD_DAYS env var"
          />
          <Row
            label="Maximum refund window"
            value={`${settings.max_refund_days} days`}
            hint="MAX_REFUND_DAYS env var"
          />
        </div>
      )}

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
        To change these values, update the corresponding environment variables in your Railway dashboard and redeploy.
      </div>
    </div>
  );
}
