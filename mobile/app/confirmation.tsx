import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Share, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ordersApi, type Order } from '../src/api/orders';
import { cooksApi, type CookCard } from '../src/api/cooks';
import { useColors } from '../src/context/ThemeContext';
import { Fonts, Spacing, Radius, Shadow } from '../src/constants/theme';
import { fmtCurrency, shortOrderRef, fmtTime } from '../src/utils/format';
import Avatar from '../src/components/ui/Avatar';

export default function ConfirmationScreen() {
  const router = useRouter();
  const C = useColors();
  const { orderId } = useLocalSearchParams<{ orderId?: string }>();

  const scale      = useRef(new Animated.Value(0)).current;
  const opacity    = useRef(new Animated.Value(0)).current;
  const checkScale = useRef(new Animated.Value(0)).current;
  const detailsY   = useRef(new Animated.Value(16)).current;
  const detailsOp  = useRef(new Animated.Value(0)).current;

  const [order, setOrder]               = useState<Order | null>(null);
  const [recommendations, setRecs]       = useState<CookCard[]>([]);

  const load = useCallback(async () => {
    if (!orderId) return;
    try {
      const { order: o } = await ordersApi.get(orderId);
      setOrder(o);
      Animated.parallel([
        Animated.timing(detailsOp, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(detailsY, { toValue: 0, duration: 350, useNativeDriver: true }),
      ]).start();

      // Load similar cooks in background (non-blocking)
      cooksApi.list({ limit: 6 }).then(res => {
        const others = (res.cooks ?? []).filter(c => c.id !== o?.cook_id).slice(0, 4);
        setRecs(others);
      }).catch(() => {});
    } catch {
      // non-fatal — order card just won't show details
    }
  }, [orderId]);

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.sequence([
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]),
      Animated.spring(checkScale, { toValue: 1, tension: 80, friction: 6, useNativeDriver: true }),
    ]).start();

    // Stagger details fetch after animation
    const t = setTimeout(load, 500);
    return () => clearTimeout(t);
  }, []);

  async function handleShare() {
    if (!orderId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const cookName = order?.cook_name ?? 'a cook';
    const dish     = order?.item_title ?? 'a meal';
    try {
      await Share.share({
        message: `I just ordered ${dish} from ${cookName} on FOODS! 🍽️`,
        title: 'Order confirmed on FOODS',
      });
    } catch { /* user dismissed */ }
  }

  const cookName = order?.cook_name ?? null;
  const dishTitle = order?.item_title ?? null;
  const total = order ? fmtCurrency(order.total_amount, order.currency_code ?? 'NGN') : null;
  const window = order?.delivery_window_start
    ? `${fmtTime(order.delivery_window_start)} – ${fmtTime(order.delivery_window_end ?? '')}`
    : null;

  return (
    <View style={[styles.root, { backgroundColor: C.bg }]}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1 }}
        >
          <View style={styles.inner}>
            {/* Animated badge */}
            <Animated.View style={[styles.badge, { backgroundColor: C.spice, transform: [{ scale }], opacity }]}>
              <Animated.View style={{ transform: [{ scale: checkScale }] }}>
                <Ionicons name="checkmark" size={40} color={C.white} />
              </Animated.View>
            </Animated.View>

            {/* Copy */}
            <Text style={[styles.headline, { color: C.textInk }]}>You're at the table.</Text>
            <Text style={[styles.sub, { color: C.body }]}>
              Your portion has been claimed.{cookName ? ` ${cookName} is on it.` : ' The cook is on it.'}
            </Text>

            {/* Order details card */}
            <Animated.View
              style={[styles.card, { backgroundColor: C.bgCard, borderColor: C.borderWarm, opacity: detailsOp, transform: [{ translateY: detailsY }] }]}
            >
              {orderId && (
                <View style={styles.cardRow}>
                  <Text style={[styles.cardLabel, { color: C.bodySoft }]}>Order ref</Text>
                  <Text style={[styles.cardVal, { color: C.textInk }]} selectable>
                    {shortOrderRef(orderId)}
                  </Text>
                </View>
              )}
              {dishTitle && (
                <View style={styles.cardRow}>
                  <Text style={[styles.cardLabel, { color: C.bodySoft }]}>Dish</Text>
                  <Text style={[styles.cardVal, { color: C.textInk }]} numberOfLines={2}>{dishTitle}</Text>
                </View>
              )}
              {cookName && (
                <View style={styles.cardRow}>
                  <Text style={[styles.cardLabel, { color: C.bodySoft }]}>Cook</Text>
                  <Text style={[styles.cardVal, { color: C.textInk }]}>{cookName}</Text>
                </View>
              )}
              {window && (
                <View style={styles.cardRow}>
                  <Text style={[styles.cardLabel, { color: C.bodySoft }]}>Delivery window</Text>
                  <Text style={[styles.cardVal, { color: C.textInk }]}>{window}</Text>
                </View>
              )}
              {total && (
                <View style={[styles.cardRow, { marginBottom: 0 }]}>
                  <Text style={[styles.cardLabel, { color: C.bodySoft }]}>Total paid</Text>
                  <Text style={[styles.totalVal, { color: C.spice }]}>{total}</Text>
                </View>
              )}
            </Animated.View>

            {/* Hold note */}
            <View style={[styles.holdPill, { backgroundColor: C.cream }]}>
              <Ionicons name="lock-closed-outline" size={13} color={C.bodySoft} />
              <Text style={[styles.holdText, { color: C.bodySoft }]}>Your slot is confirmed and locked in</Text>
            </View>
          </View>

          {/* CTAs */}
          <View style={styles.ctaBar}>
            <TouchableOpacity
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); orderId ? router.push(`/tracking/${orderId}`) : router.replace('/(customer)/orders'); }}
              style={[styles.trackBtn, { backgroundColor: C.ink }]}
              activeOpacity={0.85}
              accessibilityLabel="Track my order"
              accessibilityRole="button"
            >
              <Ionicons name="navigate-outline" size={16} color={C.canvas} />
              <Text style={[styles.trackLabel, { color: C.canvas }]}>Track my order</Text>
            </TouchableOpacity>

            <View style={styles.secondaryRow}>
              <TouchableOpacity
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.replace('/(customer)'); }}
                style={styles.homeBtn}
                accessibilityLabel="Back to home"
                accessibilityRole="button"
              >
                <Text style={[styles.homeLabel, { color: C.spice }]}>Back to home</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleShare}
                style={[styles.shareBtn, { borderColor: C.borderWarm }]}
                accessibilityLabel="Share this order"
                accessibilityRole="button"
              >
                <Ionicons name="share-outline" size={16} color={C.bodySoft} />
              </TouchableOpacity>
            </View>
          </View>

          {/* You might also like */}
          {recommendations.length > 0 && (
            <View style={styles.recsSection}>
              <Text style={[styles.recsCap, { color: C.bodySoft }]}>You might also like</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: Spacing.lg, gap: 12 }}
              >
                {recommendations.map(cook => (
                  <TouchableOpacity
                    key={cook.id}
                    style={[styles.recCard, { backgroundColor: C.bgCard, borderColor: C.borderWarm }]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      router.push(`/cook/${cook.id}` as any);
                    }}
                    activeOpacity={0.85}
                  >
                    <Avatar name={cook.display_name} avatarUrl={cook.avatar_url} size={44} isLive={cook.is_live} />
                    <Text style={[styles.recName, { color: C.textInk }]} numberOfLines={2}>{cook.display_name}</Text>
                    {cook.today_items?.[0] && (
                      <Text style={[styles.recDish, { color: C.bodySoft }]} numberOfLines={1}>
                        {cook.today_items[0].title}
                      </Text>
                    )}
                    <Text style={[styles.recPrice, { color: C.spice }]}>
                      {cook.today_items?.[0]
                        ? fmtCurrency(cook.today_items[0].unit_price, cook.currency_code ?? 'NGN')
                        : 'View menu'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:  { flex: 1 },
  inner: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.lg },

  badge: {
    width: 88, height: 88, borderRadius: 44,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 28,
    ...Shadow.lift,
  },

  headline: { fontFamily: Fonts.serif, fontSize: 30, textAlign: 'center', marginBottom: 10 },
  sub:      { fontFamily: Fonts.sans, fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 28, paddingHorizontal: Spacing.lg },

  card: {
    width: '100%', borderRadius: Radius.lg, padding: 18,
    borderWidth: 0.5, ...Shadow.card, marginBottom: 16, gap: 12,
  },
  cardRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  cardLabel: { fontFamily: Fonts.sans, fontSize: 13 },
  cardVal:   { fontFamily: Fonts.sansMedium, fontSize: 13, textAlign: 'right', flex: 1 },
  totalVal:  { fontFamily: Fonts.serif, fontSize: 16, textAlign: 'right' },

  holdPill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 40, paddingHorizontal: 14, paddingVertical: 7 },
  holdText: { fontFamily: Fonts.sans, fontSize: 12 },

  ctaBar: { padding: Spacing.lg, paddingBottom: 36, gap: 12 },
  trackBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: Radius.lg, paddingVertical: 16 },
  trackLabel: { fontFamily: Fonts.sansMedium, fontSize: 15 },

  secondaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  homeBtn:  { flex: 1, alignItems: 'center', paddingVertical: 12 },
  homeLabel:{ fontFamily: Fonts.sansMedium, fontSize: 14 },
  shareBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },

  recsSection: { paddingTop: 8, paddingBottom: 32 },
  recsCap: { fontFamily: Fonts.sans, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 12, paddingHorizontal: Spacing.lg },

  recCard: {
    width: 128, borderRadius: Radius.lg, borderWidth: 0.5,
    padding: 12, alignItems: 'center', gap: 6,
    ...Shadow.card,
  },
  recName:  { fontFamily: Fonts.sansMedium, fontSize: 12, textAlign: 'center' },
  recDish:  { fontFamily: Fonts.sans, fontSize: 11, textAlign: 'center' },
  recPrice: { fontFamily: Fonts.serif, fontSize: 13 },
});
