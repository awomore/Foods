import { api } from './client';
import type { CreatorBranding, CreatorType } from '../types';

export interface BrandingProfile extends CreatorBranding {
  id: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  creator_types: CreatorType[];
  instagram_handle?: string | null;
  tiktok_handle?: string | null;
  twitter_handle?: string | null;
  location?: string | null;
  average_rating?: number;
  platform_follower_count?: number;
  total_orders?: number;
}

export const creatorBrandingApi = {
  get: (cookId: string) =>
    api.get<{ branding: BrandingProfile }>(`/creator-branding/${cookId}`),

  getBySlug: (slug: string) =>
    api.get<{ branding: BrandingProfile }>(`/creator-branding/slug/${slug}`),

  update: (updates: Partial<CreatorBranding>) =>
    api.put<{ branding: BrandingProfile; message: string }>('/creator-branding', updates),

  updateCreatorTypes: (types: CreatorType[]) =>
    api.put<{ creator_types: CreatorType[] }>('/creator-branding/creator-types', { creator_types: types }),

  checkSlug: (slug: string) =>
    api.get<{ available: boolean; reason?: string }>(`/creator-branding/check-slug/${slug}`),
};
