import { api } from './client';

export interface ReferralStats {
  total_signups: number;
  qualified: number;
  rewarded: number;
  total_earned: number;
}

export interface MyReferrals {
  referral_code: string;
  share_url: string;
  reward_per_referral: number;
  currency: string;
  stats: ReferralStats;
  referrals: Array<{ id: string; status: string; signed_up_at: string | null }>;
}

export const referralsApi = {
  my: () => api.get<MyReferrals>('/referrals/my'),
  track: (ref_code: string, new_user_id: string) =>
    api.post<{ tracked: boolean }>('/referrals/track', { ref_code, new_user_id }),
};
