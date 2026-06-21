'use client';
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type AppColors } from '../src/context/ThemeContext';
import { useAuth } from '../src/context/AuthContext';
import { Fonts, Spacing, Radius, FontSize, Shadow } from '../src/constants/theme';
import { fleetApi } from '../src/api/fleet';
import { fmtCurrency } from '../src/utils/format';
import { parsePhoneCurrency } from '../src/utils/currency';

type EarningsData = Awaited<ReturnType<typeof fleetApi.operatorEarnings>>;

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.bg },
    header: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
      paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
      borderBottomWidth: 1, borderBottomColor: C.borderWarm,
    },
    backBtn: { padding: 6 },
    headerTitle: { fontFamily: Fonts.semiBold, fontSize: FontSize.lg, color: C.ink, flex: 1 },
    businessName: { fontFamily: Fonts.regular, fontSize: FontSize.sm, color: C.bodySoft },
    scroll: { flex: 1 },
    section: { paddingHorizontal: Spacing.md, paddingTop: Spacing.md },
    sectionLabel: {
      fontFamily: Fonts.semiBold, fontSize: FontSize.sm, color: C.bodySoft,
      textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.sm,
    },
    kpiRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
    kpiCard: {
      flex: 1, backgroundColor: C.bgCard, borderRadius: Radius.md,
      padding: Spacing.md, ...Shadow.card,
    },
    kpiValue: { fontFamily: Fonts.semiBold, fontSize: 22, color: C.ink },
    kpiLabel: { fontFamily: Fonts.regular, fontSize: FontSize.xs, color: C.bodySoft, marginTop: 2 },
    kpiSub: { fontFamily: Fonts.regular, fontSize: FontSize.xs, color: C.spice, marginTop: 1 },
    riderCard: {
      backgroundColor: C.bgCard, borderRadius: Radius.md,
      padding: Spacing.md, marginBottom: Spacing.sm, ...Shadow.card,
      flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    },
    avatarCircle: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: C.borderWarm,
      alignItems: 'center', justifyContent: 'center',
    },
    riderName: { fontFamily: Fonts.semiBold, fontSize: FontSize.sm, color: C.ink },
    riderSub: { fontFamily: Fonts.regular, fontSize: FontSize.xs, color: C.bodySoft, marginTop: 1 },
    riderRight: { marginLeft: 'auto', alignItems: 'flex-end' },
    riderEarnings: { fontFamily: Fonts.semiBold, fontSize: FontSize.sm, color: C.ink },
    riderWeek: { fontFamily: Fonts.regular, fontSize: FontSize.xs, color: C.bodySoft, marginTop: 1 },
    badge: {
      paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99,
      alignSelf: 'flex-start', marginTop: 4,
    },
    badgeText: { fontFamily: Fonts.semiBold, fontSize: 10 },
    chartRow: {
      flexDirection: 'row', alignItems: 'flex-end', gap: 3,
      height: 80, marginBottom: Spacing.md,
    },
    bar: { flex: 1, borderRadius: 3, minHeight: 3 },
    emptyText: {
      fontFamily: Fonts.regular, fontSize: FontSize.sm, color: C.bodySoft,
      textAlign: 'center', paddingVertical: Spacing.xl,
    },
    centred: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
    errorText: { fontFamily: Fonts.regular, fontSize: FontSize.sm, color: C.bodySoft, textAlign: 'center' },
    retryBtn: {
      paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
      backgroundColor: C.spice, borderRadius: Radius.md,
    },
    retryText: { fontFamily: Fonts.semiBold, fontSize: FontSize.sm, color: '#fff' },
    addRiderBtn: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
      marginHorizontal: Spacing.md, marginBottom: Spacing.lg,
      padding: Spacing.md, borderRadius: Radius.md,
      borderWidth: 1.5, borderColor: C.spice, borderStyle: 'dashed',
      justifyContent: 'center',
    },
    addRiderText: { fontFamily: Fonts.semiBold, fontSize: FontSize.sm, color: C.spice },
  });
}

