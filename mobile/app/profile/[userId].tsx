import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView,
  ActivityIndicator, Alert, Image,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { cravingsApi, type Craving } from '../../src/api/cravings';
import { useAuth } from '../../src/context/AuthContext';
import { Colors, Fonts, Spacing, Radius, Shadow } from '../../src/constants/theme';
import Avatar from '../../src/components/ui/Avatar';
import DishPhoto from '../../src/components/ui/DishPhoto';

function fmtCurrency(amount: number | null, currency = 'NGN'): string {
  if (amount == null) return '';
  const symbols: Record<string, string> = { NGN: '₦', KES: 'KSh ', GHS: 'GH₵', ZAR: 'R', EGP: 'E£' };
  return (symbols[currency] ?? currency + ' ') + Number(amount).toLocaleString('en-NG', { maximumFractionDigits: 0 });
}

function CravingCard({ craving, canGift, onGift }: { craving: Craving; canGift: boolean; onGift: (c: Craving) => void }) {
  return (
    <View style={styles.cravingCard}>
      {craving.dish_photo ? (
        <Image source={{ uri: craving.dish_photo }} style={styles.cravingPhoto} resizeMode="cover" />
      ) : (
        <DishPhoto tint="#C97A35" label={craving.dish_title} height={110} radius={0} />
      )}
      <View style={styles.cravingInfo}>
        <Text style={styles.cravingTitle} numberOfLines={2}>{craving.dish_title}</Text>
        {craving.dish_price != null && (
          <Text style={styles.cravingPrice}>{fmtCurrency(craving.dish_price, craving.currency_code)}</Text>
        )}
        {craving.notes ? (
          <Text style={styles.cravingNotes} numberOfLines={2}>{craving.notes}</Text>
        ) : null}
        {canGift && !craving.is_fulfilled && (
          <TouchableOpacity style={styles.giftBtn} onPress={() => onGift(craving)} activeOpacity={0.8}>
            <Ionicons name="gift-outline" size={14} color={Colors.canvas} />
            <Text style={styles.giftBtnText}>Treat</Text>
          </TouchableOpacity>
        )}
        {craving.is_fulfilled && (
          <View style={styles.fulfilledBadge}>
            <Ionicons name="checkmark-circle" size={12} color={Colors.successFg} />
            <Text style={styles.fulfilledText}>Fulfilled</Text>
          </View>
        )}
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
              Alert.alert('Gifted!', `You've fulfilled ${userName}'s craving for ${craving.dish_title} 🎉`);
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

  const isOwnProfile = isAuthenticated && user?.id === userId;
  const canGift = isAuthenticated && !isOwnProfile;

  return (
    <View style={styles.root}>
      <SafeAreaView>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={Colors.textInk} />
          </TouchableOpacity>
          <Text style={styles.pageTitle}>{isOwnProfile ? 'My cravings' : userName + "'s cravings"}</Text>
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
            <Avatar name={userName.charAt(0)} avatarUrl={userAvatar ?? undefined} avatarBg={Colors.ember} size={56} />
            <View style={{ flex: 1 }}>
              <Text style={styles.profileName}>{userName}</Text>
              <Text style={styles.profileSub}>
                {cravings.length} {cravings.length === 1 ? 'craving' : 'cravings'}
              </Text>
            </View>
          </View>

          {cravings.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="heart-outline" size={36} color={Colors.stone} />
              <Text style={styles.emptyTitle}>No public cravings</Text>
              <Text style={styles.emptySub}>
                {isOwnProfile
                  ? 'Save dishes you want to eat and share them publicly so friends can gift you.'
                  : userName + ' hasn\'t shared any cravings yet.'}
              </Text>
            </View>
          ) : (
            <View style={styles.grid}>
              {cravings.map(c => (
                <CravingCard
                  key={c.id}
                  craving={c}
                  canGift={canGift && giftingId !== c.id}
                  onGift={handleGift}
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
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingTop: 8, paddingBottom: 12, gap: 12 },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.bgCook, alignItems: 'center', justifyContent: 'center' },
  pageTitle: { fontFamily: Fonts.serif, fontSize: 22, color: Colors.textInk, flex: 1 },

  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: Colors.bgCard, borderRadius: Radius.xl, padding: 16, borderWidth: 0.5, borderColor: Colors.borderWarm, ...Shadow.card },
  profileName: { fontFamily: Fonts.sansMedium, fontSize: 17, color: Colors.textInk, fontWeight: '600' },
  profileSub: { fontFamily: Fonts.sans, fontSize: 13, color: Colors.bodySoft, marginTop: 3 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  cravingCard: { width: '47.5%', backgroundColor: Colors.bgCard, borderRadius: Radius.lg, overflow: 'hidden', borderWidth: 0.5, borderColor: Colors.borderWarm, ...Shadow.card },
  cravingPhoto: { width: '100%', height: 110 },
  cravingInfo: { padding: 10, gap: 5 },
  cravingTitle: { fontFamily: Fonts.sansMedium, fontSize: 13, color: Colors.textInk, fontWeight: '600', lineHeight: 18 },
  cravingPrice: { fontFamily: Fonts.serif, fontSize: 14, color: Colors.spice },
  cravingNotes: { fontFamily: Fonts.sans, fontSize: 11, color: Colors.bodySoft, fontStyle: 'italic', lineHeight: 16 },
  giftBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: Colors.spice, borderRadius: Radius.md, paddingVertical: 8, marginTop: 6 },
  giftBtnText: { fontFamily: Fonts.sansMedium, fontSize: 12, color: Colors.canvas, fontWeight: '600' },
  fulfilledBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  fulfilledText: { fontFamily: Fonts.sans, fontSize: 11, color: Colors.successFg },

  emptyState: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyTitle: { fontFamily: Fonts.sansMedium, fontSize: 15, color: Colors.textInk },
  emptySub: { fontFamily: Fonts.sans, fontSize: 13, color: Colors.bodySoft, textAlign: 'center', lineHeight: 20 },
});
