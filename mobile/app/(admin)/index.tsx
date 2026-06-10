import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api/client';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { Fonts, Spacing, Radius, Shadow, FontSize } from '../../src/constants/theme';
import { fmtCurrency } from '../../src/utils/format';
import { useAuth } from '../../src/context/AuthContext';
import { Bone } from '../../src/components/ui/Skeleton';

interface AdminStats {
  total_users: number;
  total_active_cooks: number;
  total_orders: number;
  platform_revenue: number;
  pending_payout_amount: number;
  pending_payout_count: number;
  pending_verifications: number;
  orders_by_status: Record<string, number>;
}

const QUEUE_ITEMS = [
  { key: 'disputes',      label: 'Dispute Queue',       icon: 'alert-circle-outline', route: '/(admin)/disputes' },
  { key: 'refunds',       label: 'Refund Queue',        icon: 'card-outline',          route: '/(admin)/refunds' },
  { key: 'verifications', label: 'Verification Queue',  icon: 'shield-checkmark-outline', route: '/(admin)/verifications' },
  { key: 'moderation',    label: 'Moderation Queue',    icon: 'flag-outline',          route: '/(admin)/moderation' },
  { key: 'payouts',       label: 'Payout Approvals',    icon: 'cash-outline',          route: '/(admin)/payouts' },
  { key: 'fraud',         label: 'Fraud Dashboard',     icon: 'warning-outline',       route: '/(admin)/fraud' },
  { key: 'settings',      label: 'Platform Settings',   icon: 'settings-outline',      route: '/(admin)/settings' },
];

export default function AdminDashboard() {
  const router = useRouter();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const { user } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<AdminStats>('/admin/stats')
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (user?.role !== 'admin') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Ionicons name="lock-closed" size={48} color={C.stone} />
          <Text style={styles.accessDenied}>Admin access required</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Admin Portal</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={22} color={C.ink} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {loading ? (
          <View style={{ gap: 12, paddingTop: 8 }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <Bone width="47%" height={80} radius={12} />
              <Bone width="47%" height={80} radius={12} />
              <Bone width="47%" height={80} radius={12} />
              <Bone width="47%" height={80} radius={12} />
            </View>
            <Bone width="100%" height={56} radius={12} />
            <Bone width="100%" height={56} radius={12} />
            <Bone width="100%" height={56} radius={12} />
          </View>
        ) : stats ? (
          <>
            {/* Stats grid */}
            <View style={styles.statsGrid}>
              <StatCard label="Users" value={stats.total_users.toLocaleString()} icon="people-outline" C={C} styles={styles} />
              <StatCard label="Cooks" value={stats.total_active_cooks.toLocaleString()} icon="restaurant-outline" C={C} styles={styles} />
              <StatCard label="Orders" value={stats.total_orders.toLocaleString()} icon="bag-outline" C={C} styles={styles} />
              <StatCard
                label="Revenue"
                value={fmtCurrency(stats.platform_revenue, 'NGN')}
                icon="trending-up-outline"
                C={C} styles={styles}
                highlight
              />
              <StatCard
                label="Pending Payouts"
                value={fmtCurrency(stats.pending_payout_amount, 'NGN')}
                icon="cash-outline"
                sub={`${stats.pending_payout_count} requests`}
                C={C} styles={styles}
              />
              <StatCard
                label="Verifications"
                value={String(stats.pending_verifications)}
                icon="shield-half-outline"
                sub="pending review"
                C={C} styles={styles}
                alert={stats.pending_verifications > 0}
              />
            </View>

            {/* Order status breakdown */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Orders by Status</Text>
              <View style={styles.orderStatus}>
                {Object.entries(stats.orders_by_status).map(([status, count]) => (
                  <View key={status} style={styles.orderStatusItem}>
                    <Text style={styles.orderStatusCount}>{count}</Text>
                    <Text style={styles.orderStatusLabel}>{status.replace('_', ' ')}</Text>
                  </View>
                ))}
              </View>
            </View>
          </>
        ) : null}

        {/* Queue navigation */}
        <Text style={styles.sectionTitle}>Queues & Tools</Text>
        <View style={styles.queueGrid}>
          {QUEUE_ITEMS.map(item => (
            <TouchableOpacity
              key={item.key}
              style={styles.queueItem}
              onPress={() => router.push(item.route as any)}
            >
              <View style={styles.queueIcon}>
                <Ionicons name={item.icon as any} size={22} color={C.spice} />
              </View>
              <Text style={styles.queueLabel}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={16} color={C.stone} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ label, value, icon, sub, highlight, alert, C, styles }: any) {
  return (
    <View style={[styles.statCard, highlight && styles.statCardHighlight, alert && styles.statCardAlert]}>
      <Ionicons name={icon} size={20} color={highlight ? C.canvas : alert ? C.errorFg : C.spice} />
      <Text style={[styles.statValue, highlight && styles.statValueLight]}>{value}</Text>
      <Text style={[styles.statLabel, highlight && styles.statLabelLight]}>{label}</Text>
      {sub && <Text style={[styles.statSub, highlight && styles.statLabelLight]}>{sub}</Text>}
    </View>
  );
}

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
    accessDenied: { fontFamily: Fonts.sansMedium, fontSize: FontSize.lg, color: C.body },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
      borderBottomWidth: 1, borderBottomColor: C.borderWarm,
    },
    title: { fontFamily: Fonts.serif, fontSize: FontSize.xl, color: C.ink },
    closeBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    content: { padding: Spacing.lg, gap: Spacing.lg },
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    statCard: {
      width: '47%', backgroundColor: C.bgCard, borderRadius: Radius.lg,
      padding: Spacing.md, gap: 4, ...Shadow.card,
    },
    statCardHighlight: { backgroundColor: C.spice },
    statCardAlert: { borderWidth: 1.5, borderColor: C.errorFg },
    statValue: { fontFamily: Fonts.sansMedium, fontSize: FontSize.xl, color: C.ink },
    statValueLight: { color: C.canvas },
    statLabel: { fontFamily: Fonts.sans, fontSize: FontSize.sm, color: C.bodySoft },
    statLabelLight: { color: C.canvas, opacity: 0.8 },
    statSub: { fontFamily: Fonts.sans, fontSize: FontSize.xs, color: C.bodySoft },
    section: { gap: Spacing.sm },
    sectionTitle: { fontFamily: Fonts.sansMedium, fontSize: FontSize.lg, color: C.ink },
    orderStatus: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    orderStatusItem: {
      backgroundColor: C.bgCard, borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 8,
      alignItems: 'center', minWidth: 70,
    },
    orderStatusCount: { fontFamily: Fonts.sansMedium, fontSize: FontSize.lg, color: C.ink },
    orderStatusLabel: { fontFamily: Fonts.sans, fontSize: FontSize.xs, color: C.bodySoft },
    queueGrid: { gap: 1, backgroundColor: C.borderWarm, borderRadius: Radius.lg, overflow: 'hidden', ...Shadow.card },
    queueItem: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
      backgroundColor: C.bgCard, paddingHorizontal: Spacing.md, paddingVertical: 14,
    },
    queueIcon: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: C.honey, alignItems: 'center', justifyContent: 'center',
    },
    queueLabel: { flex: 1, fontFamily: Fonts.sansMedium, fontSize: FontSize.body, color: C.ink },
  });
}
