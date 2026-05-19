import { api } from './client';
import type { CookCard, MenuItem } from './cooks';

export const discoverApi = {
  search: (params: {
    q?: string;
    mode?: string;
    health?: boolean;
    dietary?: string;
    lat?: number;
    lng?: number;
    radius?: number;
    min_price?: number;
    max_price?: number;
    sort?: 'rating' | 'distance' | 'followers';
    available_now?: boolean;
    limit?: number;
    offset?: number;
  }) => {
    const q = new URLSearchParams();
    if (params.q) q.set('q', params.q);
    if (params.mode) q.set('mode', params.mode);
    if (params.health) q.set('health', 'true');
    if (params.dietary) q.set('dietary', params.dietary);
    if (params.lat != null) q.set('lat', String(params.lat));
    if (params.lng != null) q.set('lng', String(params.lng));
    if (params.radius) q.set('radius', String(params.radius));
    if (params.min_price != null) q.set('min_price', String(params.min_price));
    if (params.max_price != null) q.set('max_price', String(params.max_price));
    if (params.sort) q.set('sort', params.sort);
    if (params.available_now) q.set('available_now', 'true');
    if (params.limit) q.set('limit', String(params.limit));
    if (params.offset) q.set('offset', String(params.offset));
    return api.get<{
      cooks: CookCard[];
      dishes: (MenuItem & { cook_name: string; cook_username: string; cook_rating: number; cook_location: string | null; distance_km: number })[];
      health_kitchens: CookCard[];
      total: number;
    }>(`/discover?${q}`);
  },
};
