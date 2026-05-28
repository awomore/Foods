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
  comment_count?: number;
}

export interface DiaryComment {
  id: string;
  post_id: string;
  user_id: string;
  body: string;
  mentions: MentionRef[];
  created_at: string;
  author_name: string;
  author_username: string | null;
  author_avatar: string | null;
  like_count: number;
  user_liked: boolean;
}

export interface MentionRef {
  type: 'user' | 'cook';
  id: string;
  username: string;
}

export const feedApi = {
  following: (params?: { limit?: number; offset?: number }) => {
    const q = new URLSearchParams();
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.offset) q.set('offset', String(params.offset));
    return api.get<{ posts: DiaryPost[] }>(`/diary/feed?${q}`);
  },

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

  getComments: (postId: string) =>
    api.get<{ comments: DiaryComment[] }>(`/diary/${postId}/comments`),

  addComment: (postId: string, body: string, mentions: MentionRef[] = []) =>
    api.post<{ comment: DiaryComment }>(`/diary/${postId}/comments`, { body, mentions }),

  likeComment: (commentId: string) =>
    api.post<{ liked: boolean; like_count: number }>(`/diary/comments/${commentId}/like`, {}),

  deleteComment: (commentId: string) =>
    api.delete<{ message: string }>(`/diary/comments/${commentId}`),
};
