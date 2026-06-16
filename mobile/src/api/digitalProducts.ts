import { api } from './client';

export type DigitalProductType =
  | 'recipe_book' | 'meal_plan' | 'cookbook' | 'nutrition_guide'
  | 'shopping_list' | 'kitchen_guide' | 'other';

export interface DigitalProduct {
  id: string;
  cook_id: string;
  type: DigitalProductType;
  title: string;
  description: string | null;
  cover_image: string | null;
  file_url: string | null;
  preview_url: string | null;
  price: number;
  currency: string;
  is_published: boolean;
  download_count: number;
  page_count: number | null;
  tags: string[];
  created_at: string;
  cook_name?: string;
  cook_avatar?: string;
  slug: string | null;
}

export interface DigitalProductPurchase {
  id: string;
  product_id: string;
  user_id: string;
  purchased_at: string;
  download_url: string | null;
}

export const digitalProductsApi = {
  list: (params?: { cook_id?: string; type?: DigitalProductType; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.cook_id) q.set('cook_id', params.cook_id);
    if (params?.type) q.set('type', params.type);
    if (params?.limit) q.set('limit', String(params.limit));
    return api.get<{ products: DigitalProduct[] }>(`/digital-products?${q}`);
  },

  myProducts: () =>
    api.get<{ products: DigitalProduct[] }>('/digital-products/my'),

  get: (id: string) =>
    api.get<{ product: DigitalProduct }>(`/digital-products/${id}`),

  create: (data: {
    type: DigitalProductType;
    title: string;
    description?: string;
    cover_image?: string;
    file_url?: string;
    preview_url?: string;
    price?: number;
    page_count?: number;
    tags?: string[];
  }) => api.post<{ product: DigitalProduct }>('/digital-products', data),

  update: (id: string, data: Partial<DigitalProduct>) =>
    api.patch<{ product: DigitalProduct }>(`/digital-products/${id}`, data),

  purchase: (id: string, data: { tx_ref?: string; amount_paid?: number }) =>
    api.post<{ purchase: DigitalProductPurchase; access_granted: boolean }>(`/digital-products/${id}/purchase`, data),

  download: (id: string) =>
    api.get<{ download_url: string }>(`/digital-products/${id}/download`),

  sales: (id: string) =>
    api.get<{ buyers: any[]; total_revenue: number; copies_sold: number }>(`/digital-products/${id}/sales`),

  myPurchases: () =>
    api.get<{ purchases: any[] }>('/digital-products/my/purchases'),
};
