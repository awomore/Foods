import React, { useEffect, useCallback, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Animated, Linking, ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ordersApi, type Order, type OrderStatus } from '../../src/api/orders';
import { Fonts, Spacing, Radius, Shadow } from '../../src/constants/theme';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import Avatar from '../../src/components/ui/Avatar';
import DishPhoto from '../../src/components/ui/DishPhoto';
import { fmtCurrency, fmtTime, shortOrderRef } from '../../src/utils/format';
import { SkeletonTracking } from '../../src/components/ui/Skeleton';

const ORDER_STEPS: { key: OrderStatus; label: string }[] = [
  { key: 'pending_payment',   label: 'Order placed' },
  { key: 'payment_confirmed', label: 'Payment confirmed' },
  { key: 'accepted',          label: 'Cook accepted' },
  { key: 'preparing',         label: 'Being prepared' },
  { key: 'ready',             label: 'Ready for pickup' },
  { key: 'out_for_delivery',  label: 'Out for delivery' },
  { key: 'in_transit',        label: 'On its way to you' },
  { key: 'delivered',         label: 'Delivered' },
];

const STEP_ORDER = ORDER_STEPS.map(s => s.key);

// ─── Status hero card ────────────────────────────────────────────────────────

interface HeroConfig {
  icon: string;
  title: string;
  subtitle: string;
  iconColor: (C: AppColors) => string;
  bgColor: (C: AppColors) => string;
}

function getHeroConfig(status: string, isDark: boolean): HeroConfig {
  switch (status) {
    case 'pending_payment':
      return { icon: 'time-outline', title: 'Awaiting payment', subtitle: 'Your order is being confirmed', iconColor: C => C.bodySoft, bgColor: C => C.bgCard };
    case 'payment_confirmed':
      return { icon: 'checkmark-circle-outline', title: 'Payment confirmed!', subtitle: 'Connecting you with a cook', iconColor: C => C.successFg, bgColor: C => C.successBg };
    case 'accepted':
      return { icon: 'person-circle-outline', title: 'Cook accepted your order', subtitle: "They're getting things ready", iconColor: C => C.ember, bgColor: C => C.bgCard };
    case 'preparing':
      return { icon: 'flame-outline', title: 'Cooking in progress', subtitle: 'Your meal is being made with care', iconColor: C => C.ember, bgColor: C => C.bgCard };
    case 'ready':
      return { icon: 'bag-check-outline', title: 'Your meal is ready!', subtitle: 'Waiting to be picked up', iconColor: C => C.successFg, bgColor: C => C.successBg };
    case 'delivered':
      return { icon: 'heart-circle-outline', title: 'Delivered!', subtitle: 'Enjoy your meal 🍽️', iconColor: C => C.ember, bgColor: C => C.bgCard };
    case 'cancelled':
      return { icon: 'close-circle-outline', title: 'Order cancelled', subtitle: 'Your order was not fulfilled', iconColor: C => C.errorFg, bgColor: C => C.errorBg };
    case 'refunded':
      return { icon: 'refresh-circle-outline', title: 'Refund initiated', subtitle: 'You should receive your money back shortly', iconColor: C => C.infoFg, bgColor: C => C.infoBg };
    default:
      return { icon: 'bicycle-outline', title: 'On its way', subtitle: 'Your order is heading to you', iconColor: C => C.ember, bgColor: C => C.bgCard };
  }
}

function PulsingIcon({ iconName, color, size = 52 }: { iconName: string; color: string; size?: number }) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.12, duration: 700, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1,    duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Ionicons name={iconName as any} size={size} color={color} />
    </Animated.View>
  );
}

