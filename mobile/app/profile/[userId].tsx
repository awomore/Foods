import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView,
  ActivityIndicator, Alert, Image, Share,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { cravingsApi, type Craving } from '../../src/api/cravings';
import { useAuth } from '../../src/context/AuthContext';
import { Colors, Fonts, Spacing, Radius, Shadow } from '../../src/constants/theme';
import Avatar from '../../src/components/ui/Avatar';
import DishPhoto from '../../src/components/ui/DishPhoto';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://foodsbyme-production.up.railway.app';

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
    ? `${firstName} is craving ${craving.dish_title} (${price}) 🍽️\n\nGift it to them or order it for yourself 👇\n${link}`
    : `${firstName} is craving ${craving.dish_title} 🍽️\n\nGift it to them or order it for yourself 👇\n${link}`;

  Share.share({ message, url: link, title: `${firstName} is craving ${craving.dish_title}!` });
}

function shareAllCravings(userId: string, userName: string) {
  const firstName = userName.split(' ')[0];
  const link = `${BASE_URL}/profile/${userId}`;
  Share.share({
    message: `Check out ${firstName}'s cravings on FOODSbyme — you can gift any dish to them! 🍽️\n${link}`,
    url: link,
    title: `${firstName}'s cravings`,
  });
}

function CravingCard({
  craving, canGift, isOwn, onGift, onShare,
}: {
  craving: Craving;
  canGift: boolean;
  isOwn: boolean;
  onGift: (c: Craving) => void;
  onShare: (c: Craving) => void;
}) {
  return (
    <View style={styles.cravingCard}>
      {craving.dish_photo ? (
        <Image source={{ uri: craving.dish_photo }} style={styles.cravingPhoto} resizeMode="cover" />
      ) : (
        <DishPhoto tint="#C97A35" label={craving.dish_title} height={110} radius={0} />
      )}

      {/* Share button — top-right corner */}
      {!craving.is_fulfilled && (
        <TouchableOpacity style={styles.shareOverlay} onPress={() => onShare(craving)} activeOpacity={0.8} hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}>
          <Ionicons name="share-social" size={14} color={Colors.canvas} />
        </TouchableOpacity>
      )}

      <View style={styles.cravingInfo}>
        <Text style={styles.cravingTitle} numberOfLines={2}>{craving.dish_title}</Text>
        {craving.dish_price != null && (
          <Text style={styles.cravingPrice}>{fmtCurrency(craving.dish_price, craving.currency_code)}</Text>
        )}
        {craving.notes ? (
          <Text style={styles.cravingNotes} numberOfLines={2}>{craving.notes}</Text>
        ) : null}

        {craving.is_fulfilled ? (
          <View style={styles.fulfilledBadge}>
            <Ionicons name="checkmark-circle" size={12} color={Colors.successFg} />
            <Text style={styles.fulfilledText}>Fulfilled</Text>
          </View>
        ) : canGift ? (
          <TouchableOpacity style={styles.giftBtn} onPress={() => onGift(craving)} activeOpacity={0.8}>
            <Ionicons name="gift-outline" size={13} color={Colors.canvas} />
            <Text style={styles.giftBtnText}>Treat</Text>
          </TouchableOpacity>
        ) : isOwn ? (
          <TouchableOpacity style={styles.shareBtn} onPress={() => onShare(craving)} activeOpacity={0.8}>
            <Ionicons name="share-social-outline" size={13} color={Colors.spice} />
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
  const [cravings, setCravings] = useState<Craving[]>([]);
  const [loading, setLoading] = useState(true);
  const [giftingId, setGiftingId] = useState<string | null>(null);

  const userName = cravings[0]?.user_name ?? 'This person';
  const userAvatar = cravings[0]?.user_avatar ?? null;
  const isOwnProfile = isAuthenticated && user?.id === userId;
  const canGift = isAuthenticated && !isOwnProfile;

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const { cravings: data } = await cravingsApi.byUser(userId);
      setCravings(data ?? []);
    } catch {
      setCravings([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

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
              Alert.alert('Gifted! 🎉', `You've fulfilled ${userName}'s craving for ${craving.dish_title}`);
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

  return (
    <View style={styles.root}>
      <SafeAreaView>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={Colors.textInk} />
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
              <Ionicons name="share-social-outline" size={16} color={Colors.spice} />
              <Text style={styles.shareAllText}>Share</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={Colors.spice} />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: Spacing.lg, gap: 16, paddingBottom: 60 }}>
          {/* Profile header */}
          <View style={styles.profileHeader}>
            <Avatar name={userName.charAt(0)} avatarUrl={userAvatar ?? undefined} avatarBg={Colors.ember} size={52} />
            <View style={{ flex: 1 }}>
              <Text style={styles.profileName}>{userName}</Text>
              <Text style={styles.profileSub}>
                {cravings.length} {cravings.length === 1 ? 'craving' : 'cravings'}
              </Text>
            </View>
          </View>

          {isOwnProfile && cravings.length > 0 && (
            <TouchableOpacity style={styles.shareListCta} onPress={() => shareAllCravings(userId!, userName)} activeOpacity={0.8}>
              <Ionicons name="share-social-outline" size={16} color={Colors.spice} />
              <Text style={styles.shareListCtaText}>Share your cravings list</Text>
              <Text style={styles.shareListCtaSub}>Let friends know what you want — they can gift you or order for themselves</Text>
            </TouchableOpacity>
          )}

          {cravings.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="heart-outline" size={36} color={Colors.stone} />
              <Text style={styles.emptyTitle}>No public cravings</Text>
              <Text style={styles.emptySub}>
                {isOwnProfile
                  ? 'Tap "Crave" on any dish to add it here, then share with friends so they can gift you!'
                  : `${userName.split(' ')[0]} hasn't shared any cravings yet.`}
              </Text>
            </View>
          ) : (
            <View style={styles.grid}>
              {cravings.map(c => (
                <CravingCard
                  key={c.id}
                  craving={c}
                  canGift={canGift && giftingId !== c.id}
                  isOwn={isOwnProfile}
                  onGift={handleGift}
                  onShare={craving => shareCreaving(craving, userName)}
                />
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingTop: 8, paddingBottom: 12, gap: 10 },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.bgCook, alignItems: 'center', justifyContent: 'center' },
  pageTitle: { fontFamily: Fonts.serif, fontSize: 22, color: Colors.textInk, flex: 1 },
  shareAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 40, backgroundColor: Colors.bgCard, borderWidth: 0.5, borderColor: Colors.borderWarm },
  shareAllText: { fontFamily: Fonts.sansMedium, fontSize: 12, color: Colors.spice },

  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: Colors.bgCard, borderRadius: Radius.xl, padding: 16, borderWidth: 0.5, borderColor: Colors.borderWarm, ...Shadow.card },
  profileName: { fontFamily: Fonts.sansMedium, fontSize: 17, color: Colors.textInk, fontWeight: '600' },
  profileSub: { fontFamily: Fonts.sans, fontSize: 13, color: Colors.bodySoft, marginTop: 3 },

  shareListCta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, backgroundColor: Colors.honey, borderRadius: Radius.lg, padding: 14, borderWidth: 0.5, borderColor: '#EDCFAA' },
  shareListCtaText: { fontFamily: Fonts.sansMedium, fontSize: 14, color: '#5C3B16', fontWeight: '600', flex: 1 },
  shareListCtaSub: { fontFamily: Fonts.sans, fontSize: 12, color: '#7A5C30', lineHeight: 18, width: '100%' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  cravingCard: { width: '47.5%', backgroundColor: Colors.bgCard, borderRadius: Radius.lg, overflow: 'hidden', borderWidth: 0.5, borderColor: Colors.borderWarm, ...Shadow.card },
  cravingPhoto: { width: '100%', height: 110 },
  shareOverlay: { position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  cravingInfo: { padding: 10, gap: 5 },
  cravingTitle: { fontFamily: Fonts.sansMedium, fontSize: 13, color: Colors.textInk, fontWeight: '600', lineHeight: 18 },
  cravingPrice: { fontFamily: Fonts.serif, fontSize: 14, color: Colors.spice },
  cravingNotes: { fontFamily: Fonts.sans, fontSize: 11, color: Colors.bodySoft, fontStyle: 'italic', lineHeight: 16 },
  giftBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: Colors.spice, borderRadius: Radius.md, paddingVertical: 8, marginTop: 4 },
  giftBtnText: { fontFamily: Fonts.sansMedium, fontSize: 12, color: Colors.canvas, fontWeight: '600' },
  shareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, borderWidth: 1, borderColor: Colors.spice, borderRadius: Radius.md, paddingVertical: 7, marginTop: 4 },
  shareBtnText: { fontFamily: Fonts.sansMedium, fontSize: 12, color: Colors.spice },
  fulfilledBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  fulfilledText: { fontFamily: Fonts.sans, fontSize: 11, color: Colors.successFg },

  emptyState: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyTitle: { fontFamily: Fonts.sansMedium, fontSize: 15, color: Colors.textInk },
  emptySub: { fontFamily: Fonts.sans, fontSize: 13, color: Colors.bodySoft, textAlign: 'center', lineHeight: 20 },
});
