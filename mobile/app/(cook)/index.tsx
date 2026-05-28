import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { earningsApi, type EarningsResponse } from '../../src/api/earnings';
import { ordersApi, type Order } from '../../src/api/orders';
import { cooksApi, type CookDetail } from '../../src/api/cooks';
import { Fonts, Spacing, Radius, Shadow } from '../../src/constants/theme';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { fmtCurrency } from '../../src/utils/format';
import Avatar from '../../src/components/ui/Avatar';

export default function CookDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);

  const ORDER_STATUS_CONFIG = useMemo(() => ({
    accepted:         { label: 'Accepted',   color: C.infoFg },
    preparing:        { label: 'Preparing',  color: C.spice },
    ready:            { label: 'Ready',      color: C.successFg },
    out_for_delivery: { label: 'Out',        color: C.ember },
    in_transit:       { label: 'In transit', color: C.ember },
    delivered:        { label: 'Delivered',  color: C.successFg },
    cancelled:        { label: 'Cancelled',  color: C.errorFg },
  }), [C]);

  const [earnings, setEarnings] = useState<EarningsResponse | null>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [cookProfile, setCookProfile] = useState<CookDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [togglingLive, setTogglingLive] = useState(false);

  const firstName = user?.full_name?.split(' ')[0] ?? 'Chef';
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [earningsData, ordersData] = await Promise.all([
        earningsApi.summary('today'),
        ordersApi.list({ limit: 5 }),
      ]);
      setEarnings(earningsData);
      setRecentOrders((ordersData as any).orders ?? []);
    } catch (e) {
      console.error('cook dashboard load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadProfile = useCallback(async () => {
    if (!user?.cook_id) return;
    try {
      const { cook } = await cooksApi.get(user.cook_id);
      setCookProfile(cook);
    } catch {}
  }, [user?.cook_id]);

  useEffect(() => {
    if (!user?.cook_id) {
      router.replace('/cook-onboarding' as any);
      return;
    }
    load();
    loadProfile();
  }, [load, loadProfile]);

  async function toggleLive() {
    if (!cookProfile || !user?.cook_id) return;
    setTogglingLive(true);
    try {
      const { is_live } = await cooksApi.setLive(user.cook_id, !cookProfile.is_live);
      setCookProfile(p => p ? { ...p, is_live } : p);
    } catch (e) {
      console.error('toggle live error:', e);
    } finally {
      setTogglingLive(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={C.spice} />
      </View>
    );
  }

  const isLive = cookProfile?.is_live ?? false;
  const currency = earnings?.currency_code ?? 'NGN';
  const summary = earnings?.summary;
  const todayTotal = summary?.total_earned ?? 0;
  const todayOrders = summary?.total_orders ?? 0;
  const todayItem = cookProfile?.today_items?.[0];
  const slotsLeft = todayItem ? todayItem.total_slots - todayItem.slots_claimed : 0;

  return (
    <View style={styles.root}>
      <SafeAreaView>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>{greeting},</Text>
            <Text style={styles.name}>{firstName}</Text>
          </View>
          <Avatar name={firstName.charAt(0)} avatarBg={C.ember} size={40} />
        </View>
      </SafeAreaView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: Spacing.lg, gap: 16, paddingTop: 8 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={C.spice} />
        }
      >
        <View style={[styles.statusBanner, isLive && styles.statusBannerActive]}>
          <View style={[styles.statusDot, { backgroundColor: isLive ? C.leaf : C.stone }]} />
          <Text style={styles.statusText}>{isLive ? "Cooking now — you're live" : 'Not live today'}</Text>
          <TouchableOpacity style={styles.toggleBtn} onPress={toggleLive} disabled={togglingLive}>
            {togglingLive ? (
              <ActivityIndicator size="small" color={C.bodySoft} />
            ) : (
              <Text style={styles.toggleBtnText}>{isLive ? 'Go offline' : 'Go live'}</Text>
            )}
          </TouchableOpacity>
        </View>

        {todayItem && (
          <View>
            <Text style={styles.sectionLabel}>Today's dish</Text>
            <View style={styles.dishCard}>
              <View style={[styles.dishThumb, { backgroundColor: C.ember }]}>
                <Text style={styles.dishThumbLabel}>{todayItem.title.slice(0, 6)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.dishTitle} numberOfLines={2}>{todayItem.title}</Text>
                <Text style={styles.dishPrice}>{fmtCurrency(todayItem.unit_price, currency)}</Text>
                <View style={styles.slotRow}>
                  <View style={styles.slotBar}>
                    <View style={[styles.slotFill, {
                      width: `${((todayItem.total_slots - slotsLeft) / todayItem.total_slots) * 100}%` as any,
                    }]} />
                  </View>
                  <Text style={styles.slotText}>{slotsLeft} left</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        <View style={styles.statsGrid}>
          {[
            { label: 'Orders today', value: todayOrders.toString(), icon: 'receipt-outline' },
            { label: 'Today earnings', value: fmtCurrency(todayTotal, currency), icon: 'cash-outline' },
            { label: 'Repeat rate', value: `${Math.round((cookProfile?.repeat_order_rate ?? 0) * 100)}%`, icon: 'repeat-outline' },
            { label: 'Followers', value: (cookProfile?.platform_follower_count ?? 0).toLocaleString(), icon: 'people-outline' },
          ].map(s => (
            <View key={s.label} style={styles.statCard}>
              <Ionicons name={s.icon as any} size={18} color={C.spice} />
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {recentOrders.length > 0 && (
          <View>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionLabel}>Recent orders</Text>
              <TouchableOpacity onPress={() => router.push('/(cook)/orders')}>
                <Text style={styles.seeAll}>See all</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.card}>
              {recentOrders.slice(0, 5).map((order, i) => {
                const cfg = (ORDER_STATUS_CONFIG as any)[order.status] ?? { label: order.status, color: C.bodySoft };
                return (
                  <View key={order.id}>
                    {i > 0 && <View style={styles.divider} />}
                    <View style={styles.orderRow}>
                      <View style={[styles.orderDot, { backgroundColor: cfg.color }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.orderCustomer}>{order.customer_name ?? 'Customer'}</Text>
                        <Text style={styles.orderDish} numberOfLines={1}>{order.item_title ?? 'Order'}</Text>
                      </View>
                      <View style={[styles.orderStatus, { backgroundColor: cfg.color + '22' }]}>
                        <Text style={[styles.orderStatusText, { color: cfg.color }]}>{cfg.label}</Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        <View>
          <Text style={styles.sectionLabel}>Quick actions</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity style={[styles.actionBtn, { flex: 1 }]} onPress={() => router.push('/cook/dish-form' as any)}>
              <Ionicons name="add-circle-outline" size={20} color={C.spice} />
              <Text style={styles.actionLabel}>Add dish</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, { flex: 1 }]} onPress={() => router.push('/diary-post' as any)}>
              <Ionicons name="camera-outline" size={20} color={C.spice} />
              <Text style={styles.actionLabel}>Post update</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, { flex: 1 }]} onPress={() => router.push('/(cook)/earnings')}>
              <Ionicons name="cash-outline" size={20} color={C.spice} />
              <Text style={styles.actionLabel}>Earnings</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function makeStyles(C: AppColors) { return StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: Spacing.lg, paddingTop: 16, paddingBottom: 12 },
  greeting: { fontFamily: Fonts.sans, fontSize: 13, color: C.bodySoft },
  name: { fontFamily: Fonts.serif, fontSize: 24, color: C.textInk },

  statusBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.bgCard, borderRadius: Radius.md, padding: 12, borderWidth: 0.5, borderColor: C.borderWarm },
  statusBannerActive: { borderColor: C.leaf + '50', backgroundColor: C.successBg },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.textInk, flex: 1 },
  toggleBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 40, borderWidth: 1, borderColor: C.borderWarm, minWidth: 70, alignItems: 'center' },
  toggleBtnText: { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.bodySoft },

  sectionLabel: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.textInk, marginBottom: 10 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  seeAll: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.spice },

  dishCard: { flexDirection: 'row', gap: 12, backgroundColor: C.bgCard, borderRadius: Radius.lg, padding: 14, borderWidth: 0.5, borderColor: C.borderWarm, ...Shadow.card },
  dishThumb: { width: 70, height: 70, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  dishThumbLabel: { fontFamily: Fonts.serifItalic, fontSize: 11, color: 'rgba(250,246,240,0.8)', textAlign: 'center', padding: 4 },
  dishTitle: { fontFamily: Fonts.sans, fontSize: 13, color: C.textInk, lineHeight: 18, marginBottom: 4 },
  dishPrice: { fontFamily: Fonts.serif, fontSize: 16, color: C.spice, marginBottom: 8 },
  slotRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  slotBar: { flex: 1, height: 4, borderRadius: 2, backgroundColor: C.borderWarm, overflow: 'hidden' },
  slotFill: { height: '100%', backgroundColor: C.spice, borderRadius: 2 },
  slotText: { fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: { width: '47.5%', backgroundColor: C.bgCard, borderRadius: Radius.md, padding: 14, borderWidth: 0.5, borderColor: C.borderWarm, ...Shadow.card, gap: 4 },
  statValue: { fontFamily: Fonts.serif, fontSize: 20, color: C.textInk },
  statLabel: { fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft },

  card: { backgroundColor: C.bgCard, borderRadius: Radius.lg, borderWidth: 0.5, borderColor: C.borderWarm, ...Shadow.card, overflow: 'hidden' },
  divider: { height: 0.5, backgroundColor: C.borderWarm },
  orderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  orderDot: { width: 8, height: 8, borderRadius: 4 },
  orderCustomer: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.textInk },
  orderDish: { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft, marginTop: 2 },
  orderStatus: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 40 },
  orderStatusText: { fontFamily: Fonts.sansMedium, fontSize: 11 },

  actionBtn: { backgroundColor: C.bgCard, borderRadius: Radius.md, padding: 14, alignItems: 'center', gap: 6, borderWidth: 0.5, borderColor: C.borderWarm, ...Shadow.card },
  actionLabel: { fontFamily: Fonts.sans, fontSize: 12, color: C.body, textAlign: 'center' },
}); }
