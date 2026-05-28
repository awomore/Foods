import { api } from './client';
import { User } from '../types';

export interface SendOtpResponse {
  message: string;
  dev_otp?: string;
}

export interface VerifyOtpResponse {
  token: string;
  user: User;
  is_new_user: boolean;
}

export const authApi = {
  sendOtp: (phone: string) =>
    api.post<SendOtpResponse>('/auth/send-otp', { phone }),

  verifyOtp: (phone: string, otp: string) =>
    api.post<VerifyOtpResponse>('/auth/verify-otp', { phone, otp }),

  getDevOtp: (phone: string) =>
    api.get<{ otp: string }>(`/auth/dev-otp?phone=${encodeURIComponent(phone)}`),

  getProfile: () => api.get<{ user: User }>('/auth/me'),

  updateProfile: (data: Partial<Pick<User, 'full_name' | 'email' | 'role' | 'phone' | 'avatar_url' | 'username'>>) =>
    api.patch<{ user: User }>('/auth/me', data),

  getPublicProfile: (userId: string) =>
    api.get<{ user: Pick<User, 'id' | 'full_name' | 'username' | 'avatar_url' | 'following_count' | 'follower_count'> }>(`/auth/profile/${userId}`),

  deleteAccount: (reason?: string) =>
    api.post<{ message: string }>('/auth/delete-account', { reason }),
};
