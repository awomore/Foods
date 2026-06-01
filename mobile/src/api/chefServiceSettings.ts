import { client } from './client';

export interface GuestTier {
  label: string;
  min_guests: number;
  max_guests: number;
  rate_per_head?: number;
  flat_rate?: number;
}

export interface ChefServiceSettings {
  id: string;
  cook_id: string;
  cities_served: string[];
  states_served: string[];
  travel_radius_km: number;
  nationwide: boolean;
  travel_fee_flat?: number;
  travel_fee_per_km?: number;
  hourly_rate?: number;
  day_rate?: number;
  event_rate?: number;
  minimum_spend?: number;
  guest_tiers: GuestTier[];
  notice_hours: number;
  deposit_pct: number;
  equipment_notes?: string;
  kitchen_notes?: string;
  ingredients_by_client: boolean;
  accommodation_required: boolean;
  updated_at: string;
}

export const chefServiceSettingsApi = {
  get: async (cookId: string) => {
    const res = await client.get<{ settings: ChefServiceSettings | null }>(`/chef-service-settings/${cookId}`);
    return res.data;
  },

  getMy: async () => {
    const res = await client.get<{ settings: ChefServiceSettings | null }>('/chef-service-settings/my/profile');
    return res.data;
  },

  updateGeography: async (payload: {
    cities_served?: string[];
    states_served?: string[];
    travel_radius_km?: number;
    nationwide?: boolean;
    travel_fee_flat?: number;
    travel_fee_per_km?: number;
  }) => {
    const res = await client.put<{ settings: ChefServiceSettings }>('/chef-service-settings/geography', payload);
    return res.data;
  },

  updatePricing: async (payload: {
    hourly_rate?: number;
    day_rate?: number;
    event_rate?: number;
    minimum_spend?: number;
    guest_tiers?: GuestTier[];
  }) => {
    const res = await client.put<{ settings: ChefServiceSettings }>('/chef-service-settings/pricing', payload);
    return res.data;
  },

  updateRequirements: async (payload: {
    notice_hours?: number;
    deposit_pct?: number;
    equipment_notes?: string;
    kitchen_notes?: string;
    ingredients_by_client?: boolean;
    accommodation_required?: boolean;
  }) => {
    const res = await client.put<{ settings: ChefServiceSettings }>('/chef-service-settings/requirements', payload);
    return res.data;
  },
};
