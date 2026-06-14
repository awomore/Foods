import { api } from './client';

export type DiaryPostStatus = 'published' | 'draft' | 'scheduled';
export type DiaryPostType = 'dish_reveal' | 'kitchen_story' | 'behind_the_scenes' | 'flash_sale' | 'weekly_menu';

export interface DiaryPost {
  id: string;
  cook_id: string;
  body: string;
  photo_url: string | null;
  photo_urls: string[] | null;
  video_url: string | null;
  post_type: DiaryPostType;
  title: string | null;
  status: DiaryPostStatus;
  scheduled_at: string | null;
  is_pinned: boolean;
  linked_item_id: string | null;
  linked_item_title: string | null;
  linked_item_price: number | null;
  linked_item_photos: string[];
  share_count: number;
  view_count: number;
  like_count: number;
  comment_count: number;
  orders_generated: number;
  created_at: string;
}

export const diaryApi = {
  myPosts(params?: { status?: DiaryPostStatus; limit?: number; offset?: number }) {
    const q = new URLSearchParams();
    if (params?.status)  q.set('status', params.status);
    if (params?.limit)   q.set('limit',  String(params.limit));
    if (params?.offset)  q.set('offset', String(params.offset));
    const qs = q.toString();
    return api<{ posts: DiaryPost[] }>(`/diary/my-posts${qs ? '?' + qs : ''}`);
  },

  pin(id: string, pinned: boolean) {
    return api<{ post: DiaryPost }>(`/diary/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_pinned: pinned }),
    });
  },

  delete(id: string) {
    return api<{ message: string }>(`/diary/${id}`, { method: 'DELETE' });
  },

  publish(id: string) {
    return api<{ post: DiaryPost }>(`/diary/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'published' }),
    });
  },
};
