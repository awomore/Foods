import { api } from './client';

export interface Craving {
  id: string;
  user_id: string;
  menu_item_id: string | null;
  cook_id: string | null;
  dish_title: string;
  dish_price: number | null;
  dish_photo: string | null;
  currency_code: string;
  notes: string | null;
  is_public: boolean;
  is_fulfilled: boolean;
  fulfilled_by: string | null;
  fulfilled_by_user_id: string | null;
  fulfilled_by_name: string | null;
  fulfilled_by_username: string | null;
  fulfilled_by_avatar: string | null;
  fulfilled_at: string | null;
  cook_notify: boolean;
  user_name?: string;
  user_avatar?: string | null;
  created_at: string;
}

export const cravingsApi = {
  list: () =>
    api.get<{ cravings: Craving[] }>('/cravings'),

  byUser: (userId: string) =>
    api.get<{ cravings: Craving[] }>(`/cravings/user/${userId}`),

  add: (data: {
    menu_item_id?: string;
    cook_id?: string;
    dish_title: string;
    dish_price?: number;
    dish_photo?: string;
    currency_code?: string;
    notes?: string;
    is_public?: boolean;
  }) => api.post<{ craving: Craving }>('/cravings', data),

  remove: (id: string) =>
    api.delete<{ message: string }>(`/cravings/${id}`),

  setVisibility: (id: string, is_public: boolean) =>
    api.patch<{ craving: Craving }>(`/cravings/${id}/visibility`, { is_public }),

  /** Gift/fulfill someone else's craving */
  fulfill: (id: string) =>
    api.post<{ craving: Craving }>(`/cravings/${id}/fulfill`, {}),

  /** Cook toggles "I'll make this soon" notification */
  setCookNotify: (id: string, notify: boolean) =>
    api.patch<{ craving: Craving }>(`/cravings/${id}/cook-notify`, { notify }),

  /** Get cravings for the cook's dishes (cook-only) */
  forCook: () =>
    api.get<{ cravings: Craving[] }>('/cravings/cook'),
};
