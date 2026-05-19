import { api } from './client';

export interface AppNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
}

export const notificationsApi = {
  list: (params?: { limit?: number; offset?: number }) => {
    const q = new URLSearchParams();
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.offset) q.set('offset', String(params.offset));
    return api.get<{ notifications: AppNotification[]; unread_count: number }>(`/notifications?${q}`);
  },

  markRead: (id: string) =>
    api.patch<{ message: string }>(`/notifications/${id}/read`, {}),

  markAllRead: () =>
    api.patch<{ message: string }>('/notifications/mark-all-read', {}),

  registerPushToken: (push_token: string) =>
    api.patch<{ message: string }>('/notifications/push-token', { push_token }),
};
