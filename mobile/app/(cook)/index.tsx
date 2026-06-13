import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../src/context/AuthContext';
import { useFeedback } from '../../src/components/feedback';
import { earningsApi, type EarningsSummary } from '../../src/api/earnings';
import { ordersApi, type Order } from '../../src/api/orders';
import { cooksApi, type CookDetail, type MenuItem } from '../../src/api/cooks';
import { cravingsApi, type Craving } from '../../src/api/cravings';
import { analyticsApi, type CreatorOverview, type TopCraving } from '../../src/api/analytics';
import { Fonts, Spacing, Radius, Shadow } from '../../src/constants/theme';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { fmtCurrency } from '../../src/utils/format';
import Wordmark from '../../src/components/ui/Wordmark';
import { Bone } from '../../src/components/ui/Skeleton';

// ─── Kitchen Level system ─────────────────────────────────────────────────────
type KitchenLevel = { name: string; minOrders: number; color: string; icon: string };
const KITCHEN_LEVELS: KitchenLevel[] = [
  { name: 'Prep Kitchen', minOrders: 0,    color: '#6B7280', icon: 'restaurant-outline' },
  { name: 'Line Cook',    minOrders: 25,   color: '#FF6B35', icon: 'flame-outline' },
  { name: 'Head Chef',    minOrders: 100,  color: '#2A5FBF', icon: 'ribbon-outline' },
  { name: 'Master Chef',  minOrders: 500,  color: '#2E8B3F', icon: 'star-outline' },
  { name: 'Legend',       minOrders: 2000, color: '#FF8A5C', icon: 'trophy-outline' },
];

function getKitchenLevel(totalOrders: number): { current: KitchenLevel; next: KitchenLevel | null; progress: number } {
  let current = KITCHEN_LEVELS[0];
  let next: KitchenLevel | null = KITCHEN_LEVELS[1];
  for (let i = KITCHEN_LEVELS.length - 1; i >= 0; i--) {
    if (totalOrders >= KITCHEN_LEVELS[i].minOrders) {
      current = KITCHEN_LEVELS[i];
      next = KITCHEN_LEVELS[i + 1] ?? null;
      break;
    }
  }
  const progress = next
    ? Math.min((totalOrders - current.minOrders) / (next.minOrders - current.minOrders), 1)
    : 1;
  return { current, next, progress };
}

const fmtK = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
};

function buildInsight(
  overview: CreatorOverview | null,
  topCraving: TopCraving | null,
): { text: string; icon: React.ComponentProps<typeof Ionicons>['name'] } {
  if (!overview && !topCraving) return { text: 'Your insights will appear as you grow.', icon: 'bulb-outline' };
  const candidates: { text: string; icon: React.ComponentProps<typeof Ionicons>['name']; score: number }[] = [];
  if (topCraving) {
    candidates.push({ text: `Your followers are craving ${topCraving.dish_title} — ${topCraving.craving_count} people want it.`, icon: 'flame-outline', score: topCraving.craving_count * 10 });
  }
  if (overview?.deltas.revenue_pct && overview.deltas.revenue_pct > 10) {
    candidates.push({ text: `Revenue is up ${Math.round(overview.deltas.revenue_pct)}% this week.`, icon: 'trending-up-outline', score: overview.deltas.revenue_pct });
  }
  if (overview?.current.new_followers && overview.current.new_followers >= 3) {
    candidates.push({ text: `You gained ${overview.current.new_followers} new followers this week.`, icon: 'people-outline', score: overview.current.new_followers * 5 });
  }
  if (overview?.current.content_reach && overview.current.content_reach >= 100) {
    candidates.push({ text: `Your content reached ${fmtK(overview.current.content_reach)} people this week.`, icon: 'eye-outline', score: overview.current.content_reach / 10 });
  }
  if (overview?.deltas.orders_pct && overview.deltas.orders_pct > 15) {
    candidates.push({ text: `Orders are up ${Math.round(overview.deltas.orders_pct)}% this week. Great momentum!`, icon: 'rocket-outline', score: overview.deltas.orders_pct });
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0] ?? { text: 'Start taking orders to unlock your first insights.', icon: 'bulb-outline' };
}

