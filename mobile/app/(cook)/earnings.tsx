import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Modal, TextInput, FlatList,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { earningsApi, type EarningsResponse, type Payout } from '../../src/api/earnings';
import { Fonts, Spacing, Radius, Shadow } from '../../src/constants/theme';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { useFeedback } from '../../src/components/feedback';
import { fmtCurrency, fmtDate } from '../../src/utils/format';
import { Bone } from '../../src/components/ui/Skeleton';

const NIGERIAN_BANKS = [
  { name: 'Access Bank', code: '044' },
  { name: 'Citibank Nigeria', code: '023' },
  { name: 'Ecobank Nigeria', code: '050' },
  { name: 'Fidelity Bank', code: '070' },
  { name: 'First Bank of Nigeria', code: '011' },
  { name: 'First City Monument Bank (FCMB)', code: '214' },
  { name: 'Globus Bank', code: '00103' },
  { name: 'Guaranty Trust Bank (GTBank)', code: '058' },
  { name: 'Heritage Bank', code: '030' },
  { name: 'Keystone Bank', code: '082' },
  { name: 'Kuda Bank', code: '50211' },
  { name: 'Moniepoint Microfinance Bank', code: '50515' },
  { name: 'OPay (Paycom)', code: '999992' },
  { name: 'PalmPay', code: '999991' },
  { name: 'Polaris Bank', code: '076' },
  { name: 'Providus Bank', code: '101' },
  { name: 'Stanbic IBTC Bank', code: '221' },
  { name: 'Standard Chartered Bank', code: '068' },
  { name: 'Sterling Bank', code: '232' },
  { name: 'Titan Trust Bank', code: '102' },
  { name: 'Union Bank of Nigeria', code: '032' },
  { name: 'United Bank for Africa (UBA)', code: '033' },
  { name: 'Unity Bank', code: '215' },
  { name: 'VFD Microfinance Bank', code: '566' },
  { name: 'Wema Bank', code: '035' },
  { name: 'Zenith Bank', code: '057' },
];

