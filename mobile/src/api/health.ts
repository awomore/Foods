import { api } from './client';

export interface CustomerHealthProfile {
  id: string;
  customer_id: string;
  allergens: string[];
  dietary_preferences: string[];
  conditions: string[];
  health_goals: string[];
  health_notes: string | null;
  is_visible_to_cooks: boolean;
  updated_at: string;
}

export const healthApi = {
  getProfile: () =>
    api.get<{ health_profile: CustomerHealthProfile }>('/health/customer/profile'),

  updateProfile: (data: Partial<Pick<CustomerHealthProfile, 'allergens' | 'dietary_preferences' | 'conditions' | 'health_goals' | 'health_notes' | 'is_visible_to_cooks'>>) =>
    api.patch<{ health_profile: CustomerHealthProfile }>('/health/customer/profile', data),
};
