import { api } from './client';

export const SPECIALISATION_LABELS: Record<string, string> = {
  diabetes:          'Diabetes',
  weight_loss:       'Weight Loss',
  heart_health:      'Heart Health',
  pregnancy:         'Pregnancy',
  postpartum:        'Postpartum',
  child_nutrition:   'Child Nutrition',
  keto:              'Keto',
  low_sodium:        'Low Sodium',
  high_protein:      'High Protein',
  gut_health:        'Gut Health',
  anti_inflammatory: 'Anti-Inflammatory',
  general_wellness:  'General Wellness',
  vegan:             'Vegan',
  vegetarian:        'Vegetarian',
  gluten_free:       'Gluten-Free',
  dairy_free:        'Dairy-Free',
  halal:             'Halal',
  low_carb:          'Low Carb',
};

export const SPECIALISATION_ICONS: Record<string, string> = {
  diabetes:          'water-outline',
  weight_loss:       'trending-down-outline',
  heart_health:      'heart-outline',
  pregnancy:         'happy-outline',
  postpartum:        'body-outline',
  child_nutrition:   'people-outline',
  keto:              'flame-outline',
  low_sodium:        'remove-circle-outline',
  high_protein:      'barbell-outline',
  gut_health:        'leaf-outline',
  anti_inflammatory: 'shield-outline',
  general_wellness:  'sunny-outline',
  vegan:             'leaf-outline',
  vegetarian:        'nutrition-outline',
  gluten_free:       'ban-outline',
  dairy_free:        'ban-outline',
  halal:             'moon-outline',
  low_carb:          'speedometer-outline',
};

export interface HealthKitchen {
  id: string;
  display_name: string;
  avatar_url: string | null;
  location: string | null;
  average_rating: number;
  total_orders: number;
  is_live: boolean;
  health_credential_type: 'nutritionist' | 'dietician' | 'health_cook' | null;
  health_credential_verified: boolean;
  specialisations: string[];
  plan_count: number;
  distance_km: number;
}

export interface MealPlan {
  id: string;
  creator_id: string;
  creator_name: string;
  creator_avatar: string | null;
  health_credential_type: string | null;
  health_credential_verified: boolean;
  title: string;
  description: string | null;
  target_condition: string | null;
  duration_weeks: number;
  meals_per_day: number;
  price: number;
  currency: string;
  is_published: boolean;
  subscriber_count: number;
  specialisations: string[];
  created_at: string;
}

export interface MealPlanItem {
  id: string;
  plan_id: string;
  week_number: number;
  day_number: number;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  title: string;
  description: string | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  linked_menu_item_id: string | null;
}

export interface PlanSubscription {
  id: string;
  user_id: string;
  plan_id: string;
  creator_id: string;
  status: 'active' | 'paused' | 'cancelled';
  started_at: string;
  expires_at: string | null;
  title?: string;
  description?: string | null;
  target_condition?: string | null;
  creator_name?: string;
  creator_avatar?: string | null;
}

export interface Subscriber {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  granted_at: string;
  is_active: boolean;
  health_goals: string[];
  conditions: string[];
  allergens: string[];
  dietary_preferences: string[];
  active_plan_count: number;
  active_plan_title: string | null;
}

export interface FeedingOrder {
  id: string;
  created_at: string;
  item_title: string;
  quantity: number;
  total_price: number;
  status: string;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  dietary_tags: string[];
}

export interface DailySummary {
  date: string;
  order_count: number;
  total_spend: number;
  total_calories: number;
}

export interface FeedingHistory {
  orders: FeedingOrder[];
  daily_summary: DailySummary[];
  health_profile: {
    health_goals: string[];
    conditions: string[];
    allergens: string[];
    dietary_preferences: string[];
    health_notes: string | null;
  } | null;
}

export interface ConsentRecord {
  id: string;
  user_id: string;
  creator_id: string;
  creator_name: string;
  creator_avatar: string | null;
  granted_at: string;
  revoked_at: string | null;
  is_active: boolean;
}

export const healthKitchenApi = {
  // Discovery
  listKitchens: (params?: { specialisation?: string; lat?: number; lng?: number; limit?: number }) =>
    api.get<{ kitchens: HealthKitchen[] }>('/health/kitchens', { params }),

  subscribeToKitchen: (cookId: string) =>
    api.post<{ subscription: any }>(`/health/kitchens/${cookId}/subscribe`, {}),

  // Plans — public browse
  listPlans: (params?: { condition?: string; limit?: number; offset?: number }) =>
    api.get<{ plans: MealPlan[] }>('/health/plans', { params }),

  getPlan: (id: string) =>
    api.get<{ plan: MealPlan; items: MealPlanItem[] }>(`/health/plans/${id}`),

  subscribeToPlan: (planId: string) =>
    api.post<{ subscription: PlanSubscription }>(`/health/plans/${planId}/subscribe`, {}),

  myPlans: () =>
    api.get<{ subscriptions: PlanSubscription[] }>('/health/my-plans'),

  cancelPlan: (subId: string) =>
    api.patch<{ subscription: PlanSubscription }>(`/health/my-plans/${subId}/cancel`, {}),

  // Creator — manage own plans
  myCreatorPlans: () =>
    api.get<{ plans: MealPlan[] }>('/health/plans/mine'),

  createPlan: (data: Partial<MealPlan>) =>
    api.post<{ plan: MealPlan }>('/health/plans', data),

  updatePlan: (id: string, data: Partial<MealPlan>) =>
    api.patch<{ plan: MealPlan }>(`/health/plans/${id}`, data),

  addPlanItem: (planId: string, data: Partial<MealPlanItem>) =>
    api.post<{ item: MealPlanItem }>(`/health/plans/${planId}/items`, data),

  updatePlanItem: (planId: string, itemId: string, data: Partial<MealPlanItem>) =>
    api.patch<{ item: MealPlanItem }>(`/health/plans/${planId}/items/${itemId}`, data),

  deletePlanItem: (planId: string, itemId: string) =>
    api.delete<{ ok: boolean }>(`/health/plans/${planId}/items/${itemId}`),

  // Subscribers + feeding history
  mySubscribers: () =>
    api.get<{ subscribers: Subscriber[] }>('/health/subscribers'),

  getFeedingHistory: (userId: string) =>
    api.get<FeedingHistory>(`/health/feeding-history/${userId}`),

  // Consent
  myConsents: () =>
    api.get<{ consents: ConsentRecord[] }>('/health/consent'),

  revokeConsent: (creatorId: string) =>
    api.patch<{ consent: ConsentRecord }>(`/health/consent/${creatorId}/revoke`, {}),
};
