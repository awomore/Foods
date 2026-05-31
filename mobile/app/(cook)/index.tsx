import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { earningsApi } from '../../src/api/earnings';
import { ordersApi, type Order } from '../../src/api/orders';
import { cooksApi, type CookDetail, type MenuItem } from '../../src/api/cooks';
import { cravingsApi, type Craving } from '../../src/api/cravings';
import { Fonts, Spacing, Radius, Shadow } from '../../src/constants/theme';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { fmtCurrency } from '../../src/utils/format';
import Avatar from '../../src/components/ui/Avatar';

const SWATCH_COLORS = ['#E8924A', '#B36A2E', '#2E8B3F', '#2A5FBF', '#8B2E6A'];

const ORDER_STATUS: Record<string, { label: string; color: string }> = {
  accepted:         { label: 'Accepted',   color: '#2A5FBF' },
  preparing:        { label: 'Preparing',  color: '#B36A2E' },
  ready:            { label: 'Ready',      color: '#2E8B3F' },
  out_for_delivery: { label: 'Out',        color: '#E8924A' },
  in_transit:       { label: 'In transit', color: '#E8924A' },
  delivered:        { label: 'Delivered',  color: '#2E8B3F' },
  cancelled:        { label: 'Cancelled',  color: '#C0392B' },
};

