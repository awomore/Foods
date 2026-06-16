import { api } from './client';

export type CateringStatus =
  | 'enquiry' | 'quoted' | 'accepted' | 'deposit_paid'
  | 'in_progress' | 'completed' | 'cancelled' | 'disputed';

export type CateringEventType =
  | 'wedding' | 'birthday' | 'corporate' | 'funeral'
  | 'naming' | 'graduation' | 'anniversary' | 'other';

export interface TimelineItem {
  label: string;
  description?: string;
  scheduled_at?: string;
  completed?: boolean;
}

export interface CateringEvent {
  id: string;
  customer_id: string;
  cook_id: string | null;
  event_name: string | null;
  event_type: CateringEventType;
  event_date: string;
  event_time: string | null;
  guest_count: number;
  venue_address: string;
  venue_latitude: number | null;
  venue_longitude: number | null;
  menu_description: string | null;
  dietary_requirements: string | null;
  equipment_needed: boolean;
  service_staff_needed: boolean;
  status: CateringStatus;
  quote_amount: number | null;
  deposit_amount: number;
  deposit_paid_at: string | null;
  final_amount: number | null;
  timeline: TimelineItem[];
  quote_message: string | null;
  quoted_at: string | null;
  notes: string | null;
  created_at: string;
  // joined
  customer_name?: string;
  cook_name?: string;
  cook_avatar?: string;
}

export const cateringApi = {
  create: (data: {
    cook_id?: string;
    event_name?: string;
    event_type: CateringEventType;
    event_date: string;
    event_time?: string;
    guest_count: number;
    venue_address: string;
    venue_latitude?: number;
    venue_longitude?: number;
    menu_description?: string;
    dietary_requirements?: string;
    equipment_needed?: boolean;
    service_staff_needed?: boolean;
    notes?: string;
  }) => api.post<{ event: CateringEvent }>('/catering', data),

  list: () =>
    api.get<{ events: CateringEvent[] }>('/catering'),

  get: (id: string) =>
    api.get<{ event: CateringEvent }>(`/catering/${id}`),

  quote: (id: string, data: {
    quote_amount: number;
    deposit_amount?: number;
    quote_message?: string;
    timeline?: TimelineItem[];
  }) => api.patch<{ event: CateringEvent }>(`/catering/${id}/quote`, data),

  accept: (id: string) =>
    api.patch<{ event: CateringEvent }>(`/catering/${id}/accept`, {}),

  depositPaid: (id: string, data: { tx_ref?: string; transaction_id?: string }) =>
    api.patch<{ event: CateringEvent }>(`/catering/${id}/deposit-paid`, data),

  complete: (id: string, data: { final_tx_ref?: string; final_amount?: number }) =>
    api.patch<{ event: CateringEvent }>(`/catering/${id}/complete`, data),

  cancel: (id: string) =>
    api.patch<{ event: CateringEvent }>(`/catering/${id}/cancel`, {}),

  updateTimeline: (id: string, timeline: TimelineItem[]) =>
    api.patch<{ event: CateringEvent }>(`/catering/${id}/timeline`, { timeline }),

  // Marketplace: open briefs any cook can bid on
  marketplace: (params?: { event_type?: string; limit?: number; offset?: number }) => {
    const q = new URLSearchParams();
    if (params?.event_type) q.set('event_type', params.event_type);
    if (params?.limit)  q.set('limit', String(params.limit));
    if (params?.offset) q.set('offset', String(params.offset));
    const qs = q.toString();
    return api.get<{ briefs: (CateringEvent & { bid_count: number; customer_name: string; customer_avatar: string | null })[] }>(
      `/catering/marketplace${qs ? `?${qs}` : ''}`
    );
  },

  bid: (id: string, data: { quoted_price: number; notes?: string; availability_confirmed?: boolean }) =>
    api.post<{ bid: any }>(`/catering/${id}/bid`, data),

  listBids: (id: string) =>
    api.get<{ bids: any[] }>(`/catering/${id}/bids`),

  acceptBid: (id: string, cook_id: string) =>
    api.post<{ event: CateringEvent }>(`/catering/${id}/accept-bid`, { cook_id }),
};
