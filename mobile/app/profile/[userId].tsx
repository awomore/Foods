import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Image, Share, RefreshControl,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as ExpoSharing from 'expo-sharing';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { cravingsApi, type Craving } from '../../src/api/cravings';
import { connectionsApi } from '../../src/api/connections';
import { authApi } from '../../src/api/auth';
import { useAuth } from '../../src/context/AuthContext';
import { useColors } from '../../src/context/ThemeContext';
import { useFeedback } from '../../src/components/feedback';
import { Fonts, Spacing, Radius, Shadow } from '../../src/constants/theme';
import Avatar from '../../src/components/ui/Avatar';
import DishPhoto from '../../src/components/ui/DishPhoto';
import { Bone } from '../../src/components/ui/Skeleton';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://foodsbyme-production.up.railway.app';

const CRAVING_TTL_DAYS = 10;

function isCravingExpired(craving: Craving): boolean {
  if (craving.is_fulfilled) return false;
  const created = new Date(craving.created_at).getTime();
  const now = Date.now();
  return now - created > CRAVING_TTL_DAYS * 24 * 60 * 60 * 1000;
}

interface PublicUser {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  following_count: number;
  follower_count: number;
}

function fmtCurrency(amount: number | null, currency = 'NGN'): string {
  if (amount == null) return '';
  const symbols: Record<string, string> = { NGN: '₦', KES: 'KSh ', GHS: 'GH₵', ZAR: 'R', EGP: 'E£' };
  return (symbols[currency] ?? currency + ' ') + Number(amount).toLocaleString('en-NG', { maximumFractionDigits: 0 });
}

async function shareCreaving(craving: Craving, ownerName: string) {
  const firstName = ownerName.split(' ')[0];
  const price = craving.dish_price != null ? fmtCurrency(craving.dish_price, craving.currency_code) : null;
  const link = `${BASE_URL}/c/${craving.id}`;
  const caption = price
    ? `${firstName} is craving ${craving.dish_title} (${price}) 🍽️\n\nGift it to them or order it for yourself on FOODSbyme 👇\n${link}`
    : `${firstName} is craving ${craving.dish_title} 🍽️\n\nGift it to them or order it for yourself on FOODSbyme 👇\n${link}`;

  // Try to share with the dish image attached (TikTok-style)
  if (craving.dish_photo) {
    try {
      const ext = craving.dish_photo.includes('.png') ? 'png' : 'jpg';
      const localPath = `${FileSystem.cacheDirectory ?? ''}foods-craving-${craving.id}.${ext}`;
      const info = await FileSystem.getInfoAsync(localPath);
      if (!info.exists) {
        await FileSystem.downloadAsync(craving.dish_photo, localPath);
      }
      const canShare = await ExpoSharing.isAvailableAsync();
      if (canShare) {
        await ExpoSharing.shareAsync(localPath, {
          mimeType: ext === 'png' ? 'image/png' : 'image/jpeg',
          dialogTitle: caption,
          UTI: ext === 'png' ? 'public.png' : 'public.jpeg',
        });
        return;
      }
    } catch {
      // Fall through to text share
    }
  }

  Share.share({ message: caption, url: link, title: `${firstName} is craving ${craving.dish_title}!` });
}

function shareAllCravings(userId: string, userName: string) {
  const firstName = userName.split(' ')[0];
  const link = `${BASE_URL}/profile/${userId}`;
  Share.share({
    message: `Check out ${firstName}'s cravings on FOODS — you can gift any dish to them!\n${link}`,
    url: link,
    title: `${firstName}'s cravings`,
  });
}

