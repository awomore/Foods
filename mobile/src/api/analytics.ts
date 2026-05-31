import { api } from './client';

export interface CreatorOverview {
  period_days: number;
  current: {
    revenue: number;
    orders: number;
    new_customers: number;
    repeat_customers: number;
    content_reach: number;
    profile_views: number;
    dish_views: number;
    followers: number;
    new_followers: number;
    lost_followers: number;
    net_followers: number;
    engagements: number;
  };
  deltas: {
    revenue_pct: number;
    orders_pct: number;
    new_customers_pct: number;
    content_reach_pct: number;
    profile_views_pct: number;
  };
}

export interface FollowerSnapshot {
  date: string;
  follower_count: number;
}

export interface DailyChange {
  date: string;
  new_followers: number;
  lost_followers: number;
  net_change: number;
}

export interface ContentPost {
  id: string;
  title: string | null;
  body: string;
  post_type: string;
  status: string;
  created_at: string;
  photo_urls: string[];
  view_count: number;
  unique_viewers: number;
  like_count: number;
  comment_count: number;
  share_count: number;
  bookmark_count: number;
  order_click_count: number;
  orders_from_post: number;
  revenue_from_post: number;
}

export interface DishPerformance {
  id: string;
  title: string;
  unit_price: number;
  photos: string[];
  is_active: boolean;
  total_slots: number;
  slots_claimed: number;
  view_count: number;
  unique_viewers: number;
  like_count: number;
  craving_count: number;
  cart_add_count: number;
  order_count: number;
  total_revenue: number;
  repeat_order_count: number;
  view_to_cart_rate: number | null;
  cart_to_order_rate: number | null;
  slot_fill_rate: number | null;
  avg_order_value: number | null;
}

export interface TopCustomer {
  full_name: string;
  avatar_url: string | null;
  order_count: number;
  total_spent: number;
  last_order_at: string;
  first_order_at: string;
  is_repeat: boolean;
}

export interface CohortMonth {
  cohort_month: string;
  total_customers: number;
  repeat_customers: number;
  cohort_revenue: number;
}

export interface TopCraving {
  dish_title: string;
  craving_count: number;
  fulfilled_count: number;
  suggested_price: number | null;
  unique_cravings: number;
  latest_craving_at: string;
}

export const analyticsApi = {
  overview: (days = 30) =>
    api.get<CreatorOverview>(`/analytics/creator/overview?days=${days}`),

  followers: (days = 30) =>
    api.get<{ current_followers: number; snapshots: FollowerSnapshot[]; daily_changes: DailyChange[] }>(
      `/analytics/creator/followers?days=${days}`
    ),

  content: (params?: { limit?: number; offset?: number; sort?: string }) => {
    const q = new URLSearchParams();
    if (params?.limit)  q.set('limit',  String(params.limit));
    if (params?.offset) q.set('offset', String(params.offset));
    if (params?.sort)   q.set('sort',   params.sort);
    return api.get<{ posts: ContentPost[]; totals: Record<string, number> }>(
      `/analytics/creator/content?${q}`
    );
  },

  dishes: (params?: { limit?: number; offset?: number; sort?: string }) => {
    const q = new URLSearchParams();
    if (params?.limit)  q.set('limit',  String(params.limit));
    if (params?.offset) q.set('offset', String(params.offset));
    if (params?.sort)   q.set('sort',   params.sort);
    return api.get<{ dishes: DishPerformance[] }>(`/analytics/creator/dishes?${q}`);
  },

  audience: () =>
    api.get<{
      total_customers: number;
      repeat_customers: number;
      repeat_rate: number;
      avg_orders_per_customer: string;
      segments: Record<string, { value: string; customers: number; orders: number; revenue: number }[]>;
    }>('/analytics/creator/audience'),

  orders: (days = 30) =>
    api.get<{ time_series: unknown[]; cohort_summary: CohortMonth[]; top_customers: TopCustomer[] }>(
      `/analytics/creator/orders?days=${days}`
    ),

  cravings: () =>
    api.get<{
      top_cravings: TopCraving[];
      total_cravings: number;
      fulfilled_cravings: number;
      fulfillment_rate: number;
      post_conversion_revenue: number;
      post_conversion_orders: number;
    }>('/analytics/creator/cravings'),
};
