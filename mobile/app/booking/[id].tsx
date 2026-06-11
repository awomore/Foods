import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Share, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { privateChefApi, type PrivateChefBooking } from '../../src/api/privateChef';
import { useFeedback } from '../../src/components/feedback';
import { Bone } from '../../src/components/ui/Skeleton';
import { Fonts, Spacing, Radius, Shadow, FontSize } from '../../src/constants/theme';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { fmtCurrency } from '../../src/utils/format';
import Avatar from '../../src/components/ui/Avatar';

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: string }> = {
  enquiry:      { label: 'Enquiry sent',    color: '#1A3A6C', bgColor: '#EBF0FB', icon: 'mail-outline' },
  quoted:       { label: 'Quote received',  color: '#C97A35', bgColor: '#FDF2E8', icon: 'receipt-outline' },
  deposit_paid: { label: 'Deposit paid',    color: '#2D6A4F', bgColor: '#EBF7F0', icon: 'card-outline' },
  confirmed:    { label: 'Confirmed',       color: '#2D6A4F', bgColor: '#EBF7F0', icon: 'checkmark-circle-outline' },
  completed:    { label: 'Completed',       color: '#5E3A9C', bgColor: '#F3EDF9', icon: 'star-outline' },
  cancelled:    { label: 'Cancelled',       color: '#7A6652', bgColor: '#F5F0EB', icon: 'close-circle-outline' },
};

