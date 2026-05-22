import { api } from './client';

export interface LoyaltyBalance {
  customer_id: string;
  balance: number;
  lifetime_earned: number;
}

export interface LoyaltyTransaction {
  id: string;
  customer_id: string;
  type: 'earned' | 'redeemed' | 'donated' | 'expired';
  points: number;
  description: string;
  order_id: string | null;
  cook_id: string | null;
  created_at: string;
  item_title?: string;
  cook_name?: string;
}

export const loyaltyApi = {
  get: () =>
    api.get<{ balance: LoyaltyBalance; history: LoyaltyTransaction[]; currency_value: number }>('/loyalty'),

  redeem: (points: number, order_id?: string) =>
    api.post<{ redeemed_points: number; discount_amount: number }>('/loyalty/redeem', { points, order_id }),

  donate: (points: number, cook_id: string) =>
    api.post<{ donated_points: number }>('/loyalty/donate', { points, cook_id }),
};
