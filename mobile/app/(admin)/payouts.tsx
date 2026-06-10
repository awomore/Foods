import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, FlatList, TextInput, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api/client';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { Fonts, Spacing, Radius, Shadow, FontSize } from '../../src/constants/theme';
import { fmtCurrency, relativeTime } from '../../src/utils/format';
import { useFeedback } from '../../src/components/feedback';
import { Bone } from '../../src/components/ui/Skeleton';

interface Payout {
  id: string;
  cook_id: string;
  amount: number;
  currency_code: string;
  status: string;
  created_at: string;
  cook_name: string;
  cook_phone: string;
  bank_reference?: string;
}

export default function AdminPayoutsScreen() {
  const router = useRouter();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const feedback = useFeedback();
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const [bankRef, setBankRef] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const load = useCallback((isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    api.get<{ payouts: Payout[]; total: number; total_amount: number }>('/admin/payouts?status=pending')
      .then(res => { setPayouts(res.payouts ?? []); setTotal(res.total_amount ?? 0); })
      .catch(() => {})
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  const processPayment = async (payoutId: string) => {
    setProcessing(payoutId);
    try {
      await api.patch(`/admin/payouts/${payoutId}/process`, { bank_reference: bankRef });
      feedback.toast({ type: 'success', message: 'Payout processed' });
      setExpandedId(null);
      setBankRef('');
      load();
    } catch {
      feedback.toast({ type: 'error', message: 'Failed to process payout' });
    } finally { setProcessing(null); }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <Text style={styles.title}>Payout Approvals</Text>
        <View style={{ width: 40 }} />
      </View>

      {total > 0 && (
        <View style={styles.totalBanner}>
          <Text style={styles.totalLabel}>Total Pending</Text>
          <Text style={styles.totalValue}>{fmtCurrency(total, 'NGN')}</Text>
        </View>
      )}

      {loading ? (
        <View style={{ flex: 1, padding: Spacing.lg, gap: 12 }}>
          <Bone width="100%" height={80} radius={12} />
          <Bone width="100%" height={80} radius={12} />
          <Bone width="100%" height={80} radius={12} />
        </View>
      ) : (
        <FlatList
          data={payouts}
          keyExtractor={p => p.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} />}
          ListEmptyComponent={<View style={styles.empty}><Ionicons name="cash-outline" size={40} color={C.stone} /><Text style={styles.emptyText}>No pending payouts</Text></View>}
          renderItem={({ item: p }) => (
            <View style={styles.payoutCard}>
              <View style={styles.payoutHeader}>
                <View>
                  <Text style={styles.cookName}>{p.cook_name}</Text>
                  <Text style={styles.cookPhone}>{p.cook_phone}</Text>
                  <Text style={styles.payoutTime}>{relativeTime(p.created_at)}</Text>
                </View>
                <Text style={styles.payoutAmount}>{fmtCurrency(p.amount, p.currency_code)}</Text>
              </View>
              {expandedId === p.id ? (
                <View style={styles.processPanel}>
                  <TextInput
                    style={styles.refInput}
                    value={bankRef}
                    onChangeText={setBankRef}
                    placeholder="Bank transfer reference (optional)"
                    placeholderTextColor={C.stone}
                  />
                  <View style={styles.processBtns}>
                    <TouchableOpacity style={styles.cancelBtn} onPress={() => setExpandedId(null)}>
                      <Text style={styles.cancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.processBtn, processing === p.id && styles.processBtnDisabled]}
                      onPress={() => processPayment(p.id)}
                      disabled={processing === p.id}
                    >
                      {processing === p.id ? (
                        <ActivityIndicator size="small" color={C.canvas} />
                      ) : (
                        <Text style={styles.processBtnText}>Mark Paid</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity style={styles.actionBtn} onPress={() => setExpandedId(p.id)}>
                  <Text style={styles.actionBtnText}>Process Payment</Text>
                  <Ionicons name="chevron-forward" size={16} color={C.spice} />
                </TouchableOpacity>
              )}
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
    backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    title: { fontFamily: Fonts.sansMedium, fontSize: FontSize.lg, color: C.ink },
    totalBanner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: C.honey, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
    totalLabel: { fontFamily: Fonts.sans, fontSize: FontSize.sm, color: C.body },
    totalValue: { fontFamily: Fonts.sansMedium, fontSize: FontSize.xl, color: C.spice },
    loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    list: { padding: Spacing.lg, gap: Spacing.md },
    empty: { alignItems: 'center', paddingVertical: 60, gap: Spacing.md },
    emptyText: { fontFamily: Fonts.sans, fontSize: FontSize.body, color: C.bodySoft },
    payoutCard: { backgroundColor: C.bgCard, borderRadius: Radius.lg, padding: Spacing.md, ...Shadow.card, gap: Spacing.sm },
    payoutHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    cookName: { fontFamily: Fonts.sansMedium, fontSize: FontSize.body, color: C.ink },
    cookPhone: { fontFamily: Fonts.sans, fontSize: FontSize.sm, color: C.bodySoft },
    payoutTime: { fontFamily: Fonts.sans, fontSize: FontSize.xs, color: C.stone },
    payoutAmount: { fontFamily: Fonts.sansMedium, fontSize: FontSize.xl, color: C.spice },
    processPanel: { gap: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: C.borderWarm },
    refInput: { backgroundColor: C.bg, borderRadius: Radius.md, borderWidth: 1, borderColor: C.borderWarm, paddingHorizontal: Spacing.md, paddingVertical: 10, fontFamily: Fonts.sans, fontSize: FontSize.sm, color: C.ink },
    processBtns: { flexDirection: 'row', gap: Spacing.sm },
    cancelBtn: { flex: 1, borderWidth: 1, borderColor: C.borderWarm, borderRadius: Radius.full, paddingVertical: 10, alignItems: 'center' },
    cancelBtnText: { fontFamily: Fonts.sansMedium, fontSize: FontSize.sm, color: C.body },
    processBtn: { flex: 1, backgroundColor: C.leaf, borderRadius: Radius.full, paddingVertical: 10, alignItems: 'center' },
    processBtnDisabled: { opacity: 0.5 },
    processBtnText: { fontFamily: Fonts.sansMedium, fontSize: FontSize.sm, color: C.canvas },
    actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: C.borderWarm },
    actionBtnText: { fontFamily: Fonts.sansMedium, fontSize: FontSize.sm, color: C.spice },
  });
}
