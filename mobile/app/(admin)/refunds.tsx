import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api/client';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { Fonts, Spacing, Radius, Shadow, FontSize } from '../../src/constants/theme';
import { fmtCurrency, relativeTime } from '../../src/utils/format';

interface Refund {
  dispute_id: string;
  refund_amount: number;
  resolution_type: string;
  resolved_at: string;
  order_id: string;
  total_amount: number;
  payment_tx_ref: string | null;
  customer_name: string;
  customer_phone: string;
}

export default function AdminRefundsScreen() {
  const router = useRouter();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    setLoading(true);
    api.get<{ refunds: Refund[]; total: number }>('/admin/refunds')
      .then(res => { setRefunds(res.refunds ?? []); setTotal(res.total ?? 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const totalAmount = refunds.reduce((s, r) => s + (r.refund_amount ?? r.total_amount), 0);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <Text style={styles.title}>Refund Queue ({total})</Text>
        <View style={{ width: 40 }} />
      </View>

      {totalAmount > 0 && (
        <View style={styles.totalBanner}>
          <Text style={styles.totalLabel}>Total Refund Value</Text>
          <Text style={styles.totalValue}>{fmtCurrency(totalAmount, 'NGN')}</Text>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingState}><ActivityIndicator size="large" color={C.spice} /></View>
      ) : (
        <FlatList
          data={refunds}
          keyExtractor={r => r.dispute_id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<View style={styles.empty}><Ionicons name="checkmark-circle" size={48} color={C.leaf} /><Text style={styles.emptyText}>No pending refunds</Text></View>}
          renderItem={({ item: r }) => (
            <View style={styles.refundCard}>
              <View style={styles.refundHeader}>
                <View>
                  <Text style={styles.customerName}>{r.customer_name}</Text>
                  <Text style={styles.customerPhone}>{r.customer_phone}</Text>
                </View>
                <View style={styles.amountCol}>
                  <Text style={styles.refundAmount}>{fmtCurrency(r.refund_amount ?? r.total_amount, 'NGN')}</Text>
                  <View style={[styles.typePill, r.resolution_type === 'full_refund' ? styles.fullRefund : styles.partialRefund]}>
                    <Text style={styles.typePillText}>{r.resolution_type === 'full_refund' ? 'Full' : 'Partial'}</Text>
                  </View>
                </View>
              </View>
              <View style={styles.refundFooter}>
                <Text style={styles.refundTime}>Resolved {relativeTime(r.resolved_at)}</Text>
                {r.payment_tx_ref && (
                  <Text style={styles.txRef}>TX: {r.payment_tx_ref.slice(0, 12)}...</Text>
                )}
              </View>
            </View>
          )}
        />
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
    totalBanner: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, backgroundColor: C.errorBg },
    totalLabel: { fontFamily: Fonts.sans, fontSize: FontSize.sm, color: C.body },
    totalValue: { fontFamily: Fonts.sansMedium, fontSize: FontSize.xl, color: C.errorFg },
    loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    list: { padding: Spacing.lg, gap: Spacing.md },
    empty: { alignItems: 'center', paddingVertical: 60, gap: Spacing.md },
    emptyText: { fontFamily: Fonts.sans, fontSize: FontSize.body, color: C.bodySoft },
    refundCard: { backgroundColor: C.bgCard, borderRadius: Radius.lg, padding: Spacing.md, ...Shadow.card, gap: 8 },
    refundHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    customerName: { fontFamily: Fonts.sansMedium, fontSize: FontSize.body, color: C.ink },
    customerPhone: { fontFamily: Fonts.sans, fontSize: FontSize.sm, color: C.bodySoft },
    amountCol: { alignItems: 'flex-end', gap: 4 },
    refundAmount: { fontFamily: Fonts.sansMedium, fontSize: FontSize.xl, color: C.errorFg },
    typePill: { borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 3 },
    fullRefund: { backgroundColor: C.errorBg },
    partialRefund: { backgroundColor: C.warnBg },
    typePillText: { fontFamily: Fonts.sansMedium, fontSize: FontSize.xs, color: C.ink },
    refundFooter: { flexDirection: 'row', justifyContent: 'space-between' },
    refundTime: { fontFamily: Fonts.sans, fontSize: FontSize.xs, color: C.bodySoft },
    txRef: { fontFamily: Fonts.sans, fontSize: FontSize.xs, color: C.stone },
  });
}
