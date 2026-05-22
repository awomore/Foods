import { api } from './client';

export interface BulkRequest {
  id: string;
  customer_id: string;
  cook_id: string;
  description: string;
  serving_count: number;
  preferred_date: string;
  delivery_address: string | null;
  status: 'pending' | 'quoted' | 'accepted' | 'declined' | 'cancelled';
  quote_amount: number | null;
  quote_message: string | null;
  deposit_percentage: number;
  deposit_amount: number | null;
  balance_amount: number | null;
  quoted_at: string | null;
  created_at: string;
  customer_name?: string;
  cook_name?: string;
}

export const bulkRequestsApi = {
  list: () =>
    api.get<{ requests: BulkRequest[] }>('/bulk-requests'),

  create: (data: {
    cook_id: string;
    description: string;
    serving_count: number;
    preferred_date: string;
    delivery_address?: string;
  }) => api.post<{ request: BulkRequest }>('/bulk-requests', data),

  quote: (id: string, data: { quote_amount: number; quote_message?: string; deposit_percentage?: number }) =>
    api.patch<{ request: BulkRequest }>(`/bulk-requests/${id}/quote`, data),
};
