import { api } from './client';

export interface EarningsSummary {
  total_orders: number;
  total_earned: number;
  platform_fees: number;
  delivery_fees: number;
  avg_order_value: number;
}

export interface DailyBreakdown {
  day: string;
  orders: number;
  earned: number;
}

export interface EarningsResponse {
  period: string;
  currency_code: string;
  summary: EarningsSummary;
  daily_breakdown: DailyBreakdown[];
  pending_payout: number;
  upcoming_preorders: { amount: number; count: number };
  lifetime_earned: number;
  recent_payouts: Payout[];
  savings: CookSavings | null;
}

export interface Payout {
  id: string;
  cook_id: string;
  amount: number;
  currency_code: string;
  type: 'standard' | 'instant';
  instant_fee: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  processed_at: string | null;
  created_at: string;
}

export interface CookSavings {
  id: string;
  balance: number;
  currency_code: string;
  auto_save_rate: number;
  goal_amount: number | null;
  goal_name: string | null;
}

export const earningsApi = {
  summary: (period: 'today' | 'week' | 'month' | 'year' = 'week') =>
    api.get<EarningsResponse>(`/earnings?period=${period}`),

  orders: (params?: { limit?: number; offset?: number }) => {
    const q = new URLSearchParams();
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.offset) q.set('offset', String(params.offset));
    return api.get<{ orders: unknown[] }>(`/earnings/orders?${q}`);
  },

  requestPayout: (type: 'standard' | 'instant' = 'standard') =>
    api.post<{ payout: Payout }>('/earnings/payout', { type }),
};
