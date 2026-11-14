import { api } from './client';

export interface FxRatesResponse {
  base: 'USD';
  /** Units of each currency per 1 USD. */
  rates: Record<string, number>;
  source: string;
  fetched_at: string;
}

export const fxApi = {
  rates: () => api.get<FxRatesResponse>('/fx/rates'),
};
