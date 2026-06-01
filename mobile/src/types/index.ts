export type UserRole = 'cook' | 'customer';

// ── Part A: Creator Identity ──────────────────────────────────────────────────
export type CreatorType =
  | 'home_cook'
  | 'chef'
  | 'pastry_chef'
  | 'baker'
  | 'mixologist'
  | 'caterer'
  | 'culinary_instructor'
  | 'food_brand';

export const CREATOR_TYPE_LABELS: Record<CreatorType, string> = {
  home_cook:           'Home Cook',
  chef:                'Chef',
  pastry_chef:         'Pastry Chef',
  baker:               'Baker',
  mixologist:          'Mixologist',
  caterer:             'Caterer',
  culinary_instructor: 'Culinary Instructor',
  food_brand:          'Food Brand',
};

export const CREATOR_TYPE_ICONS: Record<CreatorType, string> = {
  home_cook:           'home-outline',
  chef:                'restaurant-outline',
  pastry_chef:         'color-palette-outline',
  baker:               'cafe-outline',
  mixologist:          'wine-outline',
  caterer:             'people-outline',
  culinary_instructor: 'school-outline',
  food_brand:          'storefront-outline',
};

/** Tabs each creator type surfaces on their storefront */
export const CREATOR_TYPE_TABS: Record<CreatorType, string[]> = {
  home_cook:           ['today','archive','weekly','store','courses','community','reviews'],
  chef:                ['today','archive','weekly','services','store','courses','community','reviews'],
  pastry_chef:         ['today','archive','store','courses','community','reviews'],
  baker:               ['today','archive','store','community','reviews'],
  mixologist:          ['today','archive','store','services','community','reviews'],
  caterer:             ['services','weekly','store','courses','community','reviews'],
  culinary_instructor: ['courses','store','content','community','reviews'],
  food_brand:          ['store','courses','content','community','reviews'],
};

// ── Part B: Creator Branding ──────────────────────────────────────────────────
export interface BrandColors {
  primary:   string;
  secondary: string;
  accent:    string;
}

export interface CreatorBranding {
  cover_image?:      string | null;
  brand_logo?:       string | null;
  brand_colors?:     BrandColors;
  typography_theme?: 'default' | 'modern' | 'classic' | 'bold';
  social_banner?:    string | null;
  profile_slug?:     string | null;
}

// ── Core user + profile types ─────────────────────────────────────────────────
export interface User {
  id: string;
  phone: string;
  role: UserRole;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  username: string | null;
  following_count: number;
  follower_count: number;
  is_verified: boolean;
  created_at: string;
  cook_id: string | null;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface CookProfile {
  id: string;
  user_id: string;
  bio: string | null;
  kitchen_name: string | null;
  location: string | null;
  cuisine_types: string[];
  rating: number;
  total_reviews: number;
  is_available: boolean;
  // Phase 6
  creator_types: CreatorType[];
  profile_slug: string | null;
  cover_image: string | null;
  brand_logo: string | null;
  brand_colors: BrandColors | null;
  typography_theme: string | null;
  social_banner: string | null;
}

// ── Part D: Video fields ──────────────────────────────────────────────────────
export interface MenuItem {
  id: string;
  cook_id: string;
  name: string;
  description: string | null;
  price: number;
  images: string[];
  category: string | null;
  is_available: boolean;
  prep_time_minutes: number | null;
  allergens: string[];
  // Phase 6
  video_url?: string | null;
  video_thumbnail?: string | null;
  slug?: string | null;
}

export interface Order {
  id: string;
  customer_id: string;
  cook_id: string;
  status: OrderStatus;
  items: OrderItem[];
  total_amount: number;
  delivery_address: string | null;
  notes: string | null;
  created_at: string;
}

export type OrderStatus =
  | 'pending'
  | 'accepted'
  | 'preparing'
  | 'ready'
  | 'picked_up'
  | 'delivered'
  | 'cancelled';

export interface OrderItem {
  menu_item_id: string;
  name: string;
  quantity: number;
  unit_price: number;
}

// ── Part J: Customer posts ────────────────────────────────────────────────────
export interface CustomerPost {
  id: string;
  user_id: string;
  body: string | null;
  photo_urls: string[];
  video_url: string | null;
  video_thumbnail: string | null;
  tagged_cook_ids: string[];
  mention_user_ids: string[];
  order_id: string | null;
  like_count: number;
  comment_count: number;
  repost_count: number;
  status: 'published' | 'removed';
  created_at: string;
  // joined
  author_name?: string;
  author_avatar?: string | null;
  author_id?: string;
}

// ── Search ────────────────────────────────────────────────────────────────────
export interface SearchSuggestion {
  label: string;
  type: string;
  id?: string;
  slug?: string | null;
  image?: string | null;
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

// ── API ───────────────────────────────────────────────────────────────────────
export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface ApiError {
  error: string;
  status: number;
}
