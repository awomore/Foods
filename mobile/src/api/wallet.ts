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

export const walletApi = {
  get: () =>
    api.get<{ balance_ngn: number; transactions: WalletTransaction[] }>('/wallet'),

  topup: (data: { amount: number; tx_ref?: string; flw_ref?: string }) =>
    api.post<{ transaction: WalletTransaction; balance_ngn: number }>('/wallet/topup', data),

  pay: (data: { amount: number }) =>
    api.post<{ wallet_tx_ref: string; balance_ngn: number }>('/wallet/pay', data),
};
