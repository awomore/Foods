import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { privateChefApi, type PrivateChefBooking } from '../../src/api/privateChef';
import { paymentsApi } from '../../src/api/payments';
import { Fonts, Spacing, Radius, Shadow } from '../../src/constants/theme';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { useFeedback } from '../../src/components/feedback';
import { Bone } from '../../src/components/ui/Skeleton';
import { useCurrency } from '../../src/hooks/useCurrency';
import { useTranslation } from 'react-i18next';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
}

function BookingCard({ booking, onDepositPaid }: { booking: PrivateChefBooking; onDepositPaid: (updated: PrivateChefBooking) => void }) {
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const { fmt } = useCurrency();
  const { t } = useTranslation();
  const STATUS_CONFIG = useMemo(() => ({
    enquiry:      { label: t('bookings.awaiting'),  bg: C.warnBg,    fg: C.warnFg },
    quoted:       { label: t('bookings.received'),  bg: C.infoBg,    fg: C.infoFg },
    deposit_paid: { label: t('bookings.paid'),    bg: C.successBg, fg: C.successFg },
    confirmed:    { label: t('bookings.confirmed'),       bg: C.successBg, fg: C.successFg },
    completed:    { label: t('bookings.completed'),    bg: C.cream,     fg: C.bodySoft },
    cancelled:    { label: t('bookings.cancelled'),    bg: C.errorBg,   fg: C.errorFg },
  }), [C, t]);

  const cfg = (STATUS_CONFIG as any)[booking.status] ?? { label: booking.status, bg: C.cream, fg: C.bodySoft };
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [txRef, setTxRef] = useState<string | null>(null);
  const feedback = useFeedback();
  const [paying, setPaying] = useState(false);

  async function handlePayDeposit() {
    if (!booking.deposit_amount) return;
    setPaying(true);
    try {
      const result = await paymentsApi.initiate({
        amount: booking.deposit_amount,
        redirect_url: 'foodsbyme://payment-complete',
        meta: { booking_id: booking.id, type: 'chef_deposit' },
      });
      setTxRef(result.tx_ref);
      if (result.dev_mode) {
        const { booking: updated } = await privateChefApi.depositPaid(booking.id, { tx_ref: result.tx_ref });
        onDepositPaid(updated);
        feedback.success(t('bookings.deposit_paid_title'), t('bookings.deposit_paid'));
      } else if (result.payment_link) {
        setPaymentUrl(result.payment_link);
      }
    } catch (e: any) {
      feedback.error(t('common.error'), e.message ?? t('bookings.payment_error'));
    } finally {
      setPaying(false);
    }
  }

  async function handleWebViewNavChange(url: string) {
    if (url.includes('payment-complete') || url.includes('foodsbyme://')) {
      setPaymentUrl(null);
      if (txRef) {
        try {
          const { booking: updated } = await privateChefApi.depositPaid(booking.id, { tx_ref: txRef });
          onDepositPaid(updated);
          feedback.success(t('bookings.deposit_paid_title'), t('bookings.deposit_paid'));
        } catch {}
      }
    }
  }

  return (
    <>
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cookName}>{booking.cook_name ?? t('bookings.private_chef')}</Text>
          <Text style={styles.eventMeta}>
            {booking.event_type ?? t('bookings.event')} · {fmtDate(booking.event_date)} · {t('bookings.guests_count', { count: booking.guest_count })}
          </Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: cfg.bg }]}>
          <Text style={[styles.statusText, { color: cfg.fg }]}>{cfg.label}</Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.infoRow}>
        <Ionicons name="location-outline" size={14} color={C.bodySoft} />
        <Text style={styles.infoText} numberOfLines={1}>{booking.venue_address}</Text>
      </View>

      {booking.status === 'quoted' && booking.quote_amount && (
        <View style={styles.quoteBox}>
          <View style={{ flex: 1 }}>
            <Text style={styles.quoteLabel}>{t('bookings.received')}</Text>
            <Text style={styles.quoteAmount}>{fmt(booking.quote_amount)}</Text>
            {booking.deposit_amount != null && booking.deposit_amount > 0 && (
              <Text style={styles.quoteSplit}>
                {t('bookings.deposit_label')} {fmt(booking.deposit_amount)} · {t('bookings.balance')} {fmt(booking.balance_amount ?? 0)}
              </Text>
            )}
            {booking.quote_message && (
              <Text style={styles.quoteMsg} numberOfLines={2}>{booking.quote_message}</Text>
            )}
          </View>
          <TouchableOpacity style={[styles.acceptBtn, paying && { opacity: 0.6 }]} activeOpacity={0.85} onPress={handlePayDeposit} disabled={paying}>
            {paying
              ? <ActivityIndicator color={C.canvas} size="small" />
              : <>
                  <Text style={styles.acceptText}>{t('bookings.pay_deposit')}</Text>
                  <Ionicons name="arrow-forward" size={14} color={C.canvas} />
                </>}
          </TouchableOpacity>
        </View>
      )}
    </View>

      {paymentUrl && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setPaymentUrl(null)}>
          <View style={{ flex: 1, backgroundColor: C.bg }}>
            <SafeAreaView style={{ flex: 1 }}>
              <TouchableOpacity style={styles.webviewClose} onPress={() => setPaymentUrl(null)}>
                <Ionicons name="close" size={22} color={C.textInk} />
              </TouchableOpacity>
              <WebView
                source={{ uri: paymentUrl }}
                onNavigationStateChange={e => handleWebViewNavChange(e.url)}
                style={{ flex: 1 }}
              />
            </SafeAreaView>
          </View>
        </Modal>
      )}
    </>
  );
}

