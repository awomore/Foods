import { api } from './client';
import type { CustomerPost } from '../types';

export type { CustomerPost };

export const customerPostsApi = {
  list: (params: { cook_id?: string; user_id?: string; limit?: number; offset?: number } = {}) =>
    api.get<{ posts: CustomerPost[] }>('/customer-posts', { params: params as Record<string, unknown> }),

  create: (payload: {
    body?: string;
    photo_urls?: string[];
    video_url?: string;
    video_thumbnail?: string;
    tagged_cook_ids?: string[];
    mention_user_ids?: string[];
    order_id?: string;
  }) => api.post<{ post: CustomerPost }>('/customer-posts', payload),

  remove: (id: string) =>
    api.delete<{ message: string }>(`/customer-posts/${id}`),

  like: (id: string) =>
    api.post<{ liked: boolean }>(`/customer-posts/${id}/like`, {}),

  unlike: (id: string) =>
    api.delete<{ liked: boolean }>(`/customer-posts/${id}/like`),

  repost: (id: string) =>
    api.post<{ reposted: boolean }>(`/customer-posts/${id}/repost`, {}),
};
