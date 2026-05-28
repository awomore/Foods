export type UserRole = 'cook' | 'customer';

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
}

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

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface ApiError {
  error: string;
  status: number;
}
