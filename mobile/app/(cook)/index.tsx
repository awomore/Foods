import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { earningsApi, type EarningsResponse } from '../../src/api/earnings';
import { ordersApi, type Order, type OrderStatus } from '../../src/api/orders';
import { cooksApi, type CookDetail } from '../../src/api/cooks';
import { Colors, Fonts, Spacing, Radius, Shadow } from '../../src/constants/theme';
import Avatar from '../../src/components/ui/Avatar';

const ORDER_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  accepted:          { label: 'Accepted',      color: Colors.infoFg },
  preparing:         { label: 'Preparing',     color: Colors.spice },
  ready:             { label: 'Ready',         color: Colors.successFg },
  out_for_delivery:  { label: 'Out',           color: Colors.ember },
  in_transit:        { label: 'In transit',    color: Colors.ember },
  delivered:         { label: 'Delivered',     color: Colors.successFg },
  cancelled:         { label: 'Cancelled',     color: Colors.errorFg },
};

function fmtCurrency(amount: number, currency = 'NGN'): string {
  const symbols: Record<string, string> = { NGN: '₦', KES: 'KSh ', GHS: 'GH₵', ZAR: 'R', EGP: 'E£' };
  return (symbols[currency] ?? currency + ' ') + Number(amount).toLocaleString('en-NG', { maximumFractionDigits: 0 });
}