function CravingCard({
  craving, canGift, isOwn, onGift, onShare, onToggleVisibility, togglingId, onConnectGifter, onOrder,
}: {
  craving: Craving;
  canGift: boolean;
  isOwn: boolean;
  onGift: (c: Craving) => void;
  onShare: (c: Craving) => void;
  onToggleVisibility?: (c: Craving) => void;
  togglingId?: string | null;
  onConnectGifter?: (craving: Craving) => void;
  onOrder?: (c: Craving) => void;
}) {
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);

  return (
    <View style={styles.cravingCard}>
      {craving.dish_photo ? (
        <Image source={{ uri: craving.dish_photo }} style={styles.cravingPhoto} resizeMode="cover" />
      ) : (
        <DishPhoto label={craving.dish_title} height={110} radius={0} />
      )}

      {/* Share / privacy badge overlay */}
      <View style={styles.cardOverlayRow}>
        {isOwn && onToggleVisibility && (
          <TouchableOpacity
            style={[styles.overlayBadge, craving.is_public ? styles.overlayPublic : styles.overlayPrivate]}
            onPress={() => onToggleVisibility(craving)}
            activeOpacity={0.8}
            disabled={togglingId === craving.id}
            hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}
          >
            {togglingId === craving.id
              ? <ActivityIndicator size={10} color={C.canvas} />
              : <Ionicons name={craving.is_public ? 'eye' : 'eye-off'} size={11} color={C.canvas} />}
          </TouchableOpacity>
        )}
        {!craving.is_fulfilled && !isOwn && (
          <TouchableOpacity
            style={styles.shareOverlay}
            onPress={() => onShare(craving)}
            activeOpacity={0.8}
            hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}
          >
            <Ionicons name="share-social" size={14} color={C.canvas} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.cravingInfo}>
        <Text style={styles.cravingTitle} numberOfLines={2}>{craving.dish_title}</Text>
        {craving.dish_price != null && (
          <Text style={styles.cravingPrice}>{fmtCurrency(craving.dish_price, craving.currency_code)}</Text>
        )}
        {craving.notes ? (
          <Text style={styles.cravingNotes} numberOfLines={2}>{craving.notes}</Text>
        ) : null}

        {/* Private label */}
        {isOwn && !craving.is_public && (
          <View style={styles.privateBadge}>
            <Ionicons name="lock-closed" size={10} color={C.bodySoft} />
            <Text style={styles.privateText}>Private</Text>
          </View>
        )}

        {craving.is_fulfilled ? (
          <View style={{ gap: 6 }}>
            <View style={styles.fulfilledBadge}>
              <Ionicons name="checkmark-circle" size={12} color={C.successFg} />
              <Text style={styles.fulfilledText}>Fulfilled</Text>
            </View>
            {craving.fulfilled_by_name && isOwn && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <Text style={{ fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft }}>
                  Gifted by{' '}
                  <Text style={{ fontFamily: Fonts.sansMedium, color: C.spice }}>
                    {craving.fulfilled_by_username ? `@${craving.fulfilled_by_username}` : craving.fulfilled_by_name}
                  </Text>
                </Text>
                {craving.fulfilled_by_user_id && onConnectGifter && (
                  <TouchableOpacity
                    onPress={() => onConnectGifter(craving)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 3,
                      backgroundColor: C.bgCook, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4,
                      borderWidth: 0.5, borderColor: C.borderWarm }}
                  >
                    <Ionicons name="person-add-outline" size={11} color={C.spice} />
                    <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 10, color: C.spice }}>Connect</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        ) : canGift ? (
          <TouchableOpacity style={styles.giftBtn} onPress={() => onGift(craving)} activeOpacity={0.8}>
            <Ionicons name="gift-outline" size={13} color={C.canvas} />
            <Text style={styles.giftBtnText}>Treat</Text>
          </TouchableOpacity>
        ) : isOwn ? (
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {craving.menu_item_id && onOrder && (
              <TouchableOpacity style={styles.orderBtn} onPress={() => onOrder(craving)} activeOpacity={0.8}>
                <Ionicons name="bag-add-outline" size={13} color={C.canvas} />
                <Text style={styles.orderBtnText}>Order</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.shareBtn} onPress={() => onShare(craving)} activeOpacity={0.8}>
              <Ionicons name="share-social-outline" size={13} color={C.spice} />
              <Text style={styles.shareBtnText}>Share</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </View>
  );
}

export default function PublicProfileScreen() {
  const router = useRouter();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { user, isAuthenticated } = useAuth();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);

  const [profile, setProfile] = useState<PublicUser | null>(null);
  const [cravings, setCravings] = useState<Craving[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [giftingId, setGiftingId] = useState<string | null>(null);
  const feedback = useFeedback();
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const isOwnProfile = isAuthenticated && user?.id === userId;
  const canGift = isAuthenticated && !isOwnProfile;

  const userName = profile?.full_name ?? cravings[0]?.user_name ?? 'This person';
  const userAvatar = profile?.avatar_url ?? cravings[0]?.user_avatar ?? null;
  const displayUsername = profile?.username ? `@${profile.username}` : null;

  const load = useCallback(async (isRefresh = false) => {
    if (!userId) return;
    if (!isRefresh) setLoading(true);
    try {
      const [profileRes, cravingsRes] = await Promise.allSettled([
        authApi.getPublicProfile(userId),
        isOwnProfile ? cravingsApi.list() : cravingsApi.byUser(userId),
      ]);
      if (profileRes.status === 'fulfilled') setProfile(profileRes.value.user as PublicUser);
      if (cravingsRes.status === 'fulfilled') {
        const data: Craving[] = (cravingsRes.value as any).cravings ?? [];
        // Auto-purge expired unfulfilled cravings (own profile only, silent)
        if (isOwnProfile) {
          const expired = data.filter(isCravingExpired);
          expired.forEach(c => cravingsApi.remove(c.id).catch(() => {}));
          setCravings(data.filter(c => !isCravingExpired(c)));
        } else {
          setCravings(data.filter(c => !isCravingExpired(c)));
        }
      }
    } catch {
      setCravings([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId, isOwnProfile]);

  useEffect(() => { load(); }, [load]);

  async function handleGift(craving: Craving) {
    if (!isAuthenticated) {
      feedback.warn('Sign in required', 'Please sign in to gift a craving');
      return;
    }
    feedback.confirm({
      title: 'Gift this craving?',
      message: `Treat ${userName} to ${craving.dish_title}${craving.dish_price != null ? ' for ' + fmtCurrency(craving.dish_price, craving.currency_code) : ''}?`,
      confirmLabel: 'Gift it',
      onConfirm: async () => {
        setGiftingId(craving.id);
        try {
          const { craving: updated } = await cravingsApi.fulfill(craving.id);
          setCravings(prev => prev.map(c => c.id === updated.id ? updated : c));
          feedback.success('Gifted!', `You've fulfilled ${userName}'s craving for ${craving.dish_title}`);
        } catch (e: any) {
          feedback.error('Error', e.error ?? 'Could not fulfill craving');
        } finally {
          setGiftingId(null);
        }
      },
    });
  }

  async function handleConnectGifter(craving: Craving) {
    if (!craving.fulfilled_by_user_id) return;
    const name = craving.fulfilled_by_username
      ? `@${craving.fulfilled_by_username}`
      : craving.fulfilled_by_name ?? 'this person';
    feedback.confirm({
      title: 'Connect with gifter',
      message: `Send a connection request to ${name}?`,
      confirmLabel: 'Connect',
      onConfirm: async () => {
        try {
          await connectionsApi.request(craving.fulfilled_by_user_id!);
          feedback.success('Request sent', `Connection request sent to ${name}.`);
        } catch (e: any) {
          const msg = e.error ?? e.message ?? '';
          if (msg.includes('already')) {
            feedback.info('Already connected', msg);
          } else {
            feedback.error('Error', msg || 'Could not send request');
          }
        }
      },
    });
  }

  async function handleToggleVisibility(craving: Craving) {
    setTogglingId(craving.id);
    try {
      const { craving: updated } = await cravingsApi.setVisibility(craving.id, !craving.is_public);
      setCravings(prev => prev.map(c => c.id === updated.id ? updated : c));
    } catch (e: any) {
      feedback.error('Error', e.error ?? 'Could not update visibility');
    } finally {
      setTogglingId(null);
    }
  }

  const publicCravings = isOwnProfile ? cravings : cravings.filter(c => c.is_public);

  return (
    <View style={styles.root}>
      <SafeAreaView>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={C.textInk} />
          </TouchableOpacity>
          <Text style={styles.pageTitle} numberOfLines={1}>
            {isOwnProfile ? 'My cravings' : `${userName.split(' ')[0]}'s cravings`}
          </Text>
          {cravings.length > 0 && (
            <TouchableOpacity
              style={styles.shareAllBtn}
              onPress={() => shareAllCravings(userId!, userName)}
              activeOpacity={0.7}
            >
              <Ionicons name="share-social-outline" size={16} color={C.spice} />
              <Text style={styles.shareAllText}>Share</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>

      {loading ? (
        <View style={{ flex: 1, padding: Spacing.lg, gap: 12 }}>
          <Bone width="100%" height={80} radius={16} />
          <Bone width="100%" height={56} radius={12} />
          <Bone width="100%" height={56} radius={12} />
          <Bone width="100%" height={56} radius={12} />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: Spacing.lg, gap: 16, paddingBottom: 60 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} />}>

          {/* Profile header */}
          <View style={styles.profileHeader}>
            <Avatar name={userName.charAt(0)} avatarUrl={userAvatar ?? undefined} avatarBg={C.ember} size={52} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.profileName}>{userName}</Text>
              {displayUsername && (
                <Text style={styles.profileUsername}>{displayUsername}</Text>
              )}
              <View style={styles.countsRow}>
                <View style={styles.countItem}>
                  <Text style={styles.countNum}>{profile?.follower_count ?? 0}</Text>
                  <Text style={styles.countLabel}>followers</Text>
                </View>
                <View style={styles.countDot} />
                <View style={styles.countItem}>
                  <Text style={styles.countNum}>{profile?.following_count ?? 0}</Text>
                  <Text style={styles.countLabel}>following</Text>
                </View>
                <View style={styles.countDot} />
                <View style={styles.countItem}>
                  <Text style={styles.countNum}>{publicCravings.length}</Text>
                  <Text style={styles.countLabel}>{publicCravings.length === 1 ? 'craving' : 'cravings'}</Text>
                </View>
              </View>
            </View>
          </View>

          {isOwnProfile && (
            <View style={styles.visibilityHint}>
              <Ionicons name="eye-outline" size={14} color={C.bodySoft} />
              <Text style={styles.visibilityHintText}>
                Tap the eye icon on any craving to make it public or private
              </Text>
            </View>
          )}

          {isOwnProfile && cravings.length > 0 && (
            <TouchableOpacity style={styles.shareListCta} onPress={() => shareAllCravings(userId!, userName)} activeOpacity={0.8}>
              <Ionicons name="share-social-outline" size={16} color={C.spice} />
              <Text style={styles.shareListCtaText}>Share your cravings list</Text>
              <Text style={styles.shareListCtaSub}>Let friends know what you want — they can gift you or order for themselves</Text>
            </TouchableOpacity>
          )}

          {publicCravings.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="heart-outline" size={36} color={C.stone} />
              <Text style={styles.emptyTitle}>No public cravings</Text>
              <Text style={styles.emptySub}>
                {isOwnProfile
                  ? 'Tap "Crave" on any dish to add it here, then tap the eye icon to make it public.'
                  : `${userName.split(' ')[0]} hasn't shared any cravings yet.`}
              </Text>
            </View>
          ) : (
            <View style={styles.grid}>
              {publicCravings.map(c => (
                <CravingCard
                  key={c.id}
                  craving={c}
                  canGift={canGift && giftingId !== c.id}
                  isOwn={isOwnProfile}
                  onGift={handleGift}
                  onShare={craving => shareCreaving(craving, userName)}
                  onToggleVisibility={isOwnProfile ? handleToggleVisibility : undefined}
                  togglingId={togglingId}
                  onConnectGifter={isOwnProfile ? handleConnectGifter : undefined}
                  onOrder={isOwnProfile && c.menu_item_id ? craving => router.push({ pathname: '/item/[id]', params: { id: craving.menu_item_id!, cookId: craving.cook_id ?? '' } } as any) : undefined}
                />
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingTop: 8, paddingBottom: 12, gap: 10 },
    backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.bgCook, alignItems: 'center', justifyContent: 'center' },
    pageTitle: { fontFamily: Fonts.serif, fontSize: 22, color: C.textInk, flex: 1 },
    shareAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 40, backgroundColor: C.bgCard, borderWidth: 0.5, borderColor: C.borderWarm },
    shareAllText: { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.spice },

    profileHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, backgroundColor: C.bgCard, borderRadius: Radius.xl, padding: 16, borderWidth: 0.5, borderColor: C.borderWarm, ...Shadow.card },
    profileName: { fontFamily: Fonts.sansMedium, fontSize: 17, color: C.textInk },
    profileUsername: { fontFamily: Fonts.sans, fontSize: 13, color: C.spice },
    countsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
    countItem: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
    countNum: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.textInk },
    countLabel: { fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft },
    countDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: C.stone },

    visibilityHint: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 },
    visibilityHintText: { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft, flex: 1, lineHeight: 16 },

    shareListCta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, backgroundColor: C.honey, borderRadius: Radius.lg, padding: 14, borderWidth: 0.5, borderColor: C.borderWarm },
    shareListCtaText: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.textInk, flex: 1 },
    shareListCtaSub: { fontFamily: Fonts.sans, fontSize: 12, color: C.body, lineHeight: 18, width: '100%' },

    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    cravingCard: { width: '47.5%', backgroundColor: C.bgCard, borderRadius: Radius.lg, overflow: 'hidden', borderWidth: 0.5, borderColor: C.borderWarm, ...Shadow.card },
    cravingPhoto: { width: '100%', height: 110 },
    cardOverlayRow: { position: 'absolute', top: 8, right: 8, flexDirection: 'row', gap: 4 },
    shareOverlay: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
    overlayBadge: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    overlayPublic: { backgroundColor: 'rgba(0,0,0,0.35)' },
    overlayPrivate: { backgroundColor: 'rgba(0,0,0,0.55)' },

    cravingInfo: { padding: 10, gap: 5 },
    cravingTitle: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.textInk, lineHeight: 18 },
    cravingPrice: { fontFamily: Fonts.serif, fontSize: 14, color: C.spice },
    cravingNotes: { fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft, fontStyle: 'italic', lineHeight: 16 },

    privateBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
    privateText: { fontFamily: Fonts.sans, fontSize: 10, color: C.bodySoft },

    giftBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: C.spice, borderRadius: Radius.md, paddingVertical: 8, marginTop: 4 },
    giftBtnText: { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.canvas },
    orderBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: C.ink, borderRadius: Radius.md, paddingVertical: 7, marginTop: 4 },
    orderBtnText: { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.canvas },
    shareBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, borderWidth: 1, borderColor: C.spice, borderRadius: Radius.md, paddingVertical: 7, marginTop: 4 },
    shareBtnText: { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.spice },
    fulfilledBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
    fulfilledText: { fontFamily: Fonts.sans, fontSize: 11, color: C.successFg },

    emptyState: { alignItems: 'center', paddingTop: 60, gap: 10 },
    emptyTitle: { fontFamily: Fonts.sansMedium, fontSize: 15, color: C.textInk },
    emptySub: { fontFamily: Fonts.sans, fontSize: 13, color: C.bodySoft, textAlign: 'center', lineHeight: 20 },
  });
}
