import { api } from './client';
import type { CreatorType } from '../types';

export type SearchEntityType =
  | 'cook' | 'dish' | 'post' | 'course' | 'digital_product'
  | 'weekly_menu' | 'story' | 'customer_post' | 'service';

export interface SearchResult {
  id: string;
  name: string;
  image: string | null;
  description: string | null;
  entity_type: SearchEntityType;
  // common
  slug?: string | null;
  cook_id?: string;
  cook_name?: string;
  cook_slug?: string | null;
  // dish
  price?: number;
  dietary_labels?: string[];
  is_available?: boolean;
  video_url?: string | null;
  // cook
  rating?: number;
  trust_score?: number;
  food_safety_verified?: boolean;
  creator_types?: CreatorType[];
  profile_slug?: string | null;
  platform_follower_count?: number;
  accepts_private_chef?: boolean;
  accepts_catering?: boolean;
  // course
  enrollment_count?: number;
  difficulty_level?: string;
  is_free?: boolean;
  // post / customer_post
  post_type?: string;
  like_count?: number;
  video_thumbnail?: string | null;
  author_name?: string;
  author_avatar?: string | null;
}

export interface SearchSuggestion {
  label: string;
  type: string;
  id?: string;
  slug?: string | null;
  image?: string | null;
}

export interface SearchResults {
  cooks?:           SearchResult[];
  dishes?:          SearchResult[];
  posts?:           SearchResult[];
  courses?:         SearchResult[];
  digital_products?: SearchResult[];
  services?:        SearchResult[];
  weekly_menus?:    SearchResult[];
  stories?:         SearchResult[];
  customer_posts?:  SearchResult[];
}

export interface SearchTrending {
  query: string;
  count: number;
}

export interface SearchHistoryItem {
  query: string;
  result_type: string | null;
  created_at: string;
}

export const searchApi = {
  search: (params: {
    q: string;
    type?: SearchEntityType;
    creator_type?: CreatorType;
    limit?: number;
    offset?: number;
  }) => {
    const q = new URLSearchParams();
    q.set('q', params.q);
    if (params.type) q.set('type', params.type);
    if (params.creator_type) q.set('creator_type', params.creator_type);
    if (params.limit) q.set('limit', String(params.limit));
    if (params.offset) q.set('offset', String(params.offset));
    return api.get<{ results: SearchResults; suggestions: SearchSuggestion[]; query: string }>(`/search?${q}`);
  },

  autocomplete: (q: string) =>
    api.get<{ suggestions: SearchSuggestion[] }>(`/search/autocomplete?q=${encodeURIComponent(q)}`),

  trending: () =>
    api.get<{ trending: SearchTrending[] }>('/search/trending'),

  recent: (userId: string) =>
    api.get<{ recent: SearchHistoryItem[] }>(`/search/recent?userId=${encodeURIComponent(userId)}`),

  saveRecent: (userId: string, query: string, result_type?: string) => {
    api.post('/search/recent', { userId, query, result_type }).catch(() => {});
  },

  clearRecent: (userId: string) =>
    api.delete<{ cleared: boolean }>(`/search/recent/${userId}`),
};
