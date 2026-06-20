import { api } from './client';

export type OrderStatus =
  | 'pending_payment' | 'payment_confirmed' | 'payment_failed'
  | 'accepted' | 'preparing' | 'ready'
  | 'out_for_delivery' | 'in_transit' | 'delivered' | 'completed'
  | 'cancelled' | 'refunded';

export interface Order {
  id: string;
  customer_id: string;
  cook_id: string;
  menu_item_id: string;
  country_code: string;
  currency_code: string;
  order_type: 'preorder' | 'realtime';
  status: OrderStatus;
  quantity: number;
  unit_price: number;
  subtotal: number;
  delivery_fee: number;
  platform_fee: number;
  total_amount: number;
  cook_payout: number;
  selected_sides: unknown[];
  removed_sides: unknown[];
  delivery_address: string | null;
  delivery_latitude: number | null;
  delivery_longitude: number | null;
  delivery_window_start: string | null;
  delivery_window_end: string | null;
  allergen_acknowledged: boolean;
  matched_allergens: string[];
  ready_photo_url: string | null;
  ready_at: string | null;
  rider_tracking_id: string | null;
  rider_name: string | null;
  rider_phone: string | null;
  estimated_arrival: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  payment_tx_ref: string | null;
  payout_status: string;
  delivery_provider: string | null;
  recipient_state: string | null;
  fez_order_number: string | null;
  fez_dispatch_status: string | null;
  is_gift: boolean;
  meal_subscription_id: string | null;
  customer_note: string | null;
  created_at: string;
  updated_at: string;
  // Module 1 — delivery promise window
  prep_time_minutes: number | null;
  // Module 2 — logistics choice
  logistics_type: 'fez' | 'foods_network' | 'off_platform' | null;
  off_platform_rider_name: string | null;
  off_platform_rider_phone: string | null;
  off_platform_eta: string | null;
  customer_confirmed_receipt: boolean;
  customer_confirmed_at: string | null;
  // Module 3 — delivery fee payment
  delivery_fee_payment_method: 'wallet' | 'cash' | 'transfer' | null;
  delivery_fee_paid_to_rider: boolean;
  delivery_fee_paid_at: string | null;
  // Module 4 — OTPs
  otp_enabled: boolean;
  collection_otp: string | null;
  collection_otp_verified_at: string | null;
  delivery_otp: string | null;
  delivery_otp_verified_at: string | null;
  // Joined fields
  cook_name?: string;
  cook_username?: string;
  cook_avatar?: string;
  item_title?: string;
  item_photos?: string[];
  customer_name?: string;
}

export interface PlaceOrderItem {
  menu_item_id: string;
  quantity?: number;
  selected_sides?: unknown[];
  removed_sides?: unknown[];
}

export const ordersApi = {
  place: (data: {
    items: PlaceOrderItem[];
    delivery_address?: string;
    delivery_latitude?: number;
    delivery_longitude?: number;
    delivery_window_start?: string;
    delivery_window_end?: string;
    recipient_state?: string;
    customer_note?: string;
    is_gift?: boolean;
    gift_recipient_name?: string;
    gift_recipient_phone?: string;
    gift_message?: string;
    allergen_acknowledged?: boolean;
    payment_tx_ref?: string;
    payment_tx_id?: string;
    payment_method?: string;
    tip_amount?: number;
    delivery_fee_payment_method?: 'wallet' | 'cash' | 'transfer';
  }) => api.post<{ orders: Order[] }>('/orders', data),

  list: (params?: { status?: OrderStatus; limit?: number; offset?: number }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.offset) q.set('offset', String(params.offset));
    return api.get<{ orders: Order[] }>(`/orders?${q}`);
  },

  get: (id: string) =>
    api.get<{ order: Order }>(`/orders/${id}`),

  updateStatus: (id: string, data: {
    status: OrderStatus;
    ready_photo_url?: string;
    rider_tracking_id?: string;
    rider_name?: string;
    rider_phone?: string;
    // Module 1
    prep_time_minutes?: number;
    // Module 2
    logistics_type?: 'fez' | 'foods_network' | 'off_platform';
    off_platform_rider_name?: string;
    off_platform_rider_phone?: string;
    off_platform_eta?: string;
    // Module 4 — OTP inputs
    collection_otp_input?: string;
    delivery_otp_input?: string;
  }) => api.patch<{ order: Order }>(`/orders/${id}/status`, data),

  confirmReceipt: (id: string) =>
    api.post<{ order: Order }>(`/orders/${id}/confirm-receipt`, {}),

  confirmRiderPaid: (id: string) =>
    api.post<{ order: Order }>(`/orders/${id}/rider-paid`, {}),

  addTip: (orderId: string, amount: number) =>
    api.post<{ tip: unknown }>(`/orders/${orderId}/tip`, { amount }),

  cancel: (id: string, reason?: string) =>
    api.post<{ order: Order }>(`/orders/${id}/cancel`, { reason }),

  reportIssue: (id: string, data: { reason: string; detail?: string }) =>
    api.post<{ ticket_id: string }>(`/orders/${id}/report`, data),
};
