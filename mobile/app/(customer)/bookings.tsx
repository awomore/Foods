import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { privateChefApi, type PrivateChefBooking } from '../../src/api/privateChef';
import { Colors, Fonts, Spacing, Radius, Shadow } from '../../src/constants/theme';

const STATUS_CONFIG: Record<string, { label: string; bg: string; fg: string }> = {
  enquiry:      { label: 'Awaiting quote',  bg: Colors.warnBg,    fg: Colors.warnFg },
  quoted:       { label: 'Quote received',  bg: Colors.infoBg,    fg: Colors.infoFg },
  deposit_paid: { label: 'Deposit paid',    bg: Colors.successBg, fg: Colors.successFg },
  confirmed:    { label: 'Confirmed',       bg: Colors.successBg, fg: Colors.successFg },
  completed:    { label: 'Completed',       bg: Colors.cream,     fg: Colors.bodySoft },
  cancelled:    { label: 'Cancelled',       bg: Colors.errorBg,   fg: Colors.errorFg },
};

function nairaFmt(n: number) {
  return '₦' + n.toLocaleString('en-NG', { maximumFractionDigits: 0 });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
}

function BookingCard({ booking }: { booking: PrivateChefBooking }) {
  const cfg = STATUS_CONFIG[booking.status] ?? { label: booking.status, bg: Colors.cream, fg: Colors.bodySoft };

  return (
    <View style={styles.card}>
      {/* Header row */}
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cookName}>{booking.cook_name ?? 'Private chef'}</Text>
          <Text style={styles.eventMeta}>
            {booking.event_type ?? 'Event'} · {fmtDate(booking.event_date)} · {booking.guest_count} guests
          </Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: cfg.bg }]}>
          <Text style={[styles.statusText, { color: cfg.fg }]}>{cfg.label}</Text>
        </View>
      </View>

      <View style={styles.divider} />

      {/* Venue */}
      <View style={styles.infoRow}>
        <Ionicons name="location-outline" size={14} color={Colors.bodySoft} />
        <Text style={styles.infoText} numberOfLines={1}>{booking.venue_address}</Text>
      </View>

      {/* Quote section */}
      {booking.status === 'quoted' && booking.quote_amount && (
        <View style={styles.quoteBox}>
          <View style={{ flex: 1 }}>
            <Text style={styles.quoteLabel}>Quote received</Text>
            <Text style={styles.quoteAmount}>{nairaFmt(booking.quote_amount)}</Text>
            {booking.deposit_amount != null && booking.deposit_amount > 0 && (
              <Text style={styles.quoteSplit}>
                Deposit: {nairaFmt(booking.deposit_amount)} · Balance: {nairaFmt(booking.balance_amount ?? 0)}
              </Text>
            )}
            {booking.quote_message && (
              <Text style={styles.quoteMsg} numberOfLines={2}>{booking.quote_message}</Text>
            )}
          </View>
          <TouchableOpacity style={styles.acceptBtn} activeOpacity={0.85}>
            <Text style={styles.acceptText}>Pay deposit</Text>
            <Ionicons name="arrow-forward" size={14} color={Colors.canvas} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

export default function BookingsScreen() {
  const router = useRouter();
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
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={Colors.spice} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <SafeAreaView>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={Colors.textInk} />
          </TouchableOpacity>
          <Text style={styles.pageTitle}>Event bookings</Text>
        </View>
      </SafeAreaView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: Spacing.lg, gap: 14, paddingTop: 8 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={Colors.spice} />
        }
      >
        {bookings.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={40} color={Colors.stone} />
            <Text style={styles.emptyTitle}>No event bookings yet</Text>
            <Text style={styles.emptySub}>
              Visit a cook's profile and tap "Hire for an event" to send an enquiry.
            </Text>
          </View>
        ) : (
          bookings.map(b => <BookingCard key={b.id} booking={b} />)
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingTop: 8, paddingBottom: 12, gap: 12 },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.bgCook, alignItems: 'center', justifyContent: 'center' },
  pageTitle: { fontFamily: Fonts.serif, fontSize: 22, color: Colors.textInk },

  card: { backgroundColor: Colors.bgCard, borderRadius: Radius.lg, borderWidth: 0.5, borderColor: Colors.borderWarm, ...Shadow.card, padding: 14, gap: 10 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cookName: { fontFamily: Fonts.sansMedium, fontSize: 15, color: Colors.textInk, fontWeight: '600' },
  eventMeta: { fontFamily: Fonts.sans, fontSize: 12, color: Colors.bodySoft, marginTop: 3 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 40 },
  statusText: { fontFamily: Fonts.sansMedium, fontSize: 11, fontWeight: '600' },
  divider: { height: 0.5, backgroundColor: Colors.borderWarm },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoText: { fontFamily: Fonts.sans, fontSize: 12, color: Colors.bodySoft, flex: 1 },

  quoteBox: {
    backgroundColor: Colors.infoBg, borderRadius: Radius.md, padding: 12, gap: 10,
    flexDirection: 'row', alignItems: 'flex-end',
  },
  quoteLabel: { fontFamily: Fonts.sans, fontSize: 11, color: Colors.infoFg, marginBottom: 2 },
  quoteAmount: { fontFamily: Fonts.serif, fontSize: 22, color: Colors.textInk },
  quoteSplit: { fontFamily: Fonts.sans, fontSize: 11, color: Colors.infoFg, marginTop: 3 },
  quoteMsg: { fontFamily: Fonts.sans, fontSize: 12, color: Colors.body, marginTop: 6, lineHeight: 18, fontStyle: 'italic' },
  acceptBtn: {
    backgroundColor: Colors.spice, borderRadius: Radius.md,
    paddingHorizontal: 14, paddingVertical: 10,
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  acceptText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: Colors.canvas, fontWeight: '600' },

  emptyState: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyTitle: { fontFamily: Fonts.sansMedium, fontSize: 15, color: Colors.textInk },
  emptySub: { fontFamily: Fonts.sans, fontSize: 13, color: Colors.bodySoft, textAlign: 'center', lineHeight: 20 },
});
