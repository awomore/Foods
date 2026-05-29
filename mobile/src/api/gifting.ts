import { api } from './client';

export interface GiftCard {
  id: string;
  code: string;
  amount: number;
  currency_code: string;
  purchased_by: string;
  recipient_name: string | null;
  recipient_phone: string | null;
  message: string | null;
  is_redeemed: boolean;
  redeemed_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface GroupGift {
  id: string;
  initiator_id: string;
  recipient_name: string;
  recipient_phone: string;
  menu_item_id: string;
  cook_id: string;
  target_amount: number;
  current_amount: number;
  currency_code: string;
  share_link: string;
  expires_at: string;
  status: string;
  created_at: string;
  contributions?: GroupGiftContribution[];
}

export interface GroupGiftContribution {
  id: string;
  group_gift_id: string;
  contributor_id: string | null;
  contributor_name: string;
  amount: number;
  message: string | null;
  created_at: string;
}

export interface MealSubscription {
  id: string;
  plan_id: string;
  sub_type: string;
  meal_slot: string | null;
  add_dietician: boolean;
  recipient_name: string;
  recipient_phone: string;
  recipient_address: string;
  preferences: string | null;
  status: 'active' | 'paused' | 'cancelled';
  started_at: string;
  next_delivery: string | null;
}

export const giftingApi = {
  purchaseGiftCard: (data: {
    amount: number;
    currency_code?: string;
    recipient_name?: string;
    recipient_phone?: string;
    message?: string;
  }) => api.post<{ gift_card: GiftCard }>('/gifting/gift-cards', data),

  getGiftCard: (code: string) =>
    api.get<{ gift_card: GiftCard }>(`/gifting/gift-cards/${code}`),

  redeemGiftCard: (code: string) =>
    api.post<{ gift_card: GiftCard; credits_added: number }>(`/gifting/gift-cards/${code}/redeem`, {}),

  createGroupGift: (data: {
    recipient_name: string;
    recipient_phone: string;
    menu_item_id: string;
    cook_id: string;
    target_amount: number;
    currency_code?: string;
  }) => api.post<{ group_gift: GroupGift }>('/gifting/group-gifts', data),

  getGroupGift: (id: string) =>
    api.get<{ group_gift: GroupGift }>(`/gifting/group-gifts/${id}`),

  contributeToGroupGift: (id: string, data: {
    amount: number;
    contributor_name: string;
    message?: string;
    payment_tx_ref?: string;
  }) => api.post<{ contribution: GroupGiftContribution }>(`/gifting/group-gifts/${id}/contribute`, data),

  createSubscription: (data: {
    plan_id: string;
    sub_type: string;
    meal_slot: string | null;
    add_dietician: boolean;
    recipient_name: string;
    recipient_phone: string;
    recipient_address: string;
    preferences?: string;
  }) => api.post<{ subscription: MealSubscription }>('/gifting/subscriptions', data),

  listSubscriptions: () =>
    api.get<{ subscriptions: MealSubscription[] }>('/gifting/subscriptions'),

  pauseSubscription: (id: string) =>
    api.patch<{ subscription: MealSubscription }>(`/gifting/subscriptions/${id}/pause`, {}),

  cancelSubscription: (id: string) =>
    api.patch<{ subscription: MealSubscription }>(`/gifting/subscriptions/${id}/cancel`, {}),
};