function BankSetupModal({ visible, onClose, onSaved }: { visible: boolean; onClose: () => void; onSaved: () => void }) {
  const C = useColors();
  const mStyles = useMemo(() => makeBankStyles(C), [C]);
  const [step, setStep] = useState<'pick-bank' | 'enter-details'>('pick-bank');
  const [bankSearch, setBankSearch] = useState('');
  const [selectedBank, setSelectedBank] = useState<{ name: string; code: string } | null>(null);
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const feedback = useFeedback();
  const [saving, setSaving] = useState(false);

  const filtered = NIGERIAN_BANKS.filter(b =>
    b.name.toLowerCase().includes(bankSearch.toLowerCase())
  );

  function reset() {
    setStep('pick-bank');
    setBankSearch('');
    setSelectedBank(null);
    setAccountNumber('');
    setAccountName('');
  }

  function handleClose() { reset(); onClose(); }

  async function handleSave() {
    if (!selectedBank || accountNumber.length < 10 || !accountName.trim()) {
      feedback.warn('Missing details', 'Please fill in all fields.'); return;
    }
    setSaving(true);
    try {
      await earningsApi.saveBankAccount({
        bank_name: selectedBank.name,
        bank_code: selectedBank.code,
        bank_account_number: accountNumber.trim(),
        bank_account_name: accountName.trim(),
      });
      reset();
      onSaved();
    } catch (e: any) {
      feedback.error('Error', e.message ?? 'Could not save bank account');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={mStyles.header}>
            {step === 'enter-details' ? (
              <TouchableOpacity onPress={() => setStep('pick-bank')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="arrow-back" size={22} color={C.textInk} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={handleClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={22} color={C.textInk} />
              </TouchableOpacity>
            )}
            <Text style={mStyles.title}>{step === 'pick-bank' ? 'Select your bank' : 'Account details'}</Text>
            <View style={{ width: 22 }} />
          </View>

          {step === 'pick-bank' ? (
            <>
              <View style={mStyles.searchWrap}>
                <Ionicons name="search-outline" size={16} color={C.caps} />
                <TextInput
                  style={mStyles.searchInput}
                  placeholder="Search banks…"
                  placeholderTextColor={C.caps}
                  value={bankSearch}
                  onChangeText={setBankSearch}
                  autoFocus
                />
              </View>
              <FlatList
                data={filtered}
                keyExtractor={b => b.code}
                contentContainerStyle={{ paddingHorizontal: Spacing.lg }}
                ItemSeparatorComponent={() => <View style={mStyles.sep} />}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={mStyles.bankRow}
                    onPress={() => { setSelectedBank(item); setStep('enter-details'); }}
                    activeOpacity={0.7}
                  >
                    <Text style={mStyles.bankName}>{item.name}</Text>
                    <Ionicons name="chevron-forward" size={16} color={C.bodySoft} />
                  </TouchableOpacity>
                )}
              />
            </>
          ) : (
            <ScrollView contentContainerStyle={mStyles.form} keyboardShouldPersistTaps="handled">
              <View style={mStyles.bankBadge}>
                <Ionicons name="business-outline" size={15} color={C.spice} />
                <Text style={mStyles.bankBadgeText}>{selectedBank?.name}</Text>
              </View>

              <Text style={mStyles.fieldLabel}>Account number</Text>
              <TextInput
                style={mStyles.input}
                placeholder="0123456789"
                placeholderTextColor={C.caps}
                keyboardType="numeric"
                maxLength={10}
                value={accountNumber}
                onChangeText={setAccountNumber}
              />

              <Text style={mStyles.fieldLabel}>Account name</Text>
              <TextInput
                style={mStyles.input}
                placeholder="As it appears on your bank statement"
                placeholderTextColor={C.caps}
                autoCapitalize="words"
                value={accountName}
                onChangeText={setAccountName}
              />

              <TouchableOpacity
                style={[mStyles.saveBtn, (saving || accountNumber.length < 10 || !accountName.trim()) && { opacity: 0.45 }]}
                onPress={handleSave}
                disabled={saving || accountNumber.length < 10 || !accountName.trim()}
                activeOpacity={0.85}
              >
                {saving ? (
                  <ActivityIndicator color={C.canvas} />
                ) : (
                  <Text style={mStyles.saveBtnText}>Save bank account</Text>
                )}
              </TouchableOpacity>

              <Text style={mStyles.note}>
                Your bank details are encrypted and only used for payouts.
              </Text>
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

function makeBankStyles(C: AppColors) { return StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: C.borderWarm },
  title: { fontFamily: Fonts.serif, fontSize: 18, color: C.textInk },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: Spacing.lg, backgroundColor: C.bgCard, borderWidth: 0.5, borderColor: C.borderWarm, borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 10 },
  searchInput: { flex: 1, fontFamily: Fonts.sans, fontSize: 15, color: C.textInk },
  bankRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 },
  bankName: { fontFamily: Fonts.sans, fontSize: 15, color: C.textInk },
  sep: { height: 0.5, backgroundColor: C.borderWarm },
  form: { padding: Spacing.lg, gap: 12 },
  bankBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.bgCook, borderRadius: Radius.sm, paddingHorizontal: 12, paddingVertical: 8, alignSelf: 'flex-start', marginBottom: 8 },
  bankBadgeText: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.spice },
  fieldLabel: { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.caps, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: -4 },
  input: { backgroundColor: C.bgCard, borderWidth: 0.5, borderColor: C.borderWarm, borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 12, fontFamily: Fonts.sans, fontSize: 15, color: C.textInk },
  saveBtn: { backgroundColor: C.spice, borderRadius: Radius.lg, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  saveBtnText: { fontFamily: Fonts.sansMedium, fontSize: 15, color: C.canvas },
  note: { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft, textAlign: 'center', lineHeight: 17 },
}); }

type Period = 'today' | 'week' | 'month' | 'year';
const PERIODS: { key: Period; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week',  label: 'This week' },
  { key: 'month', label: 'This month' },
  { key: 'year',  label: 'All time' },
];