const SWATCH_COLORS = ['#FF8A5C', '#FF6B35', '#2E8B3F', '#2A5FBF', '#8B2E6A'];

const ORDER_STATUS: Record<string, { label: string; color: string }> = {
  accepted:         { label: 'Accepted',   color: '#2A5FBF' },
  preparing:        { label: 'Preparing',  color: '#FF6B35' },
  ready:            { label: 'Ready',      color: '#2E8B3F' },
  out_for_delivery: { label: 'Out',        color: '#FF8A5C' },
  in_transit:       { label: 'In transit', color: '#FF8A5C' },
  delivered:        { label: 'Delivered',  color: '#2E8B3F' },
  cancelled:        { label: 'Cancelled',  color: '#DC2626' },
};

export default function CookStudio() {
  const router = useRouter();
  const { user } = useAuth();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);

  const [currency, setCurrency]         = useState('NGN');
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [cookProfile, setCookProfile]   = useState<CookDetail | null>(null);
  const [cravings, setCravings]         = useState<Craving[]>([]);
  const [overview, setOverview]         = useState<CreatorOverview | null>(null);
  const [topCraving, setTopCraving]     = useState<TopCraving | null>(null);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [togglingLive, setTogglingLive] = useState(false);
  const [todayEarnings, setTodayEarnings] = useState<EarningsSummary | null>(null);

  const feedback = useFeedback();
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
      const [earningsData, ordersData, cravingsData, overviewData, analyticsData] = await Promise.all([
        earningsApi.summary('today'),
        ordersApi.list({ limit: 5 }),
        cravingsApi.forCook().catch(() => ({ cravings: [] })),
        analyticsApi.overview(7).catch(() => null),
        analyticsApi.cravings().catch(() => null),
      ]);
      setCurrency((earningsData as any)?.currency_code ?? 'NGN');
      setTodayEarnings((earningsData as any)?.summary ?? null);
      setRecentOrders((ordersData as any).orders ?? []);
      setCravings((cravingsData as any).cravings ?? []);
      if (overviewData) setOverview(overviewData);
      if (analyticsData?.top_cravings?.[0]) setTopCraving(analyticsData.top_cravings[0]);
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
    if (!cookProfile || !user?.cook_id) {
      feedback.error('Not ready', 'Kitchen profile is still loading. Please wait a moment.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setTogglingLive(true);
    try {
      const { is_live } = await cooksApi.setLive(user.cook_id, !cookProfile.is_live);
      setCookProfile(p => p ? { ...p, is_live } : p);
      Haptics.notificationAsync(
        is_live ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning
      );
      feedback.success(is_live ? 'You\'re live!' : 'Kitchen offline', is_live ? 'Orders can flow in now.' : 'You won\'t receive new orders.');
    } catch (e) {
      console.error('toggle live error:', e);
      feedback.error('Could not update status', 'Check your connection and try again.');
    } finally {
      setTogglingLive(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.root}>
        <SafeAreaView style={{ flex: 1, padding: Spacing.lg, gap: 12 }}>
          <Bone width="60%" height={28} radius={8} />
          <Bone width="100%" height={80} radius={16} />
          <Bone width="100%" height={120} radius={16} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Bone width="48%" height={72} radius={12} />
            <Bone width="48%" height={72} radius={12} />
          </View>
          <Bone width="100%" height={48} radius={12} />
          <Bone width="100%" height={48} radius={12} />
          <Bone width="100%" height={48} radius={12} />
        </SafeAreaView>
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
  const totalOrders = (cookProfile as any)?.total_orders ?? (todayEarnings?.total_orders ?? 0);
  const { current: kitchenLevel, next: nextLevel, progress: levelProgress } = getKitchenLevel(totalOrders);

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: C.bg }}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>{greeting},</Text>
            <Text style={styles.name}>{firstName}</Text>
          </View>
          <Wordmark size="compact" on="light" />
        </View>

        {/* Kitchen Level bar */}
        <TouchableOpacity
          style={styles.levelBar}
          onPress={() => router.push('/(cook)/analytics' as any)}
          activeOpacity={0.8}
        >
          <View style={[styles.levelIconWrap, { backgroundColor: kitchenLevel.color + '22' }]}>
            <Ionicons name={kitchenLevel.icon as any} size={14} color={kitchenLevel.color} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={[styles.levelName, { color: kitchenLevel.color }]}>{kitchenLevel.name}</Text>
              {nextLevel && (
                <Text style={styles.levelNext}>
                  {nextLevel.minOrders - totalOrders} orders to {nextLevel.name}
                </Text>
              )}
            </View>
            <View style={styles.levelTrack}>
              <View style={[styles.levelFill, { width: `${Math.round(levelProgress * 100)}%` as any, backgroundColor: kitchenLevel.color }]} />
            </View>
          </View>
        </TouchableOpacity>
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
              {
                label: 'Followers This Week',
                value: overview?.current?.new_followers != null
                  ? `+${overview.current.new_followers}`
                  : followerCount > 0 ? followerCount.toLocaleString() : '–',
                sub: overview?.current?.new_followers != null ? 'new this week' : 'total',
              },
              {
                label: 'Active Cravings',
                value: totalCravings > 0 ? totalCravings.toString() : '–',
                sub:   "today's dishes",
              },
              {
                label: 'Profile Views',
                value: overview?.current?.profile_views != null
                  ? fmtK(overview.current.profile_views)
                  : '–',
                sub:  overview?.current?.profile_views != null ? 'this week' : 'loading…',
              },
              {
                label: 'Revenue This Week',
                value: overview?.current?.revenue != null
                  ? fmtCurrency(overview.current.revenue, currency)
                  : '–',
                sub:  overview?.current?.revenue != null ? 'earned' : 'loading…',
              },
            ].map(p => (
              <TouchableOpacity
                key={p.label}
                style={styles.pulseCard}
                onPress={() => router.push('/(cook)/analytics' as any)}
                activeOpacity={0.85}
              >
                <Text style={styles.pulseValue} numberOfLines={1}>{p.value}</Text>
                <Text style={styles.pulseLabel}>{p.label}</Text>
                <Text style={styles.pulseSub}>{p.sub}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* ── TOP INSIGHT ── */}
        {(() => {
          const insight = buildInsight(overview, topCraving);
          return (
            <View style={styles.section}>
              <TouchableOpacity
                activeOpacity={0.85}
                style={[styles.insightCard]}
                onPress={() => router.push('/(cook)/analytics' as any)}
              >
                <View style={styles.insightIconWrap}>
                  <Ionicons name={insight.icon} size={20} color={C.spice} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.insightHeading}>Top Insight</Text>
                  <Text style={styles.insightText}>{insight.text}</Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color={C.bodySoft} />
              </TouchableOpacity>
            </View>
          );
        })()}

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
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={styles.emptyActionText}>Add Meal</Text>
                  <Ionicons name="chevron-forward" size={14} color={C.canvas} />
                </View>
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
                      {/* Quick actions */}
                      <View style={styles.mealActions}>
                        <TouchableOpacity
                          style={styles.mealActionBtn}
                          onPress={() => router.push({ pathname: '/cook/dish-form', params: { id: item.id } } as any)}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="pencil-outline" size={12} color={C.spice} />
                          <Text style={styles.mealActionText}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.mealActionBtn}
                          onPress={() => router.push({ pathname: '/cook/dish-form', params: { duplicate_from: item.id } } as any)}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="copy-outline" size={12} color={C.spice} />
                          <Text style={styles.mealActionText}>Duplicate for tomorrow</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* ── SHORTCUTS ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionCap, { paddingHorizontal: Spacing.lg }]}>Shortcuts</Text>
          <View style={styles.shortcutGrid}>
            {[
              { icon: 'restaurant-outline'  as const, label: 'Add Meal',       route: '/cook/dish-form' },
              { icon: 'calendar-outline'    as const, label: 'Calendar',       route: '/(cook)/calendar' },
              { icon: 'briefcase-outline'   as const, label: 'Commerce',       route: '/(cook)/commerce' },
              { icon: 'medkit-outline'      as const, label: 'Health Kitchen', route: '/(cook)/health-specialisations' },
              { icon: 'leaf-outline'        as const, label: 'Meal Plans',     route: '/(cook)/health-plans' },
              { icon: 'people-outline'      as const, label: 'Subscribers',    route: '/(cook)/health-subscribers' },
              { icon: 'ribbon-outline'      as const, label: 'Certifications', route: '/(cook)/certifications' },
              { icon: 'archive-outline'     as const, label: 'Meal Archive',   route: '/(cook)/meal-archive' },
              { icon: 'flame-outline'       as const, label: 'Pulse',          route: '/(cook)/cravings' },
            ].map(({ icon, label, route }) => (
              <TouchableOpacity
                key={label}
                style={styles.shortcutTile}
                onPress={() => router.push(route as any)}
                activeOpacity={0.8}
              >
                <View style={styles.shortcutIconWrap}>
                  <Ionicons name={icon} size={22} color={C.spice} />
                </View>
                <Text style={styles.shortcutLabel}>{label}</Text>
              </TouchableOpacity>
            ))}
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

        {/* ── KITCHEN STATUS ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionCap, { paddingHorizontal: Spacing.lg }]}>Kitchen Status</Text>
          <View style={[styles.card, styles.kitchenCard, { marginHorizontal: Spacing.lg }]}>
            {/* Full-width live toggle */}
            <TouchableOpacity
              style={[styles.liveToggleBtn, isLive ? styles.liveToggleBtnOn : styles.liveToggleBtnOff]}
              onPress={toggleLive}
              disabled={togglingLive}
              activeOpacity={0.85}
            >
              {togglingLive ? (
                <ActivityIndicator size="small" color={isLive ? C.canvas : C.spice} />
              ) : (
                <>
                  <View style={[styles.liveToggleDot, { backgroundColor: isLive ? C.canvas : C.stone }]} />
                  <Text style={[styles.liveToggleBtnText, { color: isLive ? C.canvas : C.spice }]}>
                    {isLive ? 'Kitchen is Live — Tap to go offline' : 'Go Live — Start accepting orders'}
                  </Text>
                  <Ionicons
                    name={isLive ? 'radio' : 'radio-outline'}
                    size={18}
                    color={isLive ? C.canvas : C.spice}
                  />
                </>
              )}
            </TouchableOpacity>

            <View style={styles.kitchenDivider} />

            <View style={styles.kitchenRow}>
              <View style={styles.kitchenStat}>
                <Text style={styles.kitchenStatValue}>
                  {todayEarnings ? fmtCurrency(todayEarnings.total_earned ?? 0, currency) : '–'}
                </Text>
                <Text style={styles.kitchenStatLabel}>Today's Earnings</Text>
              </View>
              <View style={styles.kitchenStat}>
                <Text style={styles.kitchenStatValue}>
                  {todayEarnings?.total_orders ?? '–'}
                </Text>
                <Text style={styles.kitchenStatLabel}>Orders Today</Text>
              </View>
              <TouchableOpacity
                style={styles.kitchenCalBtn}
                onPress={() => router.push('/(cook)/calendar' as any)}
                activeOpacity={0.8}
              >
                <Ionicons name="calendar-outline" size={16} color={C.spice} />
                <Text style={styles.kitchenCalText}>Calendar</Text>
              </TouchableOpacity>
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

        {/* ── VIEW FULL ANALYTICS ── */}
        <View style={{ paddingHorizontal: Spacing.lg, marginBottom: 8 }}>
          <TouchableOpacity
            style={styles.analyticsBtn}
            onPress={() => router.push('/(cook)/analytics' as any)}
            activeOpacity={0.85}
          >
            <View style={styles.analyticsBtnIcon}>
              <Ionicons name="bar-chart-outline" size={18} color={C.canvas} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.analyticsBtnTitle}>View Full Analytics</Text>
              <Text style={styles.analyticsBtnSub}>Followers · Cravings · Content · Revenue</Text>
            </View>
            <Ionicons name="arrow-forward" size={16} color={C.canvas} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

