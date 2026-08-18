import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { Fonts, Spacing, Radius, FontSize } from '../../src/constants/theme';
import {
  socialVerifyApi, displayableBadgeTier,
  type SocialVerifyStatus, type SocialAccount, type BadgeTier,
} from '../../src/api/socialVerify';
import { useFeedback } from '../../src/components/feedback';
import { Bone } from '../../src/components/ui/Skeleton';
import { useTranslation } from 'react-i18next';

type PlatformKey = 'instagram' | 'tiktok' | 'twitter' | 'youtube';

// Instagram advanced access is gated on Meta business verification, which has sat
// queued on Meta's side since July 2026 — support confirmed no action is available
// to us and declined to escalate. Until it clears, instagram_business_basic only
// works for accounts holding a role on the Meta app, so a real creator tapping
// Connect gets an opaque OAuth failure with nothing they can do about it. Saying
// "coming soon" is the honest version of the same outcome.
//
// Flip this to true the day verification clears. Nothing else needs to change.
const INSTAGRAM_CONNECT_AVAILABLE = false;

const PLATFORMS: { key: PlatformKey; label: string; icon: string; connect: () => Promise<void> }[] = [
  { key: 'instagram', label: 'Instagram', icon: 'logo-instagram', connect: socialVerifyApi.connectInstagram },
  { key: 'tiktok',    label: 'TikTok',    icon: 'logo-tiktok',    connect: socialVerifyApi.connectTikTok },
  { key: 'twitter',   label: 'X',         icon: 'logo-twitter',   connect: socialVerifyApi.connectTwitter },
  { key: 'youtube',   label: 'YouTube',   icon: 'logo-youtube',   connect: socialVerifyApi.connectYouTube },
];

const TIER_ICON: Record<BadgeTier, string> = {
  creator: 'ribbon-outline', rising: 'trending-up', established: 'star', elite: 'diamond',
};

