import { api } from './client';

export type DiscountType = 'general_pct' | 'general_delivery' | 'loyalty_pct' | 'loyalty_freeitem';

export interface CookDiscount {
  id: string;
  cook_id: string;
  type: DiscountType;
  discount_value: number | null;
  min_orders_required: number;
  free_item_description: string | null;
  applies_to: string;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  claimed_count: number;
  created_at: string;
}

export const discountsApi = {
  list: () =>
    api.get<{ discounts: CookDiscount[] }>('/discounts'),

  byCook: (cookId: string) =>
    api.get<{ discounts: CookDiscount[] }>(`/discounts/cook/${cookId}`),

  create: (data: {
    type: DiscountType;
    discount_value?: number;
    min_orders_required?: number;
    free_item_description?: string;
    applies_to?: string;
    starts_at?: string;
    ends_at?: string;
  }) => api.post<{ discount: CookDiscount }>('/discounts', data),

  update: (id: string, data: Partial<Pick<CookDiscount, 'discount_value' | 'ends_at' | 'is_active' | 'applies_to'>>) =>
    api.patch<{ discount: CookDiscount }>(`/discounts/${id}`, data),

  remove: (id: string) =>
    api.delete<{ message: string }>(`/discounts/${id}`),
};
