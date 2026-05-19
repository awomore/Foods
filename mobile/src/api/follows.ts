import { api } from './client';

export interface Follow {
  id: string;
  customer_id: string;
  cook_id: string;
  notify_new_menu: boolean;
  notify_diary_post: boolean;
  notify_flash_sale: boolean;
  notify_surprise_drop: boolean;
  created_at: string;
  display_name?: string;
  username?: string;
  average_rating?: number;
  is_live?: boolean;
  location?: string | null;
  platform_follower_count?: number;
  cook_avatar?: string | null;
}

export const followsApi = {
  list: () =>
    api.get<{ follows: Follow[] }>('/follows'),

  status: (cookId: string) =>
    api.get<{ is_following: boolean; follow: Follow | null }>(`/follows/${cookId}/status`),

  follow: (cookId: string, prefs?: {
    notify_new_menu?: boolean;
    notify_diary_post?: boolean;
    notify_flash_sale?: boolean;
    notify_surprise_drop?: boolean;
  }) => api.post<{ follow: Follow }>(`/follows/${cookId}`, prefs ?? {}),

  unfollow: (cookId: string) =>
    api.delete<{ message: string }>(`/follows/${cookId}`),
};
