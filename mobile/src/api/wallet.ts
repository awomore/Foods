import { api } from './client';

export interface WalletTransaction {
  id: string;
  customer_id: string;
  type: 'topup' | 'credit' | 'debit' | 'refund' | 'gift_redeem';
  amount_ngn: number;
  description: string | null;
  order_id: string | null;
  ref: string | null;
  created_at: string;
}

// A wallet holds one currency (fixed by its first top-up, switchable only while
// empty). `balance` is in `currency`; top-ups and payments must name it.
export const walletApi = {
  get: () =>
    api.get<{ balance: number; currency: string; transactions: WalletTransaction[] }>('/wallet'),

  topup: (data: { amount: number; currency: string; tx_ref?: string; flw_ref?: string }) =>
    api.post<{ transaction: WalletTransaction; balance: number; currency: string }>('/wallet/topup', data, { noRetry: true }),

  pay: (data: { amount: number; currency: string }) =>
    api.post<{ wallet_tx_ref: string; balance: number; currency: string }>('/wallet/pay', data, { noRetry: true }),
};
