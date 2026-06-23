import { api } from './client';

export interface DeliveryQuote {
  fee: number;
  currency: string;
  pickUpState: string;
  recipientState: string;
}

export interface RelayQuote {
  feeId: number;
  totalAmount: number;
  deliveryAmount: number;
  safetyFee: number;
  currency: string;
}

export const deliveryApi = {
  /** Fez quote — uses Nigerian state names, no coordinates needed. */
  quote: (params: {
    cookId: string;
    recipientState: string;
    weight?: number;
  }) => {
    const q = new URLSearchParams({ cookId: params.cookId, recipientState: params.recipientState });
    if (params.weight != null) q.set('weight', String(params.weight));
    return api.get<DeliveryQuote>(`/delivery/quote?${q}`);
  },

  /** Relay quote — requires lat/lng for both cook and customer. */
  relayQuote: (params: {
    cookId: string;
    destLat: number;
    destLng: number;
    estimatedOrderAmount?: number;
  }) =>
    api.post<RelayQuote>('/delivery/relay/quote', params),
};
