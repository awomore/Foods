import { api } from './client';

export interface CookCard {
  id: string;
  user_id: string;
  display_name: string;
  username: string;
  pronouns: 'she_her' | 'he_him' | 'they_them';
  bio: string | null;
  location: string | null;
  admin_area: string | null;
  latitude: number | null;
  longitude: number | null;
  distance_km: number;
  verification_status: string;
  average_rating: number;
  repeat_order_rate: number;
  total_orders: number;
  platform_follower_count: number;
  is_live: boolean;
  is_health_kitchen: boolean;
  instagram_handle: string | null;
  tiktok_handle: string | null;
  youtube_url: string | null;
  food_safety_verified: boolean;
  id_verified: boolean;
  storefront_title: string | null;
  storefront_bio: string | null;
  banner_image_url: string | null;
  kitchen_photos: string[];
  profile_video_url: string | null;
  open_time_default: string | null;
  close_time_default: string | null;
  currency_code: string;
  full_name: string;
  avatar_url: string | null;
  country_code: string;
  today_items: MenuItem[];
  enabled_modes: string[];
  active_discounts: Discount[];
}

export interface MenuItem {
  id: string;
  cook_id: string;
  mode: string;
  title: string;
  description: string | null;
  cook_note: string | null;
  cuisine_type: string | null;
  ethnic_tags: string[];
  ingredients: string[];
  allergens: string[];
  photos: string[];
  unit_price: number;
  currency_code: string;
  sides: Side[];
  total_slots: number;
  slots_claimed: number;
  available_date: string | null;
  delivery_window_start: string | null;
  delivery_window_end: string | null;
  realtime_available: boolean;
  realtime_slots: number;
  realtime_slots_claimed: number;
  is_surprise_drop: boolean;
  is_gold_early_access: boolean;
  is_active: boolean;
  created_at: string;
}

export interface Side {
  name: string;
  optional: boolean;
  included: boolean;
  price?: number;
}

export interface Discount {
  id: string;
  type: string;
  discount_value: number | null;
  min_orders_required: number;
  free_item_description: string | null;
  starts_at: string | null;
  ends_at: string | null;
}

export interface CookDetail extends CookCard {
  health_specialisations: string[];
  subscriber_count: number;
  active_discounts: Discount[];
}

export interface WeekPlan {
  id: string;
  cook_id: string;
  week_start_date: string;
  is_published: boolean;
  items: MenuItem[];
}

export const cooksApi = {
  list: (params?: {
    lat?: number;
    lng?: number;
    radius?: number;
    mode?: string;
    health?: boolean;
    limit?: number;
    offset?: number;
  }) => {
    const q = new URLSearchParams();
    if (params?.lat != null) q.set('lat', String(params.lat));
    if (params?.lng != null) q.set('lng', String(params.lng));
    if (params?.radius) q.set('radius', String(params.radius));
    if (params?.mode) q.set('mode', params.mode);
    if (params?.health) q.set('health', 'true');
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.offset) q.set('offset', String(params.offset));
    return api.get<{ cooks: CookCard[]; total: number }>(`/cooks?${q}`);
  },

  get: (id: string) =>
    api.get<{ cook: CookDetail; today_items: MenuItem[]; realtime_items: MenuItem[]; week_plan: WeekPlan | null }>(`/cooks/${id}`),

  update: (id: string, data: Partial<CookDetail>) =>
    api.patch<{ cook: CookDetail }>(`/cooks/${id}`, data),

  setLive: (id: string, is_live: boolean) =>
    api.patch<{ is_live: boolean }>(`/cooks/${id}/live`, { is_live }),

  getMenu: (id: string, params?: { from_date?: string; to_date?: string }) => {
    const q = new URLSearchParams(params as Record<string, string>);
    return api.get<{ items: MenuItem[] }>(`/cooks/${id}/menu?${q}`);
  },

  onboard: (data: {
    display_name: string;
    username: string;
    pronouns?: string;
    location?: string;
    admin_area?: string;
    latitude?: number;
    longitude?: number;
    bio?: string;
    bank_name?: string;
    bank_account_number?: string;
    bank_account_name?: string;
    instagram_handle?: string;
    tiktok_handle?: string;
    youtube_url?: string;
    kitchen_photos?: string[];
    profile_video_url?: string;
  }) => api.post<{ cook: CookDetail }>('/cooks/onboard', data),
};
