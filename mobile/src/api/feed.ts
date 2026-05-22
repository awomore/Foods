import { api } from './client';

export interface DiaryPost {
  id: string;
  cook_id: string;
  body: string;
  photo_url: string | null;
  video_url: string | null;
  created_at: string;
  cook_name: string;
  cook_username: string;
  cook_avatar: string | null;
  like_count: number;
  user_liked: boolean;
}

export const feedApi = {
  /** Feed from followed cooks (requires auth) */
  following: (params?: { limit?: number; offset?: number }) => {
    const q = new URLSearchParams();
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.offset) q.set('offset', String(params.offset));
    return api.get<{ posts: DiaryPost[] }>(`/diary/feed?${q}`);
  },

  /** Global public feed */
  global: (params?: { limit?: number; offset?: number }) => {
    const q = new URLSearchParams();
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.offset) q.set('offset', String(params.offset));
    return api.get<{ posts: DiaryPost[] }>(`/diary/global?${q}`);
  },

  likeDiaryPost: (postId: string) =>
    api.post<{ liked: boolean; like_count: number }>(`/diary/${postId}/like`, {}),

  likeMenuItem: (itemId: string) =>
    api.post<{ liked: boolean; like_count: number }>(`/menu/${itemId}/like`, {}),
};
