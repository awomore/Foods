import { api } from './client';

export interface Review {
  id: string;
  order_id: string;
  customer_id: string;
  cook_id: string;
  rating: number;
  body: string | null;
  photos: string[];
  cook_reply: string | null;
  cook_replied_at: string | null;
  is_visible: boolean;
  created_at: string;
  customer_name?: string;
  customer_avatar?: string | null;
}

export interface ReviewSummary {
  total: number;
  avg_rating: number;
  five_star: number;
  four_star: number;
  three_star: number;
  two_star: number;
  one_star: number;
}

export const reviewsApi = {
  byCook: (cookId: string, params?: { limit?: number; offset?: number }) => {
    const q = new URLSearchParams();
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.offset) q.set('offset', String(params.offset));
    return api.get<{ reviews: Review[]; summary: ReviewSummary }>(`/reviews/cook/${cookId}?${q}`);
  },

  submit: (data: { order_id: string; rating: number; body?: string; photos: string[] }) =>
    api.post<{ review: Review }>('/reviews', data),

  reply: (reviewId: string, cook_reply: string) =>
    api.patch<{ review: Review }>(`/reviews/${reviewId}/reply`, { cook_reply }),
};
