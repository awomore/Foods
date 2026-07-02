import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  analyticsApi,
  type CreatorOverview,
  type ContentPost,
  type DishPerformance,
  type TopCustomer,
  type TopCraving,
  type FollowerSnapshot,
  type DailyChange,
  type CohortMonth,
} from '../../src/api/analytics';
import { Fonts, Spacing, Radius, Shadow } from '../../src/constants/theme';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { fmtCurrency } from '../../src/utils/format';
import { Bone } from '../../src/components/ui/Skeleton';
import Avatar from '../../src/components/ui/Avatar';
import { useTranslation } from 'react-i18next';

// ── helpers ───────────────────────────────────────────────────────────────────

const fmtK = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
};

const fmtDelta = (n: number) => `${n >= 0 ? '+' : ''}${Math.round(n)}%`;

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function lastNDayLabels(n: number): string[] {
  const labels: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    labels.push(n <= 7 ? DAY_LABELS[d.getDay()] : `${d.getDate()}/${d.getMonth() + 1}`);
  }
  return labels;
}

// ── sub-components ────────────────────────────────────────────────────────────

function BarChart({ values, labels, barColor, labelColor, chartHeight = 72 }: {
  values: number[];
  labels?: string[];
  barColor: string;
  labelColor: string;
  chartHeight?: number;
}) {
  const max = Math.max(...values, 1);
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: chartHeight }}>
        {values.map((v, i) => (
          <View key={i} style={{ flex: 1, height: chartHeight, justifyContent: 'flex-end', alignItems: 'center' }}>
            <View style={{
              width: '75%',
              height: Math.max(2, Math.round((v / max) * chartHeight)),
              backgroundColor: v > 0 ? barColor : `${barColor}30`,
              borderRadius: 3,
            }} />
          </View>
        ))}
      </View>
      {labels && (
        <View style={{ flexDirection: 'row', marginTop: 4 }}>
          {labels.map((l, i) => (
            <Text key={i} style={{
              flex: 1, textAlign: 'center', fontSize: 9,
              color: labelColor, fontFamily: Fonts.sans,
            }}>
              {l}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

function DeltaBadge({ value, C }: { value: number; C: AppColors }) {
  const up = value >= 0;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
      <Ionicons
        name={up ? 'trending-up-outline' : 'trending-down-outline'}
        size={11}
        color={up ? C.successFg : C.errorFg}
      />
      <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 11, color: up ? C.successFg : C.errorFg }}>
        {fmtDelta(value)}
      </Text>
    </View>
  );
}

function SectionCap({ label }: { label: string }) {
  const C = useColors();
  return (
    <Text style={{
      fontFamily: Fonts.sansMedium, fontSize: 11, color: C.bodySoft,
      textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10,
    }}>
      {label}
    </Text>
  );
}

function EmptyState({ icon, title, body }: { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; body: string }) {
  const C = useColors();
  return (
    <View style={{ alignItems: 'center', padding: 32, gap: 8 }}>
      <Ionicons name={icon} size={36} color={C.bodySoft} />
      <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 14, color: C.textInk }}>{title}</Text>
      <Text style={{ fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft, textAlign: 'center', lineHeight: 18 }}>{body}</Text>
    </View>
  );
}

// ── Insights engine ───────────────────────────────────────────────────────────

type Insight = { text: string; icon: React.ComponentProps<typeof Ionicons>['name'] };

function buildInsight(
  overview: CreatorOverview | null,
  cravingsData: { top_cravings: TopCraving[] } | null,
  audienceData: { segments: Record<string, { value: string; customers: number }[]> } | null,
  t: (key: string, opts?: any) => string,
): Insight {
  if (!overview) return { text: t('analytics.insight_default'), icon: 'bulb-outline' };

  const candidates: (Insight & { score: number })[] = [];

  if (cravingsData?.top_cravings?.[0]) {
    const tc = cravingsData.top_cravings[0];
    candidates.push({
      text: t('analytics.insight_craving', { dish: tc.dish_title, count: tc.craving_count }),
      icon: 'flame-outline', score: tc.craving_count * 10,
    });
  }
  if (overview.deltas.revenue_pct > 10) {
    candidates.push({
      text: t('analytics.insight_revenue_up', { delta: fmtDelta(overview.deltas.revenue_pct) }),
      icon: 'trending-up-outline', score: overview.deltas.revenue_pct,
    });
  }
  if (overview.current.new_followers >= 3) {
    candidates.push({
      text: t('analytics.insight_new_followers', { count: overview.current.new_followers }),
      icon: 'people-outline', score: overview.current.new_followers * 5,
    });
  }
  if (overview.current.content_reach >= 100) {
    candidates.push({
      text: t('analytics.insight_content_reach', { count: fmtK(overview.current.content_reach) }),
      icon: 'eye-outline', score: overview.current.content_reach / 10,
    });
  }
  if (audienceData?.segments?.dietary?.[0]) {
    const d = audienceData.segments.dietary[0];
    candidates.push({
      text: t('analytics.insight_dietary', { count: d.customers, value: d.value }),
      icon: 'restaurant-outline', score: 20,
    });
  }
  if (overview.deltas.orders_pct > 15) {
    candidates.push({
      text: t('analytics.insight_orders_up', { delta: fmtDelta(overview.deltas.orders_pct) }),
      icon: 'rocket-outline', score: overview.deltas.orders_pct,
    });
  }
  if (overview.current.engagements > 50) {
    candidates.push({
      text: t('analytics.insight_engagements', { count: fmtK(overview.current.engagements) }),
      icon: 'heart-outline', score: overview.current.engagements / 5,
    });
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0] ?? { text: t('analytics.insight_start'), icon: 'bulb-outline' };
}

// ── customer badge ────────────────────────────────────────────────────────────

function getBadge(c: TopCustomer, t: (key: string) => string): { label: string; color: string } {
  if (c.total_spent >= 50_000 || c.order_count >= 10) return { label: t('analytics.badge_vip'),     color: '#FF6B35' };
  if (c.order_count >= 5)                              return { label: t('analytics.badge_top_fan'), color: '#2A5FBF' };
  if (c.is_repeat)                                     return { label: t('analytics.badge_regular'), color: '#2E8B3F' };
  return                                                      { label: t('analytics.badge_new'),     color: '#8B2E6A' };
}

