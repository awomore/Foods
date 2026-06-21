import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { cooksApi } from '../../src/api/cooks';
import { Fonts, Spacing, Radius, Shadow } from '../../src/constants/theme';
import { useColors, type AppColors } from '../../src/context/ThemeContext';

type Stats = {
  delivery: { delivered: number; cancelled: number; total_active: number; delivery_success_rate: number };
  sla: { on_time: number; late: number; avg_delivery_minutes: number };
  ratings: { avg_rating: number; review_count: number };
};

function StatCard({ label, value, sub, iconName, accent, C, styles }: {
  label: string; value: string; sub?: string;
  iconName: React.ComponentProps<typeof Ionicons>['name'];
  accent: string; C: AppColors; styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={[styles.card, { borderLeftColor: accent }]}>
      <View style={[styles.cardIcon, { backgroundColor: accent + '1A' }]}>
        <Ionicons name={iconName} size={20} color={accent} />
      </View>
      <View style={styles.cardBody}>
        <Text style={[styles.cardValue, { color: C.textInk }]}>{value}</Text>
        <Text style={[styles.cardLabel, { color: C.bodySoft }]}>{label}</Text>
        {sub ? <Text style={[styles.cardSub, { color: C.bodySoft }]}>{sub}</Text> : null}
      </View>
    </View>
  );
}

function SectionHeader({ title, C, styles }: { title: string; C: AppColors; styles: ReturnType<typeof makeStyles> }) {
  return <Text style={[styles.sectionTitle, { color: C.textInk }]}>{title}</Text>;
}

function RatioBar({ left, right, leftColor, rightColor, leftLabel, rightLabel, C, styles }: {
  left: number; right: number; leftColor: string; rightColor: string;
  leftLabel: string; rightLabel: string; C: AppColors; styles: ReturnType<typeof makeStyles>;
}) {
  const total = left + right;
  const leftPct = total > 0 ? (left / total) * 100 : 0;
  return (
    <View style={styles.ratioWrap}>
      <View style={styles.ratioBar}>
        {total === 0 ? (
          <View style={[styles.ratioFill, { flex: 1, backgroundColor: C.borderWarm }]} />
        ) : (
          <>
            <View style={[styles.ratioFill, { flex: left, backgroundColor: leftColor }]} />
            <View style={[styles.ratioFill, { flex: right, backgroundColor: rightColor }]} />
          </>
        )}
      </View>
      <View style={styles.ratioLegend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: leftColor }]} />
          <Text style={[styles.legendText, { color: C.body }]}>{leftLabel} ({left})</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: rightColor }]} />
          <Text style={[styles.legendText, { color: C.body }]}>{rightLabel} ({right})</Text>
        </View>
        {total > 0 && (
          <Text style={[styles.legendPct, { color: C.bodySoft }]}>{leftPct.toFixed(0)}% {leftLabel.toLowerCase()}</Text>
        )}
      </View>
    </View>
  );
}

