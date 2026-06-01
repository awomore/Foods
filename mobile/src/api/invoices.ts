import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking } from 'react-native';
import { api } from './client';

const WEB_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'https://foodsbyme-production.up.railway.app';

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled' | 'partial';
export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'converted';

export interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  cook_id: string;
  customer_id: string;
  order_id: string | null;
  catering_id: string | null;
  line_items: LineItem[];
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
  currency: string;
  status: InvoiceStatus;
  due_date: string | null;
  paid_at: string | null;
  paid_amount: number;
  notes: string | null;
  created_at: string;
  customer_name?: string;
  cook_name?: string;
}

export interface Quotation {
  id: string;
  quote_number: string;
  cook_id: string;
  customer_id: string;
  title: string | null;
  line_items: LineItem[];
  subtotal: number;
  discount_amount: number;
  total: number;
  currency: string;
  status: QuoteStatus;
  valid_until: string | null;
  notes: string | null;
  invoice_id: string | null;
  created_at: string;
  customer_name?: string;
  cook_name?: string;
}

export const invoicesApi = {
  create: (data: {
    customer_id: string;
    order_id?: string;
    catering_id?: string;
    line_items: LineItem[];
    subtotal: number;
    discount_amount?: number;
    tax_amount?: number;
    total: number;
    currency?: string;
    due_date?: string;
    notes?: string;
  }) => api.post<{ invoice: Invoice }>('/invoices', data),

  list: () =>
    api.get<{ invoices: Invoice[] }>('/invoices'),

  get: (id: string) =>
    api.get<{ invoice: Invoice }>(`/invoices/${id}`),

  send: (id: string) =>
    api.patch<{ invoice: Invoice }>(`/invoices/${id}/send`, {}),

  markPaid: (id: string, data: { tx_ref?: string; paid_amount?: number }) =>
    api.patch<{ invoice: Invoice }>(`/invoices/${id}/paid`, data),

  delete: (id: string) =>
    api.delete<{ ok: boolean }>(`/invoices/${id}`),

  // Open the branded invoice HTML page in the device browser.
  // The page includes the cook's brand colors/logo and a Print/Save PDF button.
  openBranded: async (id: string): Promise<void> => {
    const token = await AsyncStorage.getItem('auth_token');
    if (!token) throw new Error('Not authenticated');
    const url = `${WEB_BASE}/invoice/${id}?token=${encodeURIComponent(token)}`;
    await Linking.openURL(url);
  },
};

export const quotationsApi = {
  create: (data: {
    customer_id: string;
    title?: string;
    line_items: LineItem[];
    subtotal: number;
    discount_amount?: number;
    total: number;
    currency?: string;
    valid_until?: string;
    notes?: string;
  }) => api.post<{ quote: Quotation }>('/quotations', data),

  list: () =>
    api.get<{ quotes: Quotation[] }>('/quotations'),

  get: (id: string) =>
    api.get<{ quote: Quotation }>(`/quotations/${id}`),

  send: (id: string) =>
    api.patch<{ quote: Quotation }>(`/quotations/${id}/send`, {}),

  accept: (id: string) =>
    api.patch<{ quote: Quotation }>(`/quotations/${id}/accept`, {}),

  reject: (id: string) =>
    api.patch<{ quote: Quotation }>(`/quotations/${id}/reject`, {}),

  convert: (id: string, data: { due_date?: string; tax_amount?: number }) =>
    api.post<{ invoice: Invoice; quote_id: string }>(`/quotations/${id}/convert`, data),
};