export default function CookStudio() {
  const router = useRouter();
  const { user } = useAuth();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);

  const [currency, setCurrency] = useState('NGN');
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [cookProfile, setCookProfile] = useState<CookDetail | null>(null);
  const [cravings, setCravings] = useState<Craving[]>([]);
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
      const [earningsData, ordersData, cravingsData] = await Promise.all([
        earningsApi.summary('today'),
        ordersApi.list({ limit: 5 }),
        cravingsApi.forCook().catch(() => ({ cravings: [] })),
      ]);
      setCurrency((earningsData as any)?.currency_code ?? 'NGN');
      setRecentOrders((ordersData as any).orders ?? []);
      setCravings((cravingsData as any).cravings ?? []);
    } catch (e) {
      console.error('studio load error:', e);
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
  const todayItems: MenuItem[] = cookProfile?.today_items ?? [];
  const followerCount = cookProfile?.platform_follower_count ?? 0;
  const totalCravings = todayItems.reduce((sum, i) => sum + (i.craving_count ?? 0), 0);
  const topDish = todayItems.length > 0
    ? [...todayItems].sort((a, b) => (b.craving_count ?? 0) - (a.craving_count ?? 0))[0]
    : null;

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: C.bg }}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>{greeting},</Text>
            <Text style={styles.name}>{firstName}</Text>
          </View>
          {isLive && (
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveBadgeText}>Live</Text>
            </View>
          )}
          <Avatar
            name={firstName.charAt(0)}
            avatarUrl={user?.avatar_url}
            avatarBg={C.ember}
            size={40}
          />
        </View>
      </SafeAreaView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: Spacing.md, paddingBottom: 48 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(true); loadProfile(); }}
            tintColor={C.spice}
          />
        }
      >
        {/* ── AUDIENCE PULSE ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionCap, { paddingHorizontal: Spacing.lg }]}>Audience Pulse</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: Spacing.lg, gap: 10 }}
          >
            {[
              { label: 'Followers',      value: followerCount > 0 ? followerCount.toLocaleString() : '–', sub: 'total' },
              { label: 'Cravings',       value: totalCravings > 0 ? totalCravings.toString() : '–',       sub: "today's dishes" },
              { label: 'Profile Views',  value: '–',                                                       sub: 'coming soon' },
              { label: 'Post Reach',     value: '–',                                                       sub: 'coming soon' },
            ].map(p => (
              <View key={p.label} style={styles.pulseCard}>
                <Text style={styles.pulseValue}>{p.value}</Text>
                <Text style={styles.pulseLabel}>{p.label}</Text>
                <Text style={styles.pulseSub}>{p.sub}</Text>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* ── CRAVING INTELLIGENCE TEASER ── */}
        {cravings.length > 0 && (() => {
          // group cravings by dish title, pick the top
          const counts = new Map<string, number>();
          for (const c of cravings) {
            const k = c.dish_title.trim().toLowerCase();
            counts.set(k, (counts.get(k) ?? 0) + 1);
          }
          const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
          const topTitle = cravings.find(c => c.dish_title.trim().toLowerCase() === sorted[0][0])?.dish_title ?? sorted[0][0];
          const topCount = sorted[0][1];
          return (
            <View style={styles.section}>
              <View style={[styles.sectionRow, { paddingHorizontal: Spacing.lg }]}>
                <Text style={styles.sectionCap}>Craving Intelligence</Text>
                <TouchableOpacity onPress={() => router.push('/(cook)/cravings' as any)}>
                  <Text style={styles.seeAll}>See all</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                activeOpacity={0.82}
                style={[styles.card, {
                  marginHorizontal: Spacing.lg, padding: 16,
                  flexDirection: 'row', alignItems: 'center', gap: 14,
                }]}
                onPress={() => router.push('/(cook)/cravings' as any)}
              >
                <View style={{
                  width: 48, height: 48, borderRadius: 12,
                  backgroundColor: C.warnBg, alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons name="flame" size={24} color={C.ember} />
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 14, color: C.textInk }} numberOfLines={1}>
                    {topCount} {topCount === 1 ? 'person wants' : 'people want'} {topTitle}
                  </Text>
                  <Text style={{ fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft }}>
                    {cravings.length} active craving{cravings.length > 1 ? 's' : ''} across your dishes
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={C.bodySoft} />
              </TouchableOpacity>
            </View>
          );
        })()}

        {/* ── TODAY'S TABLE ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionCap, { paddingHorizontal: Spacing.lg }]}>Today's Table</Text>
          {todayItems.length === 0 ? (
            <View style={[styles.card, styles.emptyCard, { marginHorizontal: Spacing.lg }]}>
              <Text style={{ fontSize: 28 }}>🍽️</Text>
              <Text style={styles.emptyTitle}>Nothing on the table</Text>
              <Text style={styles.emptyBody}>Add a meal to start taking orders today.</Text>
              <TouchableOpacity
                style={styles.emptyAction}
                onPress={() => router.push('/cook/dish-form' as any)}
              >
                <Text style={styles.emptyActionText}>Add Meal →</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ paddingHorizontal: Spacing.lg, gap: 10 }}>
              {todayItems.map((item, idx) => {
                const sold = item.slots_claimed;
                const total = item.total_slots;
                const remaining = total - sold;
                const pct = total > 0 ? sold / total : 0;
                const color = SWATCH_COLORS[idx % SWATCH_COLORS.length];
                return (
                  <View key={item.id} style={styles.mealCard}>
                    <View style={[styles.mealSwatch, { backgroundColor: color }]}>
                      <Text style={styles.mealSwatchText}>{item.title.slice(0, 2).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1, gap: 6 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                        <Text style={styles.mealTitle} numberOfLines={1}>{item.title}</Text>
                        <Text style={styles.mealPrice}>{fmtCurrency(item.unit_price, currency)}</Text>
                      </View>
                      <View style={styles.mealBar}>
                        <View style={[styles.mealBarFill, { width: `${Math.round(pct * 100)}%` as any, backgroundColor: color }]} />
                      </View>
                      <View style={styles.mealStats}>
                        <View style={styles.mealStat}>
                          <Ionicons name="checkmark-circle-outline" size={13} color={C.successFg} />
                          <Text style={styles.mealStatText}>{sold} sold</Text>
                        </View>
                        <View style={styles.mealStat}>
                          <Ionicons name="time-outline" size={13} color={C.bodySoft} />
                          <Text style={styles.mealStatText}>{remaining} left</Text>
                        </View>
                        <View style={styles.mealStat}>
                          <Ionicons name="flame-outline" size={13} color={C.ember} />
                          <Text style={styles.mealStatText}>{item.craving_count ?? 0} cravings</Text>
                        </View>
                        <View style={styles.mealStat}>
                          <Ionicons name="eye-outline" size={13} color={C.bodySoft} />
                          <Text style={styles.mealStatText}>{item.like_count ?? 0} views</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* ── CREATOR ACTIONS ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionCap, { paddingHorizontal: Spacing.lg }]}>Creator Actions</Text>
          <View style={{ paddingHorizontal: Spacing.lg, gap: 10 }}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                style={[styles.actionCard, { flex: 1 }]}
                onPress={() => router.push('/create-post' as any)}
              >
                <Ionicons name="camera-outline" size={28} color={C.spice} />
                <Text style={styles.actionLabel}>Create Post</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionCard, { flex: 1 }]}
                onPress={() => router.push('/(cook)/content' as any)}
              >
                <Ionicons name="grid-outline" size={28} color={C.spice} />
                <Text style={styles.actionLabel}>My Content</Text>
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                style={[styles.actionCard, { flex: 1 }]}
                onPress={() => router.push('/cook/dish-form' as any)}
              >
                <Ionicons name="restaurant-outline" size={28} color={C.spice} />
                <Text style={styles.actionLabel}>Add Meal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionCard, { flex: 1 }, isLive ? styles.actionCardLive : styles.actionCardGoLive]}
                onPress={toggleLive}
                disabled={togglingLive}
              >
                {togglingLive ? (
                  <ActivityIndicator size="small" color={isLive ? C.canvas : C.spice} />
                ) : (
                  <>
                    <Ionicons
                      name={isLive ? 'radio' : 'radio-outline'}
                      size={28}
                      color={isLive ? C.canvas : C.ember}
                    />
                    <Text style={[styles.actionLabel, isLive ? { color: C.canvas } : { color: C.ember }]}>
                      {isLive ? 'Go Offline' : 'Go Live'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ── RECENT ORDERS ── */}
        {recentOrders.length > 0 && (
          <View style={styles.section}>
            <View style={[styles.sectionRow, { paddingHorizontal: Spacing.lg }]}>
              <Text style={styles.sectionCap}>Recent Orders</Text>
              <TouchableOpacity onPress={() => router.push('/(cook)/orders')}>
                <Text style={styles.seeAll}>See all</Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.card, { marginHorizontal: Spacing.lg }]}>
              {recentOrders.slice(0, 4).map((order, i) => {
                const cfg = ORDER_STATUS[order.status] ?? { label: order.status, color: C.bodySoft };
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

        {/* ── FOLLOWER GROWTH ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionCap, { paddingHorizontal: Spacing.lg }]}>Follower Growth</Text>
          <View style={[styles.card, { marginHorizontal: Spacing.lg, padding: 20 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
              <Text style={styles.followerBig}>{followerCount.toLocaleString()}</Text>
              <Text style={styles.followerUnit}>followers</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
              <Ionicons name="trending-up-outline" size={14} color={C.successFg} />
              <Text style={{ fontFamily: Fonts.sans, fontSize: 12, color: C.successFg }}>
                Growth trends coming soon
              </Text>
            </View>
          </View>
        </View>

        {/* ── TOP PERFORMING DISH ── */}
        {topDish && (
          <View style={styles.section}>
            <Text style={[styles.sectionCap, { paddingHorizontal: Spacing.lg }]}>Top Performing Dish</Text>
            <View style={[styles.card, { marginHorizontal: Spacing.lg, padding: 16, flexDirection: 'row', gap: 14, alignItems: 'center' }]}>
              <View style={[styles.mealSwatch, { backgroundColor: SWATCH_COLORS[0], width: 56, height: 56, borderRadius: 12 }]}>
                <Text style={styles.mealSwatchText}>{topDish.title.slice(0, 2).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 14, color: C.textInk }} numberOfLines={1}>
                  {topDish.title}
                </Text>
                <Text style={{ fontFamily: Fonts.serif, fontSize: 16, color: C.spice }}>
                  {fmtCurrency(topDish.unit_price, currency)}
                </Text>
                <View style={{ flexDirection: 'row', gap: 14, marginTop: 2 }}>
                  <View style={styles.mealStat}>
                    <Ionicons name="flame-outline" size={13} color={C.ember} />
                    <Text style={styles.mealStatText}>{topDish.craving_count ?? 0} cravings</Text>
                  </View>
                  <View style={styles.mealStat}>
                    <Ionicons name="checkmark-circle-outline" size={13} color={C.successFg} />
                    <Text style={styles.mealStatText}>{topDish.slots_claimed} sold</Text>
                  </View>
                </View>
              </View>
              <Text style={{ fontSize: 22 }}>🏆</Text>
            </View>
          </View>
        )}

        {/* ── RECENT REVIEWS ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionCap, { paddingHorizontal: Spacing.lg }]}>Recent Reviews</Text>
          <View style={[styles.card, styles.emptyCard, { marginHorizontal: Spacing.lg }]}>
            <Text style={{ fontSize: 28 }}>⭐</Text>
            <Text style={styles.emptyTitle}>No reviews yet</Text>
            <Text style={styles.emptyBody}>
              Your first review appears here once a customer rates their order.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function makeStyles(C: AppColors) { return StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  header: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: Spacing.lg, paddingTop: 16, paddingBottom: 14, gap: 12,
  },
  greeting: { fontFamily: Fonts.sans, fontSize: 13, color: C.bodySoft },
  name: { fontFamily: Fonts.serif, fontSize: 26, color: C.textInk, marginTop: 1 },
  liveBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: C.successBg, borderRadius: 40,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 0.5, borderColor: C.leaf + '50',
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.leaf },
  liveBadgeText: { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.successFg },

  section: { marginBottom: 32 },
  sectionCap: {
    fontFamily: Fonts.sansMedium, fontSize: 11, color: C.bodySoft,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12,
  },
  sectionRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 12,
  },
  seeAll: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.spice },

  // Pulse
  pulseCard: {
    backgroundColor: C.bgCard, borderRadius: Radius.lg, padding: 16,
    minWidth: 130, borderWidth: 0.5, borderColor: C.borderWarm,
    ...Shadow.card, gap: 2,
  },
  pulseValue: { fontFamily: Fonts.serif, fontSize: 30, color: C.textInk },
  pulseLabel: { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.body, marginTop: 2 },
  pulseSub: { fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft },

  // Meal cards
  mealCard: {
    backgroundColor: C.bgCard, borderRadius: Radius.lg, padding: 14,
    flexDirection: 'row', gap: 12, borderWidth: 0.5, borderColor: C.borderWarm, ...Shadow.card,
  },
  mealSwatch: { width: 48, height: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  mealSwatchText: { fontFamily: Fonts.sansMedium, fontSize: 14, color: 'rgba(255,255,255,0.92)' },
  mealTitle: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.textInk, flex: 1, marginRight: 8 },
  mealPrice: { fontFamily: Fonts.serif, fontSize: 14, color: C.spice },
  mealBar: { height: 4, borderRadius: 2, backgroundColor: C.borderWarm, overflow: 'hidden' },
  mealBarFill: { height: '100%', borderRadius: 2 },
  mealStats: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  mealStat: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  mealStatText: { fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft },

  // Creator Actions
  actionCard: {
    backgroundColor: C.bgCard, borderRadius: Radius.lg, padding: 20,
    alignItems: 'center', gap: 10, borderWidth: 0.5, borderColor: C.borderWarm, ...Shadow.card,
  },
  actionCardLive: { backgroundColor: C.spice, borderColor: C.spice },
  actionCardGoLive: { borderColor: C.ember + '60', backgroundColor: C.warnBg },
  actionLabel: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.body, textAlign: 'center' },

  // Card shell
  card: {
    backgroundColor: C.bgCard, borderRadius: Radius.lg,
    borderWidth: 0.5, borderColor: C.borderWarm, ...Shadow.card, overflow: 'hidden',
  },
  divider: { height: 0.5, backgroundColor: C.borderWarm },
  orderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  orderDot: { width: 8, height: 8, borderRadius: 4 },
  orderCustomer: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.textInk },
  orderDish: { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft, marginTop: 2 },
  orderStatus: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 40 },
  orderStatusText: { fontFamily: Fonts.sansMedium, fontSize: 11 },

  // Follower Growth
  followerBig: { fontFamily: Fonts.serif, fontSize: 38, color: C.textInk },
  followerUnit: { fontFamily: Fonts.sans, fontSize: 14, color: C.bodySoft, marginBottom: 6 },

  // Empty states
  emptyCard: { padding: 28, alignItems: 'center', gap: 8 },
  emptyTitle: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.textInk },
  emptyBody: { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft, textAlign: 'center', lineHeight: 18 },
  emptyAction: {
    marginTop: 4, backgroundColor: C.ink, borderRadius: 40,
    paddingHorizontal: 18, paddingVertical: 9,
  },
  emptyActionText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.canvas },
}); }