export default function ConnectedAccountsScreen() {
  const router = useRouter();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const feedback = useFeedback();
  const { t } = useTranslation();

  const [status, setStatus] = useState<SocialVerifyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<PlatformKey | null>(null);

  const load = useCallback(async () => {
    try {
      setStatus(await socialVerifyApi.status());
    } catch {
      feedback.error(t('connected_accounts.load_failed'), t('connected_accounts.load_failed_body'));
    } finally {
      setLoading(false);
    }
  }, [feedback, t]);

  useEffect(() => { load(); }, [load]);

  // The OAuth flow leaves the app for a browser and returns via deep link.
  // Deliberately an event listener rather than expo-linking's useURL(): useURL
  // replays the URL the app was opened with, so re-entering this screen after a
  // connection would re-fire a stale success toast.
  useEffect(() => {
    const sub = Linking.addEventListener('url', ({ url }) => {
      if (!url.startsWith('foodsbyme://social-verify/')) return;
      const parsed = new URL(url);
      const platform = (parsed.searchParams.get('platform') ?? '') as PlatformKey;
      const label = PLATFORMS.find(p => p.key === platform)?.label ?? platform;
      setConnecting(null);

      if (parsed.pathname === '/success') {
        // The backend sends `handle` only for platforms whose scope returns a
        // real one — TikTok sends display_name instead, which is not a handle.
        const handle = parsed.searchParams.get('handle');
        feedback.success(
          t('connected_accounts.connected_title', { platform: label }),
          handle ? t('connected_accounts.connected_as', { handle }) : t('connected_accounts.connected_body', { platform: label }),
        );
        load();
      } else if (parsed.pathname === '/error') {
        const reason = parsed.searchParams.get('reason') ?? 'unknown_error';
        feedback.error(
          t('connected_accounts.failed_title', { platform: label }),
          reason === 'handle_mismatch'
            ? t('connected_accounts.handle_mismatch', { platform: label })
            : reason.replace(/_/g, ' '),
        );
      }
    });
    return () => sub.remove();
  }, [feedback, load, t]);

  const onConnect = useCallback(async (p: typeof PLATFORMS[number]) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setConnecting(p.key);
    try {
      await p.connect();
    } catch {
      setConnecting(null);
      feedback.error(
        t('connected_accounts.failed_title', { platform: p.label }),
        t('connected_accounts.open_failed', { platform: p.label }),
      );
    }
  }, [feedback, t]);

  const accounts = status?.accounts ?? [];
  const byPlatform = useMemo(
    () => Object.fromEntries(accounts.map(a => [a.platform, a])) as Record<string, SocialAccount>,
    [accounts],
  );

  // Never show the bottom tier: a lowest rank reads as a downgrade, worse than
  // no badge at all.
  const tier = displayableBadgeTier(status?.badge_tier ?? null);
  const primary = status?.primary_platform ? byPlatform[status.primary_platform] : undefined;
  const primaryLabel = PLATFORMS.find(p => p.key === status?.primary_platform)?.label ?? status?.primary_platform;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('connected_accounts.title')}</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>{t('connected_accounts.intro')}</Text>

        {loading ? (
          <View style={{ gap: Spacing.sm }}>
            <Bone height={78} radius={Radius.lg} />
            <Bone height={78} radius={Radius.lg} />
            <Bone height={78} radius={Radius.lg} />
            <Bone height={78} radius={Radius.lg} />
          </View>
        ) : (
          <>
            {/* ── Standing ────────────────────────────────────────────────── */}
            {(tier || primary) && (
              <View style={styles.standing}>
                <View style={styles.standingRow}>
                  <Ionicons
                    name={(tier ? TIER_ICON[tier] : 'checkmark-circle') as any}
                    size={20}
                    color={C.spice}
                  />
                  <Text style={styles.standingTier}>
                    {tier ? t(`connected_accounts.tier_${tier}`) : t('connected_accounts.verified')}
                  </Text>
                </View>
                {!!primaryLabel && (
                  <Text style={styles.standingBody}>
                    {/* A withheld count is not a zero — say nothing about size. */}
                    {primary?.follower_count_known
                      ? t('connected_accounts.standing_with_count', {
                          platform: primaryLabel,
                          count: primary.follower_count.toLocaleString(),
                        })
                      : t('connected_accounts.standing_no_count', { platform: primaryLabel })}
                  </Text>
                )}
              </View>
            )}

            {/* ── Platforms ───────────────────────────────────────────────── */}
            {PLATFORMS.map(p => {
              const acct = byPlatform[p.key];
              const isConnecting = connecting === p.key;
              // Only gate the *first* connect. An existing Instagram account can
              // only have been linked by someone holding a role on the Meta app,
              // and reconnect still works for them — don't take it away.
              const unavailable = p.key === 'instagram' && !INSTAGRAM_CONNECT_AVAILABLE && !acct;
              return (
                <View key={p.key} style={styles.card}>
                  <View style={styles.cardIcon}>
                    <Ionicons name={p.icon as any} size={22} color={acct ? C.spice : C.bodySoft} />
                  </View>

                  <View style={{ flex: 1 }}>
                    <View style={styles.cardTitleRow}>
                      <Text style={styles.cardTitle}>{p.label}</Text>
                      {status?.primary_platform === p.key && (
                        <View style={styles.primaryPill}>
                          <Text style={styles.primaryPillText}>{t('connected_accounts.primary')}</Text>
                        </View>
                      )}
                    </View>

                    {acct ? (
                      <>
                        {/* handle_verified false means we proved account control
                            but NOT which @handle — never present it as verified. */}
                        {acct.handle_verified && acct.handle ? (
                          <Text style={styles.cardHandle}>@{acct.handle}</Text>
                        ) : acct.display_name ? (
                          <Text style={styles.cardHandle}>{acct.display_name}</Text>
                        ) : null}

                        <Text style={styles.cardMeta}>
                          {acct.follower_count_known
                            ? t('connected_accounts.followers', { count: acct.follower_count.toLocaleString() })
                            : t('connected_accounts.connected')}
                        </Text>

                        {!acct.handle_verified && (
                          <Text style={styles.cardNote}>{t('connected_accounts.handle_unverified')}</Text>
                        )}
                      </>
                    ) : (
                      <>
                        <Text style={styles.cardMeta}>{t('connected_accounts.not_connected')}</Text>
                        {unavailable && (
                          <Text style={styles.cardNote}>{t('connected_accounts.unavailable_note')}</Text>
                        )}
                      </>
                    )}
                  </View>

                  <TouchableOpacity
                    onPress={() => onConnect(p)}
                    disabled={isConnecting || unavailable}
                    accessibilityState={{ disabled: isConnecting || unavailable }}
                    style={[
                      styles.connectBtn,
                      acct && styles.reconnectBtn,
                      isConnecting && styles.connectBtnBusy,
                      unavailable && styles.connectBtnDisabled,
                    ]}
                  >
                    {isConnecting
                      ? <ActivityIndicator size="small" color={acct ? C.spice : C.canvas} />
                      : (
                        <Text style={[
                          styles.connectBtnText,
                          acct && styles.reconnectBtnText,
                          unavailable && styles.connectBtnDisabledText,
                        ]}>
                          {unavailable
                            ? t('connected_accounts.coming_soon')
                            : acct ? t('connected_accounts.reconnect') : t('connected_accounts.connect')}
                        </Text>
                      )}
                  </TouchableOpacity>
                </View>
              );
            })}

            <Text style={styles.footnote}>{t('connected_accounts.reconnect_note')}</Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (C: AppColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.canvas },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: C.borderWarm,
  },
  headerBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: Fonts.serif, fontSize: FontSize.xl, color: C.ink },

  scroll: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: Spacing.xxl },
  intro: { fontFamily: Fonts.sans, fontSize: FontSize.md, color: C.bodySoft, marginBottom: Spacing.xs, lineHeight: 20 },

  standing: {
    backgroundColor: C.bgCook, borderRadius: Radius.lg, padding: Spacing.md,
    marginBottom: Spacing.xs, gap: 4,
  },
  standingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  standingTier: { fontFamily: Fonts.sansMedium, fontSize: FontSize.lg, color: C.ink },
  standingBody: { fontFamily: Fonts.sans, fontSize: FontSize.sm, color: C.bodySoft },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: C.canvas, borderRadius: Radius.lg, padding: Spacing.md,
    borderWidth: 1, borderColor: C.borderWarm,
  },
  cardIcon: {
    width: 40, height: 40, borderRadius: Radius.full,
    alignItems: 'center', justifyContent: 'center', backgroundColor: C.bgCook,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  cardTitle: { fontFamily: Fonts.sansMedium, fontSize: FontSize.body, color: C.ink },
  cardHandle: { fontFamily: Fonts.sans, fontSize: FontSize.sm, color: C.ink, marginTop: 2 },
  cardMeta: { fontFamily: Fonts.sans, fontSize: FontSize.sm, color: C.bodySoft, marginTop: 2 },
  cardNote: { fontFamily: Fonts.sans, fontSize: FontSize.xs, color: C.bodySoft, marginTop: 4, lineHeight: 14 },

  primaryPill: {
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: Radius.full, backgroundColor: C.spice,
  },
  primaryPillText: { fontFamily: Fonts.sansMedium, fontSize: FontSize.xs, color: C.canvas },

  connectBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full,
    backgroundColor: C.spice, minWidth: 88, alignItems: 'center',
  },
  connectBtnBusy: { opacity: 0.7 },
  // Reads as inert rather than as a failed action — no spice fill, no border.
  connectBtnDisabled: { backgroundColor: C.bgCook, borderWidth: 0 },
  connectBtnDisabledText: { color: C.bodySoft },
  connectBtnText: { fontFamily: Fonts.sansMedium, fontSize: FontSize.sm, color: C.canvas },
  reconnectBtn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.spice },
  reconnectBtnText: { color: C.spice },

  footnote: {
    fontFamily: Fonts.sans, fontSize: FontSize.xs, color: C.bodySoft,
    marginTop: Spacing.sm, lineHeight: 16,
  },
});
