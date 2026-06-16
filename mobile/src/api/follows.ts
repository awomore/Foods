import { api } from './client';
import type { CookCard } from './cooks';

export interface Follow extends CookCard {
  cook_id: string;
  followed_at: string;
  notify_new_menu: boolean;
  notify_diary_post: boolean;
  notify_flash_sale: boolean;
  notify_surprise_drop: boolean;
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

  broadcast: (payload: {
    type: 'new_menu' | 'flash_sale' | 'segment';
    message?: string;
    discount_pct?: number;
    segment?: 'vip' | 'inactive' | 'new' | 'all';
  }) => api.post<{ sent: number }>('/follows/broadcast', payload),
};
