import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Image, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { cravingsApi, type Craving } from '../../src/api/cravings';
import { authApi } from '../../src/api/auth';
import { useAuth } from '../../src/context/AuthContext';
import { useColors } from '../../src/context/ThemeContext';
import { Fonts, Spacing, Radius, Shadow } from '../../src/constants/theme';
import Avatar from '../../src/components/ui/Avatar';
import DishPhoto from '../../src/components/ui/DishPhoto';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://foodsbyme-production.up.railway.app';

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

function shareCreaving(craving: Craving, ownerName: string) {
  const firstName = ownerName.split(' ')[0];
  const price = craving.dish_price != null ? fmtCurrency(craving.dish_price, craving.currency_code) : null;
  const link = `${BASE_URL}/c/${craving.id}`;
  const message = price
    ? `${firstName} is craving ${craving.dish_title} (${price})\n\nGift it to them or order it for yourself\n${link}`
    : `${firstName} is craving ${craving.dish_title}\n\nGift it to them or order it for yourself\n${link}`;
  Share.share({ message, url: link, title: `${firstName} is craving ${craving.dish_title}!` });
}

function shareAllCravings(userId: string, userName: string) {
  const firstName = userName.split(' ')[0];
  const link = `${BASE_URL}/profile/${userId}`;
  Share.share({
    message: `Check out ${firstName}'s cravings on FOODSbyme — you can gift any dish to them!\n${link}`,
    url: link,
    title: `${firstName}'s cravings`,
  });
}

function CravingCard({
  craving, canGift, isOwn, onGift, onShare, onToggleVisibility, togglingId,
}: {
  craving: Craving;
  canGift: boolean;
  isOwn: boolean;
  onGift: (c: Craving) => void;
  onShare: (c: Craving) => void;
  onToggleVisibility?: (c: Craving) => void;
  togglingId?: string | null;
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
          <View style={styles.fulfilledBadge}>
            <Ionicons name="checkmark-circle" size={12} color={C.successFg} />
            <Text style={styles.fulfilledText}>Fulfilled</Text>
          </View>
        ) : canGift ? (
          <TouchableOpacity style={styles.giftBtn} onPress={() => onGift(craving)} activeOpacity={0.8}>
            <Ionicons name="gift-outline" size={13} color={C.canvas} />
            <Text style={styles.giftBtnText}>Treat</Text>
          </TouchableOpacity>
        ) : isOwn ? (
          <TouchableOpacity style={styles.shareBtn} onPress={() => onShare(craving)} activeOpacity={0.8}>
            <Ionicons name="share-social-outline" size={13} color={C.spice} />
            <Text style={styles.shareBtnText}>Share</Text>
          </TouchableOpacity>
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
  const [giftingId, setGiftingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const isOwnProfile = isAuthenticated && user?.id === userId;
  const canGift = isAuthenticated && !isOwnProfile;

  const userName = profile?.full_name ?? cravings[0]?.user_name ?? 'This person';
  const userAvatar = profile?.avatar_url ?? cravings[0]?.user_avatar ?? null;
  const displayUsername = profile?.username ? `@${profile.username}` : null;

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [profileRes, cravingsRes] = await Promise.allSettled([
        authApi.getPublicProfile(userId),
        isOwnProfile ? cravingsApi.list() : cravingsApi.byUser(userId),
      ]);
      if (profileRes.status === 'fulfilled') setProfile(profileRes.value.user as PublicUser);
      if (cravingsRes.status === 'fulfilled') {
        const data = (cravingsRes.value as any).cravings ?? [];
        setCravings(data);
      }
    } catch {
      setCravings([]);
    } finally {
      setLoading(false);
    }
  }, [userId, isOwnProfile]);

  useEffect(() => { load(); }, [load]);

  async function handleGift(craving: Craving) {
    if (!isAuthenticated) {
      Alert.alert('Sign in required', 'Please sign in to gift a craving');
      return;
    }
    Alert.alert(
      'Gift this craving?',
      `Treat ${userName} to ${craving.dish_title}${craving.dish_price != null ? ' for ' + fmtCurrency(craving.dish_price, craving.currency_code) : ''}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Gift it',
          onPress: async () => {
            setGiftingId(craving.id);
            try {
              const { craving: updated } = await cravingsApi.fulfill(craving.id);
              setCravings(prev => prev.map(c => c.id === updated.id ? updated : c));
              Alert.alert('Gifted!', `You've fulfilled ${userName}'s craving for ${craving.dish_title}`);
            } catch (e: any) {
              Alert.alert('Error', e.error ?? 'Could not fulfill craving');
            } finally {
              setGiftingId(null);
            }
          },
        },
      ]
    );
  }

  async function handleToggleVisibility(craving: Craving) {
    setTogglingId(craving.id);
    try {
      const { craving: updated } = await cravingsApi.setVisibility(craving.id, !craving.is_public);
      setCravings(prev => prev.map(c => c.id === updated.id ? updated : c));
    } catch (e: any) {
      Alert.alert('Error', e.error ?? 'Could not update visibility');
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
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={C.spice} />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: Spacing.lg, gap: 16, paddingBottom: 60 }}>

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
    backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.bgCook, alignItems: 'center', justifyContent: 'center' },
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
    shareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, borderWidth: 1, borderColor: C.spice, borderRadius: Radius.md, paddingVertical: 7, marginTop: 4 },
    shareBtnText: { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.spice },
    fulfilledBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
    fulfilledText: { fontFamily: Fonts.sans, fontSize: 11, color: C.successFg },

    emptyState: { alignItems: 'center', paddingTop: 60, gap: 10 },
    emptyTitle: { fontFamily: Fonts.sansMedium, fontSize: 15, color: C.textInk },
    emptySub: { fontFamily: Fonts.sans, fontSize: 13, color: C.bodySoft, textAlign: 'center', lineHeight: 20 },
  });
}