export default function CookDashboard() {
  const router = useRouter();
  const { user } = useAuth();
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

  // Load cook profile for live status toggle
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
        <ActivityIndicator color={Colors.spice} />
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
          <Avatar name={firstName.charAt(0)} avatarBg={Colors.ember} size={40} />
        </View>
      </SafeAreaView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: Spacing.lg, gap: 16, paddingTop: 8 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={Colors.spice} />
        }
      >
        {/* Status banner */}
        <View style={[styles.statusBanner, isLive && styles.statusBannerActive]}>
          <View style={[styles.statusDot, { backgroundColor: isLive ? Colors.leaf : Colors.stone }]} />
          <Text style={styles.statusText}>{isLive ? 'Cooking now — you\'re live' : 'Not live today'}</Text>
          <TouchableOpacity style={styles.toggleBtn} onPress={toggleLive} disabled={togglingLive}>
            {togglingLive ? (
              <ActivityIndicator size="small" color={Colors.bodySoft} />
            ) : (
              <Text style={styles.toggleBtnText}>{isLive ? 'Go offline' : 'Go live'}</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Today's dish */}
        {todayItem && (
          <View>
            <Text style={styles.sectionLabel}>Today's dish</Text>
            <View style={styles.dishCard}>
              <View style={[styles.dishThumb, { backgroundColor: '#C97A35' }]}>
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

        {/* Stats row */}
        <View style={styles.statsGrid}>
          {[
            { label: 'Orders today', value: todayOrders.toString(), icon: 'receipt-outline' },
            { label: 'Today earnings', value: fmtCurrency(todayTotal, currency), icon: 'cash-outline' },
            { label: 'Repeat rate', value: `${Math.round((cookProfile?.repeat_order_rate ?? 0) * 100)}%`, icon: 'repeat-outline' },
            { label: 'Followers', value: (cookProfile?.platform_follower_count ?? 0).toLocaleString(), icon: 'people-outline' },
          ].map(s => (
            <View key={s.label} style={styles.statCard}>
              <Ionicons name={s.icon as any} size={18} color={Colors.spice} />
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Recent orders */}
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
                const cfg = ORDER_STATUS_CONFIG[order.status] ?? { label: order.status, color: Colors.bodySoft };
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

        {/* Quick actions */}
        <View>
          <Text style={styles.sectionLabel}>Quick actions</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity style={[styles.actionBtn, { flex: 1 }]} onPress={() => router.push('/cook/dish-form' as any)}>
              <Ionicons name="add-circle-outline" size={20} color={Colors.spice} />
              <Text style={styles.actionLabel}>Add dish</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, { flex: 1 }]}>
              <Ionicons name="camera-outline" size={20} color={Colors.spice} />
              <Text style={styles.actionLabel}>Post update</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, { flex: 1 }]} onPress={() => router.push('/(cook)/earnings')}>
              <Ionicons name="cash-outline" size={20} color={Colors.spice} />
              <Text style={styles.actionLabel}>Earnings</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: Spacing.lg, paddingTop: 16, paddingBottom: 12 },
  greeting: { fontFamily: Fonts.sans, fontSize: 13, color: Colors.bodySoft },
  name: { fontFamily: Fonts.serif, fontSize: 24, color: Colors.textInk },

  statusBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.bgCard, borderRadius: Radius.md, padding: 12, borderWidth: 0.5, borderColor: Colors.borderWarm },
  statusBannerActive: { borderColor: Colors.leaf + '50', backgroundColor: Colors.successBg },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: Colors.textInk, flex: 1 },
  toggleBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 40, borderWidth: 1, borderColor: Colors.borderWarm, minWidth: 70, alignItems: 'center' },
  toggleBtnText: { fontFamily: Fonts.sansMedium, fontSize: 12, color: Colors.bodySoft },

  sectionLabel: { fontFamily: Fonts.sansMedium, fontSize: 14, color: Colors.textInk, fontWeight: '600', marginBottom: 10 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  seeAll: { fontFamily: Fonts.sansMedium, fontSize: 13, color: Colors.spice },

  dishCard: { flexDirection: 'row', gap: 12, backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: 14, borderWidth: 0.5, borderColor: Colors.borderWarm, ...Shadow.card },
  dishThumb: { width: 70, height: 70, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  dishThumbLabel: { fontFamily: Fonts.serifItalic, fontSize: 11, color: 'rgba(250,246,240,0.8)', textAlign: 'center', padding: 4 },
  dishTitle: { fontFamily: Fonts.sans, fontSize: 13, color: Colors.textInk, lineHeight: 18, marginBottom: 4 },
  dishPrice: { fontFamily: Fonts.serif, fontSize: 16, color: Colors.spice, marginBottom: 8 },
  slotRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  slotBar: { flex: 1, height: 4, borderRadius: 2, backgroundColor: Colors.borderWarm, overflow: 'hidden' },
  slotFill: { height: '100%', backgroundColor: Colors.spice, borderRadius: 2 },
  slotText: { fontFamily: Fonts.sans, fontSize: 11, color: Colors.bodySoft },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: { width: '47.5%', backgroundColor: Colors.bgCard, borderRadius: Radius.md, padding: 14, borderWidth: 0.5, borderColor: Colors.borderWarm, ...Shadow.card, gap: 4 },
  statValue: { fontFamily: Fonts.serif, fontSize: 20, color: Colors.textInk },
  statLabel: { fontFamily: Fonts.sans, fontSize: 11, color: Colors.bodySoft },

  card: { backgroundColor: Colors.bgCard, borderRadius: Radius.lg, borderWidth: 0.5, borderColor: Colors.borderWarm, ...Shadow.card, overflow: 'hidden' },
  divider: { height: 0.5, backgroundColor: Colors.borderWarm },
  orderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  orderDot: { width: 8, height: 8, borderRadius: 4 },
  orderCustomer: { fontFamily: Fonts.sansMedium, fontSize: 13, color: Colors.textInk, fontWeight: '600' },
  orderDish: { fontFamily: Fonts.sans, fontSize: 12, color: Colors.bodySoft, marginTop: 2 },
  orderStatus: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 40 },
  orderStatusText: { fontFamily: Fonts.sansMedium, fontSize: 11, fontWeight: '600' },

  actionBtn: { backgroundColor: Colors.bgCard, borderRadius: Radius.md, padding: 14, alignItems: 'center', gap: 6, borderWidth: 0.5, borderColor: Colors.borderWarm, ...Shadow.card },
  actionLabel: { fontFamily: Fonts.sans, fontSize: 12, color: Colors.body, textAlign: 'center' },
});