export default function BookingsScreen() {
  const router = useRouter();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const { t } = useTranslation();
  const [bookings, setBookings] = useState<PrivateChefBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { bookings: data } = await privateChefApi.list();
      setBookings(data ?? []);
    } catch {
      setBookings([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <View style={styles.root}>
        <SafeAreaView style={{ flex: 1, padding: Spacing.lg, gap: 12 }}>
          <Bone width="50%" height={22} radius={6} />
          <Bone width="100%" height={120} radius={14} />
          <Bone width="100%" height={120} radius={14} />
          <Bone width="100%" height={120} radius={14} />
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <SafeAreaView>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={C.textInk} />
          </TouchableOpacity>
          <Text style={styles.pageTitle}>{t('bookings.title')}</Text>
        </View>
      </SafeAreaView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: Spacing.lg, gap: 14, paddingTop: 8 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={C.spice} />
        }
      >
        {/* Explore section — always visible */}
        <View style={styles.exploreBanner}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.exploreTitle}>{t('bookings.hire')}</Text>
            <Text style={styles.exploreSub}>
              {t('bookings.hire_sub')}
            </Text>
          </View>
          <TouchableOpacity style={styles.exploreBtn} onPress={() => router.push('/(customer)/discover' as any)} activeOpacity={0.85}>
            <Ionicons name="search-outline" size={16} color={C.canvas} />
            <Text style={styles.exploreBtnText}>{t('bookings.browse')}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.howRow}>
          {[
            { icon: 'search-outline',      label: t('bookings.find'), desc: t('bookings.find_desc') },
            { icon: 'chatbubble-outline',   label: t('bookings.quote'), desc: t('bookings.quote_desc') },
            { icon: 'card-outline',         label: t('bookings.deposit'), desc: t('bookings.deposit_desc') },
          ].map((step, i) => (
            <View key={i} style={styles.howStep}>
              <View style={[styles.howIcon, { backgroundColor: C.bgCook }]}>
                <Ionicons name={step.icon as any} size={16} color={C.spice} />
              </View>
              <Text style={styles.howLabel}>{step.label}</Text>
              <Text style={styles.howDesc}>{step.desc}</Text>
            </View>
          ))}
        </View>

        {bookings.length > 0 && (
          <Text style={styles.myBookingsLabel}>{t('bookings.my_bookings')}</Text>
        )}

        {bookings.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={36} color={C.stone} />
            <Text style={styles.emptyTitle}>{t('bookings.no_bookings')}</Text>
            <Text style={styles.emptySub}>{t('bookings.no_bookings_body')}</Text>
            <TouchableOpacity onPress={() => router.push('/search' as any)} style={styles.emptyBtn}>
              <Text style={styles.emptyBtnText}>{t('bookings.find_chef')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          bookings.map(b => (
            <BookingCard
              key={b.id}
              booking={b}
              onDepositPaid={updated => setBookings(prev => prev.map(x => x.id === updated.id ? updated : x))}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

function makeStyles(C: AppColors) { return StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingTop: 8, paddingBottom: 12, gap: 12 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.bgCook, alignItems: 'center', justifyContent: 'center' },
  pageTitle: { fontFamily: Fonts.serif, fontSize: 22, color: C.textInk },

  card: { backgroundColor: C.bgCard, borderRadius: Radius.lg, borderWidth: 0.5, borderColor: C.borderWarm, ...Shadow.card, padding: 14, gap: 10 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cookName: { fontFamily: Fonts.sansMedium, fontSize: 15, color: C.textInk },
  eventMeta: { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft, marginTop: 3 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 40 },
  statusText: { fontFamily: Fonts.sansMedium, fontSize: 11 },
  divider: { height: 0.5, backgroundColor: C.borderWarm },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoText: { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft, flex: 1 },

  quoteBox: {
    backgroundColor: C.infoBg, borderRadius: Radius.md, padding: 12, gap: 10,
    flexDirection: 'row', alignItems: 'flex-end',
  },
  quoteLabel: { fontFamily: Fonts.sans, fontSize: 11, color: C.infoFg, marginBottom: 2 },
  quoteAmount: { fontFamily: Fonts.serif, fontSize: 22, color: C.textInk },
  quoteSplit: { fontFamily: Fonts.sans, fontSize: 11, color: C.infoFg, marginTop: 3 },
  quoteMsg: { fontFamily: Fonts.sans, fontSize: 12, color: C.body, marginTop: 6, lineHeight: 18, fontStyle: 'italic' },
  acceptBtn: {
    backgroundColor: C.spice, borderRadius: Radius.md,
    paddingHorizontal: 14, paddingVertical: 10,
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  acceptText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.canvas },

  webviewClose: { padding: 14 },
  exploreBanner: { backgroundColor: C.ink, borderRadius: Radius.lg, padding: 16, gap: 14 },
  exploreTitle: { fontFamily: Fonts.serif, fontSize: 18, color: C.canvas },
  exploreSub: { fontFamily: Fonts.sans, fontSize: 13, color: 'rgba(255, 255, 255,0.6)', lineHeight: 18 },
  exploreBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.spice,
    borderRadius: Radius.md, paddingHorizontal: 16, paddingVertical: 11, alignSelf: 'flex-start' },
  exploreBtnText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.canvas },

  howRow: { flexDirection: 'row', gap: 8 },
  howStep: { flex: 1, gap: 6, backgroundColor: C.bgCard, borderRadius: Radius.md,
    padding: 12, borderWidth: 0.5, borderColor: C.borderWarm, alignItems: 'center' },
  howIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  howLabel: { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.textInk, textAlign: 'center' },
  howDesc: { fontFamily: Fonts.sans, fontSize: 10, color: C.bodySoft, textAlign: 'center', lineHeight: 14 },

  myBookingsLabel: { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.caps,
    textTransform: 'uppercase', letterSpacing: 0.5 },

  emptyState: { alignItems: 'center', paddingTop: 24, gap: 10, paddingHorizontal: Spacing.lg },
  emptyTitle: { fontFamily: Fonts.sansMedium, fontSize: 15, color: C.textInk },
  emptySub: { fontFamily: Fonts.sans, fontSize: 13, color: C.bodySoft, textAlign: 'center', lineHeight: 20 },
  emptyBtn: { marginTop: 6, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 40, backgroundColor: C.spice },
  emptyBtnText: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.canvas },
}); }
