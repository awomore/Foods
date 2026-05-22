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
};
