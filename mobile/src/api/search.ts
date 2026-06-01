import { api } from './client';

export type SearchEntityType =
  | 'cook' | 'dish' | 'post' | 'course' | 'digital_product' | 'weekly_menu';

export interface SearchResult {
  id: string;
  name: string;
  image: string | null;
  description: string | null;
  entity_type: SearchEntityType;
  // dish fields
  price?: number;
  cook_name?: string;
  cook_id?: string;
  dietary_labels?: string[];
  is_available?: boolean;
  // cook fields
  rating?: number;
  trust_score?: number;
  food_safety_verified?: boolean;
  // course fields
  enrollment_count?: number;
  difficulty_level?: string;
  is_free?: boolean;
  // post fields
  post_type?: string;
  like_count?: number;
}

export interface SearchSuggestion {
  label: string;
  type: SearchEntityType;
  id?: string;
}

export interface SearchResults {
  cooks?: SearchResult[];
  dishes?: SearchResult[];
  posts?: SearchResult[];
  courses?: SearchResult[];
  digital_products?: SearchResult[];
  weekly_menus?: SearchResult[];
}

export const searchApi = {
  search: (params: {
    q: string;
    type?: SearchEntityType;
    limit?: number;
    offset?: number;
  }) => {
    const q = new URLSearchParams();
    q.set('q', params.q);
    if (params.type) q.set('type', params.type);
    if (params.limit) q.set('limit', String(params.limit));
    if (params.offset) q.set('offset', String(params.offset));
    return api.get<{ results: SearchResults; suggestions: SearchSuggestion[]; query: string }>(`/search?${q}`);
  },

  autocomplete: (q: string) =>
    api.get<{ suggestions: SearchSuggestion[] }>(`/search/autocomplete?q=${encodeURIComponent(q)}`),
};
