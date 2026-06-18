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

export interface SocialAuthResponse {
  token: string;
  user: User;
  is_new_user: boolean;
}

export const authApi = {
  socialAuth: (provider: 'google' | 'apple', access_token: string, email?: string, full_name?: string) =>
    api.post<SocialAuthResponse>('/auth/social', { provider, access_token, email, full_name }),

  setRole: (role: 'customer' | 'cook') =>
    api.post<{ user: User }>('/auth/set-role', { role }),

  sendOtp: (phone: string) =>
    api.post<SendOtpResponse>('/auth/send-otp', { phone }),

  verifyOtp: (phone: string, otp: string, tosAccepted = false) =>
    api.post<VerifyOtpResponse>('/auth/verify-otp', { phone, otp, tos_accepted: tosAccepted }),

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
