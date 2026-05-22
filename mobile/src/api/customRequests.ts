import { api } from './client';

export interface CustomRequest {
  id: string;
  customer_id: string;
  cook_id: string;
  description: string;
  photos: string[];
  serving_count: number | null;
  preferred_date: string | null;
  budget_range: string | null;
  status: 'pending' | 'quoted' | 'accepted' | 'declined' | 'cancelled';
  quote_amount: number | null;
  quote_message: string | null;
  quoted_at: string | null;
  created_at: string;
  customer_name?: string;
  customer_avatar?: string | null;
  cook_name?: string;
}

export const customRequestsApi = {
  list: () =>
    api.get<{ requests: CustomRequest[] }>('/custom-requests'),

  create: (data: {
    cook_id: string;
    description: string;
    serving_count?: number;
    preferred_date?: string;
    budget_range?: string;
  }) => api.post<{ request: CustomRequest }>('/custom-requests', data),

  quote: (id: string, data: { quote_amount: number; quote_message?: string }) =>
    api.patch<{ request: CustomRequest }>(`/custom-requests/${id}/quote`, data),

  respond: (id: string, action: 'accept' | 'decline') =>
    api.patch<{ request: CustomRequest }>(`/custom-requests/${id}/respond`, { action }),
};
