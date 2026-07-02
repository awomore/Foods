import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { cateringApi, type CateringEvent, type TimelineItem } from '../../src/api/catering';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { Fonts, Spacing, Radius, Shadow, FontSize } from '../../src/constants/theme';
import { useFeedback } from '../../src/components/feedback';
import { Bone } from '../../src/components/ui/Skeleton';
import { fmtCurrency, relativeTime } from '../../src/utils/format';
import Avatar from '../../src/components/ui/Avatar';
import { useAuth } from '../../src/context/AuthContext';
import { useTranslation } from 'react-i18next';

function useStatusLabels() {
  const { t } = useTranslation();
  return useMemo((): Record<string, { label: string; color: string; bg: string }> => ({
    enquiry:      { label: t('catering.detail.status_enquiry'),      color: '#2A5FBF', bg: '#EBF0FA' },
    quoted:       { label: t('catering.detail.status_quoted'),       color: '#FF6B35', bg: '#FFF1EB' },
    accepted:     { label: t('catering.detail.status_accepted'),     color: '#2E8B3F', bg: '#EBF5EE' },
    deposit_paid: { label: t('catering.detail.status_deposit_paid'), color: '#2E8B3F', bg: '#EBF5EE' },
    in_progress:  { label: t('catering.detail.status_in_progress'),  color: '#2E8B3F', bg: '#EBF5EE' },
    completed:    { label: t('catering.detail.status_completed'),    color: '#6B7280', bg: '#F5F5F5' },
    cancelled:    { label: t('catering.detail.status_cancelled'),    color: '#DC2626', bg: '#FEF2F2' },
    disputed:     { label: t('catering.detail.status_disputed'),     color: '#DC2626', bg: '#FEF2F2' },
  }), [t]);
}