export default function CookEarnings() {
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [period, setPeriod] = useState<Period>('week');
  const [data, setData] = useState<EarningsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [requestingPayout, setRequestingPayout] = useState(false);
  const feedback = useFeedback();
  const [showBankModal, setShowBankModal] = useState(false);

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
    feedback.confirm({
      title: 'Request payout',
      message: `Request ${fmtCurrency(data.pending_payout, data.currency_code)} to your registered bank?`,
      confirmLabel: 'Request',
      onConfirm: async () => {
        setRequestingPayout(true);
        try {
          await earningsApi.requestPayout('standard');
          feedback.success('Requested', 'Your payout has been requested. It will arrive within 1 business day.');
          load(period, true);
        } catch (e: any) {
          if (e.message?.includes('No bank account')) {
            setShowBankModal(true);
          } else {
            feedback.error('Error', e.message ?? 'Could not request payout');
          }
        } finally {
          setRequestingPayout(false);
        }
      },
    });
  }

  const currency = data?.currency_code ?? 'NGN';
  const summary = data?.summary;
  const daily = data?.daily_breakdown ?? [];
  const maxAmount = daily.length > 0 ? Math.max(...daily.map(d => d.earned), 1) : 1;
  const payouts: Payout[] = data?.recent_payouts ?? [];

  return (
    <View style={styles.root}>
      <BankSetupModal
        visible={showBankModal}
        onClose={() => setShowBankModal(false)}
        onSaved={() => { setShowBankModal(false); feedback.success('Saved', 'Bank account saved. You can now request payouts.'); load(period, true); }}
      />
      <SafeAreaView>
        <View style={styles.topBar}>
          <Text style={styles.pageTitle}>Earnings</Text>
          <TouchableOpacity onPress={() => setShowBankModal(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="card-outline" size={20} color={C.spice} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: Spacing.lg, gap: 16, paddingTop: 8 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(period, true); }} tintColor={C.spice} />
        }
      >
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

        {loading && (
          <>
            <Bone width="100%" height={120} radius={16} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Bone width="48%" height={80} radius={12} />
              <Bone width="48%" height={80} radius={12} />
            </View>
            <Bone width="100%" height={160} radius={12} />
            <Bone width="100%" height={48} radius={12} />
            <Bone width="100%" height={56} radius={12} />
            <Bone width="100%" height={56} radius={12} />
          </>
        )}

        {!loading && <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total earned</Text>
          <Text style={styles.summaryAmount}>{fmtCurrency(summary?.total_earned ?? 0, currency)}</Text>
          <View style={styles.summaryMeta}>
            <View style={styles.summaryMetaItem}>
              <Ionicons name="receipt-outline" size={14} color="rgba(255, 255, 255,0.5)" />
              <Text style={styles.summaryMetaText}>{summary?.total_orders ?? 0} orders</Text>
            </View>
            {data?.pending_payout != null && data.pending_payout > 0 && (
              <>
                <View style={styles.summaryMetaDivider} />
                <View style={styles.summaryMetaItem}>
                  <Ionicons name="time-outline" size={14} color={C.honey} />
                  <Text style={[styles.summaryMetaText, { color: C.honey }]}>
                    {fmtCurrency(data.pending_payout, currency)} pending
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>}

        {!loading && daily.length > 0 && (
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

        {!loading && summary && (
          <View style={styles.statsGrid}>
            {[
              { label: 'Avg order value', value: fmtCurrency(summary.avg_order_value, currency), icon: 'calculator-outline' },
              { label: 'Platform fees', value: fmtCurrency(summary.platform_fees, currency), icon: 'cut-outline' },
              { label: 'Net payout', value: fmtCurrency(summary.total_earned - summary.platform_fees, currency), icon: 'cash-outline' },
              { label: 'Lifetime earned', value: fmtCurrency(data?.lifetime_earned ?? 0, currency), icon: 'trophy-outline' },
            ].map(s => (
              <View key={s.label} style={styles.statCard}>
                <Ionicons name={s.icon as any} size={17} color={C.spice} />
                <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{s.value}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
            ))}
          </View>
        )}

        {!loading && data?.savings && (
          <View style={styles.savingsCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.savingsLabel}>{data.savings.goal_name ?? 'Savings pot'}</Text>
              <Text style={styles.savingsAmount}>{fmtCurrency(data.savings.balance, data.savings.currency_code)}</Text>
              <Text style={styles.savingsRate}>Auto-saving {data.savings.auto_save_rate}% of each order</Text>
            </View>
            <Ionicons name="wallet-outline" size={28} color={C.ember} />
          </View>
        )}

        {!loading && payouts.length > 0 && (
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

        {!loading && <TouchableOpacity
          style={[styles.withdrawBtn, (!data || data.pending_payout <= 0) && { opacity: 0.5 }]}
          onPress={handlePayout}
          disabled={!data || data.pending_payout <= 0 || requestingPayout}
          activeOpacity={0.85}
        >
          {requestingPayout ? (
            <ActivityIndicator color={C.canvas} />
          ) : (
            <>
              <Ionicons name="arrow-up-circle-outline" size={18} color={C.canvas} />
              <Text style={styles.withdrawText}>
                {data && data.pending_payout > 0
                  ? `Withdraw ${fmtCurrency(data.pending_payout, currency)}`
                  : 'No pending balance'}
              </Text>
            </>
          )}
        </TouchableOpacity>}
      </ScrollView>
    </View>
  );
}

function makeStyles(C: AppColors) { return StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  topBar: { paddingHorizontal: Spacing.lg, paddingTop: 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pageTitle: { fontFamily: Fonts.serif, fontSize: 26, color: C.textInk },

  periodPill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 40, backgroundColor: C.bgCard, borderWidth: 0.5, borderColor: C.borderWarm },
  periodPillActive: { backgroundColor: C.ink, borderColor: 'transparent' },
  periodText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.body },
  periodTextActive: { color: C.canvas },

  summaryCard: { backgroundColor: C.ink, borderRadius: Radius.lg, padding: 20, gap: 6, ...Shadow.lift },
  summaryLabel: { fontFamily: Fonts.sans, fontSize: 13, color: 'rgba(255, 255, 255,0.5)' },
  summaryAmount: { fontFamily: Fonts.serif, fontSize: 34, color: C.ember, letterSpacing: -0.5 },
  summaryMeta: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  summaryMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  summaryMetaDivider: { width: 1, height: 12, backgroundColor: 'rgba(255, 255, 255,0.2)' },
  summaryMetaText: { fontFamily: Fonts.sans, fontSize: 12, color: 'rgba(255, 255, 255,0.6)' },

  sectionLabel: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.caps, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },

  chartCard: { backgroundColor: C.bgCard, borderRadius: Radius.lg, padding: 16, borderWidth: 0.5, borderColor: C.borderWarm, ...Shadow.card },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 120 },
  barCol: { flex: 1, alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' },
  barAmount: { fontFamily: Fonts.sans, fontSize: 9, color: C.bodySoft, textAlign: 'center' },
  barTrack: { flex: 1, width: '80%', backgroundColor: C.bgCook, borderRadius: 4, overflow: 'hidden', justifyContent: 'flex-end' },
  barFill: { width: '100%', backgroundColor: C.spice, borderRadius: 4 },
  barDay: { fontFamily: Fonts.sansMedium, fontSize: 10, color: C.bodySoft },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: { width: '47.5%', backgroundColor: C.bgCard, borderRadius: Radius.md, padding: 14, borderWidth: 0.5, borderColor: C.borderWarm, ...Shadow.card, gap: 4 },
  statValue: { fontFamily: Fonts.serif, fontSize: 18, color: C.textInk },
  statLabel: { fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft },

  savingsCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: C.bgCard, borderRadius: Radius.lg, padding: 16,
    borderWidth: 0.5, borderColor: C.borderWarm, ...Shadow.card,
  },
  savingsLabel: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.textInk, marginBottom: 4 },
  savingsAmount: { fontFamily: Fonts.serif, fontSize: 22, color: C.spice },
  savingsRate: { fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft, marginTop: 4 },

  card: { backgroundColor: C.bgCard, borderRadius: Radius.lg, borderWidth: 0.5, borderColor: C.borderWarm, ...Shadow.card, overflow: 'hidden' },
  divider: { height: 0.5, backgroundColor: C.borderWarm },
  payoutRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 },
  payoutLeft: { gap: 3 },
  payoutId: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.textInk },
  payoutDate: { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft },
  payoutRight: { alignItems: 'flex-end', gap: 4 },
  payoutAmount: { fontFamily: Fonts.serif, fontSize: 16, color: C.spice },
  payoutPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 40 },
  payoutPillPaid: { backgroundColor: C.successBg },
  payoutPillPending: { backgroundColor: C.warnBg },
  payoutPillText: { fontFamily: Fonts.sansMedium, fontSize: 10 },
  payoutPillTextPaid: { color: C.successFg },
  payoutPillTextPending: { color: C.ember },

  withdrawBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.spice, borderRadius: Radius.lg, paddingVertical: 16 },
  withdrawText: { fontFamily: Fonts.sansMedium, fontSize: 15, color: C.canvas },
}); }
