import { api } from './client';

export const notifyAvailableApi = {
  register: (menuItemId: string) =>
    api.post<{ registered: boolean; title: string }>(`/notify-available/${menuItemId}`, {}),

  remove: (menuItemId: string) =>
    api.delete<{ removed: boolean }>(`/notify-available/${menuItemId}`),

  check: (menuItemId: string) =>
    api.get<{ watching: boolean }>(`/notify-available/check/${menuItemId}`),
};
