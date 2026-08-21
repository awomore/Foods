import { Linking } from 'react-native';
import { api } from './client';

const BACKEND_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'https://foodsbyme-api-production.up.railway.app';

export type BadgeTier = 'creator' | 'rising' | 'established' | 'elite';

// Instagram advanced access is gated on Meta business verification, which has sat
// in manual review since July 2026 — Meta support confirmed no action is available
// to us and declined to escalate. Until it clears, instagram_business_basic works
// only for accounts holding a role on the Meta app, so a real creator who taps
// Connect authorises and comes back to an opaque failure.
//
// This is NOT a decision to drop Instagram — the channel stays open and the whole
// OAuth path is intact behind it. Flip to true the day verification lands and
// Instagram returns everywhere at once, with no other change.
//
// Note the bio-code verification path in onboarding is unaffected either way: it
// never touches Meta, so Instagram can still be verified manually today.
export const INSTAGRAM_CONNECT_AVAILABLE = false;

export interface SocialOAuthEntry {
  channel_id?: string;
  handle?: string;
  display_name?: string;
  subscriber_count?: number;
  follower_count?: number;
  video_count?: number;
  view_count?: number;
  verified_at: string;
}

// Normalised, UI-ready view of one connected account, derived server-side.
// Prefer this over oauth_data: the flags below are computed for every row,
// including ones written before those keys existed.
export interface SocialAccount {
  platform: string;
  handle: string | null;
  display_name: string | null;
  // False means we proved the person controls an account but NOT which @handle
  // it is — TikTok's approved scope returns only a display name. Never render a
  // handle as verified when this is false.
  handle_verified: boolean;
  follower_count: number;
  // False means the platform withheld the count. follower_count is 0 in that
  // case and is NOT a real zero — show nothing rather than "0 followers".
  follower_count_known: boolean;
  verified_at: string | null;
}

export interface SocialVerifyStatus {
  platforms: string[];
  oauth_data: Record<string, SocialOAuthEntry>;
  accounts: SocialAccount[];
  // Derived from the largest single *measured* audience, not the sum of all
  // platforms, and recomputed on read — so it can differ from stored_badge_tier
  // on profiles last written by an older rule. Trust this one.
  badge_tier: BadgeTier | null;
  // The account carrying the most weight. Always derived, never creator-chosen.
  // Look it up in accounts[] and check follower_count_known before showing a count.
  primary_platform: string | null;
  stored_badge_tier: BadgeTier | null;
  legacy_verified: boolean;
  legacy_platform: string | null;
  legacy_handle: string | null;
}

// The bottom tier reads as a rank, and the bottom rank reads as a downgrade —
// worse than no badge at all. Below 'rising' show only the verified check and
// the primary platform. Gate every tier badge on this.
export function displayableBadgeTier(tier: BadgeTier | null): BadgeTier | null {
  return tier === 'rising' || tier === 'established' || tier === 'elite' ? tier : null;
}

// Gets a short-lived, single-use opaque token from the backend.
// This token is used in the OAuth browser URL instead of the real JWT,
// so the JWT is never exposed in the browser URL bar, access logs, or referrers.
async function getOAuthInitToken(): Promise<string> {
  const { init_token } = await api.post<{ init_token: string }>('/social-verify/oauth/init', {});
  return init_token;
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

  // ── OAuth flows ───────────────────────────────────────────────────────────
  // Opens a browser to the platform consent screen. After approval, the backend
  // deep-links back to:
  //   foodsbyme://social-verify/success?platform=<p>&handle=...&badge_tier=...
  // or foodsbyme://social-verify/error?platform=<p>&reason=...
  // Wire up a Linking.addEventListener in your screen to catch the result.
  connectYouTube: async (): Promise<void> => {
    const init_token = await getOAuthInitToken();
    await Linking.openURL(`${BACKEND_BASE}/api/social-verify/oauth/youtube?init_token=${init_token}`);
  },

  connectTikTok: async (): Promise<void> => {
    const init_token = await getOAuthInitToken();
    await Linking.openURL(`${BACKEND_BASE}/api/social-verify/oauth/tiktok?init_token=${init_token}`);
  },

  connectTwitter: async (): Promise<void> => {
    const init_token = await getOAuthInitToken();
    await Linking.openURL(`${BACKEND_BASE}/api/social-verify/oauth/twitter?init_token=${init_token}`);
  },

  connectInstagram: async (): Promise<void> => {
    const init_token = await getOAuthInitToken();
    await Linking.openURL(`${BACKEND_BASE}/api/social-verify/oauth/instagram?init_token=${init_token}`);
  },

  // ── Status ───────────────────────────────────────────────────────────────
  status: () =>
    api.get<SocialVerifyStatus>('/social-verify/status'),
};
