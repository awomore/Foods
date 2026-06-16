import { api } from './client';

export interface AffiliateLink {
  id: string;
  cook_id: string;
  code: string;
  url: string;
  title: string | null;
  description: string | null;
  commission_rate: number;
  click_count: number;
  conversion_count: number;
  total_earned: number;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
}

export const affiliateApi = {
  list: () =>
    api.get<{ links: AffiliateLink[] }>('/affiliate/my'),

  create: (data: { url: string; title?: string; description?: string; commission_rate?: number; expires_at?: string }) =>
    api.post<{ link: AffiliateLink }>('/affiliate', data),

  update: (id: string, data: Partial<Pick<AffiliateLink, 'title' | 'description' | 'commission_rate' | 'is_active' | 'expires_at'>>) =>
    api.patch<{ link: AffiliateLink }>(`/affiliate/${id}`, data),

  remove: (id: string) =>
    api.delete<{ message: string }>(`/affiliate/${id}`),
};
