import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Modal, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api/client';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { Fonts, Spacing, Radius, Shadow, FontSize } from '../../src/constants/theme';
import { fmtCurrency, relativeTime } from '../../src/utils/format';

type Severity = 'low' | 'medium' | 'high' | 'critical';

interface FraudSignal {
  id: string; signal_type: string; severity: Severity;
  details: Record<string, unknown>; resolved: boolean;
  created_at: string; full_name?: string; phone?: string;
  account_risk_level?: string;
}
interface FraudData {
  high_dispute_cooks: { id: string; display_name: string; dispute_count: number; reliability_score: number }[];
  refund_rate: { refunded: number; total: number; rate: number };
  large_orders: { id: string; total_amount: number; status: string; created_at: string; customer_name: string; cook_name: string }[];
  fraud_signals: FraudSignal[];
  payout_abuse: { display_name: string; payout_count: number; total_withdrawn: number }[];
  duplicate_accounts: { phone_base: string; account_count: number; names: string[] }[];
  velocity_breaches: { id: string; full_name: string; phone: string; order_count: number; total_spent: number }[];
  high_risk_users: { id: string; full_name: string; phone: string; account_risk_level: string; fraud_flagged: boolean }[];
}

const SEV_COLOR: Record<Severity, string> = {
  low: '#059669', medium: '#D97706', high: '#DC2626', critical: '#7C3AED',
};