function RiderJourneyCard({ estimatedArrival, C }: { estimatedArrival: string | null; C: AppColors }) {
  const riderX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(riderX, { toValue: 1,   duration: 1800, useNativeDriver: true }),
        Animated.timing(riderX, { toValue: 0.7, duration: 900,  useNativeDriver: true }),
        Animated.timing(riderX, { toValue: 1,   duration: 900,  useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  // Translates 0→1 into a translateX offset across the track width
  const translateX = riderX.interpolate({ inputRange: [0, 1], outputRange: [0, 180] });

  return (
    <View style={[journeyStyles.container, { backgroundColor: C.bgCard, borderColor: C.borderWarm }]}>
      {/* Header row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        <Ionicons name="navigate" size={16} color={C.ember} />
        <Text style={[journeyStyles.heading, { color: C.textInk }]}>On its way to you</Text>
        {estimatedArrival && (
          <View style={[journeyStyles.etaBadge, { backgroundColor: C.successBg }]}>
            <Text style={[journeyStyles.etaText, { color: C.successFg }]}>ETA {fmtTime(estimatedArrival)}</Text>
          </View>
        )}
      </View>

      {/* Road track */}
      <View style={journeyStyles.track}>
        {/* Origin dot */}
        <View style={[journeyStyles.trackDot, { backgroundColor: C.ember }]}>
          <Ionicons name="restaurant-outline" size={11} color={C.white} />
        </View>

        {/* Dashed road line */}
        <View style={journeyStyles.road}>
          <View style={[journeyStyles.roadLine, { backgroundColor: C.borderWarm }]} />
          {/* Animated rider */}
          <Animated.View style={[journeyStyles.riderIcon, { transform: [{ translateX }] }]}>
            <View style={[journeyStyles.riderBubble, { backgroundColor: C.ember }]}>
              <Ionicons name="bicycle" size={16} color={C.white} />
            </View>
            <View style={[journeyStyles.riderShadow, { backgroundColor: C.ember }]} />
          </Animated.View>
        </View>

        {/* Destination dot */}
        <View style={[journeyStyles.trackDot, { backgroundColor: C.spice }]}>
          <Ionicons name="location" size={11} color={C.white} />
        </View>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
        <Text style={[journeyStyles.trackLabel, { color: C.bodySoft }]}>Cook's kitchen</Text>
        <Text style={[journeyStyles.trackLabel, { color: C.bodySoft }]}>Your location</Text>
      </View>
    </View>
  );
}

const journeyStyles = StyleSheet.create({
  container: { borderRadius: Radius.lg, padding: 18, borderWidth: 0.5, ...Shadow.card },
  heading: { flex: 1, fontFamily: Fonts.sansMedium, fontSize: 14 },
  etaBadge: { borderRadius: 40, paddingHorizontal: 10, paddingVertical: 3 },
  etaText: { fontFamily: Fonts.sansMedium, fontSize: 12 },
  track: { flexDirection: 'row', alignItems: 'center', height: 40 },
  trackDot: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  road: { flex: 1, height: 40, justifyContent: 'center', paddingHorizontal: 6 },
  roadLine: { position: 'absolute', left: 6, right: 6, height: 2, borderRadius: 1 },
  riderBubble: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', ...Shadow.card },
  riderShadow: { width: 12, height: 4, borderRadius: 6, alignSelf: 'center', marginTop: 2, opacity: 0.25 },
  riderIcon: { position: 'absolute', left: 0, alignItems: 'center' },
  trackLabel: { fontFamily: Fonts.sans, fontSize: 11 },
});

function DeliveryWindowBadge({ windowStart, windowEnd, C }: { windowStart: string | null; windowEnd: string | null; C: AppColors }) {
  if (!windowStart || !windowEnd) return null;
  const now = Date.now();
  const end = new Date(windowEnd).getTime();
  const isLate = now > end;
  const bg = isLate ? C.errorBg : C.successBg;
  const fg = isLate ? C.errorFg : C.successFg;
  return (
    <View style={[heroStyles.windowBadge, { backgroundColor: bg }]}>
      <Ionicons name="time-outline" size={13} color={fg} />
      <Text style={[heroStyles.etaText, { color: fg }]}>
        {isLate ? 'Running late · ' : 'Arriving '}
        {fmtTime(windowStart)} – {fmtTime(windowEnd)}
      </Text>
    </View>
  );
}

function StatusHeroCard({ status, order, C }: { status: string; order: Order; C: AppColors }) {
  const isTransit = status === 'in_transit' || status === 'out_for_delivery';
  const isCooking = status === 'preparing' || status === 'accepted';
  const showWindow = status !== 'delivered' && status !== 'cancelled' && status !== 'refunded';

  if (isTransit) {
    return (
      <View>
        <RiderJourneyCard estimatedArrival={order.estimated_arrival ?? null} C={C} />
        {showWindow && (
          <View style={{ marginTop: 8 }}>
            <DeliveryWindowBadge windowStart={order.delivery_window_start} windowEnd={order.delivery_window_end} C={C} />
          </View>
        )}
      </View>
    );
  }

  const cfg = getHeroConfig(status, false);

  return (
    <View style={[heroStyles.container, { backgroundColor: cfg.bgColor(C), borderColor: C.borderWarm }]}>
      {isCooking
        ? <PulsingIcon iconName={cfg.icon} color={cfg.iconColor(C)} />
        : <Ionicons name={cfg.icon as any} size={52} color={cfg.iconColor(C)} />
      }
      <View style={{ alignItems: 'center', gap: 4, marginTop: 12 }}>
        <Text style={[heroStyles.title, { color: C.textInk }]}>{cfg.title}</Text>
        <Text style={[heroStyles.subtitle, { color: C.bodySoft }]}>{cfg.subtitle}</Text>
      </View>
      {showWindow && (
        <View style={{ marginTop: 14, width: '100%' }}>
          <DeliveryWindowBadge windowStart={order.delivery_window_start} windowEnd={order.delivery_window_end} C={C} />
        </View>
      )}
    </View>
  );
}

const heroStyles = StyleSheet.create({
  container:   { borderRadius: Radius.lg, padding: 28, alignItems: 'center', borderWidth: 0.5, ...Shadow.card },
  title:       { fontFamily: Fonts.sansMedium, fontSize: 16, textAlign: 'center' },
  subtitle:    { fontFamily: Fonts.sans, fontSize: 13, textAlign: 'center', lineHeight: 18 },
  etaBadge:    { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 40, paddingHorizontal: 12, paddingVertical: 5, marginTop: 14 },
  etaText:     { fontFamily: Fonts.sansMedium, fontSize: 13 },
  windowBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 40, paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'center' },
});

// ─── Main screen ─────────────────────────────────────────────────────────────

const BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'https://foodsbyme-api-production.up.railway.app') + '/api';

