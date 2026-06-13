import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  analyticsApi,
  type TopCustomer,
  type FollowerSnapshot,
  type DailyChange,
} from '../../src/api/analytics';
import { Fonts, Spacing, Radius, Shadow } from '../../src/constants/theme';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { fmtCurrency } from '../../src/utils/format';
import Avatar from '../../src/components/ui/Avatar';
import { Bone } from '../../src/components/ui/Skeleton';

// ── helpers ───────────────────────────────────────────────────────────────────

const fmtK = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
};

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function relativeTime(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime();
  const d  = Math.floor(ms / 86400000);
  if (d === 0)  return 'today';
  if (d === 1)  return 'yesterday';
  if (d < 7)   return `${d}d ago`;
  if (d < 30)  return `${Math.floor(d / 7)}w ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

type Filter = 'spend' | 'loyal' | 'new' | 'inactive';
type Period = 7 | 30 | 90;

// ── badge ─────────────────────────────────────────────────────────────────────

function getBadge(c: TopCustomer): { label: string; color: string } {
  if (c.total_spent >= 50_000 || c.order_count >= 10) return { label: 'VIP',     color: '#FF6B35' };
  if (c.order_count >= 5)                              return { label: 'Top Fan', color: '#2A5FBF' };
  if (c.is_repeat)                                     return { label: 'Regular', color: '#2E8B3F' };
  return                                                      { label: 'New',     color: '#8B2E6A' };
}

// ── BarChart ──────────────────────────────────────────────────────────────────

function BarChart({ values, labels, barColor, labelColor, chartHeight = 96 }: {
  values: number[];
  labels?: string[];
  barColor: string;
  labelColor: string;
  chartHeight?: number;
}) {
  const max = Math.max(...values, 1);
  const display = values.length > 30 ? values.filter((_, i) => i % 2 === 0) : values;
  const displayLabels = labels && values.length > 30 ? labels.filter((_, i) => i % 2 === 0) : labels;

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: chartHeight }}>
        {display.map((v, i) => (
          <View key={i} style={{ flex: 1, height: chartHeight, justifyContent: 'flex-end', alignItems: 'center' }}>
            <View style={{
              width: '80%',
              height: Math.max(2, Math.round((v / max) * chartHeight)),
              backgroundColor: barColor,
              borderRadius: 2,
              opacity: i === display.length - 1 ? 1 : 0.65,
            }} />
          </View>
        ))}
      </View>
      {displayLabels && (
        <View style={{ flexDirection: 'row', marginTop: 4 }}>
          {displayLabels.map((l, i) => (
            <Text key={i} style={{ flex: 1, textAlign: 'center', fontSize: 9, color: labelColor, fontFamily: Fonts.sans }}>
              {l}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function FollowerAnalytics() {
  const router = useRouter();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);

  const [period, setPeriod] = useState<Period>(30);
  const [filter, setFilter] = useState<Filter>('spend');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [currentFollowers, setCurrentFollowers] = useState(0);
  const [snapshots, setSnapshots]   = useState<FollowerSnapshot[]>([]);
  const [dailyChanges, setDailyChanges] = useState<DailyChange[]>([]);
  const [topCustomers, setTopCustomers] = useState<TopCustomer[]>([]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [fl, or_] = await Promise.allSettled([
        analyticsApi.followers(period),
        analyticsApi.orders(period),
      ]);
      if (fl.status === 'fulfilled') {
        setCurrentFollowers(fl.value.current_followers);
        setSnapshots(fl.value.snapshots);
        setDailyChanges(fl.value.daily_changes);
      }
      if (or_.status === 'fulfilled') {
        setTopCustomers(or_.value.top_customers);
      }
    } catch (e) {
      console.error('followers load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period]);

  useEffect(() => { load(); }, [load]);

  // Chart data from snapshots
  const chartValues = useMemo(() => {
    const pts = snapshots.slice(-period);
    return pts.map(s => s.follower_count);
  }, [snapshots, period]);

  const chartLabels = useMemo(() => {
    const pts = snapshots.slice(-period);
    return pts.map(s => {
      const d = new Date(s.date);
      if (period === 7) return DAY_LABELS[d.getDay()];
      return `${d.getDate()}/${d.getMonth() + 1}`;
    });
  }, [snapshots, period]);

  const periodChanges = useMemo(() => {
    const dc = dailyChanges.slice(-period);
    return {
      gained: dc.reduce((s, d) => s + d.new_followers, 0),
      lost:   dc.reduce((s, d) => s + d.lost_followers, 0),
      net:    dc.reduce((s, d) => s + d.net_change, 0),
    };
  }, [dailyChanges, period]);

  // Filter + search customers
  const filteredCustomers = useMemo(() => {
    const now = Date.now();
    const thirty = 30 * 24 * 60 * 60 * 1000;
    let list = [...topCustomers];

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(c => c.full_name.toLowerCase().includes(q));
    }

    switch (filter) {
      case 'spend':    return list.sort((a, b) => b.total_spent - a.total_spent);
      case 'loyal':    return list.sort((a, b) => b.order_count - a.order_count);
      case 'new':      return list.sort((a, b) => new Date(b.first_order_at).getTime() - new Date(a.first_order_at).getTime());
      case 'inactive': return list.filter(c => now - new Date(c.last_order_at).getTime() > thirty)
                                  .sort((a, b) => new Date(a.last_order_at).getTime() - new Date(b.last_order_at).getTime());
    }
  }, [topCustomers, filter, search]);

  const netPositive = periodChanges.net >= 0;

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: C.bg }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="arrow-back" size={22} color={C.textInk} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Follower Analytics</Text>
          <TouchableOpacity onPress={() => router.push('/(cook)/analytics' as any)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
              <Text style={styles.linkText}>Full Hub</Text>
              <Ionicons name="chevron-forward" size={13} color={C.spice} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Period selector */}
        <View style={styles.periodRow}>
          {([7, 30, 90] as Period[]).map(p => (
            <TouchableOpacity
              key={p}
              style={[styles.periodBtn, period === p && styles.periodBtnActive]}
              onPress={() => setPeriod(p)}
            >
              <Text style={[styles.periodBtnText, period === p && styles.periodBtnTextActive]}>
                {p}D
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </SafeAreaView>

      {loading ? (
        <View style={{ flex: 1, padding: Spacing.lg, gap: 12 }}>
          <Bone width="100%" height={80} radius={14} />
          <Bone width="100%" height={80} radius={14} />
          <Bone width="100%" height={80} radius={14} />
          <Bone width="100%" height={120} radius={14} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 48 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(true); }}
              tintColor={C.spice}
            />
          }
        >
          {/* Follower hero */}
          <View style={[styles.card, { marginBottom: 12 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 4 }}>
              <Text style={styles.heroNumber}>{fmtK(currentFollowers)}</Text>
              <Text style={{ fontFamily: Fonts.sans, fontSize: 14, color: C.bodySoft, marginBottom: 6 }}>followers</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons
                name={netPositive ? 'trending-up' : 'trending-down'}
                size={14}
                color={netPositive ? C.successFg : C.errorFg}
              />
              <Text style={{ fontFamily: Fonts.sans, fontSize: 13, color: netPositive ? C.successFg : C.errorFg }}>
                {netPositive ? '+' : ''}{periodChanges.net} in {period} days
              </Text>
            </View>
          </View>

          {/* Growth stats row */}
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'Gained',  value: `+${periodChanges.gained}`, color: C.successFg },
              { label: 'Lost',    value: `-${periodChanges.lost}`,   color: C.errorFg   },
              { label: 'Net',     value: (periodChanges.net >= 0 ? '+' : '') + periodChanges.net, color: C.textInk },
            ].map(s => (
              <View key={s.label} style={[styles.statPill, { flex: 1 }]}>
                <Text style={[styles.statPillVal, { color: s.color }]}>{s.value}</Text>
                <Text style={styles.statPillLabel}>{s.label}</Text>
              </View>
            ))}
          </View>

          {/* Growth chart */}
          {chartValues.length > 1 && (
            <View style={[styles.card, { marginBottom: 24 }]}>
              <Text style={styles.sectionCap}>Follower Growth</Text>
              <BarChart
                values={chartValues}
                labels={chartValues.length <= 14 ? chartLabels : undefined}
                barColor={C.spice}
                labelColor={C.bodySoft}
                chartHeight={96}
              />
            </View>
          )}

          {/* Customer list */}
          {topCustomers.length > 0 && (
            <>
              <Text style={styles.sectionCap}>Your Customers</Text>

              {/* Search */}
              <View style={[styles.searchBox, { marginBottom: 12 }]}>
                <Ionicons name="search-outline" size={16} color={C.bodySoft} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search customers..."
                  placeholderTextColor={C.bodySoft}
                  value={search}
                  onChangeText={setSearch}
                  clearButtonMode="while-editing"
                />
              </View>

              {/* Filter chips */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 14 }}
              >
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {([
                    { id: 'spend'   as const, label: 'Highest Spend' },
                    { id: 'loyal'   as const, label: 'Most Loyal'    },
                    { id: 'new'     as const, label: 'Newest'        },
                    { id: 'inactive'as const, label: 'Inactive'      },
                  ]).map(f => (
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

              {filteredCustomers.length === 0 ? (
                <View style={[styles.card, { alignItems: 'center', padding: 32, gap: 8 }]}>
                  <Ionicons name="search-outline" size={32} color={C.bodySoft} />
                  <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 14, color: C.textInk }}>
                    {search ? 'No results found' : 'No customers match this filter'}
                  </Text>
                </View>
              ) : (
                <View style={[styles.card, { padding: 0, overflow: 'hidden' }]}>
                  {filteredCustomers.map((c, i) => {
                    const badge = getBadge(c);
                    const daysSince = Math.floor((Date.now() - new Date(c.last_order_at).getTime()) / 86400000);
                    const isInactive = daysSince > 30;

                    return (
                      <View key={i}>
                        {i > 0 && <View style={styles.divider} />}
                        <View style={styles.customerRow}>
                          <Avatar
                            name={c.full_name.charAt(0)}
                            avatarUrl={c.avatar_url}
                            size={44}
                            avatarBg={C.borderWarm}
                          />
                          <View style={{ flex: 1, gap: 3 }}>
                            {/* Name + badge */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <Text style={styles.customerName} numberOfLines={1}>{c.full_name}</Text>
                              <View style={[styles.badge, { backgroundColor: badge.color + '20' }]}>
                                <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
                              </View>
                              {isInactive && (
                                <View style={[styles.badge, { backgroundColor: C.errorBg }]}>
                                  <Text style={[styles.badgeText, { color: C.errorFg }]}>Inactive</Text>
                                </View>
                              )}
                            </View>

                            {/* Orders + spend */}
                            <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
                              <View style={styles.statRow}>
                                <Ionicons name="bag-outline" size={11} color={C.bodySoft} />
                                <Text style={styles.statText}>{c.order_count} order{c.order_count !== 1 ? 's' : ''}</Text>
                              </View>
                              <View style={styles.statRow}>
                                <Ionicons name="wallet-outline" size={11} color={C.bodySoft} />
                                <Text style={styles.statText}>{fmtCurrency(c.total_spent, 'NGN')} total</Text>
                              </View>
                            </View>

                            {/* Last order */}
                            <Text style={styles.customerSub}>
                              Last order {relativeTime(c.last_order_at)} · First: {relativeTime(c.first_order_at)}
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

          {topCustomers.length === 0 && (
            <View style={[styles.card, { alignItems: 'center', padding: 32, gap: 8 }]}>
              <Ionicons name="people-outline" size={36} color={C.bodySoft} />
              <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 14, color: C.textInk }}>No customer data yet</Text>
              <Text style={{ fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft, textAlign: 'center', lineHeight: 18 }}>
                Customer analytics appear after your first order is placed and delivered.
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

// ── styles ────────────────────────────────────────────────────────────────────

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    header: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingHorizontal: Spacing.lg, paddingTop: 12, paddingBottom: 10,
    },
    headerTitle: { flex: 1, fontFamily: Fonts.serif, fontSize: 20, color: C.textInk },
    linkText:    { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.spice },

    periodRow:       { flexDirection: 'row', gap: 8, paddingHorizontal: Spacing.lg, paddingBottom: 10 },
    periodBtn:       { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, backgroundColor: C.borderWarm },
    periodBtnActive: { backgroundColor: C.ink },
    periodBtnText:       { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.bodySoft },
    periodBtnTextActive: { color: C.canvas },

    card: {
      backgroundColor: C.bgCard, borderRadius: Radius.lg,
      borderWidth: 0.5, borderColor: C.borderWarm,
      padding: 16, ...Shadow.card,
    },

    heroNumber: { fontFamily: Fonts.serif, fontSize: 48, color: C.textInk, lineHeight: 52 },

    statPill: {
      backgroundColor: C.bgCard, borderRadius: Radius.lg,
      borderWidth: 0.5, borderColor: C.borderWarm,
      padding: 12, alignItems: 'center', gap: 3, ...Shadow.card,
    },
    statPillVal:   { fontFamily: Fonts.serif, fontSize: 22, color: C.textInk },
    statPillLabel: { fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft },

    sectionCap: {
      fontFamily: Fonts.sansMedium, fontSize: 11, color: C.bodySoft,
      textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10,
    },

    searchBox: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: C.bgCard, borderRadius: Radius.lg,
      borderWidth: 0.5, borderColor: C.borderWarm,
      paddingHorizontal: 12, paddingVertical: 10, ...Shadow.card,
    },
    searchInput: {
      flex: 1, fontFamily: Fonts.sans, fontSize: 14, color: C.textInk,
    },

    filterChip: {
      paddingHorizontal: 12, paddingVertical: 7,
      borderRadius: 20, backgroundColor: C.borderWarm,
    },
    filterChipActive:     { backgroundColor: C.ink },
    filterChipText:       { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.bodySoft },
    filterChipTextActive: { color: C.canvas },

    customerRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14 },
    customerName: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.textInk, flexShrink: 1 },
    customerSub:  { fontFamily: Fonts.sans, fontSize: 11, color: C.caps },

    badge:     { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
    badgeText: { fontFamily: Fonts.sansMedium, fontSize: 10 },

    statRow:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
    statText: { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft },

    divider: { height: 0.5, backgroundColor: C.borderWarm },
  });
}
