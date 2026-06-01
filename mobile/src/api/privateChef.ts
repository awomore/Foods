import { api } from './client';

export interface PrivateChefBooking {
  id: string;
  customer_id: string;
  cook_id: string;
  event_type: string | null;
  event_date: string;
  event_time: string | null;
  guest_count: number;
  venue_address: string;
  venue_latitude: number | null;
  venue_longitude: number | null;
  description: string | null;
  dietary_requirements: string | null;
  status: 'enquiry' | 'quoted' | 'deposit_paid' | 'confirmed' | 'completed' | 'cancelled';
  quote_amount: number | null;
  quote_breakdown: Record<string, unknown> | null;
  quote_message: string | null;
  quoted_at: string | null;
  deposit_amount: number | null;
  balance_amount: number | null;
  cook_name?: string;
  customer_name?: string;
  customer_phone?: string;
  created_at: string;
}

export const privateChefApi = {
  create: (data: {
    cook_id: string;
    event_type?: string;
    event_date: string;
    event_time?: string;
    guest_count: number;
    venue_address: string;
    venue_latitude?: number;
    venue_longitude?: number;
    description?: string;
    dietary_requirements?: string;
  }) => api.post<{ booking: PrivateChefBooking }>('/private-chef', data),

  list: () =>
    api.get<{ bookings: PrivateChefBooking[] }>('/private-chef'),

  get: (id: string) =>
    api.get<{ booking: PrivateChefBooking }>(`/private-chef/${id}`),

  quote: (id: string, data: { quote_amount: number; quote_message?: string; deposit_amount?: number; quote_breakdown?: unknown }) =>
    api.patch<{ booking: PrivateChefBooking }>(`/private-chef/${id}/quote`, data),

  counterOffer: (id: string, data: { counter_offer_amount: number; counter_offer_notes?: string }) =>
    api.patch<{ booking: PrivateChefBooking }>(`/private-chef/${id}/counter-offer`, data),

  acceptCounter: (id: string) =>
    api.patch<{ booking: PrivateChefBooking }>(`/private-chef/${id}/accept-counter`, {}),

  accept: (id: string) =>
    api.patch<{ booking: PrivateChefBooking }>(`/private-chef/${id}/accept`, {}),

  attachContract: (id: string, contract_url: string) =>
    api.patch<{ booking: PrivateChefBooking }>(`/private-chef/${id}/contract`, { contract_url }),

  signContract: (id: string) =>
    api.patch<{ booking: PrivateChefBooking }>(`/private-chef/${id}/sign-contract`, {}),

  depositPaid: (id: string, data: { tx_ref: string; transaction_id?: string }) =>
    api.patch<{ booking: PrivateChefBooking }>(`/private-chef/${id}/deposit-paid`, data),

  milestonePayment: (id: string, data: { milestone_index: number; tx_ref?: string; amount: number; label?: string }) =>
    api.patch<{ booking: PrivateChefBooking }>(`/private-chef/${id}/milestone`, data),

  balancePaid: (id: string, data: { tx_ref?: string; transaction_id?: string }) =>
    api.patch<{ booking: PrivateChefBooking }>(`/private-chef/${id}/balance-paid`, data),

  complete: (id: string) =>
    api.patch<{ booking: PrivateChefBooking }>(`/private-chef/${id}/complete`, {}),

  cancel: (id: string) =>
    api.patch<{ booking: PrivateChefBooking }>(`/private-chef/${id}/cancel`, {}),
};
