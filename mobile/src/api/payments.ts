import { api } from './client';

export const paymentsApi = {
  initiate: (data: {
    amount: number;
    currency?: string;
    redirect_url: string;
    cart_items?: unknown[];
    meta?: Record<string, unknown>;
  }) => api.post<{ tx_ref: string; payment_link: string | null; dev_mode?: boolean }>('/payments/initiate', data),

  verify: (data: { tx_ref?: string; transaction_id?: string }) =>
    api.post<{
      verified: boolean;
      tx_ref?: string;
      amount?: number;
      currency?: string;
      payment_method?: string;
      transaction_id?: string;
      dev_mode?: boolean;
    }>('/payments/verify', data),
};
