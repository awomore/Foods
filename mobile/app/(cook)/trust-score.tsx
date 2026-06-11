import React, { useMemo, useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api/client';
import { Fonts, Spacing, Radius, Shadow } from '../../src/constants/theme';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { Bone } from '../../src/components/ui/Skeleton';

interface ReliabilityScore {
  score: number;
  role: string;
  on_time_deliveries: number;
  late_deliveries: number;
  cancellations: number;
  no_shows: number;
  disputes_received: number;
  disputes_won: number;
  disputes_lost: number;
  total_orders: number;
  last_computed_at: string | null;
  breakdown: { label: string; value: string; weight: number }[];
}

const BADGE_TIERS = [
  { min: 90, label: 'Elite Kitchen',   color: '#7C3AED', bg: '#F5F3FF', icon: 'diamond' as const },
  { min: 75, label: 'Trusted Kitchen', color: '#059669', bg: '#F0FDF4', icon: 'shield-checkmark' as const },
  { min: 60, label: 'Good Standing',   color: '#D97706', bg: '#FFFBEB', icon: 'star' as const },
  { min: 0,  label: 'Building Trust',  color: '#6B7280', bg: '#F9FAFB', icon: 'construct-outline' as const },
];

export default function TrustScoreScreen() {
  const router = useRouter();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [data, setData] = useState<ReliabilityScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback((isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    api.get<ReliabilityScore>('/reliability/me')
      .then(setData)
      .catch(() => {})
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  const score = data?.score ?? 0;
  const tier = BADGE_TIERS.find(t => score >= t.min) ?? BADGE_TIERS[BADGE_TIERS.length - 1];

  return (
    <View style={styles.root}>
      <SafeAreaView>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={C.textInk} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Trust Score</Text>
        </View>
      </SafeAreaView>

      {loading ? (
        <View style={{ flex: 1, padding: Spacing.lg, gap: 12 }}>
          <Bone width="100%" height={100} radius={16} />
          <Bone width="100%" height={72} radius={12} />
          <Bone width="100%" height={72} radius={12} />
          <Bone width="100%" height={72} radius={12} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: Spacing.lg, gap: 20, paddingBottom: 60 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} />}
        >
          {/* Score display */}
          <View style={styles.scoreCard}>
            <View style={[styles.tierBadge, { backgroundColor: tier.bg }]}>
              <Ionicons name={tier.icon} size={16} color={tier.color} />
              <Text style={[styles.tierLabel, { color: tier.color }]}>{tier.label}</Text>
            </View>
            <Text style={styles.scoreNum}>{Math.round(score)}</Text>
            <Text style={styles.scoreLabel}>out of 100</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${score}%` }]} />
            </View>
            {data?.last_computed_at && (
              <Text style={styles.lastUpdated}>Last updated: {new Date(data.last_computed_at).toLocaleDateString()}</Text>
            )}
          </View>

          {/* Stats grid */}
          {data && (
            <View style={styles.statsGrid}>
              {[
                { label: 'Total Orders',    value: data.total_orders,         icon: 'receipt-outline' },
                { label: 'On-Time',         value: data.on_time_deliveries,   icon: 'time-outline' },
                { label: 'Late Deliveries', value: data.late_deliveries,      icon: 'hourglass-outline' },
                { label: 'Cancellations',   value: data.cancellations,        icon: 'close-circle-outline' },
                { label: 'Disputes Won',    value: data.disputes_won,         icon: 'checkmark-circle-outline' },
                { label: 'Disputes Lost',   value: data.disputes_lost,        icon: 'alert-circle-outline' },
              ].map(stat => (
                <View key={stat.label} style={styles.statCard}>
                  <Ionicons name={stat.icon as any} size={18} color={C.spice} />
                  <Text style={styles.statValue}>{stat.value}</Text>
                  <Text style={styles.statLabel}>{stat.label}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Breakdown */}
          {data?.breakdown && (
            <View>
              <Text style={styles.sectionLabel}>Score breakdown</Text>
              {data.breakdown.map(f => (
                <View key={f.label} style={styles.factorCard}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={styles.factorLabel}>{f.label}</Text>
                      <Text style={styles.factorWeight}>{f.weight}%</Text>
                    </View>
                    <Text style={styles.factorDesc}>{f.value}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Tips */}
          <View style={styles.tipsCard}>
            <Text style={styles.tipsTitle}>How to improve your score</Text>
            {[
              { icon: 'star',             tip: 'Deliver consistently high-quality food to raise your rating' },
              { icon: 'checkmark-circle', tip: 'Avoid cancellations — every cancellation lowers your score by 5 points' },
              { icon: 'time',             tip: 'Accept and prepare orders on time to maintain your SLA record' },
              { icon: 'shield-checkmark', tip: 'Get your identity and food safety verified in Certifications' },
              { icon: 'ribbon',           tip: 'Upload culinary or health certifications to earn bonus points' },
            ].map((t, i) => (
              <View key={i} style={styles.tipRow}>
                <View style={styles.tipIcon}>
                  <Ionicons name={t.icon as any} size={14} color={C.spice} />
                </View>
                <Text style={styles.tipText}>{t.tip}</Text>
              </View>
            ))}
          </View>

          {/* CTAs */}
          <TouchableOpacity
            style={styles.ctaBtn}
            onPress={() => router.push('/(cook)/certifications' as any)}
          >
            <Ionicons name="shield-checkmark-outline" size={18} color={C.canvas} />
            <Text style={styles.ctaBtnText}>Upload certifications</Text>
            <Ionicons name="arrow-forward" size={16} color={C.canvas} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.ctaBtn, { backgroundColor: C.bgCard }]}
            onPress={() => router.push('/(cook)/earnings' as any)}
          >
            <Ionicons name="card-outline" size={18} color={C.ink} />
            <Text style={[styles.ctaBtnText, { color: C.ink }]}>Verify bank account</Text>
            <Ionicons name="arrow-forward" size={16} color={C.ink} />
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

function makeStyles(C: AppColors) { return StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingTop: 8, paddingBottom: 12, gap: 12 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.bgCook, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: Fonts.serif, fontSize: 20, color: C.textInk, flex: 1 },
  sectionLabel: { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.bodySoft, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 },

  scoreCard: {
    backgroundColor: C.bgCard, borderRadius: Radius.xl, padding: 24,
    alignItems: 'center', gap: 10, borderWidth: 0.5, borderColor: C.borderWarm, ...Shadow.card,
  },
  tierBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 40, marginBottom: 6 },
  tierLabel: { fontFamily: Fonts.sansMedium, fontSize: 13 },
  scoreNum: { fontFamily: Fonts.serif, fontSize: 64, color: C.spice, lineHeight: 72 },
  scoreLabel: { fontFamily: Fonts.sans, fontSize: 14, color: C.bodySoft },
  progressBar: { width: '100%', height: 8, backgroundColor: C.bgCook, borderRadius: 4, overflow: 'hidden', marginTop: 6 },
  progressFill: { height: '100%', backgroundColor: C.spice, borderRadius: 4 },
  lastUpdated: { fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft, marginTop: 4 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statCard: {
    width: '31%', backgroundColor: C.bgCard, borderRadius: Radius.md,
    padding: 12, alignItems: 'center', gap: 4, borderWidth: 0.5, borderColor: C.borderWarm,
  },
  statValue: { fontFamily: Fonts.sansMedium, fontSize: 20, color: C.ink },
  statLabel: { fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft, textAlign: 'center' },

  factorCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 14,
    backgroundColor: C.bgCard, borderRadius: Radius.lg, padding: 14,
    borderWidth: 0.5, borderColor: C.borderWarm, marginBottom: 8,
  },
  factorLabel: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.textInk },
  factorWeight: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.spice },
  factorDesc: { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft, marginTop: 3, lineHeight: 18 },

  tipsCard: { backgroundColor: C.honey, borderRadius: Radius.xl, padding: 16, gap: 12 },
  tipsTitle: { fontFamily: Fonts.sansMedium, fontSize: 14, color: '#5C3B16', marginBottom: 4 },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  tipIcon: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.6)', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  tipText: { fontFamily: Fonts.sans, fontSize: 13, color: '#5C3B16', lineHeight: 20, flex: 1 },

  ctaBtn: {
    backgroundColor: C.ink, borderRadius: Radius.lg, paddingVertical: 16, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 0.5, borderColor: C.borderWarm,
  },
  ctaBtnText: { fontFamily: Fonts.sansMedium, fontSize: 15, color: C.canvas, flex: 1, marginLeft: 8 },
}); }
