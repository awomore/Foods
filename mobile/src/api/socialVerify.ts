import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking } from 'react-native';
import { api } from './client';

const BACKEND_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'https://foodsbyme-production.up.railway.app';

export interface SocialOAuthEntry {
  channel_id?: string;
  handle?: string;
  subscriber_count?: number;
  follower_count?: number;
  video_count?: number;
  view_count?: number;
  verified_at: string;
}

export interface SocialVerifyStatus {
  platforms: string[];
  oauth_data: Record<string, SocialOAuthEntry>;
  badge_tier: 'creator' | 'rising' | 'established' | 'elite' | null;
  legacy_verified: boolean;
  legacy_platform: string | null;
  legacy_handle: string | null;
}

export const socialVerifyApi = {
  // ── Manual bio-code flow (Instagram, TikTok, X) ──────────────────────────
  start: (platform: string, handle: string) =>
    api.post<{ code: string; instructions: string; profile_url: string }>(
      '/social-verify/start', { platform, handle }
    ),

  check: () =>
    api.post<{ verified: boolean; platform: string; handle: string }>(
      '/social-verify/check', {}
    ),

  // ── OAuth flow (YouTube / Google) ────────────────────────────────────────
  // Opens the browser to the Google consent screen. After the user approves,
  // Google redirects back to the backend, which deep-links to:
  //   foodsbyme://social-verify/success?platform=youtube&handle=@...&subscriber_count=...
  // or foodsbyme://social-verify/error?platform=youtube&reason=...
  // Wire up a Linking.addEventListener in your screen to catch the result.
  connectYouTube: async (): Promise<void> => {
    const token = await AsyncStorage.getItem('auth_token');
    if (!token) throw new Error('Not authenticated');
    const url = `${BACKEND_BASE}/api/social-verify/oauth/youtube?token=${encodeURIComponent(token)}`;
    await Linking.openURL(url);
  },

  // ── Status ───────────────────────────────────────────────────────────────
  status: () =>
    api.get<SocialVerifyStatus>('/social-verify/status'),
};
