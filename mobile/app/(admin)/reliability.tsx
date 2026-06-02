import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api/client';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { Fonts, Spacing, Radius, Shadow, FontSize } from '../../src/constants/theme';

interface ScoreRow {
  user_id: string; role: string; score: number;
  full_name: string; phone: string; account_risk_level: string;
  on_time_deliveries: number; late_deliveries: number;
  cancellations: number; disputes_received: number;
  disputes_won: number; disputes_lost: number; total_orders: number;
}

interface SLADashboard {
  sla_breaches: { total: number; breached: number; breach_rate: number };
  avg_delivery_minutes: number;
  dispute_window: { dispute_window_open: number };
  penalty_stats: { total_penalties: number; total_deductions: number };
  top_breaching_cooks: { display_name: string; username: string; breach_count: number }[];
}

export default function ReliabilityScreen() {
  const router = useRouter();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [scores, setScores] = useState<ScoreRow[]>([]);
  const [sla, setSla] = useState<SLADashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'scores' | 'sla'>('scores');
  const [roleFilter, setRoleFilter] = useState<'cook' | 'customer'>('cook');

  const load = useCallback((isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    Promise.all([
      api.get<{ scores: ScoreRow[] }>(`/reliability/admin/all?role=${roleFilter}&max_score=80&limit=50`)
        .then(d => setScores(d.scores))
        .catch(() => {}),
      api.get<SLADashboard>('/sla/admin/dashboard')
        .then(setSla)
        .catch(() => {}),
    ]).finally(() => { setLoading(false); setRefreshing(false); });
  }, [roleFilter]);

  useEffect(() => { load(); }, [load]);

  function scoreColor(score: number) {
    if (score >= 90) return C.leaf;
    if (score >= 70) return C.honey;
    if (score >= 50) return '#D97706';
    return C.errorFg;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <Text style={styles.title}>Reliability & SLA</Text>
        <TouchableOpacity onPress={() => load(true)} style={styles.backBtn}>
          <Ionicons name="refresh" size={20} color={C.ink} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {(['scores', 'sla'] as const).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabLabel, activeTab === tab && styles.tabLabelActive]}>
              {tab === 'scores' ? 'Low Scores' : 'SLA Dashboard'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.loadingState}><ActivityIndicator size="large" color={C.spice} /></View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} />}
        >
          {activeTab === 'scores' && (
            <>
              {/* Role filter */}
              <View style={styles.roleRow}>
                {(['cook', 'customer'] as const).map(r => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.roleChip, roleFilter === r && styles.roleChipActive]}
                    onPress={() => setRoleFilter(r)}
                  >
                    <Text style={[styles.roleLabel, roleFilter === r && styles.roleLabelActive]}>
                      {r.charAt(0).toUpperCase() + r.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {scores.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Ionicons name="shield-checkmark" size={40} color={C.leaf} />
                  <Text style={styles.emptyTitle}>All users above 80 score</Text>
                </View>
              ) : (
                scores.map(row => (
                  <View key={`${row.user_id}-${row.role}`} style={styles.scoreCard}>
                    <View style={styles.scoreHeader}>
                      <View style={[styles.scoreBadge, { backgroundColor: scoreColor(row.score) + '22' }]}>
                        <Text style={[styles.scoreNum, { color: scoreColor(row.score) }]}>
                          {row.score.toFixed(0)}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.userName}>{row.full_name}</Text>
                        <Text style={styles.userPhone}>{row.phone}</Text>
                      </View>
                      {row.account_risk_level !== 'low' && (
                        <View style={styles.riskChip}>
                          <Text style={styles.riskChipText}>{row.account_risk_level}</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.statsRow}>
                      <View style={styles.statPill}>
                        <Text style={styles.statPillVal}>{row.total_orders}</Text>
                        <Text style={styles.statPillLabel}>orders</Text>
                      </View>
                      <View style={styles.statPill}>
                        <Text style={[styles.statPillVal, { color: C.errorFg }]}>{row.late_deliveries}</Text>
                        <Text style={styles.statPillLabel}>late</Text>
                      </View>
                      <View style={styles.statPill}>
                        <Text style={[styles.statPillVal, { color: C.errorFg }]}>{row.cancellations}</Text>
                        <Text style={styles.statPillLabel}>cancels</Text>
                      </View>
                      <View style={styles.statPill}>
                        <Text style={[styles.statPillVal, { color: C.errorFg }]}>{row.disputes_lost}</Text>
                        <Text style={styles.statPillLabel}>lost</Text>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </>
          )}

          {activeTab === 'sla' && sla && (
            <>
              {/* SLA overview cards */}
              <View style={styles.slaGrid}>
                <View style={styles.slaCard}>
                  <Ionicons name="time" size={20} color={C.spice} />
                  <Text style={styles.slaNum}>{sla.avg_delivery_minutes.toFixed(0)}m</Text>
                  <Text style={styles.slaLabel}>Avg Delivery</Text>
                </View>
                <View style={styles.slaCard}>
                  <Ionicons name="alert-circle" size={20} color={C.errorFg} />
                  <Text style={[styles.slaNum, { color: C.errorFg }]}>
                    {sla.sla_breaches.breach_rate?.toFixed(1) ?? 0}%
                  </Text>
                  <Text style={styles.slaLabel}>SLA Breach Rate</Text>
                </View>
                <View style={styles.slaCard}>
                  <Ionicons name="shield" size={20} color={C.leaf} />
                  <Text style={styles.slaNum}>{sla.dispute_window.dispute_window_open}</Text>
                  <Text style={styles.slaLabel}>Open Windows</Text>
                </View>
                <View style={styles.slaCard}>
                  <Ionicons name="trending-down" size={20} color={C.warnFg} />
                  <Text style={styles.slaNum}>{sla.penalty_stats.total_penalties}</Text>
                  <Text style={styles.slaLabel}>Penalties (30d)</Text>
                </View>
              </View>

              {/* Top breaching cooks */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Most SLA Breaches (30 days)</Text>
                {sla.top_breaching_cooks.length === 0 ? (
                  <Text style={styles.emptyText}>No repeat breaches</Text>
                ) : (
                  sla.top_breaching_cooks.map((cook, i) => (
                    <View key={i} style={styles.breachRow}>
                      <View style={styles.breachRank}>
                        <Text style={styles.breachRankNum}>{i + 1}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.userName}>{cook.display_name}</Text>
                        <Text style={styles.userPhone}>@{cook.username}</Text>
                      </View>
                      <View style={[styles.flaggedBadge, { backgroundColor: C.errorFg }]}>
                        <Text style={styles.flaggedCount}>{cook.breach_count} breaches</Text>
                      </View>
                    </View>
                  ))
                )}
              </View>

              {/* Breach stats */}
              <View style={[styles.slaCard, { flexDirection: 'row', gap: 20, flex: 0 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.slaLabel}>Total Orders Tracked</Text>
                  <Text style={styles.slaNum}>{sla.sla_breaches.total}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.slaLabel}>Total Breached</Text>
                  <Text style={[styles.slaNum, { color: C.errorFg }]}>{sla.sla_breaches.breached}</Text>
                </View>
              </View>
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: C.borderWarm },
    backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    title: { fontFamily: Fonts.sansMedium, fontSize: FontSize.lg, color: C.ink },
    tabRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.borderWarm },
    tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
    tabActive: { borderBottomWidth: 2, borderBottomColor: C.spice },
    tabLabel: { fontFamily: Fonts.sans, fontSize: FontSize.sm, color: C.bodySoft },
    tabLabelActive: { fontFamily: Fonts.sansMedium, color: C.spice },
    loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    content: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: 40 },
    roleRow: { flexDirection: 'row', gap: 8 },
    roleChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.full, backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.borderWarm },
    roleChipActive: { backgroundColor: C.ink, borderColor: C.ink },
    roleLabel: { fontFamily: Fonts.sansMedium, fontSize: FontSize.sm, color: C.body },
    roleLabelActive: { color: C.canvas },
    emptyCard: { alignItems: 'center', gap: 8, paddingVertical: 40 },
    emptyTitle: { fontFamily: Fonts.sansMedium, fontSize: FontSize.body, color: C.leaf },
    emptyText: { fontFamily: Fonts.sans, fontSize: FontSize.body, color: C.bodySoft },
    scoreCard: { backgroundColor: C.bgCard, borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.sm, ...Shadow.card },
    scoreHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    scoreBadge: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
    scoreNum: { fontFamily: Fonts.sansMedium, fontSize: FontSize.xl },
    userName: { fontFamily: Fonts.sansMedium, fontSize: FontSize.body, color: C.ink },
    userPhone: { fontFamily: Fonts.sans, fontSize: FontSize.xs, color: C.bodySoft, marginTop: 2 },
    riskChip: { backgroundColor: '#DC2626' + '22', paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
    riskChipText: { fontFamily: Fonts.sansMedium, fontSize: FontSize.xs, color: '#DC2626', textTransform: 'uppercase' },
    statsRow: { flexDirection: 'row', gap: 8 },
    statPill: { flex: 1, backgroundColor: C.bg, borderRadius: Radius.sm, padding: 8, alignItems: 'center' },
    statPillVal: { fontFamily: Fonts.sansMedium, fontSize: FontSize.body, color: C.ink },
    statPillLabel: { fontFamily: Fonts.sans, fontSize: FontSize.xs, color: C.bodySoft },
    slaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    slaCard: { width: '47%', backgroundColor: C.bgCard, borderRadius: Radius.lg, padding: 14, gap: 4, alignItems: 'center', ...Shadow.card },
    slaNum: { fontFamily: Fonts.sansMedium, fontSize: FontSize.xl, color: C.ink },
    slaLabel: { fontFamily: Fonts.sans, fontSize: FontSize.xs, color: C.bodySoft, textAlign: 'center' },
    section: { gap: 8 },
    sectionTitle: { fontFamily: Fonts.sansMedium, fontSize: FontSize.lg, color: C.ink },
    breachRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: C.bgCard, borderRadius: Radius.md, padding: Spacing.md },
    breachRank: { width: 28, height: 28, borderRadius: 14, backgroundColor: C.errorBg, alignItems: 'center', justifyContent: 'center' },
    breachRankNum: { fontFamily: Fonts.sansMedium, fontSize: FontSize.sm, color: C.errorFg },
    flaggedBadge: { borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4 },
    flaggedCount: { fontFamily: Fonts.sansMedium, fontSize: FontSize.xs, color: C.canvas },
  });
}