function makeStyles(C: AppColors) { return StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  header: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: Spacing.lg, paddingTop: 16, paddingBottom: 10, gap: 12,
  },
  greeting: { fontFamily: Fonts.sans, fontSize: 13, color: C.bodySoft },
  name: { fontFamily: Fonts.serif, fontSize: 26, color: C.textInk, marginTop: 1 },

  // Kitchen Level bar
  levelBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: Spacing.lg, paddingBottom: 14,
  },
  levelIconWrap: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  levelName:  { fontFamily: Fonts.sansMedium, fontSize: 12 },
  levelNext:  { fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft },
  levelTrack: { height: 4, backgroundColor: C.borderWarm, borderRadius: 2, overflow: 'hidden' },
  levelFill:  { height: '100%', borderRadius: 2 },

  // Full-width live toggle
  liveToggleBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: Radius.md, paddingVertical: 14, paddingHorizontal: 16,
    borderWidth: 1.5,
  },
  liveToggleBtnOn:  { backgroundColor: C.spice, borderColor: C.spice },
  liveToggleBtnOff: { backgroundColor: C.bgCook, borderColor: C.spice },
  liveToggleDot: { width: 10, height: 10, borderRadius: 5 },
  liveToggleBtnText: { fontFamily: Fonts.sansMedium, fontSize: 14, flex: 1 },

  // Meal quick actions
  mealActions: { flexDirection: 'row', gap: 8, marginTop: 2 },
  mealActionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: C.spice + '50',
    borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: C.warnBg,
  },
  mealActionText: { fontFamily: Fonts.sansMedium, fontSize: 11, color: C.spice },

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

  // Shortcuts grid
  shortcutGrid: {
    paddingHorizontal: Spacing.lg,
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
  },
  shortcutTile: {
    width: '30.5%',
    backgroundColor: C.bgCard, borderRadius: Radius.lg,
    paddingVertical: 16, paddingHorizontal: 8,
    alignItems: 'center', gap: 8,
    borderWidth: 0.5, borderColor: C.borderWarm, ...Shadow.card,
  },
  shortcutIconWrap: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: C.warnBg, alignItems: 'center', justifyContent: 'center',
  },
  shortcutLabel: { fontFamily: Fonts.sansMedium, fontSize: 11, color: C.body, textAlign: 'center' },

  // Kitchen Status card
  kitchenCard: { padding: 16 },
  kitchenRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  kitchenStatusLabel: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.textInk },
  kitchenDivider: { height: 0.5, backgroundColor: C.borderWarm, marginVertical: 14 },
  kitchenStat: { flex: 1, gap: 2 },
  kitchenStatValue: { fontFamily: Fonts.serif, fontSize: 18, color: C.textInk },
  kitchenStatLabel: { fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft },
  kitchenCalBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: Radius.md, borderWidth: 1, borderColor: C.spice,
  },
  kitchenCalText: { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.spice },

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

  // Insight card
  insightCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.warnBg, borderRadius: Radius.lg,
    borderWidth: 0.5, borderColor: C.ember + '30',
    marginHorizontal: Spacing.lg, padding: 14, ...Shadow.card,
  },
  insightIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: C.bgCard, alignItems: 'center', justifyContent: 'center',
    borderWidth: 0.5, borderColor: C.borderWarm,
  },
  insightHeading: { fontFamily: Fonts.sansMedium, fontSize: 10, color: C.warnFg, textTransform: 'uppercase', letterSpacing: 0.5 },
  insightText:    { fontFamily: Fonts.sans, fontSize: 13, color: C.textInk, lineHeight: 19 },

  // Analytics CTA
  analyticsBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: C.ink, borderRadius: Radius.lg, padding: 16, ...Shadow.card,
  },
  analyticsBtnIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center',
  },
  analyticsBtnTitle: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.canvas },
  analyticsBtnSub:   { fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft, marginTop: 2 },

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
