import { client } from './client';
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
  get: async (cookId: string) => {
    const res = await client.get<{ branding: BrandingProfile }>(`/creator-branding/${cookId}`);
    return res.data;
  },

  getBySlug: async (slug: string) => {
    const res = await client.get<{ branding: BrandingProfile }>(`/creator-branding/slug/${slug}`);
    return res.data;
  },

  update: async (updates: Partial<CreatorBranding>) => {
    const res = await client.put<{ branding: BrandingProfile; message: string }>('/creator-branding', updates);
    return res.data;
  },

  updateCreatorTypes: async (types: CreatorType[]) => {
    const res = await client.put<{ creator_types: CreatorType[] }>('/creator-branding/creator-types', { creator_types: types });
    return res.data;
  },

  checkSlug: async (slug: string) => {
    const res = await client.get<{ available: boolean; reason?: string }>(`/creator-branding/check-slug/${slug}`);
    return res.data;
  },
};