export default function DeliveryStatsScreen() {
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const data = await cooksApi.deliveryStats();
      setStats(data);
    } catch (e: any) {
      setError(e.message ?? 'Could not load delivery stats');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function onRefresh() { setRefreshing(true); load(true); }

  const successRate = stats ? Math.round(stats.delivery.delivery_success_rate * 100) : 0;
  const rateColor = successRate >= 90 ? C.successFg : successRate >= 70 ? C.ember : C.errorFg;

  const avgMin = stats?.sla.avg_delivery_minutes ?? 0;
  const avgMinLabel = avgMin > 0 ? `${Math.round(avgMin)} min avg` : '—';

  const stars = stats?.ratings.avg_rating ?? 0;
  const starsLabel = stars > 0 ? stars.toFixed(1) : '—';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.bg }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: C.borderWarm }]}>
        <Text style={[styles.headerTitle, { color: C.textInk }]}>Delivery performance</Text>
        <Text style={[styles.headerSub, { color: C.bodySoft }]}>Last 30 days</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={C.spice} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={40} color={C.errorFg} />
          <Text style={[styles.errorText, { color: C.errorFg }]}>{error}</Text>
        </View>
      ) : stats ? (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.spice} />}
        >
          {/* Success rate hero */}
          <View style={[styles.heroCard, { backgroundColor: rateColor + '12', borderColor: rateColor + '30' }]}>
            <Text style={[styles.heroRate, { color: rateColor }]}>{successRate}%</Text>
            <Text style={[styles.heroLabel, { color: C.body }]}>Delivery success rate</Text>
            <Text style={[styles.heroSub, { color: C.bodySoft }]}>
              {stats.delivery.delivered} delivered · {stats.delivery.cancelled} cancelled
            </Text>
          </View>

          <SectionHeader title="Deliveries" C={C} styles={styles} />
          <RatioBar
            left={stats.delivery.delivered}
            right={stats.delivery.cancelled}
            leftColor={C.successFg}
            rightColor={C.errorFg}
            leftLabel="Delivered"
            rightLabel="Cancelled"
            C={C}
            styles={styles}
          />

          <SectionHeader title="SLA performance" C={C} styles={styles} />
          <View style={styles.cardRow}>
            <StatCard
              label="On time"
              value={String(stats.sla.on_time)}
              iconName="checkmark-circle-outline"
              accent={C.successFg}
              C={C} styles={styles}
            />
            <StatCard
              label="Late"
              value={String(stats.sla.late)}
              iconName="time-outline"
              accent={C.ember}
              C={C} styles={styles}
            />
          </View>
          <View style={[styles.infoRow, { backgroundColor: C.infoBg, borderColor: C.infoFg + '30' }]}>
            <Ionicons name="speedometer-outline" size={16} color={C.infoFg} />
            <Text style={[styles.infoText, { color: C.infoFg }]}>Average delivery time: {avgMinLabel}</Text>
          </View>

          <SectionHeader title="Customer ratings" C={C} styles={styles} />
          <View style={styles.cardRow}>
            <StatCard
              label="Avg rating"
              value={starsLabel}
              sub={stars > 0 ? '/ 5 stars' : undefined}
              iconName="star-outline"
              accent={C.ember}
              C={C} styles={styles}
            />
            <StatCard
              label="Reviews"
              value={String(stats.ratings.review_count)}
              iconName="chatbubble-ellipses-outline"
              accent={C.spice}
              C={C} styles={styles}
            />
          </View>

          <View style={styles.bottomPad} />
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1 },
    header: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.md,
      borderBottomWidth: 1,
    },
    headerTitle: { fontSize: 20, fontFamily: Fonts.sansMedium },
    headerSub: { fontSize: 13, fontFamily: Fonts.sans, marginTop: 2 },
    scroll: { padding: Spacing.lg, gap: Spacing.sm },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
    errorText: { fontSize: 14, fontFamily: Fonts.sans, textAlign: 'center', marginTop: Spacing.xs },

    heroCard: {
      alignItems: 'center',
      borderRadius: Radius.lg,
      borderWidth: 1,
      paddingVertical: Spacing.xl,
      paddingHorizontal: Spacing.lg,
      marginBottom: Spacing.sm,
    },
    heroRate: { fontSize: 52, fontFamily: Fonts.sansMedium, lineHeight: 60 },
    heroLabel: { fontSize: 15, fontFamily: Fonts.sansMedium, marginTop: 4 },
    heroSub: { fontSize: 13, fontFamily: Fonts.sans, marginTop: 4 },

    sectionTitle: {
      fontSize: 13,
      fontFamily: Fonts.sansMedium,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: Spacing.md,
      marginBottom: Spacing.xs,
    },

    cardRow: { flexDirection: 'row', gap: Spacing.sm },
    card: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      padding: Spacing.md,
      borderRadius: Radius.md,
      borderLeftWidth: 3,
      backgroundColor: C.bgCard,
      ...Shadow.card,
    },
    cardIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    cardBody: { flex: 1 },
    cardValue: { fontSize: 22, fontFamily: Fonts.sansMedium },
    cardLabel: { fontSize: 12, fontFamily: Fonts.sans, marginTop: 1 },
    cardSub: { fontSize: 11, fontFamily: Fonts.sans },

    ratioWrap: {
      backgroundColor: C.bgCard,
      borderRadius: Radius.md,
      padding: Spacing.md,
      ...Shadow.card,
    },
    ratioBar: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: Spacing.sm },
    ratioFill: {},
    ratioLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, alignItems: 'center' },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendText: { fontSize: 12, fontFamily: Fonts.sans },
    legendPct: { fontSize: 12, fontFamily: Fonts.sans, marginLeft: 'auto' },

    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      padding: Spacing.md,
      borderRadius: Radius.md,
      borderWidth: 1,
    },
    infoText: { fontSize: 13, fontFamily: Fonts.sans, flex: 1 },

    bottomPad: { height: Spacing.xl },
  });
}
