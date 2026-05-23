import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView,
  ActivityIndicator, RefreshControl, Alert, TextInput, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { privateChefApi, type PrivateChefBooking } from '../../src/api/privateChef';
import { customRequestsApi, type CustomRequest } from '../../src/api/customRequests';
import { bulkRequestsApi, type BulkRequest } from '../../src/api/bulkRequests';
import { Colors, Fonts, Spacing, Radius, Shadow } from '../../src/constants/theme';

type Tab = 'Private Chef' | 'Custom' | 'Bulk';
const TABS: Tab[] = ['Private Chef', 'Custom', 'Bulk'];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
}

function nairaFmt(n: number) {
  return '₦' + n.toLocaleString('en-NG', { maximumFractionDigits: 0 });
}

const STATUS_CFG: Record<string, { label: string; bg: string; fg: string }> = {
  enquiry:  { label: 'New enquiry', bg: Colors.warnBg,    fg: Colors.warnFg },
  pending:  { label: 'New request', bg: Colors.warnBg,    fg: Colors.warnFg },
  quoted:   { label: 'Quoted',      bg: Colors.infoBg,    fg: Colors.infoFg },
  accepted: { label: 'Accepted',    bg: Colors.successBg, fg: Colors.successFg },
  declined: { label: 'Declined',    bg: Colors.errorBg,   fg: Colors.errorFg },
  deposit_paid: { label: 'Deposit paid', bg: Colors.successBg, fg: Colors.successFg },
  confirmed:    { label: 'Confirmed',    bg: Colors.successBg, fg: Colors.successFg },
  completed:    { label: 'Completed',    bg: Colors.cream,      fg: Colors.bodySoft },
  cancelled:    { label: 'Cancelled',    bg: Colors.errorBg,    fg: Colors.errorFg },
};