function StatusBadge({ status, C }: { status: string; C: any }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.enquiry;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: cfg.bgColor, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'flex-start' }}>
      <Ionicons name={cfg.icon as any} size={14} color={cfg.color} />
      <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 12, color: cfg.color }}>{cfg.label}</Text>
    </View>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  const C = useColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 10 }}>
      <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#FDF2E8', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
        <Ionicons name={icon as any} size={16} color={C.spice} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 }}>{label}</Text>
        <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 14, color: C.ink }}>{value}</Text>
      </View>
    </View>
  );
}

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const feedback = useFeedback();

  const [booking, setBooking] = useState<PrivateChefBooking | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await privateChefApi.get(id!);
      setBooking(res.booking);
    } catch {
      feedback.error('Failed to load booking');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleAcceptQuote = async () => {
    if (!booking) return;
    setAccepting(true);
    try {
      const res = await privateChefApi.accept(booking.id);
      setBooking(res.booking);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      feedback.success('Quote accepted', 'The chef will confirm shortly.');
    } catch (e: any) {
      feedback.error('Error', e.error ?? 'Could not accept quote');
    } finally {
      setAccepting(false);
    }
  };

  const handlePayDeposit = () => {
    if (!booking || !booking.deposit_amount) return;
    router.push({
      pathname: '/checkout',
      params: {
        mode: 'booking_deposit',
        booking_id: booking.id,
        amount: booking.deposit_amount,
        title: `Deposit — ${booking.event_type ?? 'Private Chef'}`,
      },
    } as any);
  };

  const handleCallChef = () => {
    feedback.info('Contact details shared after confirmation');
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, padding: Spacing.lg, gap: 14 }}>
          <Bone width="55%" height={22} radius={6} />
          <Bone width="100%" height={100} radius={14} />
          <Bone width="100%" height={80} radius={14} />
          <Bone width="100%" height={56} radius={12} />
          <Bone width="100%" height={56} radius={12} />
        </View>
      </SafeAreaView>
    );
  }

  if (!booking) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.notFoundText}>Booking not found</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.goBackBtn}>
            <Text style={styles.goBackText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const cfg = STATUS_CONFIG[booking.status] ?? STATUS_CONFIG.enquiry;
  const eventDate = booking.event_date
    ? new Date(booking.event_date).toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : '—';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Booking</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 120, gap: Spacing.lg }}>
        {/* Status card */}
        <View style={styles.statusCard}>
          <StatusBadge status={booking.status} C={C} />
          <Text style={styles.bookingRef}>Ref: {booking.id.slice(0, 8).toUpperCase()}</Text>
          <Text style={styles.bookingDate}>
            Submitted {new Date(booking.created_at).toLocaleDateString('en-NG')}
          </Text>
        </View>

        {/* Chef info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Chef</Text>
          <TouchableOpacity
            style={styles.chefRow}
            onPress={() => router.push(`/cook/${booking.cook_id}` as any)}
          >
            <Avatar name={booking.cook_name ?? 'Chef'} size={44} />
            <View style={{ flex: 1 }}>
              <Text style={styles.chefName}>{booking.cook_name ?? 'Chef'}</Text>
              <Text style={styles.chefSub}>Tap to view profile</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={C.bodySoft} />
          </TouchableOpacity>
        </View>

        {/* Event details */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Event details</Text>
          <InfoRow icon="calendar-outline"    label="Date"        value={eventDate} />
          <View style={styles.divider} />
          {booking.event_time && <><InfoRow icon="time-outline"      label="Time"        value={booking.event_time} /><View style={styles.divider} /></>}
          <InfoRow icon="people-outline"      label="Guests"      value={`${booking.guest_count} guests`} />
          <View style={styles.divider} />
          <InfoRow icon="location-outline"    label="Venue"       value={booking.venue_address} />
          {booking.event_type && <><View style={styles.divider} /><InfoRow icon="star-outline" label="Event type" value={booking.event_type} /></>}
          {booking.dietary_requirements && <><View style={styles.divider} /><InfoRow icon="leaf-outline" label="Dietary requirements" value={booking.dietary_requirements} /></>}
        </View>

        {/* Notes */}
        {booking.description && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Your notes</Text>
            <Text style={styles.noteText}>{booking.description}</Text>
          </View>
        )}

        {/* Quote */}
        {booking.quote_amount != null && (
          <View style={styles.quoteCard}>
            <View style={styles.quoteHeader}>
              <Ionicons name="receipt-outline" size={18} color={C.spice} />
              <Text style={styles.quoteTitle}>Chef's Quote</Text>
            </View>
            <Text style={styles.quoteAmount}>{fmtCurrency(booking.quote_amount, 'NGN')}</Text>
            {booking.quote_message && (
              <Text style={styles.quoteMessage}>"{booking.quote_message}"</Text>
            )}
            {booking.deposit_amount && (
              <View style={styles.quoteBreakdown}>
                <View style={styles.quoteRow}>
                  <Text style={styles.quoteRowLabel}>Deposit required</Text>
                  <Text style={styles.quoteRowValue}>{fmtCurrency(booking.deposit_amount, 'NGN')}</Text>
                </View>
                {booking.balance_amount && (
                  <View style={styles.quoteRow}>
                    <Text style={styles.quoteRowLabel}>Balance on the day</Text>
                    <Text style={styles.quoteRowValue}>{fmtCurrency(booking.balance_amount, 'NGN')}</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* Timeline */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>What happens next</Text>
          {[
            { step: 'Enquiry sent',       done: true },
            { step: 'Chef sends quote',   done: !!booking.quote_amount },
            { step: 'You accept quote',   done: ['deposit_paid','confirmed','completed'].includes(booking.status) },
            { step: 'Pay deposit',        done: ['deposit_paid','confirmed','completed'].includes(booking.status) },
            { step: 'Event day',          done: booking.status === 'completed' },
          ].map((item, i) => (
            <View key={i} style={styles.timelineRow}>
              <View style={[styles.timelineDot, item.done && styles.timelineDotDone]}>
                {item.done && <Ionicons name="checkmark" size={12} color={C.canvas} />}
              </View>
              <Text style={[styles.timelineText, item.done && styles.timelineTextDone]}>{item.step}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Sticky action bar */}
      {(booking.status === 'quoted' || booking.status === 'deposit_paid') && (
        <View style={styles.footer}>
          {booking.status === 'quoted' && (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={styles.declineBtn}>
                <Text style={styles.declineBtnText}>Decline</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.acceptBtn, accepting && { opacity: 0.6 }]}
                onPress={handleAcceptQuote}
                disabled={accepting}
              >
                {accepting ? <ActivityIndicator color={C.canvas} size="small" /> : (
                  <Text style={styles.acceptBtnText}>Accept Quote</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
          {booking.status === 'deposit_paid' && booking.deposit_amount && (
            <TouchableOpacity style={styles.depositBtn} onPress={handlePayDeposit}>
              <Ionicons name="card-outline" size={18} color={C.canvas} />
              <Text style={styles.depositBtnText}>Pay Deposit · {fmtCurrency(booking.deposit_amount, 'NGN')}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
    notFoundText: { fontFamily: Fonts.sans, fontSize: FontSize.lg, color: C.body },
    goBackBtn: { backgroundColor: C.spice, borderRadius: Radius.full, paddingHorizontal: 20, paddingVertical: 10 },
    goBackText: { fontFamily: Fonts.sansMedium, fontSize: FontSize.body, color: C.canvas },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: C.borderWarm },
    headerBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.bgCard, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontFamily: Fonts.serif, fontSize: 18, color: C.ink },
    statusCard: { backgroundColor: C.bgCard, borderRadius: Radius.lg, padding: Spacing.md, ...Shadow.card, gap: 8 },
    bookingRef: { fontFamily: Fonts.sansMedium, fontSize: FontSize.sm, color: C.bodySoft },
    bookingDate: { fontFamily: Fonts.sans, fontSize: FontSize.xs, color: C.bodySoft },
    card: { backgroundColor: C.bgCard, borderRadius: Radius.lg, padding: Spacing.md, ...Shadow.card },
    cardTitle: { fontFamily: Fonts.sansMedium, fontSize: FontSize.body, color: C.ink, marginBottom: 10 },
    chefRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    chefName: { fontFamily: Fonts.sansMedium, fontSize: FontSize.body, color: C.ink },
    chefSub: { fontFamily: Fonts.sans, fontSize: FontSize.xs, color: C.bodySoft },
    divider: { height: 0.5, backgroundColor: C.borderWarm },
    noteText: { fontFamily: Fonts.sans, fontSize: FontSize.body, color: C.body, lineHeight: 22 },
    quoteCard: { backgroundColor: C.honey, borderRadius: Radius.lg, padding: Spacing.md, gap: 10 },
    quoteHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    quoteTitle: { fontFamily: Fonts.sansMedium, fontSize: FontSize.body, color: C.spice },
    quoteAmount: { fontFamily: Fonts.serif, fontSize: 32, color: C.ink },
    quoteMessage: { fontFamily: Fonts.sans, fontSize: FontSize.body, color: C.body, fontStyle: 'italic', lineHeight: 22 },
    quoteBreakdown: { backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: Radius.md, padding: 12, gap: 8 },
    quoteRow: { flexDirection: 'row', justifyContent: 'space-between' },
    quoteRowLabel: { fontFamily: Fonts.sans, fontSize: FontSize.sm, color: C.body },
    quoteRowValue: { fontFamily: Fonts.sansMedium, fontSize: FontSize.sm, color: C.ink },
    timelineRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
    timelineDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: C.bgCook, borderWidth: 1.5, borderColor: C.borderWarm, alignItems: 'center', justifyContent: 'center' },
    timelineDotDone: { backgroundColor: C.leaf, borderColor: C.leaf },
    timelineText: { fontFamily: Fonts.sans, fontSize: FontSize.body, color: C.bodySoft },
    timelineTextDone: { color: C.ink, fontFamily: Fonts.sansMedium },
    footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.bg, borderTopWidth: 0.5, borderTopColor: C.borderWarm, padding: Spacing.lg, paddingBottom: 34 },
    declineBtn: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: Radius.lg, borderWidth: 1.5, borderColor: C.borderWarm },
    declineBtnText: { fontFamily: Fonts.sansMedium, fontSize: FontSize.body, color: C.bodySoft },
    acceptBtn: { flex: 2, alignItems: 'center', paddingVertical: 14, borderRadius: Radius.lg, backgroundColor: C.leaf },
    acceptBtnText: { fontFamily: Fonts.sansMedium, fontSize: FontSize.body, color: C.canvas },
    depositBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: C.spice, borderRadius: Radius.lg, paddingVertical: 16 },
    depositBtnText: { fontFamily: Fonts.sansMedium, fontSize: FontSize.body, color: C.canvas },
  });
}