export default function FraudDashboardScreen() {
  const router = useRouter();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [data, setData] = useState<FraudData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'signals' | 'refunds' | 'disputes' | 'risk'>('signals');
  const [noteModal, setNoteModal] = useState<{ signalId: string } | null>(null);
  const [resolveNote, setResolveNote] = useState('');

  const load = useCallback((isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    api.get<FraudData>('/admin/fraud')
      .then(setData)
      .catch(() => {})
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  async function resolveSignal(id: string) {
    await api.patch(`/admin/fraud/signals/${id}/resolve`, { resolution_note: resolveNote });
    setNoteModal(null);
    setResolveNote('');
    load(true);
  }

  const TABS = [
    { key: 'signals',   label: 'Signals',   icon: 'warning-outline' },
    { key: 'refunds',   label: 'Refunds',   icon: 'trending-down-outline' },
    { key: 'disputes',  label: 'Disputes',  icon: 'file-tray-outline' },
    { key: 'risk',      label: 'Risk',      icon: 'shield-outline' },
  ] as const;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <Text style={styles.title}>Fraud Dashboard</Text>
        <TouchableOpacity onPress={() => load(true)} style={styles.backBtn}>
          <Ionicons name="refresh" size={20} color={C.ink} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar} contentContainerStyle={styles.tabBarContent}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Ionicons name={tab.icon as any} size={14} color={activeTab === tab.key ? C.canvas : C.body} />
            <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.loadingState}><ActivityIndicator size="large" color={C.spice} /></View>
      ) : !data ? (
        <View style={styles.loadingState}><Text style={styles.errorText}>Failed to load fraud data</Text></View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} />}
        >
          {/* ── Signals tab ── */}
          {activeTab === 'signals' && (
            <>
              {/* Summary bar */}
              <View style={styles.summaryRow}>
                {(['critical','high','medium'] as Severity[]).map(sev => {
                  const count = data.fraud_signals.filter(s => s.severity === sev && !s.resolved).length;
                  return (
                    <View key={sev} style={[styles.summaryChip, { backgroundColor: SEV_COLOR[sev] + '22' }]}>
                      <Text style={[styles.summaryCount, { color: SEV_COLOR[sev] }]}>{count}</Text>
                      <Text style={[styles.summaryLabel, { color: SEV_COLOR[sev] }]}>{sev}</Text>
                    </View>
                  );
                })}
              </View>

              {data.fraud_signals.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Ionicons name="shield-checkmark" size={40} color={C.leaf} />
                  <Text style={styles.emptyTitle}>No open fraud signals</Text>
                </View>
              ) : (
                data.fraud_signals.filter(s => !s.resolved).map(signal => (
                  <View key={signal.id} style={[styles.signalCard, { borderLeftColor: SEV_COLOR[signal.severity] }]}>
                    <View style={styles.signalHeader}>
                      <View style={[styles.sevBadge, { backgroundColor: SEV_COLOR[signal.severity] + '22' }]}>
                        <Text style={[styles.sevText, { color: SEV_COLOR[signal.severity] }]}>
                          {signal.severity.toUpperCase()}
                        </Text>
                      </View>
                      <Text style={styles.signalType}>{signal.signal_type.replace(/_/g, ' ')}</Text>
                      <Text style={styles.signalTime}>{relativeTime(signal.created_at)}</Text>
                    </View>
                    {signal.full_name && (
                      <Text style={styles.signalUser}>{signal.full_name} · {signal.phone}</Text>
                    )}
                    <TouchableOpacity
                      style={styles.resolveBtn}
                      onPress={() => setNoteModal({ signalId: signal.id })}
                    >
                      <Text style={styles.resolveBtnText}>Resolve</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}

              {/* Velocity breaches */}
              {data.velocity_breaches.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Velocity Anomalies (5+ orders/24h)</Text>
                  {data.velocity_breaches.map(u => (
                    <View key={u.id} style={styles.riskRow}>
                      <Ionicons name="flash" size={16} color={C.errorFg} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.riskName}>{u.full_name}</Text>
                        <Text style={styles.riskSub}>{u.order_count} orders · {fmtCurrency(u.total_spent, 'NGN')}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* Duplicate accounts */}
              {data.duplicate_accounts.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Possible Duplicate Accounts</Text>
                  {data.duplicate_accounts.map((d, i) => (
                    <View key={i} style={styles.riskRow}>
                      <Ionicons name="people" size={16} color={C.warnFg} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.riskName}>{d.phone_base}••• ({d.account_count} accounts)</Text>
                        <Text style={styles.riskSub}>{d.names.slice(0, 3).join(', ')}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}

          {/* ── Refunds tab ── */}
          {activeTab === 'refunds' && (
            <>
              <View style={styles.rateCard}>
                <Ionicons
                  name="trending-down"
                  size={28}
                  color={parseFloat(String(data.refund_rate.rate)) > 10 ? C.errorFg : C.leaf}
                />
                <View>
                  <Text style={styles.rateTitle}>30-Day Refund Rate</Text>
                  <Text style={[styles.rateValue, parseFloat(String(data.refund_rate.rate)) > 10 && styles.rateValueAlert]}>
                    {data.refund_rate.rate}%
                  </Text>
                  <Text style={styles.rateSub}>{data.refund_rate.refunded} refunds / {data.refund_rate.total} orders</Text>
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Payout Abuse (3+ payouts/7 days)</Text>
                {data.payout_abuse.length === 0 ? (
                  <Text style={styles.emptyText}>No payout abuse detected</Text>
                ) : (
                  data.payout_abuse.map((p, i) => (
                    <View key={i} style={styles.flaggedRow}>
                      <Ionicons name="cash" size={16} color={C.errorFg} />
                      <Text style={styles.flaggedName}>{p.display_name}</Text>
                      <View style={styles.flaggedBadge}>
                        <Text style={styles.flaggedCount}>{p.payout_count}× · {fmtCurrency(p.total_withdrawn, 'NGN')}</Text>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </>
          )}

          {/* ── Disputes tab ── */}
          {activeTab === 'disputes' && (
            <>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>High-Dispute Cooks (30 days)</Text>
                {data.high_dispute_cooks.length === 0 ? (
                  <Text style={styles.emptyText}>No high-dispute cooks ✓</Text>
                ) : (
                  data.high_dispute_cooks.map(cook => (
                    <View key={cook.id} style={styles.flaggedRow}>
                      <Ionicons name="warning" size={16} color={C.errorFg} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.flaggedName}>{cook.display_name}</Text>
                        <Text style={styles.riskSub}>Score: {cook.reliability_score?.toFixed(0) ?? '—'}</Text>
                      </View>
                      <View style={styles.flaggedBadge}>
                        <Text style={styles.flaggedCount}>{cook.dispute_count} disputes</Text>
                      </View>
                    </View>
                  ))
                )}
              </View>

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
            </>
          )}

          {/* ── Risk tab ── */}
          {activeTab === 'risk' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>High Risk Users</Text>
              {data.high_risk_users.length === 0 ? (
                <Text style={styles.emptyText}>No high-risk users ✓</Text>
              ) : (
                data.high_risk_users.map(u => (
                  <View key={u.id} style={[styles.riskRow, u.account_risk_level === 'critical' && styles.riskRowCritical]}>
                    <Ionicons
                      name={u.fraud_flagged ? 'flag' : 'alert-circle'}
                      size={16}
                      color={SEV_COLOR[u.account_risk_level as Severity] ?? C.body}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.riskName}>{u.full_name}</Text>
                      <Text style={styles.riskSub}>{u.phone}</Text>
                    </View>
                    <View style={[styles.sevBadge, { backgroundColor: (SEV_COLOR[u.account_risk_level as Severity] ?? C.body) + '22' }]}>
                      <Text style={[styles.sevText, { color: SEV_COLOR[u.account_risk_level as Severity] ?? C.body }]}>
                        {u.account_risk_level.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}
        </ScrollView>
      )}

      {/* Resolve modal */}
      <Modal visible={!!noteModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Resolve Signal</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Resolution note (optional)"
              placeholderTextColor={C.bodySoft}
              value={resolveNote}
              onChangeText={setResolveNote}
              multiline
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setNoteModal(null)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmBtn} onPress={() => noteModal && resolveSignal(noteModal.signalId)}>
                <Text style={styles.modalConfirmText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    content: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: 40 },
    tabBar: { maxHeight: 48, borderBottomWidth: 1, borderBottomColor: C.borderWarm },
    tabBarContent: { paddingHorizontal: Spacing.lg, gap: 8, alignItems: 'center', paddingVertical: 8 },
    tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 6, borderRadius: Radius.full, backgroundColor: C.bgCard },
    tabActive: { backgroundColor: C.ink },
    tabLabel: { fontFamily: Fonts.sansMedium, fontSize: FontSize.sm, color: C.body },
    tabLabelActive: { color: C.canvas },
    summaryRow: { flexDirection: 'row', gap: Spacing.md },
    summaryChip: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: Radius.md },
    summaryCount: { fontFamily: Fonts.sansMedium, fontSize: FontSize.xl },
    summaryLabel: { fontFamily: Fonts.sans, fontSize: FontSize.xs, textTransform: 'uppercase', letterSpacing: 0.5 },
    signalCard: { backgroundColor: C.bgCard, borderRadius: Radius.lg, padding: Spacing.md, borderLeftWidth: 4, ...Shadow.card },
    signalHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
    sevBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
    sevText: { fontFamily: Fonts.sansMedium, fontSize: FontSize.xs, letterSpacing: 0.5 },
    signalType: { flex: 1, fontFamily: Fonts.sansMedium, fontSize: FontSize.sm, color: C.ink, textTransform: 'capitalize' },
    signalTime: { fontFamily: Fonts.sans, fontSize: FontSize.xs, color: C.bodySoft },
    signalUser: { fontFamily: Fonts.sans, fontSize: FontSize.sm, color: C.body, marginBottom: 8 },
    resolveBtn: { alignSelf: 'flex-end', backgroundColor: C.leaf, paddingHorizontal: 14, paddingVertical: 6, borderRadius: Radius.full },
    resolveBtnText: { fontFamily: Fonts.sansMedium, fontSize: FontSize.xs, color: C.canvas },
    emptyCard: { alignItems: 'center', gap: 8, paddingVertical: 32 },
    emptyTitle: { fontFamily: Fonts.sansMedium, fontSize: FontSize.body, color: C.leaf },
    section: { gap: 8 },
    sectionTitle: { fontFamily: Fonts.sansMedium, fontSize: FontSize.lg, color: C.ink },
    emptyText: { fontFamily: Fonts.sans, fontSize: FontSize.body, color: C.bodySoft },
    rateCard: { flexDirection: 'row', gap: Spacing.md, backgroundColor: C.bgCard, borderRadius: Radius.lg, padding: Spacing.lg, alignItems: 'center', ...Shadow.card },
    rateTitle: { fontFamily: Fonts.sans, fontSize: FontSize.sm, color: C.bodySoft },
    rateValue: { fontFamily: Fonts.sansMedium, fontSize: FontSize.xxl, color: C.leaf },
    rateValueAlert: { color: C.errorFg },
    rateSub: { fontFamily: Fonts.sans, fontSize: FontSize.sm, color: C.bodySoft, marginTop: 2 },
    flaggedRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: C.errorBg, borderRadius: Radius.md, padding: Spacing.md },
    flaggedName: { flex: 1, fontFamily: Fonts.sansMedium, fontSize: FontSize.body, color: C.errorFg },
    flaggedBadge: { backgroundColor: C.errorFg, borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4 },
    flaggedCount: { fontFamily: Fonts.sansMedium, fontSize: FontSize.xs, color: C.canvas },
    riskRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: C.bgCard, borderRadius: Radius.md, padding: Spacing.md, ...Shadow.card },
    riskRowCritical: { borderWidth: 1, borderColor: SEV_COLOR.critical + '44' },
    riskName: { fontFamily: Fonts.sansMedium, fontSize: FontSize.body, color: C.ink },
    riskSub: { fontFamily: Fonts.sans, fontSize: FontSize.xs, color: C.bodySoft, marginTop: 2 },
    orderRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bgCard, borderRadius: Radius.md, padding: Spacing.md, ...Shadow.card },
    orderInfo: { flex: 1 },
    orderAmount: { fontFamily: Fonts.sansMedium, fontSize: FontSize.lg, color: C.ink },
    orderParty: { fontFamily: Fonts.sans, fontSize: FontSize.sm, color: C.body },
    orderTime: { fontFamily: Fonts.sans, fontSize: FontSize.xs, color: C.bodySoft, marginTop: 2 },
    orderStatus: { backgroundColor: C.honey, borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4 },
    orderStatusText: { fontFamily: Fonts.sansMedium, fontSize: FontSize.xs, color: C.spice },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalCard: { backgroundColor: C.bg, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.lg, gap: Spacing.md },
    modalTitle: { fontFamily: Fonts.sansMedium, fontSize: FontSize.lg, color: C.ink },
    modalInput: { backgroundColor: C.bgCard, borderRadius: Radius.md, padding: Spacing.md, fontFamily: Fonts.sans, fontSize: FontSize.body, color: C.ink, minHeight: 80, textAlignVertical: 'top' },
    modalActions: { flexDirection: 'row', gap: Spacing.md },
    modalCancelBtn: { flex: 1, paddingVertical: 14, borderRadius: Radius.md, backgroundColor: C.bgCard, alignItems: 'center' },
    modalCancelText: { fontFamily: Fonts.sansMedium, fontSize: FontSize.body, color: C.body },
    modalConfirmBtn: { flex: 1, paddingVertical: 14, borderRadius: Radius.md, backgroundColor: C.leaf, alignItems: 'center' },
    modalConfirmText: { fontFamily: Fonts.sansMedium, fontSize: FontSize.body, color: C.canvas },
  });
}