export default function CateringEventScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const feedback = useFeedback();
  const { user } = useAuth();
  const { t } = useTranslation();
  const STATUS_LABELS = useStatusLabels();

  const [event, setEvent] = useState<CateringEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);

  const load = useCallback(async () => {
    try {
      const { event: ev } = await cateringApi.get(id!);
      setEvent(ev);
    } catch {
      feedback.error(t('catering.detail.load_error'));
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleAccept = async () => {
    setAccepting(true);
    try {
      const { event: ev } = await cateringApi.accept(id!);
      setEvent(ev);
      feedback.success(t('catering.detail.accept_success'));
    } catch (err: any) {
      feedback.error(err.error ?? t('catering.detail.accept_error'));
    } finally { setAccepting(false); }
  };

  const handleCancel = async () => {
    feedback.confirm({
      title: t('catering.detail.cancel_title'),
      message: t('catering.detail.cancel_message'),
      confirmLabel: t('catering.detail.cancel_title'),
      onConfirm: async () => {
        try {
          await cateringApi.cancel(id!);
          setEvent(prev => prev ? { ...prev, status: 'cancelled' } : prev);
        } catch { feedback.error(t('catering.detail.cancel_error')); }
      },
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, padding: Spacing.lg, gap: 14 }}>
          <Bone width="55%" height={22} radius={6} />
          <Bone width="100%" height={60} radius={12} />
          <Bone width="100%" height={140} radius={14} />
          <Bone width="100%" height={60} radius={12} />
        </View>
      </SafeAreaView>
    );
  }

  if (!event) {
    return <SafeAreaView style={styles.container}><View style={styles.loadingState}><Text style={styles.errorText}>{t('catering.detail.not_found')}</Text></View></SafeAreaView>;
  }

  const statusInfo = STATUS_LABELS[event.status] ?? STATUS_LABELS.enquiry;
  const isCustomer = event.customer_id === user?.id;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <Text style={styles.title}>{event.event_name ?? t('catering.detail.title_fallback', { type: event.event_type })}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Status badge */}
        <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
          <View style={[styles.statusDot, { backgroundColor: statusInfo.color }]} />
          <Text style={[styles.statusText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
        </View>

        {/* Cook info */}
        {event.cook_name && (
          <View style={styles.cookRow}>
            <Avatar avatarUrl={event.cook_avatar} name={event.cook_name} size={44} />
            <View style={{ flex: 1 }}>
              <Text style={styles.cookName}>{event.cook_name}</Text>
              <Text style={styles.cookLabel}>{t('catering.detail.caterer')}</Text>
            </View>
          </View>
        )}

        {/* Event details */}
        <View style={styles.card}>
          <DetailRow icon="calendar-outline" label={t('catering.detail.date')} value={new Date(event.event_date).toLocaleDateString('en-NG', { dateStyle: 'long' })} C={C} />
          <DetailRow icon="people-outline" label={t('catering.detail.guests')} value={String(event.guest_count)} C={C} />
          <DetailRow icon="location-outline" label={t('catering.detail.venue')} value={event.venue_address} C={C} />
          <DetailRow icon="restaurant-outline" label={t('catering.detail.event_type')} value={event.event_type.replace('_', ' ')} C={C} />
          {event.equipment_needed && <DetailRow icon="construct-outline" label={t('catering.detail.equipment')} value={t('catering.detail.requested')} C={C} />}
          {event.service_staff_needed && <DetailRow icon="people-circle-outline" label={t('catering.detail.service_staff')} value={t('catering.detail.requested')} C={C} />}
        </View>

        {event.menu_description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('catering.detail.menu_description')}</Text>
            <Text style={styles.bodyText}>{event.menu_description}</Text>
          </View>
        )}

        {event.dietary_requirements && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('catering.detail.dietary_requirements')}</Text>
            <Text style={styles.bodyText}>{event.dietary_requirements}</Text>
          </View>
        )}

        {/* Quote section */}
        {event.quote_amount && (
          <View style={styles.quoteCard}>
            <Text style={styles.quoteBanner}>{t('catering.detail.quote_from_chef')}</Text>
            {event.quote_message && <Text style={styles.quoteMessage}>{event.quote_message}</Text>}
            <View style={styles.priceRow}>
              <View style={styles.priceItem}>
                <Text style={styles.priceLabel}>{t('catering.detail.total_quote')}</Text>
                <Text style={styles.priceValue}>{fmtCurrency(event.quote_amount, 'NGN')}</Text>
              </View>
              {event.deposit_amount > 0 && (
                <View style={styles.priceItem}>
                  <Text style={styles.priceLabel}>{t('catering.detail.deposit')}</Text>
                  <Text style={styles.priceValue}>{fmtCurrency(event.deposit_amount, 'NGN')}</Text>
                </View>
              )}
              {event.quote_amount - event.deposit_amount > 0 && (
                <View style={styles.priceItem}>
                  <Text style={styles.priceLabel}>{t('catering.detail.balance_due')}</Text>
                  <Text style={styles.priceValue}>{fmtCurrency(event.quote_amount - event.deposit_amount, 'NGN')}</Text>
                </View>
              )}
            </View>

            {isCustomer && event.status === 'quoted' && (
              <View style={styles.quoteActions}>
                <TouchableOpacity
                  style={[styles.acceptBtn, accepting && styles.btnDisabled]}
                  onPress={handleAccept}
                  disabled={accepting}
                >
                  {accepting ? (
                    <ActivityIndicator size="small" color={C.canvas} />
                  ) : (
                    <Text style={styles.acceptBtnText}>{t('catering.detail.accept_quote')}</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity style={styles.rejectBtn} onPress={handleCancel}>
                  <Text style={styles.rejectBtnText}>{t('catering.detail.decline')}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Timeline */}
        {event.timeline && event.timeline.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('catering.detail.event_timeline')}</Text>
            {event.timeline.map((item: TimelineItem, i: number) => (
              <View key={i} style={styles.timelineItem}>
                <View style={[styles.timelineDot, item.completed && styles.timelineDotDone]} />
                <View style={styles.timelineInfo}>
                  <Text style={styles.timelineLabel}>{item.label}</Text>
                  {item.description && <Text style={styles.timelineDesc}>{item.description}</Text>}
                  {item.scheduled_at && (
                    <Text style={styles.timelineTime}>
                      {new Date(item.scheduled_at).toLocaleTimeString('en-NG', { timeStyle: 'short' })}
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {isCustomer && ['enquiry', 'quoted', 'accepted'].includes(event.status) && (
          <TouchableOpacity style={styles.cancelRow} onPress={handleCancel}>
            <Ionicons name="close-circle-outline" size={16} color={C.errorFg} />
            <Text style={styles.cancelText}>{t('catering.detail.cancel_title')}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Pay deposit CTA */}
      {isCustomer && event.status === 'accepted' && event.deposit_amount > 0 && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.payBtn}
            onPress={() => router.push({ pathname: '/checkout', params: {
              mode: 'catering_deposit', ref: event.id, amount: String(event.deposit_amount),
            } } as any)}
          >
            <Text style={styles.payBtnText}>{t('catering.detail.pay_deposit_amount', { amount: fmtCurrency(event.deposit_amount, 'NGN') })}</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

function DetailRow({ icon, label, value, C }: { icon: string; label: string; value: string; C: AppColors }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.borderWarm }}>
      <Ionicons name={icon as any} size={18} color={C.bodySoft} />
      <Text style={{ fontFamily: Fonts.sans, fontSize: FontSize.sm, color: C.bodySoft, width: 90 }}>{label}</Text>
      <Text style={{ flex: 1, fontFamily: Fonts.sansMedium, fontSize: FontSize.sm, color: C.ink }}>{value}</Text>
    </View>
  );
}

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
      borderBottomWidth: 1, borderBottomColor: C.borderWarm,
    },
    backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    title: { fontFamily: Fonts.sansMedium, fontSize: FontSize.lg, color: C.ink, flex: 1, textAlign: 'center' },
    loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    errorText: { fontFamily: Fonts.sans, fontSize: FontSize.body, color: C.body },
    content: { padding: Spacing.lg, gap: Spacing.lg },
    statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: Radius.full, paddingHorizontal: 14, paddingVertical: 8, alignSelf: 'flex-start' },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
    statusText: { fontFamily: Fonts.sansMedium, fontSize: FontSize.sm },
    cookRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: C.bgCard, borderRadius: Radius.lg, padding: Spacing.md, ...Shadow.card },
    cookName: { fontFamily: Fonts.sansMedium, fontSize: FontSize.body, color: C.ink },
    cookLabel: { fontFamily: Fonts.sans, fontSize: FontSize.sm, color: C.bodySoft },
    card: { backgroundColor: C.bgCard, borderRadius: Radius.lg, padding: Spacing.md, ...Shadow.card },
    section: { gap: 6 },
    sectionTitle: { fontFamily: Fonts.sansMedium, fontSize: FontSize.lg, color: C.ink },
    bodyText: { fontFamily: Fonts.sans, fontSize: FontSize.body, color: C.body, lineHeight: 24 },
    quoteCard: { backgroundColor: C.honey, borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.md },
    quoteBanner: { fontFamily: Fonts.sansMedium, fontSize: FontSize.lg, color: C.spice },
    quoteMessage: { fontFamily: Fonts.sans, fontSize: FontSize.body, color: C.body, lineHeight: 22 },
    priceRow: { flexDirection: 'row', gap: Spacing.md },
    priceItem: { flex: 1, backgroundColor: C.bgCard, borderRadius: Radius.md, padding: Spacing.sm, alignItems: 'center' },
    priceLabel: { fontFamily: Fonts.sans, fontSize: FontSize.xs, color: C.bodySoft },
    priceValue: { fontFamily: Fonts.sansMedium, fontSize: FontSize.lg, color: C.ink, marginTop: 2 },
    quoteActions: { flexDirection: 'row', gap: Spacing.sm },
    acceptBtn: { flex: 1, backgroundColor: C.spice, borderRadius: Radius.full, paddingVertical: 12, alignItems: 'center' },
    btnDisabled: { opacity: 0.4 },
    acceptBtnText: { fontFamily: Fonts.sansMedium, fontSize: FontSize.body, color: C.canvas },
    rejectBtn: { flex: 1, borderWidth: 1.5, borderColor: C.errorFg, borderRadius: Radius.full, paddingVertical: 12, alignItems: 'center' },
    rejectBtnText: { fontFamily: Fonts.sansMedium, fontSize: FontSize.body, color: C.errorFg },
    timelineItem: { flexDirection: 'row', gap: Spacing.md, paddingVertical: 8 },
    timelineDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: C.borderWarm, marginTop: 4 },
    timelineDotDone: { backgroundColor: C.leaf },
    timelineInfo: { flex: 1 },
    timelineLabel: { fontFamily: Fonts.sansMedium, fontSize: FontSize.sm, color: C.ink },
    timelineDesc: { fontFamily: Fonts.sans, fontSize: FontSize.sm, color: C.body },
    timelineTime: { fontFamily: Fonts.sans, fontSize: FontSize.xs, color: C.bodySoft, marginTop: 2 },
    cancelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' },
    cancelText: { fontFamily: Fonts.sansMedium, fontSize: FontSize.sm, color: C.errorFg },
    footer: { padding: Spacing.lg, borderTopWidth: 1, borderTopColor: C.borderWarm, backgroundColor: C.bg },
    payBtn: { backgroundColor: C.spice, borderRadius: Radius.full, paddingVertical: 16, alignItems: 'center' },
    payBtnText: { fontFamily: Fonts.sansMedium, fontSize: FontSize.lg, color: C.canvas },
  });
}
