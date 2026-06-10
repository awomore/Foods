import { api } from './client';

export type StoryType = 'cooking_now' | 'available_today' | 'sold_out' | 'flash_sale' | 'live';
export type MediaType = 'photo' | 'video';

export interface Story {
  id: string;
  cook_id: string;
  type: StoryType;
  media_url: string | null;
  media_type: MediaType | null;
  caption: string | null;
  expires_at: string;
  created_at: string;
  has_viewed?: boolean;
  view_count?: number;
}

export interface StoryCook {
  id: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
  is_live: boolean;
}

export interface StoryFeedEntry {
  cook: StoryCook;
  stories: Story[];
  has_unseen: boolean;
}

export const storiesApi = {
  feed: () =>
    api.get<{ feed: StoryFeedEntry[] }>('/stories/feed'),

  forCook: (cookId: string) =>
    api.get<{ stories: Story[] }>(`/stories/cook/${cookId}`),

  create: (data: {
    type: StoryType;
    media_url?: string;
    media_type?: MediaType;
    media_cloudinary_id?: string;
    caption?: string;
  }) => api.post<{ story: Story }>('/stories', data),

  delete: (id: string) =>
    api.delete<{ message: string }>(`/stories/${id}`),

  markViewed: (id: string) =>
    api.post<{ ok: boolean }>(`/stories/${id}/view`, {}),
};

export const STORY_TYPE_LABELS: Record<StoryType, string> = {
  cooking_now: 'Cooking Now',
  available_today: 'Available Today',
  sold_out: 'Sold Out',
  flash_sale: 'Flash Sale',
  live: 'LIVE',
};

export const STORY_TYPE_COLORS: Record<StoryType, string> = {
  cooking_now:    '#B36A2E',
  available_today:'#2E7D32',
  sold_out:       '#757575',
  flash_sale:     '#C62828',
  live:           '#D32F2F',
};
