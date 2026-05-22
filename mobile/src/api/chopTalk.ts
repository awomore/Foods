import { api } from './client';

export interface ChopTalkPost {
  id: string;
  cook_id: string;
  customer_id: string;
  body: string;
  photo_urls: string[];
  order_count_with_cook: number;
  is_milestone: boolean;
  is_pinned: boolean;
  created_at: string;
  author_name: string;
  author_avatar: string | null;
  cook_name: string;
  reply_count: number;
}

export interface ChopTalkReply {
  id: string;
  post_id: string;
  author_id: string;
  body: string;
  is_cook_reply: boolean;
  created_at: string;
  author_name: string;
  author_avatar: string | null;
}

export const chopTalkApi = {
  getPosts: (cookId: string, params?: { limit?: number; offset?: number }) => {
    const q = new URLSearchParams();
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.offset) q.set('offset', String(params.offset));
    return api.get<{ posts: ChopTalkPost[]; active_posters: number }>(`/chop-talk/cook/${cookId}?${q}`);
  },

  post: (cookId: string, data: { body: string; photo_urls?: string[] }) =>
    api.post<{ post: ChopTalkPost }>(`/chop-talk/cook/${cookId}`, data),

  getReplies: (postId: string) =>
    api.get<{ replies: ChopTalkReply[] }>(`/chop-talk/${postId}/replies`),

  reply: (postId: string, body: string) =>
    api.post<{ reply: ChopTalkReply }>(`/chop-talk/${postId}/reply`, { body }),

  pin: (postId: string) =>
    api.patch<{ message: string }>(`/chop-talk/${postId}/pin`, {}),
};
