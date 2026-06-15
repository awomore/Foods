import { api } from './client';

export interface DeliveryQuote {
  fee: number;
  currency: string;
  pickUpState: string;
  recipientState: string;
}

export const deliveryApi = {
  quote: (params: {
    cookId: string;
    recipientState: string;
    weight?: number;
  }) => {
    const q = new URLSearchParams({ cookId: params.cookId, recipientState: params.recipientState });
    if (params.weight != null) q.set('weight', String(params.weight));
    return api.get<DeliveryQuote>(`/delivery/quote?${q}`);
  },
};
