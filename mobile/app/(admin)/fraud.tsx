import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api/client';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { Fonts, Spacing, Radius, Shadow, FontSize } from '../../src/constants/theme';
import { fmtCurrency, relativeTime } from '../../src/utils/format';

interface FraudData {
  high_dispute_cooks: { id: string; display_name: string; dispute_count: number }[];
  refund_rate: { refunded: number; total: number; rate: number };
  large_orders: { id: string; total_amount: number; status: string; created_at: string; customer_name: string; cook_name: string }[];
}

export default function FraudDashboardScreen() {
  const router = useRouter();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [data, setData] = useState<FraudData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<FraudData>('/admin/fraud')
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <Text style={styles.title}>Fraud Dashboard</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.loadingState}><ActivityIndicator size="large" color={C.spice} /></View>
      ) : !data ? (
        <View style={styles.loadingState}><Text style={styles.errorText}>Failed to load</Text></View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          {/* Refund rate */}
          <View style={styles.rateCard}>
            <Ionicons name="trending-down" size={28} color={parseFloat(String(data.refund_rate.rate)) > 10 ? C.errorFg : C.leaf} />
            <View>
              <Text style={styles.rateTitle}>30-Day Refund Rate</Text>
              <Text style={[styles.rateValue, parseFloat(String(data.refund_rate.rate)) > 10 && styles.rateValueAlert]}>
                {data.refund_rate.rate}%
              </Text>
              <Text style={styles.rateSub}>{data.refund_rate.refunded} refunds / {data.refund_rate.total} orders</Text>
            </View>
          </View>

          {/* High dispute cooks */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cooks with High Disputes (30 days)</Text>
            {data.high_dispute_cooks.length === 0 ? (
              <Text style={styles.emptyText}>No high-dispute cooks this month ✓</Text>
            ) : (
              data.high_dispute_cooks.map(cook => (
                <View key={cook.id} style={styles.flaggedRow}>
                  <Ionicons name="warning" size={18} color={C.errorFg} />
                  <Text style={styles.flaggedName}>{cook.display_name}</Text>
                  <View style={styles.flaggedBadge}>
                    <Text style={styles.flaggedCount}>{cook.dispute_count} disputes</Text>
                  </View>
                </View>
              ))
            )}
          </View>

          {/* Large orders */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Large Orders (Last 7 Days)</Text>
            {data.large_orders.length === 0 ? (
              <Text style={styles.emptyText}>No large orders flagged</Text>
            ) : (
              data.large_orders.map(order => (
                <TouchableOpacity
                  key={order.id}
                  style={styles.orderRow}
                  onPress={() => router.push(`/tracking/${order.id}` as any)}
                >
                  <View style={styles.orderInfo}>
                    <Text style={styles.orderAmount}>{fmtCurrency(order.total_amount, 'NGN')}</Text>
                    <Text style={styles.orderParty}>{order.customer_name} → {order.cook_name}</Text>
                    <Text style={styles.orderTime}>{relativeTime(order.created_at)}</Text>
                  </View>
                  <View style={styles.orderStatus}>
                    <Text style={styles.orderStatusText}>{order.status}</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
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
    loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    errorText: { fontFamily: Fonts.sans, fontSize: FontSize.body, color: C.body },
    content: { padding: Spacing.lg, gap: Spacing.lg },
    rateCard: { flexDirection: 'row', gap: Spacing.md, backgroundColor: C.bgCard, borderRadius: Radius.lg, padding: Spacing.lg, alignItems: 'center', ...Shadow.card },
    rateTitle: { fontFamily: Fonts.sans, fontSize: FontSize.sm, color: C.bodySoft },
    rateValue: { fontFamily: Fonts.sansMedium, fontSize: FontSize.xxl, color: C.leaf },
    rateValueAlert: { color: C.errorFg },
    rateSub: { fontFamily: Fonts.sans, fontSize: FontSize.sm, color: C.bodySoft, marginTop: 2 },
    section: { gap: 8 },
    sectionTitle: { fontFamily: Fonts.sansMedium, fontSize: FontSize.lg, color: C.ink },
    emptyText: { fontFamily: Fonts.sans, fontSize: FontSize.body, color: C.bodySoft },
    flaggedRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: C.errorBg, borderRadius: Radius.md, padding: Spacing.md },
    flaggedName: { flex: 1, fontFamily: Fonts.sansMedium, fontSize: FontSize.body, color: C.errorFg },
    flaggedBadge: { backgroundColor: C.errorFg, borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4 },
    flaggedCount: { fontFamily: Fonts.sansMedium, fontSize: FontSize.xs, color: C.canvas },
    orderRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bgCard, borderRadius: Radius.md, padding: Spacing.md, ...Shadow.card },
    orderInfo: { flex: 1 },
    orderAmount: { fontFamily: Fonts.sansMedium, fontSize: FontSize.lg, color: C.ink },
    orderParty: { fontFamily: Fonts.sans, fontSize: FontSize.sm, color: C.body },
    orderTime: { fontFamily: Fonts.sans, fontSize: FontSize.xs, color: C.bodySoft, marginTop: 2 },
    orderStatus: { backgroundColor: C.honey, borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4 },
    orderStatusText: { fontFamily: Fonts.sansMedium, fontSize: FontSize.xs, color: C.spice },
  });
}
