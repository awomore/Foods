import { api } from './client';

export interface CustomerHealthProfile {
  id: string;
  user_id: string;
  allergens: string[];
  dietary_preferences: string[];
  health_goals: string[];
  medical_conditions: string[];
  calorie_target: number | null;
  updated_at: string;
}

export const healthApi = {
  getProfile: () =>
    api.get<{ profile: CustomerHealthProfile }>('/health/customer/profile'),

  updateProfile: (data: Partial<Pick<CustomerHealthProfile, 'allergens' | 'dietary_preferences' | 'health_goals' | 'calorie_target'>>) =>
    api.patch<{ profile: CustomerHealthProfile }>('/health/customer/profile', data),
};
