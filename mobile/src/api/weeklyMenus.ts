import { api } from './client';

export interface WeeklyMenuItem {
  menu_item_id?: string;
  name: string;
  price: number;
  description?: string;
  photo?: string;
  day?: string;
  available_slots?: number;
}

export interface WeeklyMenu {
  id: string;
  cook_id: string;
  week_start: string;
  title: string | null;
  description: string | null;
  items: WeeklyMenuItem[];
  is_published: boolean;
  created_at: string;
  updated_at: string;
  cook_name: string | null;
}

export const weeklyMenusApi = {
  list: (params?: { limit?: number }) =>
    api.get<{ menus: WeeklyMenu[] }>(`/weekly-menus/discovery${params?.limit ? `?limit=${params.limit}` : ''}`),

  forCook: (cookId: string, limit?: number) => {
    const q = limit ? `?limit=${limit}` : '';
    return api.get<{ menus: WeeklyMenu[] }>(`/weekly-menus/${cookId}${q}`);
  },

  myMenus: () =>
    api.get<{ menus: WeeklyMenu[] }>('/weekly-menus/my/all'),

  upsert: (weekStart: string, data: {
    title?: string;
    description?: string;
    items?: WeeklyMenuItem[];
    is_published?: boolean;
  }) => api.patch<{ menu: WeeklyMenu }>(`/weekly-menus/${weekStart}`, data),

  delete: (weekStart: string) =>
    api.delete<{ ok: boolean }>(`/weekly-menus/${weekStart}`),
};
