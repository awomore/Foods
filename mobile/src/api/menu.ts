import { api } from './client';
import type { MenuItem } from './cooks';

export const menuApi = {
  byCook: (cookId: string, params?: { date?: string; mode?: string; week_start?: string }) => {
    const q = new URLSearchParams(params as Record<string, string>);
    return api.get<{ items: MenuItem[] }>(`/menu/cook/${cookId}?${q}`);
  },

  get: (id: string) =>
    api.get<{ item: MenuItem & { cook_name: string; cook_username: string; average_rating: number; repeat_order_rate: number; cook_location: string | null } }>(`/menu/${id}`),

  create: (data: {
    title: string;
    unit_price: number;
    photos: string[];
    mode?: string;
    description?: string;
    cook_note?: string;
    cuisine_type?: string;
    ethnic_tags?: string[];
    ingredients?: string[];
    allergens?: string[];
    sides?: Array<{ name: string; optional: boolean; included: boolean }>;
    total_slots?: number;
    available_date?: string;
    delivery_window_start?: string;
    delivery_window_end?: string;
    realtime_available?: boolean;
    realtime_slots?: number;
    is_surprise_drop?: boolean;
    meal_plan_id?: string;
  }) => api.post<{ item: MenuItem }>('/menu', data),

  update: (id: string, data: Partial<MenuItem>) =>
    api.patch<{ item: MenuItem }>(`/menu/${id}`, data),

  remove: (id: string) =>
    api.delete<{ message: string }>(`/menu/${id}`),

  createMealPlan: (week_start_date: string) =>
    api.post<{ meal_plan: { id: string; week_start_date: string; is_published: boolean } }>('/menu/meal-plans', { week_start_date }),

  publishMealPlan: (id: string) =>
    api.patch<{ meal_plan: { id: string; is_published: boolean } }>(`/menu/meal-plans/${id}/publish`, {}),
};