export default function FleetDashboardScreen() {
  const router = useRouter();
  const C = useColors();
  const { user } = useAuth();
  const styles = useMemo(() => makeStyles(C), [C]);
  const currencyInfo = useMemo(() => parsePhoneCurrency(user?.phone ?? ''), [user]);
  const fmt = useCallback((n: number) => fmtCurrency(n, currencyInfo.code), [currencyInfo]);

  const [data, setData] = useState<EarningsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState('');

  async function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setErr('');
    try {
      setData(await fleetApi.operatorEarnings());
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, []);

  const maxGross = useMemo(
    () => Math.max(1, ...(data?.daily_breakdown ?? []).map(d => Number(d.gross))),
    [data],
  );

  function riderStatusColor(status: string, isAvailable: boolean) {
    if (status !== 'approved') return { bg: C.borderWarm, fg: C.bodySoft };
    return isAvailable ? { bg: '#D1FAE5', fg: '#065F46' } : { bg: C.borderWarm, fg: C.bodySoft };
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Fleet Dashboard</Text>
          {data && (
            <Text style={styles.businessName}>{data.operator.business_name}</Text>
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.centred}>
          <ActivityIndicator color={C.spice} />
        </View>
      ) : err ? (
        <View style={styles.centred}>
          <Text style={styles.errorText}>{err}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => load()}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : !data ? null : (
        <ScrollView
          style={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={C.spice} />}
          showsVerticalScrollIndicator={false}
        >
          {/* ── KPIs ── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>This week</Text>
            <View style={styles.kpiRow}>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiValue}>{fmt(Number(data.aggregate.week_gross))}</Text>
                <Text style={styles.kpiLabel}>Fleet revenue</Text>
                <Text style={styles.kpiSub}>{data.aggregate.week_deliveries} deliveries</Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiValue}>{data.aggregate.active_riders}</Text>
                <Text style={styles.kpiLabel}>Active riders</Text>
                <Text style={styles.kpiSub}>of {data.aggregate.rider_count} total</Text>
              </View>
            </View>

            <Text style={styles.sectionLabel}>All time</Text>
            <View style={styles.kpiRow}>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiValue}>{fmt(Number(data.aggregate.total_gross))}</Text>
                <Text style={styles.kpiLabel}>Total earned</Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiValue}>{data.aggregate.total_deliveries.toLocaleString()}</Text>
                <Text style={styles.kpiLabel}>Total deliveries</Text>
              </View>
            </View>
          </View>

          {/* ── 30-day chart ── */}
          {data.daily_breakdown.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>30-day revenue</Text>
              <View style={styles.chartRow}>
                {data.daily_breakdown.map((d, i) => (
                  <View
                    key={i}
                    style={[
                      styles.bar,
                      {
                        height: Math.max(4, (Number(d.gross) / maxGross) * 72),
                        backgroundColor: C.spice,
                        opacity: 0.5 + 0.5 * (Number(d.gross) / maxGross),
                      },
                    ]}
                  />
                ))}
              </View>
            </View>
          )}

          {/* ── Per-rider roster ── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              Riders ({data.per_rider.length})
            </Text>
            {data.per_rider.length === 0 ? (
              <Text style={styles.emptyText}>No riders registered under your fleet yet.</Text>
            ) : data.per_rider.map(r => {
              const sc = riderStatusColor(r.status, r.is_available);
              return (
                <View key={r.id} style={styles.riderCard}>
                  <View style={styles.avatarCircle}>
                    <Ionicons name="bicycle-outline" size={20} color={C.bodySoft} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.riderName}>{r.full_name}</Text>
                    <Text style={styles.riderSub}>{r.phone} · {r.vehicle_type}</Text>
                    <View style={[styles.badge, { backgroundColor: sc.bg }]}>
                      <Text style={[styles.badgeText, { color: sc.fg }]}>
                        {r.status !== 'approved' ? r.status : r.is_available ? 'Available' : 'Offline'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.riderRight}>
                    <Text style={styles.riderEarnings}>{fmt(Number(r.all_time_gross))}</Text>
                    <Text style={styles.riderWeek}>this wk: {fmt(Number(r.week_gross))}</Text>
                    <Text style={styles.riderWeek}>{r.total_deliveries} total deliveries</Text>
                  </View>
                </View>
              );
            })}
          </View>

          {/* Add rider shortcut */}
          <TouchableOpacity
            style={styles.addRiderBtn}
            onPress={() => router.push('/register-rider' as any)}
          >
            <Ionicons name="add-circle-outline" size={18} color={C.spice} />
            <Text style={styles.addRiderText}>Add a rider to your fleet</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