function StatusPill({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? { label: status, bg: Colors.cream, fg: Colors.bodySoft };
  return (
    <View style={[styles.statusPill, { backgroundColor: cfg.bg }]}>
      <Text style={[styles.statusText, { color: cfg.fg }]}>{cfg.label}</Text>
    </View>
  );
}

function QuoteModal({
  visible, onClose, onSubmit, title,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (amount: number, message: string, deposit?: number) => void;
  title: string;
}) {
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [deposit, setDeposit] = useState('50');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    const amountNum = parseFloat(amount.replace(/,/g, ''));
    if (!amountNum || amountNum <= 0) { Alert.alert('Error', 'Enter a valid amount'); return; }
    setSubmitting(true);
    try { await onSubmit(amountNum, message, parseFloat(deposit) || 50); }
    finally { setSubmitting(false); }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Send quote for {title}</Text>

          <Text style={styles.inputLabel}>Quote amount (₦)</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            placeholder="e.g. 150000"
            value={amount}
            onChangeText={setAmount}
            placeholderTextColor={Colors.stone}
          />

          <Text style={styles.inputLabel}>Deposit % (default 50%)</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            placeholder="50"
            value={deposit}
            onChangeText={setDeposit}
            placeholderTextColor={Colors.stone}
          />

          <Text style={styles.inputLabel}>Message to customer (optional)</Text>
          <TextInput
            style={[styles.input, styles.inputMulti]}
            multiline
            placeholder="Include what's covered, timing, requirements…"
            value={message}
            onChangeText={setMessage}
            placeholderTextColor={Colors.stone}
          />

          <TouchableOpacity style={[styles.submitBtn, submitting && { opacity: 0.6 }]} onPress={handleSubmit} disabled={submitting}>
            {submitting
              ? <ActivityIndicator color={Colors.canvas} />
              : <Text style={styles.submitText}>Send quote</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function EnquiriesScreen() {
  const [tab, setTab] = useState<Tab>('Private Chef');
  const [chefBookings, setChefBookings] = useState<PrivateChefBooking[]>([]);
  const [customReqs, setCustomReqs] = useState<CustomRequest[]>([]);
  const [bulkReqs, setBulkReqs] = useState<BulkRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [quoteTarget, setQuoteTarget] = useState<{ type: Tab; id: string; title: string } | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [chef, custom, bulk] = await Promise.all([
        privateChefApi.list(),
        customRequestsApi.list(),
        bulkRequestsApi.list(),
      ]);
      setChefBookings(chef.bookings ?? []);
      setCustomReqs(custom.requests ?? []);
      setBulkReqs(bulk.requests ?? []);
    } catch (e) {
      console.error('enquiries load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleQuoteSubmit(amount: number, message: string, deposit?: number) {
    if (!quoteTarget) return;
    try {
      if (quoteTarget.type === 'Private Chef') {
        const depositAmt = Math.round(amount * (deposit ?? 50) / 100);
        const { booking } = await privateChefApi.quote(quoteTarget.id, {
          quote_amount: amount, quote_message: message, deposit_amount: depositAmt,
        });
        setChefBookings(prev => prev.map(b => b.id === booking.id ? booking : b));
      } else if (quoteTarget.type === 'Custom') {
        const { request } = await customRequestsApi.quote(quoteTarget.id, { quote_amount: amount, quote_message: message });
        setCustomReqs(prev => prev.map(r => r.id === request.id ? request : r));
      } else {
        const { request } = await bulkRequestsApi.quote(quoteTarget.id, {
          quote_amount: amount, quote_message: message, deposit_percentage: deposit,
        });
        setBulkReqs(prev => prev.map(r => r.id === request.id ? request : r));
      }
      setQuoteTarget(null);
      Alert.alert('Quote sent', 'The customer has been notified.');
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Could not send quote');
    }
  }

  if (loading) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={Colors.spice} />
      </View>
    );
  }

  const newChef = chefBookings.filter(b => b.status === 'enquiry').length;
  const newCustom = customReqs.filter(r => r.status === 'pending').length;
  const newBulk = bulkReqs.filter(r => r.status === 'pending').length;
  const totalNew = newChef + newCustom + newBulk;

  return (
    <View style={styles.root}>
      <SafeAreaView>
        <View style={styles.topBar}>
          <Text style={styles.pageTitle}>Enquiries</Text>
          {totalNew > 0 && (
            <View style={styles.countPill}>
              <Text style={styles.countText}>{totalNew} new</Text>
            </View>
          )}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
          {TABS.map(t => {
            const count = t === 'Private Chef' ? newChef : t === 'Custom' ? newCustom : newBulk;
            return (
              <TouchableOpacity key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabActive]}>
                <Text style={[styles.tabLabel, tab === t && styles.tabLabelActive]}>
                  {t}{count > 0 ? ` (${count})` : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </SafeAreaView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: Spacing.lg, gap: 12, paddingTop: 12 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={Colors.spice} />
        }
      >
        {tab === 'Private Chef' && (
          chefBookings.length === 0 ? <EmptyState type="private chef bookings" /> :
          chefBookings.map(b => (
            <View key={b.id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.customerName}>{b.customer_name ?? 'Customer'}</Text>
                  <Text style={styles.meta}>{b.event_type ?? 'Event'} · {fmtDate(b.event_date)} · {b.guest_count} guests</Text>
                </View>
                <StatusPill status={b.status} />
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="location-outline" size={13} color={Colors.bodySoft} />
                <Text style={styles.infoText} numberOfLines={1}>{b.venue_address}</Text>
              </View>
              {b.description ? (
                <Text style={styles.description} numberOfLines={3}>{b.description}</Text>
              ) : null}
              {b.dietary_requirements ? (
                <View style={styles.dietPill}>
                  <Ionicons name="leaf-outline" size={12} color={Colors.healthFg} />
                  <Text style={styles.dietText}>{b.dietary_requirements}</Text>
                </View>
              ) : null}
              {b.status === 'enquiry' && (
                <TouchableOpacity
                  style={styles.quoteBtn}
                  onPress={() => setQuoteTarget({ type: 'Private Chef', id: b.id, title: `${b.event_type ?? 'event'} for ${b.customer_name ?? 'customer'}` })}
                >
                  <Text style={styles.quoteBtnText}>Send quote</Text>
                  <Ionicons name="arrow-forward" size={14} color={Colors.canvas} />
                </TouchableOpacity>
              )}
              {b.status === 'quoted' && b.quote_amount && (
                <View style={styles.quotedBanner}>
                  <Ionicons name="checkmark-circle-outline" size={15} color={Colors.successFg} />
                  <Text style={styles.quotedText}>Quoted {nairaFmt(b.quote_amount)} · Awaiting customer</Text>
                </View>
              )}
            </View>
          ))
        )}

        {tab === 'Custom' && (
          customReqs.length === 0 ? <EmptyState type="custom requests" /> :
          customReqs.map(r => (
            <View key={r.id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.customerName}>{r.customer_name ?? 'Customer'}</Text>
                  {r.preferred_date && <Text style={styles.meta}>For {fmtDate(r.preferred_date)}{r.serving_count ? ` · ${r.serving_count} servings` : ''}</Text>}
                </View>
                <StatusPill status={r.status} />
              </View>
              <Text style={styles.description} numberOfLines={4}>{r.description}</Text>
              {r.budget_range && (
                <View style={styles.budgetPill}>
                  <Ionicons name="cash-outline" size={12} color={Colors.spice} />
                  <Text style={styles.budgetText}>Budget: {r.budget_range}</Text>
                </View>
              )}
              {r.status === 'pending' && (
                <TouchableOpacity
                  style={styles.quoteBtn}
                  onPress={() => setQuoteTarget({ type: 'Custom', id: r.id, title: `${r.customer_name ?? 'customer'}'s custom request` })}
                >
                  <Text style={styles.quoteBtnText}>Send quote</Text>
                  <Ionicons name="arrow-forward" size={14} color={Colors.canvas} />
                </TouchableOpacity>
              )}
              {r.status === 'quoted' && r.quote_amount && (
                <View style={styles.quotedBanner}>
                  <Ionicons name="checkmark-circle-outline" size={15} color={Colors.successFg} />
                  <Text style={styles.quotedText}>Quoted {nairaFmt(r.quote_amount)} · Awaiting customer</Text>
                </View>
              )}
            </View>
          ))
        )}

        {tab === 'Bulk' && (
          bulkReqs.length === 0 ? <EmptyState type="bulk orders" /> :
          bulkReqs.map(r => (
            <View key={r.id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.customerName}>{r.customer_name ?? 'Customer'}</Text>
                  <Text style={styles.meta}>{fmtDate(r.preferred_date)} · {r.serving_count} servings</Text>
                </View>
                <StatusPill status={r.status} />
              </View>
              <Text style={styles.description} numberOfLines={4}>{r.description}</Text>
              {r.delivery_address && (
                <View style={styles.infoRow}>
                  <Ionicons name="location-outline" size={13} color={Colors.bodySoft} />
                  <Text style={styles.infoText} numberOfLines={1}>{r.delivery_address}</Text>
                </View>
              )}
              {r.status === 'pending' && (
                <TouchableOpacity
                  style={styles.quoteBtn}
                  onPress={() => setQuoteTarget({ type: 'Bulk', id: r.id, title: `bulk order for ${r.customer_name ?? 'customer'}` })}
                >
                  <Text style={styles.quoteBtnText}>Send quote</Text>
                  <Ionicons name="arrow-forward" size={14} color={Colors.canvas} />
                </TouchableOpacity>
              )}
              {r.status === 'quoted' && r.quote_amount && (
                <View style={styles.quotedBanner}>
                  <Ionicons name="checkmark-circle-outline" size={15} color={Colors.successFg} />
                  <Text style={styles.quotedText}>Quoted {nairaFmt(r.quote_amount)} · Deposit {r.deposit_percentage}%</Text>
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>

      {quoteTarget && (
        <QuoteModal
          visible
          title={quoteTarget.title}
          onClose={() => setQuoteTarget(null)}
          onSubmit={handleQuoteSubmit}
        />
      )}
    </View>
  );
}

function EmptyState({ type }: { type: string }) {
  return (
    <View style={styles.emptyState}>
      <Ionicons name="mail-outline" size={40} color={Colors.stone} />
      <Text style={styles.emptyText}>No {type} yet</Text>
      <Text style={styles.emptySub}>When customers send you enquiries, they'll appear here.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: Spacing.lg, paddingTop: 16, paddingBottom: 8 },
  pageTitle: { fontFamily: Fonts.serif, fontSize: 26, color: Colors.textInk, flex: 1 },
  countPill: { backgroundColor: Colors.spice, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 40 },
  countText: { fontFamily: Fonts.sansMedium, fontSize: 12, color: Colors.canvas },

  tabRow: { paddingHorizontal: Spacing.lg, gap: 6, paddingBottom: 8 },
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 40, borderWidth: 0.5, borderColor: Colors.borderWarm },
  tabActive: { backgroundColor: Colors.ink, borderColor: Colors.ink },
  tabLabel: { fontFamily: Fonts.sansMedium, fontSize: 13, color: Colors.bodySoft },
  tabLabelActive: { color: Colors.canvas },

  card: { backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: 14, borderWidth: 0.5, borderColor: Colors.borderWarm, ...Shadow.card, gap: 8 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  customerName: { fontFamily: Fonts.sansMedium, fontSize: 15, color: Colors.textInk },
  meta: { fontFamily: Fonts.sans, fontSize: 12, color: Colors.bodySoft, marginTop: 2 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 40 },
  statusText: { fontFamily: Fonts.sansMedium, fontSize: 11 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  infoText: { fontFamily: Fonts.sans, fontSize: 12, color: Colors.bodySoft, flex: 1 },
  description: { fontFamily: Fonts.sans, fontSize: 13, color: Colors.body, lineHeight: 19 },
  dietPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.healthBg, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 40, alignSelf: 'flex-start' },
  dietText: { fontFamily: Fonts.sans, fontSize: 11, color: Colors.healthFg },
  budgetPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.cream, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 40, alignSelf: 'flex-start' },
  budgetText: { fontFamily: Fonts.sans, fontSize: 11, color: Colors.bodySoft },

  quoteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.ink, borderRadius: Radius.md, paddingVertical: 11, marginTop: 2 },
  quoteBtnText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: Colors.canvas },
  quotedBanner: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: Colors.successBg, borderRadius: Radius.sm, paddingHorizontal: 12, paddingVertical: 8 },
  quotedText: { fontFamily: Fonts.sans, fontSize: 12, color: Colors.successFg },

  emptyState: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyText: { fontFamily: Fonts.sansMedium, fontSize: 15, color: Colors.textInk },
  emptySub: { fontFamily: Fonts.sans, fontSize: 13, color: Colors.bodySoft, textAlign: 'center', lineHeight: 20 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: Colors.bgCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.lg, gap: 12, paddingBottom: 36 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.borderWarm, alignSelf: 'center', marginBottom: 4 },
  modalTitle: { fontFamily: Fonts.serif, fontSize: 18, color: Colors.textInk },
  inputLabel: { fontFamily: Fonts.sansMedium, fontSize: 12, color: Colors.caps, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: Colors.bg, borderRadius: Radius.md, borderWidth: 0.5, borderColor: Colors.borderWarm, paddingHorizontal: 14, paddingVertical: 12, fontFamily: Fonts.sans, fontSize: 14, color: Colors.textInk },
  inputMulti: { minHeight: 80, textAlignVertical: 'top' },
  submitBtn: { backgroundColor: Colors.spice, borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center' },
  submitText: { fontFamily: Fonts.sansMedium, fontSize: 15, color: Colors.canvas },
  cancelBtn: { alignItems: 'center', paddingVertical: 10 },
  cancelText: { fontFamily: Fonts.sans, fontSize: 14, color: Colors.bodySoft },
});