async function fetchRiderLocation(orderId: string) {
  try {
    const token = await AsyncStorage.getItem('auth_token');
    const res = await fetch(`${BASE_URL}/fleet/orders/${orderId}/location`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.location as { latitude: number; longitude: number; updated_at: string } | null;
  } catch {
    return null;
  }
}

export default function TrackingScreen() {
  const router  = useRouter();
  const C       = useColors();
  const { id }  = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmingReceipt, setConfirmingReceipt] = useState(false);
  const [riderLocation, setRiderLocation] = useState<{ latitude: number; longitude: number; updated_at: string } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevStatus = useRef<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { order: o } = await ordersApi.get(id!);
      if (prevStatus.current && prevStatus.current !== o.status) {
        Haptics.notificationAsync(
          o.status === 'delivered'
            ? Haptics.NotificationFeedbackType.Success
            : Haptics.NotificationFeedbackType.Warning
        );
      }
      prevStatus.current = o.status;
      setOrder(o);
      if (o.status === 'delivered' || o.status === 'cancelled' || o.status === 'refunded') {
        if (pollRef.current) clearInterval(pollRef.current);
      }
      // Poll rider GPS when in transit
      if (['rider_assigned', 'picked_up', 'in_transit', 'out_for_delivery'].includes(o.status)) {
        const loc = await fetchRiderLocation(id!);
        setRiderLocation(loc);
      }
    } catch (e) {
      console.error('tracking load error:', e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
    pollRef.current = setInterval(load, 20000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [load]);

  const S = makeStyles(C);

  if (loading) {
    return <SkeletonTracking />;
  }

  if (!order) {
    return (
      <View style={[S.root, { alignItems: 'center', justifyContent: 'center', padding: 24 }]}>
        <Text style={{ fontFamily: Fonts.sans, fontSize: 15, color: C.bodySoft }}>Order not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 14, color: C.spice }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const activeIdx  = STEP_ORDER.indexOf(order.status as OrderStatus);
  const isCancelled = order.status === 'cancelled' || order.status === 'refunded';
  const cookName   = order.cook_name ?? 'Your cook';
  const dishTitle  = order.item_title ?? 'Your meal';

  function callRider() {
    const phone = order?.off_platform_rider_phone ?? order?.rider_phone;
    if (!phone) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL(`tel:${phone}`);
  }

  async function handleConfirmReceipt() {
    if (!order) return;
    setConfirmingReceipt(true);
    try {
      const { order: updated } = await ordersApi.confirmReceipt(order.id);
      setOrder(updated);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      console.error('confirm receipt error:', e);
    } finally {
      setConfirmingReceipt(false);
    }
  }

  return (
    <View style={S.root}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={S.header}>
          <TouchableOpacity
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }}
            style={S.backBtn}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <Ionicons name="chevron-back" size={22} color={C.textInk} />
          </TouchableOpacity>
          <Text style={S.headerTitle}>Tracking your order</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: Spacing.lg, gap: 16, paddingBottom: 48 }}
        >
          {/* Status hero + delivery window */}
          <StatusHeroCard status={order.status} order={order} C={C} />

          {/* Order ref */}
          <View style={[S.refRow, { backgroundColor: C.bgCard, borderColor: C.borderWarm }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="receipt-outline" size={14} color={C.bodySoft} />
              <Text style={[S.refKey, { color: C.bodySoft }]}>Order</Text>
            </View>
            <Text style={[S.refVal, { color: C.textInk }]} selectable>{shortOrderRef(order.id)}</Text>
          </View>

          {/* Timeline */}
          <View style={[S.card, { backgroundColor: C.bgCard, borderColor: C.borderWarm }]}>
            <Text style={[S.sectionLabel, { color: C.textInk }]}>Order timeline</Text>
            {ORDER_STEPS.map((step, i) => {
              const done   = activeIdx >= 0 && i <= activeIdx && !isCancelled;
              const active = i === activeIdx && !isCancelled;
              return (
                <View key={step.key} style={S.stepRow}>
                  <View style={S.stepLeft}>
                    {i > 0 && (
                      <View style={[S.connectorLine, { backgroundColor: done ? C.spice : C.borderWarm }]} />
                    )}
                    <View style={[
                      S.stepDot,
                      { borderColor: C.borderWarm, backgroundColor: C.bgCard },
                      done   && { backgroundColor: C.spice, borderColor: C.spice },
                      active && { backgroundColor: C.ember, borderColor: C.ember },
                    ]}>
                      {done && !active && <Ionicons name="checkmark" size={10} color={C.white} />}
                      {active && <View style={[S.stepDotInner, { backgroundColor: C.white }]} />}
                    </View>
                  </View>
                  <View style={S.stepContent}>
                    <Text style={[S.stepLabel, { color: done ? C.textInk : C.stone }]}>{step.label}</Text>
                  </View>
                </View>
              );
            })}
            {isCancelled && (
              <View style={[S.cancelledBanner, { backgroundColor: C.errorBg }]}>
                <Ionicons name="close-circle-outline" size={16} color={C.errorFg} />
                <Text style={[S.cancelledText, { color: C.errorFg }]}>
                  {order.status === 'refunded' ? 'Order refunded' : 'Order was cancelled'}
                </Text>
              </View>
            )}
          </View>

          {/* Off-platform rider card */}
          {order.logistics_type === 'off_platform' && order.off_platform_rider_name && (
            <View style={[S.card, { backgroundColor: C.bgCard, borderColor: C.borderWarm }]}>
              <Text style={[S.sectionLabel, { color: C.textInk }]}>Your rider</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={[S.riderAvatar, { backgroundColor: C.bgCook }]}>
                  <Ionicons name="bicycle" size={22} color={C.spice} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[S.personName, { color: C.textInk }]}>{order.off_platform_rider_name}</Text>
                  {order.off_platform_eta && (
                    <Text style={[S.refKey, { color: C.bodySoft, marginTop: 2 }]}>
                      ETA {fmtTime(order.off_platform_eta)}
                    </Text>
                  )}
                </View>
                {order.off_platform_rider_phone && (
                  <TouchableOpacity
                    style={[S.callBtn, { borderColor: C.borderWarm }]}
                    onPress={callRider}
                    accessibilityLabel={`Call rider ${order.off_platform_rider_name}`}
                    accessibilityRole="button"
                  >
                    <Ionicons name="call-outline" size={16} color={C.spice} />
                    <Text style={[S.callText, { color: C.spice }]}>Call</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {/* FOODS network rider card */}
          {order.logistics_type !== 'off_platform' && order.rider_name && (
            <View style={[S.card, { backgroundColor: C.bgCard, borderColor: C.borderWarm }]}>
              <Text style={[S.sectionLabel, { color: C.textInk }]}>Your rider</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={[S.riderAvatar, { backgroundColor: C.bgCook }]}>
                  <Ionicons name="bicycle" size={22} color={C.spice} />
                </View>
                <Text style={[S.personName, { color: C.textInk, flex: 1 }]}>{order.rider_name}</Text>
                {order.rider_phone && (
                  <TouchableOpacity
                    style={[S.callBtn, { borderColor: C.borderWarm }]}
                    onPress={callRider}
                    accessibilityLabel={`Call rider ${order.rider_name}`}
                    accessibilityRole="button"
                  >
                    <Ionicons name="call-outline" size={16} color={C.spice} />
                    <Text style={[S.callText, { color: C.spice }]}>Call</Text>
                  </TouchableOpacity>
                )}
              </View>
              {riderLocation && (
                <TouchableOpacity
                  style={[S.liveLocBtn, { backgroundColor: C.successBg, borderColor: C.leaf }]}
                  onPress={() => {
                    const url = `https://maps.google.com/?q=${riderLocation.latitude},${riderLocation.longitude}`;
                    Linking.openURL(url);
                  }}
                  accessibilityLabel="Open rider live location in maps"
                  accessibilityRole="button"
                >
                  <View style={[S.liveDot, { backgroundColor: C.leaf }]} />
                  <Ionicons name="navigate-outline" size={15} color={C.successFg} />
                  <Text style={[S.liveLocText, { color: C.successFg }]}>Live location · Open in Maps</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Delivery OTP — shown to customer when order is out for delivery */}
          {order.otp_enabled && order.delivery_otp && !order.delivery_otp_verified_at && (
            <View style={[S.card, { backgroundColor: C.warnBg ?? C.bgCard, borderColor: C.ember }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Ionicons name="shield-checkmark-outline" size={18} color={C.ember} />
                <Text style={[S.sectionLabel, { color: C.textInk, marginBottom: 0 }]}>Delivery code</Text>
              </View>
              <Text style={[S.refKey, { color: C.bodySoft, marginBottom: 10 }]}>
                Read this code to your rider when they arrive to confirm delivery.
              </Text>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontFamily: Fonts.serif, fontSize: 36, letterSpacing: 8, color: C.ember }}>
                  {order.delivery_otp}
                </Text>
              </View>
            </View>
          )}

          {/* Fez delivery tracking */}
          {order.fez_order_number && (
            <View style={[S.card, { backgroundColor: C.bgCard, borderColor: C.borderWarm }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Ionicons name="bicycle-outline" size={18} color={C.spice} />
                <Text style={[S.sectionLabel, { color: C.textInk, marginBottom: 0 }]}>Fez delivery</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={[S.refKey, { color: C.bodySoft }]}>Tracking number</Text>
                <Text style={[S.refVal, { color: C.textInk }]} selectable>{order.fez_order_number}</Text>
              </View>
              {order.fez_dispatch_status && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                  <Text style={[S.refKey, { color: C.bodySoft }]}>Rider status</Text>
                  <Text style={[S.refVal, { color: order.fez_dispatch_status === 'dispatched' ? C.successFg : C.bodySoft }]}>
                    {order.fez_dispatch_status === 'dispatched' ? 'Rider dispatched' : order.fez_dispatch_status}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Confirm receipt — off-platform orders only */}
          {order.logistics_type === 'off_platform' && !order.customer_confirmed_receipt &&
            ['out_for_delivery', 'in_transit', 'delivered'].includes(order.status) && (
            <TouchableOpacity
              style={[S.confirmBtn, { backgroundColor: C.spice }, confirmingReceipt && { opacity: 0.6 }]}
              onPress={handleConfirmReceipt}
              disabled={confirmingReceipt}
              accessibilityLabel="Confirm you received your order"
              accessibilityRole="button"
            >
              {confirmingReceipt
                ? <ActivityIndicator size="small" color="#fff" />
                : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                    <Text style={S.confirmBtnText}>I received my order</Text>
                  </>
                )}
            </TouchableOpacity>
          )}

          {/* Delivery fee payment reminder */}
          {order.delivery_fee > 0 && order.delivery_fee_payment_method !== 'wallet' && !order.delivery_fee_paid_to_rider &&
            ['out_for_delivery', 'in_transit'].includes(order.status) && (
            <View style={[S.card, { backgroundColor: C.infoBg ?? C.bgCard, borderColor: C.borderWarm }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="cash-outline" size={16} color={C.infoFg} />
                <Text style={[S.refKey, { color: C.infoFg, flex: 1 }]}>
                  {order.delivery_fee_payment_method === 'cash'
                    ? `Pay ${fmtCurrency(order.delivery_fee, order.currency_code)} in cash to your rider on arrival.`
                    : `Transfer ${fmtCurrency(order.delivery_fee, order.currency_code)} to your rider's number when they arrive.`}
                </Text>
              </View>
            </View>
          )}

          {/* Cook card */}
          <View style={[S.card, { backgroundColor: C.bgCard, borderColor: C.borderWarm }]}>
            <Text style={[S.sectionLabel, { color: C.textInk }]}>Your cook</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Avatar name={cookName.charAt(0).toUpperCase()} avatarBg={C.ember} size={44} />
              <Text style={[S.personName, { color: C.textInk, flex: 1 }]}>{cookName}</Text>
            </View>
          </View>

          {/* Dish summary */}
          <View style={[S.card, { backgroundColor: C.bgCard, borderColor: C.borderWarm }]}>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <DishPhoto uri={(order as any).item_photo_url ?? null} label={dishTitle} height={60} width={60} radius={10} />
              <View style={{ flex: 1 }}>
                <Text style={[S.dishTitle, { color: C.textInk }]} numberOfLines={2}>{dishTitle}</Text>
                <Text style={[S.dishPrice, { color: C.spice }]}>{fmtCurrency(order.total_amount, order.currency_code)}</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    root:        { flex: 1, backgroundColor: C.bg },
    header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 },
    backBtn:     { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { flex: 1, textAlign: 'center', fontFamily: Fonts.sansMedium, fontSize: 16, color: C.textInk },

    refRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: C.bgCard, borderRadius: Radius.md, padding: 14, borderWidth: 0.5, ...Shadow.card },
    refKey:      { fontFamily: Fonts.sans, fontSize: 13 },
    refVal:      { fontFamily: Fonts.sansMedium, fontSize: 13 },

    card:        { borderRadius: Radius.lg, padding: 16, borderWidth: 0.5, ...Shadow.card },
    sectionLabel:{ fontFamily: Fonts.sansMedium, fontSize: 14, marginBottom: 12 },

    stepRow:     { flexDirection: 'row', gap: 14, minHeight: 40 },
    stepLeft:    { width: 20, alignItems: 'center' },
    connectorLine: { position: 'absolute', top: -20, bottom: 12, width: 1.5, left: 9 },
    stepDot:     { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
    stepDotInner:{ width: 8, height: 8, borderRadius: 4 },
    stepContent: { flex: 1, paddingBottom: 20 },
    stepLabel:   { fontFamily: Fonts.sans, fontSize: 13, lineHeight: 20 },

    cancelledBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: Radius.md, padding: 10, marginTop: 4 },
    cancelledText:   { fontFamily: Fonts.sansMedium, fontSize: 13 },

    riderAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    personName:  { fontFamily: Fonts.sansMedium, fontSize: 14 },
    callBtn:     { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 40, borderWidth: 1 },
    callText:    { fontFamily: Fonts.sansMedium, fontSize: 13 },
    liveLocBtn:  { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 40, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, marginTop: 10, alignSelf: 'flex-start' },
    liveLocText: { fontFamily: Fonts.sansMedium, fontSize: 13 },
    liveDot:     { width: 7, height: 7, borderRadius: 4 },

    dishTitle:   { fontFamily: Fonts.sans, fontSize: 13, lineHeight: 18 },
    dishPrice:   { fontFamily: Fonts.serif, fontSize: 16, marginTop: 4 },

    confirmBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: Radius.lg, paddingVertical: 16, ...Shadow.card },
    confirmBtnText: { fontFamily: Fonts.sansMedium, fontSize: 15, color: '#fff' },
  });
}

