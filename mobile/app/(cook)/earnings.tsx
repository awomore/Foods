import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { earningsApi, type EarningsResponse, type Payout } from '../../src/api/earnings';
import { Colors, Fonts, Spacing, Radius, Shadow } from '../../src/constants/theme';

type Period = 'today' | 'week' | 'month' | 'year';
const PERIODS: { key: Period; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week',  label: 'This week' },
  { key: 'month', label: 'This month' },
  { key: 'year',  label: 'All time' },
];

function fmtCurrency(amount: number, currency = 'NGN'): string {
  const symbols: Record<string, string> = { NGN: '₦', KES: 'KSh ', GHS: 'GH₵', ZAR: 'R', EGP: 'E£' };
  return (symbols[currency] ?? currency + ' ') + Number(amount).toLocaleString('en-NG', { maximumFractionDigits: 0 });
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short' });
}

export default function CookEarnings() {
  const [period, setPeriod] = useState<Period>('week');
  const [data, setData] = useState<EarningsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [requestingPayout, setRequestingPayout] = useState(false);

  const load = useCallback(async (p: Period, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const result = await earningsApi.summary(p);
      setData(result);
    } catch (e) {
      console.error('earnings load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(period); }, [period]);

  function handlePeriodChange(p: Period) {
    setPeriod(p);
    load(p);
  }

  async function handlePayout() {
    if (!data || data.pending_payout <= 0) return;
    Alert.alert(
      'Request payout',
      `Request ${fmtCurrency(data.pending_payout, data.currency_code)} to your registered bank?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Request', onPress: async () => {
            setRequestingPayout(true);
            try {
              await earningsApi.requestPayout('standard');
              Alert.alert('Requested', 'Your payout has been requested. It will arrive within 1 business day.');
              load(period, true);
            } catch (e: any) {
              Alert.alert('Error', e.message ?? 'Could not request payout');
            } finally {
              setRequestingPayout(false);
            }
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={Colors.spice} />
      </View>
    );
  }

  const currency = data?.currency_code ?? 'NGN';
  const summary = data?.summary;
  const daily = data?.daily_breakdown ?? [];
  const maxAmount = daily.length > 0 ? Math.max(...daily.map(d => d.earned), 1) : 1;
  const payouts: Payout[] = data?.recent_payouts ?? [];

  return (
    <View style={styles.root}>
      <SafeAreaView>
        <View style={styles.topBar}>
          <Text style={styles.pageTitle}>Earnings</Text>
        </View>
      </SafeAreaView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: Spacing.lg, gap: 16, paddingTop: 8 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(period, true); }} tintColor={Colors.spice} />
        }
      >
        {/* Period toggle */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {PERIODS.map(p => (
            <TouchableOpacity
              key={p.key}
              onPress={() => handlePeriodChange(p.key)}
              style={[styles.periodPill, period === p.key && styles.periodPillActive]}
            >
              <Text style={[styles.periodText, period === p.key && styles.periodTextActive]}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Summary card */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total earned</Text>
          <Text style={styles.summaryAmount}>{fmtCurrency(summary?.total_earned ?? 0, currency)}</Text>
          <View style={styles.summaryMeta}>
            <View style={styles.summaryMetaItem}>
              <Ionicons name="receipt-outline" size={14} color="rgba(250,246,240,0.5)" />
              <Text style={styles.summaryMetaText}>{summary?.total_orders ?? 0} orders</Text>
            </View>
            {data?.pending_payout != null && data.pending_payout > 0 && (
              <>
                <View style={styles.summaryMetaDivider} />
                <View style={styles.summaryMetaItem}>
                  <Ionicons name="time-outline" size={14} color={Colors.honey} />
                  <Text style={[styles.summaryMetaText, { color: Colors.honey }]}>
                    {fmtCurrency(data.pending_payout, currency)} pending
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Daily breakdown bar chart */}
        {daily.length > 0 && (
          <View>
            <Text style={styles.sectionLabel}>Daily breakdown</Text>
            <View style={styles.chartCard}>
              <View style={styles.bars}>
                {daily.map(d => {
                  const pct = d.earned / maxAmount;
                  const dayLabel = new Date(d.day).toLocaleDateString('en-NG', { weekday: 'short' }).slice(0, 3);
                  return (
                    <View key={d.day} style={styles.barCol}>
                      <Text style={styles.barAmount}>
                        {d.earned > 0 ? `${fmtCurrency(d.earned, currency).replace(/[^0-9.]/g, '').length > 4 ? Math.round(d.earned / 1000) + 'k' : fmtCurrency(d.earned, currency)}` : '—'}
                      </Text>
                      <View style={styles.barTrack}>
                        <View style={[styles.barFill, { height: `${Math.max(pct * 100, d.earned > 0 ? 4 : 0)}%` as any }]} />
                      </View>
                      <Text style={styles.barDay}>{dayLabel}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        )}

        {/* Stats grid */}
        {summary && (
          <View style={styles.statsGrid}>
            {[
              {
                label: 'Avg order value',
                value: fmtCurrency(summary.avg_order_value, currency),
                icon: 'calculator-outline',
              },
              {
                label: 'Platform fees',
                value: fmtCurrency(summary.platform_fees, currency),
                icon: 'cut-outline',
              },
              {
                label: 'Net payout',
                value: fmtCurrency(summary.total_earned - summary.platform_fees, currency),
                icon: 'cash-outline',
              },
              {
                label: 'Lifetime earned',
                value: fmtCurrency(data?.lifetime_earned ?? 0, currency),
                icon: 'trophy-outline',
              },
            ].map(s => (
              <View key={s.label} style={styles.statCard}>
                <Ionicons name={s.icon as any} size={17} color={Colors.spice} />
                <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{s.value}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Savings pot */}
        {data?.savings && (
          <View style={styles.savingsCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.savingsLabel}>
                {data.savings.goal_name ?? 'Savings pot'}
              </Text>
              <Text style={styles.savingsAmount}>{fmtCurrency(data.savings.balance, data.savings.currency_code)}</Text>
              <Text style={styles.savingsRate}>Auto-saving {data.savings.auto_save_rate}% of each order</Text>
            </View>
            <Ionicons name="wallet-outline" size={28} color={Colors.ember} />
          </View>
        )}

        {/* Payout history */}
        {payouts.length > 0 && (
          <View>
            <Text style={styles.sectionLabel}>Payout history</Text>
            <View style={styles.card}>
              {payouts.map((p, i) => (
                <View key={p.id}>
                  {i > 0 && <View style={styles.divider} />}
                  <View style={styles.payoutRow}>
                    <View style={styles.payoutLeft}>
                      <Text style={styles.payoutId}>{p.id.slice(0, 12)}</Text>
                      <Text style={styles.payoutDate}>{p.processed_at ? fmtDate(p.processed_at) : fmtDate(p.created_at)}</Text>
                    </View>
                    <View style={styles.payoutRight}>
                      <Text style={styles.payoutAmount}>{fmtCurrency(p.amount, p.currency_code)}</Text>
                      <View style={[styles.payoutPill, p.status === 'completed' ? styles.payoutPillPaid : styles.payoutPillPending]}>
                        <Text style={[styles.payoutPillText, p.status === 'completed' ? styles.payoutPillTextPaid : styles.payoutPillTextPending]}>
                          {p.status === 'completed' ? 'Paid' : p.status}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Withdraw */}
        <TouchableOpacity
          style={[styles.withdrawBtn, (!data || data.pending_payout <= 0) && { opacity: 0.5 }]}
          onPress={handlePayout}
          disabled={!data || data.pending_payout <= 0 || requestingPayout}
          activeOpacity={0.85}
        >
          {requestingPayout ? (
            <ActivityIndicator color={Colors.canvas} />
          ) : (
            <>
              <Ionicons name="arrow-up-circle-outline" size={18} color={Colors.canvas} />
              <Text style={styles.withdrawText}>
                {data && data.pending_payout > 0
                  ? `Withdraw ${fmtCurrency(data.pending_payout, currency)}`
                  : 'No pending balance'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  topBar: { paddingHorizontal: Spacing.lg, paddingTop: 16, paddingBottom: 12 },
  pageTitle: { fontFamily: Fonts.serif, fontSize: 26, color: Colors.textInk },

  periodPill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 40, backgroundColor: Colors.bgCard, borderWidth: 0.5, borderColor: Colors.borderWarm },
  periodPillActive: { backgroundColor: Colors.ink, borderColor: 'transparent' },
  periodText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: Colors.body },
  periodTextActive: { color: Colors.canvas },

  summaryCard: { backgroundColor: Colors.ink, borderRadius: Radius.lg, padding: 20, gap: 6, ...Shadow.lift },
  summaryLabel: { fontFamily: Fonts.sans, fontSize: 13, color: 'rgba(250,246,240,0.5)' },
  summaryAmount: { fontFamily: Fonts.serif, fontSize: 34, color: Colors.ember, letterSpacing: -0.5 },
  summaryMeta: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  summaryMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  summaryMetaDivider: { width: 1, height: 12, backgroundColor: 'rgba(250,246,240,0.2)' },
  summaryMetaText: { fontFamily: Fonts.sans, fontSize: 12, color: 'rgba(250,246,240,0.6)' },

  sectionLabel: { fontFamily: Fonts.sansMedium, fontSize: 13, color: Colors.caps, fontWeight: '600', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },

  chartCard: { backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: 16, borderWidth: 0.5, borderColor: Colors.borderWarm, ...Shadow.card },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 120 },
  barCol: { flex: 1, alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' },
  barAmount: { fontFamily: Fonts.sans, fontSize: 9, color: Colors.bodySoft, textAlign: 'center' },
  barTrack: { flex: 1, width: '80%', backgroundColor: Colors.bgCook, borderRadius: 4, overflow: 'hidden', justifyContent: 'flex-end' },
  barFill: { width: '100%', backgroundColor: Colors.spice, borderRadius: 4 },
  barDay: { fontFamily: Fonts.sansMedium, fontSize: 10, color: Colors.bodySoft },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: { width: '47.5%', backgroundColor: Colors.bgCard, borderRadius: Radius.md, padding: 14, borderWidth: 0.5, borderColor: Colors.borderWarm, ...Shadow.card, gap: 4 },
  statValue: { fontFamily: Fonts.serif, fontSize: 18, color: Colors.textInk },
  statLabel: { fontFamily: Fonts.sans, fontSize: 11, color: Colors.bodySoft },

  savingsCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: 16,
    borderWidth: 0.5, borderColor: Colors.borderWarm, ...Shadow.card,
  },
  savingsLabel: { fontFamily: Fonts.sansMedium, fontSize: 13, color: Colors.textInk, fontWeight: '600', marginBottom: 4 },
  savingsAmount: { fontFamily: Fonts.serif, fontSize: 22, color: Colors.spice },
  savingsRate: { fontFamily: Fonts.sans, fontSize: 11, color: Colors.bodySoft, marginTop: 4 },

  card: { backgroundColor: Colors.bgCard, borderRadius: Radius.lg, borderWidth: 0.5, borderColor: Colors.borderWarm, ...Shadow.card, overflow: 'hidden' },
  divider: { height: 0.5, backgroundColor: Colors.borderWarm },
  payoutRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 },
  payoutLeft: { gap: 3 },
  payoutId: { fontFamily: Fonts.sansMedium, fontSize: 13, color: Colors.textInk, fontWeight: '600' },
  payoutDate: { fontFamily: Fonts.sans, fontSize: 12, color: Colors.bodySoft },
  payoutRight: { alignItems: 'flex-end', gap: 4 },
  payoutAmount: { fontFamily: Fonts.serif, fontSize: 16, color: Colors.spice },
  payoutPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 40 },
  payoutPillPaid: { backgroundColor: Colors.successBg },
  payoutPillPending: { backgroundColor: Colors.warnBg },
  payoutPillText: { fontFamily: Fonts.sansMedium, fontSize: 10 },
  payoutPillTextPaid: { color: Colors.successFg },
  payoutPillTextPending: { color: Colors.ember },

  withdrawBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.spice, borderRadius: Radius.lg, paddingVertical: 16 },
  withdrawText: { fontFamily: Fonts.sansMedium, fontSize: 15, color: Colors.canvas, fontWeight: '600' },
});
