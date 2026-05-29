import { api } from './client';

export interface GiftCard {
  id: string;
  code: string;
  denomination: number;
  balance: number;
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
  gifter_id: string;
  plan_id: string;
  sub_type: string;
  meal_slots: string[];
  add_dietician: boolean;
  recipient_name: string;
  recipient_phone: string;
  recipient_address: string;
  preferences: string | null;
  total_amount: number | null;
  currency_code: string;
  status: 'active' | 'paused' | 'cancelled';
  started_at: string;
  next_delivery: string | null;
  created_at: string;
}

export interface SubscriptionMeal {
  id: string;
  subscription_id: string;
  delivery_date: string;
  meal_slot: string;
  meal_title: string | null;
  meal_description: string | null;
  cook_note: string | null;
  status: 'scheduled' | 'delivered' | 'approved' | 'rejected' | 'skipped';
  gifter_feedback: string | null;
  recipient_feedback: string | null;
  approved_by: 'gifter' | 'recipient' | null;
  rejected_by: 'gifter' | 'recipient' | null;
  rejection_reason: string | null;
  created_at: string;
}

export const giftingApi = {
  purchaseGiftCard: (data: {
    denomination: number;
    recipient_phone?: string;
    recipient_email?: string;
    gift_message?: string;
  }) => api.post<{ gift_card: GiftCard }>('/gifting/gift-cards', data),

  getGiftCard: (code: string) =>
    api.get<{ gift_card: GiftCard }>(`/gifting/gift-cards/${code}`),

  redeemGiftCard: (code: string) =>
    api.post<{ gift_card: GiftCard; credits_added: number }>(`/gifting/gift-cards/${code}/redeem`, {}),

  createGroupGift: (data: {
    recipient_name: string;
    recipient_phone: string;
    menu_item_id?: string;
    cook_id?: string;
    target_amount: number;
    message?: string;
  }) => api.post<{ group_gift: GroupGift }>('/gifting/group-gifts', data),

  getGroupGift: (id: string) =>
    api.get<{ group_gift: GroupGift }>(`/gifting/group-gifts/${id}`),

  contributeToGroupGift: (id: string, data: {
    amount: number;
    contributor_name: string;
    message?: string;
  }) => api.post<{ contribution: GroupGiftContribution; is_funded: boolean; current_amount: number }>(
    `/gifting/group-gifts/${id}/contribute`, data
  ),

  createSubscription: (data: {
    plan_id: string;
    sub_type: string;
    meal_slots: string[];
    add_dietician: boolean;
    recipient_name: string;
    recipient_phone: string;
    recipient_address: string;
    preferences?: string;
    total_amount?: number;
    currency_code?: string;
  }) => api.post<{ subscription: MealSubscription }>('/gifting/subscriptions', data),

  listSubscriptions: () =>
    api.get<{ subscriptions: MealSubscription[] }>('/gifting/subscriptions'),

  pauseSubscription: (id: string) =>
    api.patch<{ subscription: MealSubscription }>(`/gifting/subscriptions/${id}/pause`, {}),

  cancelSubscription: (id: string) =>
    api.patch<{ subscription: MealSubscription }>(`/gifting/subscriptions/${id}/cancel`, {}),

  getSubscriptionMeals: (id: string) =>
    api.get<{ subscription: MealSubscription; meals: SubscriptionMeal[] }>(`/gifting/subscriptions/${id}/meals`),

  submitMealFeedback: (subscriptionId: string, mealId: string, data: {
    action: 'approve' | 'reject';
    reason?: string;
    feedback?: string;
  }) => api.post<{ meal: SubscriptionMeal }>(
    `/gifting/subscriptions/${subscriptionId}/meals/${mealId}/feedback`, data
  ),
};