const POST_TYPE_ICON: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  recipe:  'book-outline',
  photo:   'image-outline',
  video:   'videocam-outline',
  story:   'sparkles-outline',
  update:  'chatbubble-outline',
};

// ── section components ────────────────────────────────────────────────────────

type AllData = {
  overview: CreatorOverview | null;
  followerData: { current_followers: number; snapshots: FollowerSnapshot[]; daily_changes: DailyChange[] } | null;
  contentData: { posts: ContentPost[]; totals: Record<string, number> } | null;
  dishData: { dishes: DishPerformance[] } | null;
  audienceData: {
    total_customers: number; repeat_customers: number; repeat_rate: number;
    avg_orders_per_customer: string;
    segments: Record<string, { value: string; customers: number; orders: number; revenue: number }[]>;
  } | null;
  ordersData: { time_series: any[]; cohort_summary: CohortMonth[]; top_customers: TopCustomer[] } | null;
  cravingsData: {
    top_cravings: TopCraving[]; total_cravings: number; fulfilled_cravings: number;
    fulfillment_rate: number; post_conversion_revenue: number; post_conversion_orders: number;
  } | null;
};

// ── Overview section ──────────────────────────────────────────────────────────

function OverviewSection({ data, days, C, styles, router }: {
  data: AllData; days: number; C: AppColors;
  styles: ReturnType<typeof makeStyles>; router: ReturnType<typeof useRouter>;
}) {
  const { t } = useTranslation();
  const { overview, cravingsData, audienceData, followerData } = data;
  const insight = useMemo(
    () => buildInsight(overview, cravingsData, audienceData, t),
    [overview, cravingsData, audienceData, t],
  );

  // build last-7-day follower bar chart
  const followerBars = useMemo(() => {
    if (!followerData?.daily_changes) return [];
    return followerData.daily_changes.slice(-7).map(d => Math.max(0, d.net_change));
  }, [followerData]);

  const followerLabels = useMemo(() => lastNDayLabels(7), []);

  if (!overview) return (
    <EmptyState icon="pulse-outline" title={t('analytics.no_data')} body={t('analytics.no_data_body')} />
  );

  const { current, deltas } = overview;

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
      {/* KPI Grid */}
      <View style={styles.kpiGrid}>
        <View style={[styles.kpiCard, { flex: 1 }]}>
          <Text style={styles.kpiLabel}>{t('analytics.revenue')}</Text>
          <Text style={styles.kpiValue} numberOfLines={1}>{fmtCurrency(current.revenue, 'NGN')}</Text>
          <DeltaBadge value={deltas.revenue_pct} C={C} />
        </View>
        <View style={[styles.kpiCard, { flex: 1 }]}>
          <Text style={styles.kpiLabel}>{t('analytics.orders')}</Text>
          <Text style={styles.kpiValue}>{current.orders}</Text>
          <DeltaBadge value={deltas.orders_pct} C={C} />
        </View>
      </View>
      <View style={styles.kpiGrid}>
        <View style={[styles.kpiCard, { flex: 1 }]}>
          <Text style={styles.kpiLabel}>{t('analytics.new_customers')}</Text>
          <Text style={styles.kpiValue}>{current.new_customers}</Text>
          <DeltaBadge value={deltas.new_customers_pct} C={C} />
        </View>
        <View style={[styles.kpiCard, { flex: 1 }]}>
          <Text style={styles.kpiLabel}>{t('analytics.reach')}</Text>
          <Text style={styles.kpiValue}>{fmtK(current.content_reach)}</Text>
          <DeltaBadge value={deltas.content_reach_pct} C={C} />
        </View>
      </View>
      <View style={styles.kpiGrid}>
        <View style={[styles.kpiCard, { flex: 1 }]}>
          <Text style={styles.kpiLabel}>{t('analytics.views')}</Text>
          <Text style={styles.kpiValue}>{fmtK(current.profile_views ?? 0)}</Text>
          <DeltaBadge value={deltas.profile_views_pct ?? 0} C={C} />
        </View>
        <View style={[styles.kpiCard, { flex: 1 }]}>
          <Text style={styles.kpiLabel}>{t('analytics.conversion')}</Text>
          <Text style={styles.kpiValue}>
            {current.profile_views > 0
              ? `${((current.orders / current.profile_views) * 100).toFixed(1)}%`
              : '—'}
          </Text>
          <Text style={{ fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft, marginTop: 2 }}>
            {t('analytics.orders_from_visits', { orders: current.orders, visits: fmtK(current.profile_views ?? 0) })}
          </Text>
        </View>
      </View>

      {/* Top Insight */}
      <View style={styles.insightCard}>
        <View style={styles.insightIconWrap}>
          <Ionicons name={insight.icon} size={20} color={C.spice} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.insightLabel}>{t('analytics.top_insight')}</Text>
          <Text style={styles.insightText}>{insight.text}</Text>
        </View>
      </View>

      {/* Follower Growth mini */}
      <View style={[styles.card, { gap: 12 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <SectionCap label={t('analytics.growth_7d')} />
          <TouchableOpacity onPress={() => router.push('/(cook)/followers' as any)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
              <Text style={styles.seeAll}>{t('analytics.see_more')}</Text>
              <Ionicons name="chevron-forward" size={12} color={C.spice} />
            </View>
          </TouchableOpacity>
        </View>
        {followerBars.length > 0 ? (
          <>
            <BarChart
              values={followerBars}
              labels={followerLabels}
              barColor={C.leaf}
              labelColor={C.bodySoft}
              chartHeight={56}
            />
            <View style={{ flexDirection: 'row', gap: 16, marginTop: 4 }}>
              <View style={styles.miniStat}>
                <Text style={[styles.miniStatVal, { color: C.successFg }]}>+{followerData?.daily_changes.slice(-7).reduce((s, d) => s + d.new_followers, 0) ?? 0}</Text>
                <Text style={styles.miniStatLabel}>{t('analytics.new')}</Text>
              </View>
              <View style={styles.miniStat}>
                <Text style={[styles.miniStatVal, { color: C.errorFg }]}>-{followerData?.daily_changes.slice(-7).reduce((s, d) => s + d.lost_followers, 0) ?? 0}</Text>
                <Text style={styles.miniStatLabel}>{t('analytics.lost')}</Text>
              </View>
              <View style={styles.miniStat}>
                <Text style={[styles.miniStatVal, { color: C.textInk }]}>
                  {(followerData?.daily_changes.slice(-7).reduce((s, d) => s + d.net_change, 0) ?? 0) >= 0 ? '+' : ''}
                  {followerData?.daily_changes.slice(-7).reduce((s, d) => s + d.net_change, 0) ?? 0}
                </Text>
                <Text style={styles.miniStatLabel}>{t('analytics.net')}</Text>
              </View>
            </View>
          </>
        ) : (
          <Text style={{ fontFamily: Fonts.sans, fontSize: 13, color: C.bodySoft }}>
            {t('analytics.followers_total', { count: followerData?.current_followers ?? 0 })}
          </Text>
        )}
      </View>

      {/* Profile Views */}
      <View style={styles.kpiGrid}>
        <View style={[styles.kpiCard, { flex: 1 }]}>
          <Text style={styles.kpiLabel}>{t('analytics.profile_views')}</Text>
          <Text style={styles.kpiValue}>{fmtK(current.profile_views)}</Text>
          <DeltaBadge value={deltas.profile_views_pct} C={C} />
        </View>
        <View style={[styles.kpiCard, { flex: 1 }]}>
          <Text style={styles.kpiLabel}>{t('analytics.engagements')}</Text>
          <Text style={styles.kpiValue}>{fmtK(current.engagements)}</Text>
        </View>
      </View>
    </ScrollView>
  );
}

// ── Followers section ─────────────────────────────────────────────────────────

function FollowersSection({ data, days, C, styles, router }: {
  data: AllData; days: number; C: AppColors;
  styles: ReturnType<typeof makeStyles>; router: ReturnType<typeof useRouter>;
}) {
  const { t } = useTranslation();
  const { followerData, ordersData } = data;
  const [filter, setFilter] = useState<'spend' | 'loyal' | 'new' | 'inactive'>('spend');

  const snapshots = followerData?.snapshots ?? [];
  const dailyChanges = followerData?.daily_changes ?? [];
  const topCustomers = ordersData?.top_customers ?? [];

  const chartValues = snapshots.slice(-Math.min(snapshots.length, days)).map(s => s.follower_count);
  const chartLabels = lastNDayLabels(Math.min(chartValues.length, days));

  const filtered = useMemo(() => {
    const now = Date.now();
    const thirty = 30 * 24 * 60 * 60 * 1000;
    switch (filter) {
      case 'spend':    return [...topCustomers].sort((a, b) => b.total_spent - a.total_spent);
      case 'loyal':    return [...topCustomers].sort((a, b) => b.order_count - a.order_count);
      case 'new':      return [...topCustomers].sort((a, b) => new Date(b.first_order_at).getTime() - new Date(a.first_order_at).getTime());
      case 'inactive': return topCustomers.filter(c => now - new Date(c.last_order_at).getTime() > thirty);
    }
  }, [topCustomers, filter]);

  if (!followerData && !ordersData) return (
    <EmptyState icon="people-outline" title={t('analytics.no_follower_data')} body={t('analytics.no_follower_data_body')} />
  );

  const net7 = dailyChanges.slice(-7).reduce((s, d) => s + d.net_change, 0);

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
      {/* Follower count hero */}
      <View style={styles.card}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 4 }}>
          <Text style={{ fontFamily: Fonts.serif, fontSize: 42, color: C.textInk, lineHeight: 48 }}>
            {fmtK(followerData?.current_followers ?? 0)}
          </Text>
          <Text style={{ fontFamily: Fonts.sans, fontSize: 14, color: C.bodySoft, marginBottom: 8 }}>{t('analytics.followers')}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name={net7 >= 0 ? 'trending-up' : 'trending-down'} size={14} color={net7 >= 0 ? C.successFg : C.errorFg} />
          <Text style={{ fontFamily: Fonts.sans, fontSize: 13, color: net7 >= 0 ? C.successFg : C.errorFg }}>
            {net7 >= 0 ? '+' : ''}{t('analytics.net_last_7_days', { count: net7 })}
          </Text>
        </View>
      </View>

      {/* Growth chart */}
      {chartValues.length > 1 && (
        <View style={[styles.card, { gap: 12 }]}>
          <SectionCap label={t('analytics.follower_growth')} />
          <BarChart
            values={chartValues}
            labels={chartValues.length <= 14 ? chartLabels : undefined}
            barColor={C.spice}
            labelColor={C.bodySoft}
            chartHeight={96}
          />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View style={styles.miniStat}>
              <Text style={[styles.miniStatVal, { color: C.successFg }]}>
                +{dailyChanges.reduce((s, d) => s + d.new_followers, 0)}
              </Text>
              <Text style={styles.miniStatLabel}>{t('analytics.new')}</Text>
            </View>
            <View style={styles.miniStat}>
              <Text style={[styles.miniStatVal, { color: C.errorFg }]}>
                -{dailyChanges.reduce((s, d) => s + d.lost_followers, 0)}
              </Text>
              <Text style={styles.miniStatLabel}>{t('analytics.lost')}</Text>
            </View>
            <View style={styles.miniStat}>
              <Text style={[styles.miniStatVal, { color: C.textInk }]}>
                {dailyChanges.reduce((s, d) => s + d.net_change, 0) >= 0 ? '+' : ''}
                {dailyChanges.reduce((s, d) => s + d.net_change, 0)}
              </Text>
              <Text style={styles.miniStatLabel}>{t('analytics.net')}</Text>
            </View>
          </View>
        </View>
      )}

      {/* Filter tabs */}
      {topCustomers.length > 0 && (
        <>
          <SectionCap label={t('analytics.best_customers')} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {([
                { id: 'spend',    label: t('analytics.filter_highest_spend') },
                { id: 'loyal',   label: t('analytics.filter_most_loyal')    },
                { id: 'new',     label: t('analytics.filter_newest')        },
                { id: 'inactive',label: t('analytics.filter_inactive')      },
              ] as const).map(f => (
                <TouchableOpacity
                  key={f.id}
                  style={[styles.filterChip, filter === f.id && styles.filterChipActive]}
                  onPress={() => setFilter(f.id)}
                >
                  <Text style={[styles.filterChipText, filter === f.id && styles.filterChipTextActive]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {filtered.length === 0 ? (
            <EmptyState icon="person-outline" title={t('analytics.no_customers_here')} body={t('analytics.no_customers_here_body')} />
          ) : (
            <View style={[styles.card, { gap: 0 }]}>
              {filtered.map((c, i) => {
                const badge = getBadge(c, t);
                const daysSinceOrder = Math.floor((Date.now() - new Date(c.last_order_at).getTime()) / 86400000);
                return (
                  <View key={i}>
                    {i > 0 && <View style={styles.divider} />}
                    <View style={styles.customerRow}>
                      <Avatar name={c.full_name.charAt(0)} avatarUrl={c.avatar_url} size={42} />
                      <View style={{ flex: 1, gap: 3 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Text style={styles.customerName} numberOfLines={1}>{c.full_name}</Text>
                          <View style={[styles.badge, { backgroundColor: badge.color + '22' }]}>
                            <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
                          </View>
                        </View>
                        <Text style={styles.customerMeta}>
                          {t('analytics.orders_total', { count: c.order_count, total: fmtCurrency(c.total_spent, 'NGN') })}
                        </Text>
                        <Text style={styles.customerSub}>
                          {t('analytics.last_order', { time: daysSinceOrder === 0 ? t('analytics.today') : t('analytics.days_ago', { count: daysSinceOrder }) })}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

// ── Cravings section ──────────────────────────────────────────────────────────

function CravingsSection({ data, C, styles, router }: {
  data: AllData; C: AppColors;
  styles: ReturnType<typeof makeStyles>; router: ReturnType<typeof useRouter>;
}) {
  const { t } = useTranslation();
  const { cravingsData } = data;

  if (!cravingsData || cravingsData.top_cravings.length === 0) return (
    <EmptyState icon="flame-outline" title={t('analytics.no_cravings')} body={t('analytics.no_cravings_body')} />
  );

  const { top_cravings, total_cravings, fulfilled_cravings, fulfillment_rate, post_conversion_revenue, post_conversion_orders } = cravingsData;
  const maxCravings = top_cravings[0]?.craving_count ?? 1;

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
      {/* Summary */}
      <View style={styles.kpiGrid}>
        <View style={[styles.kpiCard, { flex: 1 }]}>
          <Text style={styles.kpiLabel}>{t('analytics.total_cravings')}</Text>
          <Text style={styles.kpiValue}>{total_cravings}</Text>
        </View>
        <View style={[styles.kpiCard, { flex: 1 }]}>
          <Text style={styles.kpiLabel}>{t('analytics.fulfillment_rate')}</Text>
          <Text style={styles.kpiValue}>{Math.round(fulfillment_rate * 100)}%</Text>
        </View>
      </View>

      {/* Post conversion */}
      {post_conversion_orders > 0 && (
        <View style={styles.insightCard}>
          <View style={styles.insightIconWrap}>
            <Ionicons name="rocket-outline" size={20} color={C.spice} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.insightLabel}>{t('analytics.craving_conversions')}</Text>
            <Text style={styles.insightText}>
              {t('analytics.craving_conversions_body', { orders: post_conversion_orders, revenue: fmtCurrency(post_conversion_revenue, 'NGN') })}
            </Text>
          </View>
        </View>
      )}

      {/* Top cravings */}
      <SectionCap label={t('analytics.most_craved_dishes')} />
      <View style={{ gap: 10 }}>
        {top_cravings.map((item, i) => {
          const barPct = maxCravings > 0 ? (item.craving_count / maxCravings) : 0;
          const suggestedRevenue = (item.suggested_price ?? 0) * item.craving_count;
          return (
            <View key={i} style={[styles.card, { padding: 14, gap: 10 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                <View style={[styles.rankCircle, { backgroundColor: i === 0 ? C.ember : C.bgCard }]}>
                  <Text style={[styles.rankText, { color: i === 0 ? '#fff' : C.bodySoft }]}>{i + 1}</Text>
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={styles.dishTitle}>{item.dish_title}</Text>
                  <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
                    <Text style={styles.customerMeta}>
                      <Ionicons name="flame" size={11} color={C.ember} /> {t('analytics.cravings_count', { count: item.craving_count })}
                    </Text>
                    {item.unique_cravings !== item.craving_count && (
                      <Text style={styles.customerMeta}>{t('analytics.unique_people', { count: item.unique_cravings })}</Text>
                    )}
                    {fulfilled_cravings > 0 && (
                      <Text style={styles.customerMeta}>{t('analytics.fulfilled_count', { count: item.fulfilled_count })}</Text>
                    )}
                  </View>
                </View>
                {suggestedRevenue > 0 && (
                  <Text style={{ fontFamily: Fonts.serif, fontSize: 13, color: C.spice }}>
                    {fmtCurrency(suggestedRevenue, 'NGN')}
                  </Text>
                )}
              </View>

              {/* Demand bar */}
              <View style={{ height: 4, backgroundColor: C.borderWarm, borderRadius: 2, overflow: 'hidden' }}>
                <View style={{
                  width: `${Math.round(barPct * 100)}%` as any,
                  height: '100%',
                  backgroundColor: i === 0 ? C.ember : C.spice,
                  borderRadius: 2,
                }} />
              </View>

              <TouchableOpacity
                style={[styles.cookCta, { alignSelf: 'flex-start' }]}
                onPress={() => router.push('/(cook)/menu' as any)}
              >
                <Ionicons name="add-circle-outline" size={14} color={C.spice} />
                <Text style={styles.cookCtaText}>{t('analytics.cook_this_next_week')}</Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

// ── Content section ───────────────────────────────────────────────────────────

function ContentSection({ data, C, styles, router }: {
  data: AllData; C: AppColors;
  styles: ReturnType<typeof makeStyles>; router: ReturnType<typeof useRouter>;
}) {
  const { t } = useTranslation();
  const { contentData } = data;

  if (!contentData || contentData.posts.length === 0) return (
    <EmptyState icon="grid-outline" title={t('analytics.no_content_data')} body={t('analytics.no_content_data_body')} />
  );

  const { posts, totals } = contentData;
  const sorted = [...posts].sort((a, b) => b.view_count - a.view_count);
  const best = sorted.slice(0, 3);
  const worst = sorted.slice(-3).reverse();

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
      {/* Totals banner */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 10 }}
        style={{ marginBottom: 20 }}
      >
        {[
          { label: t('analytics.total_reach'), value: fmtK(totals.view_count ?? 0)   },
          { label: t('analytics.likes'),        value: fmtK(totals.like_count ?? 0)   },
          { label: t('analytics.comments'),     value: fmtK(totals.comment_count ?? 0)},
          { label: t('analytics.shares'),       value: fmtK(totals.share_count ?? 0)  },
          { label: t('analytics.orders'),       value: String(totals.orders_from_post ?? 0) },
        ].map(s => (
          <View key={s.label} style={styles.pulseCard}>
            <Text style={styles.pulseValue}>{s.value}</Text>
            <Text style={styles.pulseLabel}>{s.label}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Best performing */}
      <SectionCap label={t('analytics.best_performing_content')} />
      <View style={{ gap: 8, marginBottom: 24 }}>
        {best.map((p, i) => <PostRow key={p.id} post={p} rank={i + 1} isTop C={C} styles={styles} />)}
      </View>

      {/* Worst performing */}
      {worst.length > 0 && posts.length > 3 && (
        <>
          <SectionCap label={t('analytics.needs_improvement')} />
          <View style={{ gap: 8 }}>
            {worst.filter(p => !best.find(b => b.id === p.id)).map((p, i) => (
              <PostRow key={p.id} post={p} rank={i + 1} isTop={false} C={C} styles={styles} />
            ))}
          </View>
        </>
      )}

      <TouchableOpacity
        style={[styles.cookCta, { alignSelf: 'center', marginTop: 20, paddingHorizontal: 24 }]}
        onPress={() => router.push('/(cook)/content' as any)}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={styles.cookCtaText}>{t('analytics.view_all_content')}</Text>
          <Ionicons name="chevron-forward" size={14} color={C.canvas} />
        </View>
      </TouchableOpacity>
    </ScrollView>
  );
}

function PostRow({ post, rank, isTop, C, styles }: {
  post: ContentPost; rank: number; isTop: boolean;
  C: AppColors; styles: ReturnType<typeof makeStyles>;
}) {
  const { t } = useTranslation();
  const icon = POST_TYPE_ICON[post.post_type] ?? 'document-outline';
  const relTime = (() => {
    const ms = Date.now() - new Date(post.created_at).getTime();
    const d = Math.floor(ms / 86400000);
    if (d === 0) return t('analytics.today');
    if (d === 1) return t('analytics.yesterday');
    return t('analytics.days_ago', { count: d });
  })();

  return (
    <View style={[styles.card, { padding: 12, flexDirection: 'row', gap: 10, alignItems: 'flex-start' }]}>
      <View style={[styles.postIcon, { backgroundColor: isTop ? C.warnBg : C.bgCard }]}>
        <Ionicons name={icon} size={16} color={isTop ? C.ember : C.bodySoft} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={styles.dishTitle} numberOfLines={1}>
          {post.title ?? post.body.slice(0, 50)}
        </Text>
        <Text style={styles.customerSub}>{relTime}</Text>
        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginTop: 2 }}>
          <View style={styles.miniStat}>
            <Ionicons name="eye-outline" size={11} color={C.bodySoft} />
            <Text style={styles.miniStatLabel}>{fmtK(post.view_count)}</Text>
          </View>
          <View style={styles.miniStat}>
            <Ionicons name="heart-outline" size={11} color={C.bodySoft} />
            <Text style={styles.miniStatLabel}>{fmtK(post.like_count)}</Text>
          </View>
          <View style={styles.miniStat}>
            <Ionicons name="chatbubble-outline" size={11} color={C.bodySoft} />
            <Text style={styles.miniStatLabel}>{post.comment_count}</Text>
          </View>
          <View style={styles.miniStat}>
            <Ionicons name="share-outline" size={11} color={C.bodySoft} />
            <Text style={styles.miniStatLabel}>{post.share_count}</Text>
          </View>
          {post.orders_from_post > 0 && (
            <View style={styles.miniStat}>
              <Ionicons name="bag-outline" size={11} color={C.successFg} />
              <Text style={[styles.miniStatLabel, { color: C.successFg }]}>{t('analytics.orders_count', { count: post.orders_from_post })}</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

// ── Audience section ──────────────────────────────────────────────────────────

function AudienceSection({ data, C, styles }: {
  data: AllData; C: AppColors; styles: ReturnType<typeof makeStyles>;
}) {
  const { t } = useTranslation();
  const { audienceData, ordersData } = data;

  if (!audienceData) return (
    <EmptyState icon="pie-chart-outline" title={t('analytics.no_audience_data')} body={t('analytics.no_audience_data_body')} />
  );

  const { total_customers, repeat_customers, repeat_rate, segments } = audienceData;
  const topCustomers = ordersData?.top_customers ?? [];
  const now = Date.now();
  const thirty = 30 * 24 * 60 * 60 * 1000;

  const vipCount     = topCustomers.filter(c => c.total_spent >= 50_000 || c.order_count >= 10).length;
  const churnRisk    = topCustomers.filter(c => now - new Date(c.last_order_at).getTime() > thirty).length;
  const newCustomers = total_customers - repeat_customers;

  const cohorts = [
    { label: t('analytics.cohort_new_customers'), count: newCustomers,      color: C.infoFg,    icon: 'person-add-outline' as const },
    { label: t('analytics.cohort_returning'),      count: repeat_customers,  color: C.successFg, icon: 'repeat-outline' as const    },
    { label: t('analytics.cohort_vip'),            count: vipCount,          color: C.ember,     icon: 'star-outline' as const      },
    { label: t('analytics.cohort_churn_risk'),     count: churnRisk,         color: C.errorFg,   icon: 'warning-outline' as const   },
  ];

  const dietarySegs  = segments.dietary        ?? [];
  const freqSegs     = segments.order_frequency ?? [];
  const locationSegs = segments.location        ?? [];

  const maxDiet = dietarySegs[0]?.customers ?? 1;

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
      {/* Cohort cards */}
      <SectionCap label={t('analytics.customer_cohorts')} />
      <View style={styles.cohortGrid}>
        {cohorts.map(c => (
          <View key={c.label} style={[styles.cohortCard, { borderLeftColor: c.color, flex: 1 }]}>
            <Ionicons name={c.icon} size={18} color={c.color} />
            <Text style={[styles.cohortCount, { color: c.color }]}>{c.count}</Text>
            <Text style={styles.cohortLabel}>{c.label}</Text>
          </View>
        ))}
      </View>

      {/* Repeat rate */}
      <View style={styles.insightCard}>
        <View style={styles.insightIconWrap}>
          <Ionicons name="repeat-outline" size={20} color={C.spice} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.insightLabel}>{t('analytics.loyalty_rate')}</Text>
          <Text style={styles.insightText}>
            {t('analytics.loyalty_rate_body', { pct: Math.round(repeat_rate * 100) })}
          </Text>
        </View>
      </View>

      {/* Dietary preferences */}
      {dietarySegs.length > 0 && (
        <>
          <SectionCap label={t('analytics.dietary_preferences')} />
          <View style={[styles.card, { gap: 10 }]}>
            {dietarySegs.slice(0, 6).map((seg, i) => {
              const barPct = maxDiet > 0 ? seg.customers / maxDiet : 0;
              return (
                <View key={i} style={{ gap: 5 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={styles.segLabel}>{seg.value}</Text>
                    <Text style={styles.segCount}>{t('analytics.customers_count', { count: seg.customers })}</Text>
                  </View>
                  <View style={{ height: 4, backgroundColor: C.borderWarm, borderRadius: 2, overflow: 'hidden' }}>
                    <View style={{ width: `${Math.round(barPct * 100)}%` as any, height: '100%', backgroundColor: C.spice, borderRadius: 2 }} />
                  </View>
                </View>
              );
            })}
          </View>
        </>
      )}

      {/* Location segments */}
      {locationSegs.length > 0 && (
        <>
          <SectionCap label={t('analytics.top_locations')} />
          <View style={[styles.card, { gap: 0 }]}>
            {locationSegs.slice(0, 5).map((seg, i) => {
              const total = locationSegs.reduce((s, l) => s + l.customers, 0) || 1;
              const pctVal = Math.round((seg.customers / total) * 100);
              return (
                <View key={i}>
                  {i > 0 && <View style={styles.divider} />}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 }}>
                    <Ionicons name="location-outline" size={14} color={C.bodySoft} />
                    <Text style={[styles.segLabel, { flex: 1 }]}>{seg.value}</Text>
                    <Text style={styles.segCount}>{pctVal}%</Text>
                    <Text style={styles.customerMeta}>{t('analytics.customers_count', { count: seg.customers })}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </>
      )}

      {/* Order frequency */}
      {freqSegs.length > 0 && (
        <>
          <SectionCap label={t('analytics.order_frequency')} />
          <View style={[styles.card, { gap: 0 }]}>
            {freqSegs.map((seg, i) => (
              <View key={i}>
                {i > 0 && <View style={styles.divider} />}
                <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 }}>
                  <Text style={[styles.segLabel, { flex: 1 }]}>{seg.value}</Text>
                  <Text style={styles.segCount}>{t('analytics.customers_count', { count: seg.customers })}</Text>
                </View>
              </View>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

// ── Revenue section ───────────────────────────────────────────────────────────

function RevenueSection({ data, days, C, styles }: {
  data: AllData; days: number; C: AppColors; styles: ReturnType<typeof makeStyles>;
}) {
  const { t } = useTranslation();
  const { ordersData, overview } = data;

  if (!ordersData && !overview) return (
    <EmptyState icon="cash-outline" title={t('analytics.no_revenue')} body={t('analytics.no_revenue_body')} />
  );

  const topCustomers = ordersData?.top_customers ?? [];
  const cohortSummary = ordersData?.cohort_summary ?? [];

  const totalRevenue = overview?.current?.revenue ?? 0;
  const revenueDelta = overview?.deltas?.revenue_pct ?? 0;
  const totalOrders  = overview?.current?.orders ?? 0;

  // Build revenue chart from cohort_summary (monthly buckets)
  const chartValues = cohortSummary.slice(-6).map(c => c.cohort_revenue);
  const chartLabels = cohortSummary.slice(-6).map(c => {
    const [year, month] = c.cohort_month.split('-');
    const d = new Date(parseInt(year), parseInt(month) - 1, 1);
    return d.toLocaleDateString('en-NG', { month: 'short' });
  });

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
      {/* Revenue hero */}
      <View style={styles.card}>
        <Text style={styles.revenueHero}>{fmtCurrency(totalRevenue, 'NGN')}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
          <DeltaBadge value={revenueDelta} C={C} />
          <Text style={{ fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft }}>{t('analytics.vs_prior_period')}</Text>
          <View style={styles.miniStat}>
            <Ionicons name="bag-outline" size={12} color={C.bodySoft} />
            <Text style={styles.miniStatLabel}>{t('analytics.orders_count', { count: totalOrders })}</Text>
          </View>
        </View>
      </View>

      {/* Monthly chart */}
      {chartValues.length > 1 && (
        <View style={[styles.card, { gap: 12 }]}>
          <SectionCap label={t('analytics.monthly_revenue')} />
          <BarChart
            values={chartValues}
            labels={chartLabels}
            barColor={C.spice}
            labelColor={C.bodySoft}
            chartHeight={96}
          />
        </View>
      )}

      {/* Cohort table */}
      {cohortSummary.length > 0 && (
        <>
          <SectionCap label={t('analytics.revenue_by_cohort')} />
          <View style={[styles.card, { gap: 0 }]}>
            {cohortSummary.slice(-6).reverse().map((c, i) => {
              const [year, month] = c.cohort_month.split('-');
              const d = new Date(parseInt(year), parseInt(month) - 1, 1);
              const label = d.toLocaleDateString('en-NG', { month: 'long', year: 'numeric' });
              return (
                <View key={i}>
                  {i > 0 && <View style={styles.divider} />}
                  <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 }}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={styles.dishTitle}>{label}</Text>
                      <Text style={styles.customerMeta}>
                        {t('analytics.cohort_customers', { total: c.total_customers, returning: c.repeat_customers })}
                      </Text>
                    </View>
                    <Text style={{ fontFamily: Fonts.serif, fontSize: 15, color: C.spice }}>
                      {fmtCurrency(c.cohort_revenue, 'NGN')}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </>
      )}

      {/* Top spenders */}
      {topCustomers.length > 0 && (
        <>
          <SectionCap label={t('analytics.top_spenders')} />
          <View style={[styles.card, { gap: 0 }]}>
            {topCustomers.slice(0, 8).map((c, i) => {
              const badge = getBadge(c, t);
              return (
                <View key={i}>
                  {i > 0 && <View style={styles.divider} />}
                  <View style={styles.customerRow}>
                    <Avatar name={c.full_name.charAt(0)} avatarUrl={c.avatar_url} size={38} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={styles.customerName} numberOfLines={1}>{c.full_name}</Text>
                        <View style={[styles.badge, { backgroundColor: badge.color + '22' }]}>
                          <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
                        </View>
                      </View>
                      <Text style={styles.customerMeta}>{t('analytics.orders_count', { count: c.order_count })}</Text>
                    </View>
                    <Text style={{ fontFamily: Fonts.serif, fontSize: 14, color: C.spice }}>
                      {fmtCurrency(c.total_spent, 'NGN')}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </>
      )}
    </ScrollView>
  );
}

// ── Main Hub ──────────────────────────────────────────────────────────────────

const SECTIONS: { id: Section; labelKey: string }[] = [
  { id: 'overview',  labelKey: 'analytics.overview'  },
  { id: 'followers', labelKey: 'analytics.followers' },
  { id: 'cravings',  labelKey: 'analytics.cravings'  },
  { id: 'content',   labelKey: 'analytics.content'   },
  { id: 'audience',  labelKey: 'analytics.audience'  },
  { id: 'revenue',   labelKey: 'analytics.revenue'   },
];

const PERIODS = [
  { label: '7D',  days: 7  },
  { label: '30D', days: 30 },
  { label: '90D', days: 90 },
];

type Section = 'overview' | 'followers' | 'cravings' | 'content' | 'audience' | 'revenue';

export default function AnalyticsHub() {
  const router = useRouter();
  const { t } = useTranslation();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);

  const [section, setSection] = useState<Section>('overview');
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [overview, setOverview]         = useState<AllData['overview']>(null);
  const [followerData, setFollowerData] = useState<AllData['followerData']>(null);
  const [contentData, setContentData]   = useState<AllData['contentData']>(null);
  const [dishData, setDishData]         = useState<AllData['dishData']>(null);
  const [audienceData, setAudienceData] = useState<AllData['audienceData']>(null);
  const [ordersData, setOrdersData]     = useState<AllData['ordersData']>(null);
  const [cravingsData, setCravingsData] = useState<AllData['cravingsData']>(null);

  const data: AllData = { overview, followerData, contentData, dishData, audienceData, ordersData, cravingsData };

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [ov, fl, ct, di, au, or_, cr] = await Promise.allSettled([
        analyticsApi.overview(days),
        analyticsApi.followers(days),
        analyticsApi.content({ limit: 20, sort: 'views' }),
        analyticsApi.dishes({ limit: 20 }),
        analyticsApi.audience(),
        analyticsApi.orders(days),
        analyticsApi.cravings(),
      ]);
      if (ov.status === 'fulfilled') setOverview(ov.value);
      if (fl.status === 'fulfilled') setFollowerData(fl.value);
      if (ct.status === 'fulfilled') setContentData(ct.value);
      if (di.status === 'fulfilled') setDishData(di.value);
      if (au.status === 'fulfilled') setAudienceData(au.value);
      if (or_.status === 'fulfilled') setOrdersData(or_.value);
      if (cr.status === 'fulfilled') setCravingsData(cr.value);
    } catch (e) {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const sectionProps = { data, days, C, styles, router };

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: C.bg }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="arrow-back" size={22} color={C.textInk} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('analytics.title')}</Text>

          {/* Period selector */}
          <View style={styles.periodRow}>
            {PERIODS.map(p => (
              <TouchableOpacity
                key={p.label}
                style={[styles.periodBtn, days === p.days && styles.periodBtnActive]}
                onPress={() => setDays(p.days)}
              >
                <Text style={[styles.periodBtnText, days === p.days && styles.periodBtnTextActive]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Section tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabBar}
        >
          {SECTIONS.map(s => (
            <TouchableOpacity
              key={s.id}
              style={[styles.tab, section === s.id && styles.tabActive]}
              onPress={() => setSection(s.id)}
            >
              <Text style={[styles.tabText, section === s.id && styles.tabTextActive]}>
                {t(s.labelKey)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </SafeAreaView>

      {loading ? (
        <View style={{ flex: 1, padding: Spacing.lg, gap: 12 }}>
          <Bone width="100%" height={96} radius={12} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Bone width="48%" height={80} radius={12} />
            <Bone width="48%" height={80} radius={12} />
          </View>
          <Bone width="100%" height={160} radius={12} />
          <Bone width="100%" height={72} radius={12} />
          <Bone width="100%" height={72} radius={12} />
        </View>
      ) : (
        <View style={{ flex: 1, paddingHorizontal: Spacing.lg, paddingTop: Spacing.md }}>
          {section === 'overview'  && <OverviewSection  {...sectionProps} />}
          {section === 'followers' && <FollowersSection {...sectionProps} />}
          {section === 'cravings'  && <CravingsSection  {...sectionProps} />}
          {section === 'content'   && <ContentSection   {...sectionProps} />}
          {section === 'audience'  && <AudienceSection  data={data} C={C} styles={styles} />}
          {section === 'revenue'   && <RevenueSection   data={data} days={days} C={C} styles={styles} />}
        </View>
      )}
    </View>
  );
}

// ── styles ────────────────────────────────────────────────────────────────────

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    root:   { flex: 1, backgroundColor: C.bg },
    header: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingHorizontal: Spacing.lg, paddingTop: 12, paddingBottom: 10,
    },
    headerTitle: { flex: 1, fontFamily: Fonts.serif, fontSize: 20, color: C.textInk },
    periodRow:   { flexDirection: 'row', gap: 4 },
    periodBtn:   {
      paddingHorizontal: 8, paddingVertical: 4,
      borderRadius: 20, backgroundColor: C.borderWarm,
    },
    periodBtnActive:     { backgroundColor: C.ink },
    periodBtnText:       { fontFamily: Fonts.sansMedium, fontSize: 11, color: C.bodySoft },
    periodBtnTextActive: { color: C.canvas },

    tabBar:      { paddingHorizontal: Spacing.lg, paddingBottom: 10, gap: 4 },
    tab:         { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: C.borderWarm },
    tabActive:   { backgroundColor: C.spice },
    tabText:     { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.bodySoft },
    tabTextActive: { color: C.canvas },

    card: {
      backgroundColor: C.bgCard, borderRadius: Radius.lg,
      borderWidth: 0.5, borderColor: C.borderWarm,
      padding: 16, marginBottom: 16, ...Shadow.card,
    },

    kpiGrid:  { flexDirection: 'row', gap: 10, marginBottom: 10 },
    kpiCard:  {
      backgroundColor: C.bgCard, borderRadius: Radius.lg,
      borderWidth: 0.5, borderColor: C.borderWarm,
      padding: 14, gap: 4, ...Shadow.card,
    },
    kpiLabel: { fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft },
    kpiValue: { fontFamily: Fonts.serif, fontSize: 26, color: C.textInk, lineHeight: 30 },

    insightCard: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 12,
      backgroundColor: C.warnBg, borderRadius: Radius.lg,
      borderWidth: 0.5, borderColor: C.ember + '30',
      padding: 14, marginBottom: 16,
    },
    insightIconWrap: {
      width: 36, height: 36, borderRadius: 10,
      backgroundColor: C.bgCard, alignItems: 'center', justifyContent: 'center',
      borderWidth: 0.5, borderColor: C.borderWarm,
    },
    insightLabel: { fontFamily: Fonts.sansMedium, fontSize: 11, color: C.warnFg, textTransform: 'uppercase', letterSpacing: 0.5 },
    insightText:  { fontFamily: Fonts.sans, fontSize: 13, color: C.textInk, lineHeight: 19 },

    miniStat:      { flexDirection: 'row', alignItems: 'center', gap: 4 },
    miniStatVal:   { fontFamily: Fonts.sansMedium, fontSize: 16, color: C.textInk },
    miniStatLabel: { fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft },

    seeAll: { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.spice },

    filterChip: {
      paddingHorizontal: 12, paddingVertical: 7,
      borderRadius: 20, backgroundColor: C.borderWarm,
      borderWidth: 0.5, borderColor: C.borderWarm,
    },
    filterChipActive:     { backgroundColor: C.ink, borderColor: C.ink },
    filterChipText:       { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.bodySoft },
    filterChipTextActive: { color: C.canvas },

    customerRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
    customerName: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.textInk },
    customerMeta: { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft },
    customerSub:  { fontFamily: Fonts.sans, fontSize: 11, color: C.caps },

    badge:     { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
    badgeText: { fontFamily: Fonts.sansMedium, fontSize: 10 },

    divider: { height: 0.5, backgroundColor: C.borderWarm },

    rankCircle: {
      width: 28, height: 28, borderRadius: 14,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 0.5, borderColor: C.borderWarm,
    },
    rankText:  { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.bodySoft },
    dishTitle: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.textInk },

    cookCta: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingVertical: 7, paddingHorizontal: 14,
      borderRadius: 20, borderWidth: 1, borderColor: C.spice,
    },
    cookCtaText: { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.spice },

    pulseCard: {
      backgroundColor: C.bgCard, borderRadius: Radius.lg, padding: 14,
      minWidth: 100, borderWidth: 0.5, borderColor: C.borderWarm, gap: 2,
    },
    pulseValue: { fontFamily: Fonts.serif, fontSize: 24, color: C.textInk },
    pulseLabel: { fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft },

    cohortGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
    cohortCard: {
      backgroundColor: C.bgCard, borderRadius: Radius.lg,
      borderWidth: 0.5, borderColor: C.borderWarm,
      borderLeftWidth: 3, padding: 12, gap: 4,
      minWidth: '45%', ...Shadow.card,
    },
    cohortCount: { fontFamily: Fonts.serif, fontSize: 28, lineHeight: 32 },
    cohortLabel: { fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft },

    segLabel: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.textInk },
    segCount:  { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft },

    revenueHero: { fontFamily: Fonts.serif, fontSize: 38, color: C.textInk },

    postIcon: {
      width: 36, height: 36, borderRadius: 10,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 0.5, borderColor: C.borderWarm,
    },
  });
}
