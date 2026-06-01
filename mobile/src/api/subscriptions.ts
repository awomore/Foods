import { api } from './client';

export interface SubscriptionTier {
  id: string;
  cook_id: string;
  name: string;
  price: number;
  billing_period: 'monthly' | 'quarterly' | 'yearly';
  benefits: string[];
  is_active: boolean;
  created_at: string;
}

export interface CreatorSubscription {
  id: string;
  tier_id: string;
  subscriber_id: string;
  cook_id: string;
  status: 'active' | 'cancelled' | 'expired' | 'paused';
  started_at: string;
  expires_at: string | null;
  amount_paid: number | null;
  tier_name?: string;
  benefits?: string[];
  tier_price?: number;
  cook_name?: string;
  cook_avatar?: string;
}

export const subscriptionsApi = {
  tiers: (cookId: string) =>
    api.get<{ tiers: SubscriptionTier[] }>(`/subscriptions/tiers/${cookId}`),

  createTier: (data: {
    name: string;
    price: number;
    billing_period?: string;
    benefits?: string[];
  }) => api.post<{ tier: SubscriptionTier }>('/subscriptions/tiers', data),

  updateTier: (id: string, data: Partial<SubscriptionTier>) =>
    api.patch<{ tier: SubscriptionTier }>(`/subscriptions/tiers/${id}`, data),

  subscribe: (data: { tier_id: string; tx_ref?: string; amount_paid?: number }) =>
    api.post<{ subscription: CreatorSubscription }>('/subscriptions/subscribe', data),

  mySubscriptions: () =>
    api.get<{ subscriptions: CreatorSubscription[] }>('/subscriptions/my'),

  cancel: (id: string) =>
    api.delete<{ ok: boolean }>(`/subscriptions/${id}/cancel`),
};
