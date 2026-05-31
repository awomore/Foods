import { api } from './client';
import type { PostType } from './feed';

export interface MyPost {
  id: string;
  cook_id: string;
  body: string;
  photo_url: string | null;
  photo_urls: string[];
  video_url: string | null;
  post_type: PostType;
  status: 'draft' | 'scheduled' | 'published';
  title: string | null;
  scheduled_at: string | null;
  linked_item_id: string | null;
  linked_item_title: string | null;
  linked_item_price: number | null;
  linked_item_photos: string[];
  share_count: number;
  view_count: number;
  created_at: string;
  like_count: number;
  comment_count: number;
  orders_generated: number;
}

export interface PostAnalyticsSummary {
  total_posts: number;
  total_reach: number;
  total_shares: number;
  total_likes: number;
  total_comments: number;
  total_orders_generated: number;
}

export interface CreatePostData {
  body: string;
  post_type?: PostType;
  status?: 'draft' | 'scheduled' | 'published';
  title?: string;
  photo_url?: string;
  photo_urls?: string[];
  video_url?: string;
  scheduled_at?: string;
  linked_item_id?: string;
}

export const postsApi = {
  create: (data: CreatePostData) =>
    api.post<{ post: MyPost }>('/diary', data),

  update: (id: string, data: Partial<CreatePostData>) =>
    api.patch<{ post: MyPost }>(`/diary/${id}`, data),

  delete: (id: string) =>
    api.delete<{ message: string }>(`/diary/${id}`),

  myPosts: (params?: { status?: 'draft' | 'scheduled' | 'published'; limit?: number; offset?: number }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.offset) q.set('offset', String(params.offset));
    return api.get<{ posts: MyPost[] }>(`/diary/my-posts?${q}`);
  },

  analytics: () =>
    api.get<{ summary: PostAnalyticsSummary; top_posts: MyPost[] }>('/diary/analytics'),
};
