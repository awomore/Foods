import { client } from './client';
import type { CustomerPost } from '../types';

export const customerPostsApi = {
  list: async (params: { cook_id?: string; user_id?: string; limit?: number; offset?: number } = {}) => {
    const res = await client.get<{ posts: CustomerPost[] }>('/customer-posts', { params });
    return res.data;
  },

  create: async (payload: {
    body?: string;
    photo_urls?: string[];
    video_url?: string;
    video_thumbnail?: string;
    tagged_cook_ids?: string[];
    mention_user_ids?: string[];
    order_id?: string;
  }) => {
    const res = await client.post<{ post: CustomerPost }>('/customer-posts', payload);
    return res.data;
  },

  remove: async (id: string) => {
    const res = await client.delete<{ message: string }>(`/customer-posts/${id}`);
    return res.data;
  },

  like: async (id: string) => {
    const res = await client.post<{ liked: boolean }>(`/customer-posts/${id}/like`);
    return res.data;
  },

  unlike: async (id: string) => {
    const res = await client.delete<{ liked: boolean }>(`/customer-posts/${id}/like`);
    return res.data;
  },

  repost: async (id: string) => {
    const res = await client.post<{ reposted: boolean }>(`/customer-posts/${id}/repost`);
    return res.data;
  },
};
