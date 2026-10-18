import { api } from './client';

type VerifyResult = {
  verified: boolean;
  tx_ref?: string;
  amount?: number;
  currency?: string;
  payment_method?: string;
  transaction_id?: string;
  dev_mode?: boolean;
};

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export const paymentsApi = {
  // provider says which rail took the charge: 'bachs' pays on its hosted
  // checkout page (payment_link); 'flutterwave' uses the inline form.
  initiate: (data: {
    amount: number;
    currency?: string;
    redirect_url: string;
    cart_items?: unknown[];
    meta?: Record<string, unknown>;
  }) => api.post<{ tx_ref: string; payment_link: string | null; provider?: string; dev_mode?: boolean }>('/payments/initiate', data, { noRetry: true }),

  // A hosted checkout can hand the buyer back a moment before the charge
  // settles, so a "not successful yet" answer is retried a few times.
  verify: async (data: { tx_ref?: string; transaction_id?: string; expected_amount?: number }, { attempts = 4 } = {}) => {
    for (let i = 1; ; i++) {
      try {
        return await api.post<VerifyResult>('/payments/verify', data);
      } catch (e: any) {
        if (i >= attempts || e?.error !== 'Payment not successful') throw e;
        await sleep(2000 * i);
      }
    }
  },
};
