import { api } from './client';

export interface RiderOrder {
  id: string;
  status: string;
  cook_name: string;
  cook_address: string | null;
  delivery_address: string | null;
  delivery_latitude: number | null;
  delivery_longitude: number | null;
  item_title?: string;
  quantity: number;
  delivery_fee: number;
  currency_code: string;
  otp_enabled: boolean;
  collection_otp: string | null;
  collection_otp_verified_at: string | null;
  delivery_otp: string | null;
  delivery_otp_verified_at: string | null;
  delivery_fee_payment_method: 'wallet' | 'cash' | 'transfer' | null;
  delivery_window_end: string | null;
  assigned_rider_id: string | null;
  updated_at: string;
  created_at: string;
}

export interface EarningsSummary {
  rider: {
    id: string;
    full_name: string;
    total_deliveries: number;
    status: string;
  };
  this_week: { count: number; gross: number };
  all_time: { count: number; gross: number };
  daily_breakdown: Array<{ day: string; deliveries: number; gross: number }>;
}

export const riderApi = {
  getAvailableOrders: () =>
    api.get<{ orders: RiderOrder[] }>('/fleet/orders/available'),

  getMyOrders: () =>
    api.get<{ orders: RiderOrder[] }>('/fleet/orders/mine'),

  claimOrder: (orderId: string) =>
    api.post<{ order: RiderOrder }>(`/fleet/orders/${orderId}/claim`, {}),

  verifyCollectionOtp: (orderId: string, otp: string) =>
    api.post<{ order: RiderOrder }>(`/fleet/orders/${orderId}/verify-collection-otp`, { otp }),

  skipCollectionOtp: (orderId: string) =>
    api.post<{ order: RiderOrder }>(`/fleet/orders/${orderId}/skip-collection-otp`, {}),

  verifyDeliveryOtp: (orderId: string, otp: string) =>
    api.post<{ order: RiderOrder }>(`/fleet/orders/${orderId}/verify-delivery-otp`, { otp }),

  skipDeliveryOtp: (orderId: string) =>
    api.post<{ order: RiderOrder }>(`/fleet/orders/${orderId}/skip-delivery-otp`, {}),

  setAvailability: (is_available: boolean) =>
    api.patch<{ is_available: boolean }>('/fleet/riders/me/availability', { is_available }),

  getEarnings: () =>
    api.get<EarningsSummary>('/fleet/earnings'),

  getMyProfile: () =>
    api.get<{ rider: any }>('/fleet/riders/me'),
};
