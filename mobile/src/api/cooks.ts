import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking } from 'react-native';
import { api } from './client';

const BACKEND_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'https://foodsbyme-production.up.railway.app';

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
  twitter_handle: string | null;
  food_safety_verified: boolean;
  id_verified: boolean;
  health_certified: boolean;
  licensed_kitchen: boolean;
  professional_chef: boolean;
  trust_score: number;
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
  bank_name: string | null;
  bank_account_number: string | null;
  bank_account_name: string | null;
  bank_code: string | null;
  today_items: MenuItem[];
  enabled_modes: string[];
  active_discounts: Discount[];
  has_story: boolean;
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
  dietary_labels: string[];
  photos: string[];
  videos: string[];
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
  like_count?: number;
  craving_count?: number;
}

export interface ArchiveItem {
  id: string;
  title: string;
  photos: string[];
  unit_price: number;
  currency_code: string;
  dietary_labels: string[];
  allergens: string[];
  is_active: boolean;
  available_date: string | null;
  created_at: string;
  orders_count: number;
  craving_count: number;
  review_count: number;
  avg_rating: number;
  revenue: number;
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

export type CertType =
  | 'food_safety_certificate'
  | 'health_certificate'
  | 'cac_registration'
  | 'culinary_certification'
  | 'nafdac_approval'
  | 'government_permit';

export interface VerificationSubmission {
  id: string;
  cook_id: string;
  type: CertType;
  title: string | null;
  institution: string | null;
  document_url: string;
  status: 'pending' | 'approved' | 'rejected';
  review_notes: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  expires_at: string | null;
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

export const socialVerifyApi = {
  start: (platform: 'instagram' | 'tiktok' | 'twitter', handle: string) =>
    api.post<{ code: string; instructions: string; profile_url: string; handle: string; platform: string }>(
      '/social-verify/start', { platform, handle }
    ),
  check: () =>
    api.post<{ verified: true; platform: string; handle: string }>('/social-verify/check', {}),
  connectTikTok: async (): Promise<void> => {
    const token = await AsyncStorage.getItem('auth_token');
    if (!token) throw new Error('Not authenticated');
    await Linking.openURL(`${BACKEND_BASE}/api/social-verify/oauth/tiktok?token=${encodeURIComponent(token)}`);
  },
};

export const certificationsApi = {
  mine: () =>
    api.get<{ submissions: VerificationSubmission[] }>('/certifications/mine'),

  submit: (data: {
    type: CertType;
    title?: string;
    institution?: string;
    document_url: string;
    expires_at?: string;
  }) => api.post<{ submission: VerificationSubmission }>('/certifications', data),

  delete: (id: string) =>
    api.delete<{ message: string }>(`/certifications/${id}`),

  forCook: (cookId: string) =>
    api.get<{ submissions: VerificationSubmission[] }>(`/certifications/cook/${cookId}`),
};

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

  archive: (params?: { limit?: number; offset?: number }) => {
    const q = new URLSearchParams();
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.offset) q.set('offset', String(params.offset));
    return api.get<{ items: ArchiveItem[] }>(`/cooks/me/archive?${q}`);
  },

  updateHealthSpecialisations: (specialisations: string[]) =>
    api.patch<{ specialisations: string[]; is_health_kitchen: boolean }>(
      '/cooks/me/health-specialisations', { specialisations }
    ),

  updateKitchenMedia: (data: {
    kitchen_photos?: string[];
    profile_video_url?: string;
    banner_image_url?: string;
  }) => api.patch<{ kitchen_photos: string[]; profile_video_url: string | null; banner_image_url: string | null }>(
    '/cooks/me/kitchen-photos', data
  ),

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
    bank_code?: string;
    bank_account_number?: string;
    bank_account_name?: string;
    instagram_handle?: string;
    tiktok_handle?: string;
    youtube_url?: string;
    twitter_handle?: string;
    kitchen_photos?: string[];
    profile_video_url?: string;
  }) => api.post<{ cook: CookDetail }>('/cooks/onboard', data),
};
