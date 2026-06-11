import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { privateChefApi } from '../../src/api/privateChef';
import { chefAvailabilityApi, type AvailabilitySlot } from '../../src/api/chefAvailability';
import { cooksApi, type CookDetail } from '../../src/api/cooks';
import AddressInput, { type PlaceResult } from '../../src/components/ui/AddressInput';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { Fonts, Spacing, Radius, Shadow, FontSize } from '../../src/constants/theme';
import { useFeedback } from '../../src/components/feedback';
import { trackEvent } from '../../src/utils/analytics';
import Avatar from '../../src/components/ui/Avatar';

type Step = 'date' | 'details' | 'review';

const EVENT_TYPES = [
  'Birthday Party', 'Anniversary', 'Corporate Dinner', 'Wedding',
  'House Party', 'Graduation', 'Date Night', 'Other',
];

export default function HireChefScreen() {
  const router = useRouter();
  const { cookId } = useLocalSearchParams<{ cookId: string }>();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const feedback = useFeedback();

  const [step, setStep] = useState<Step>('date');
  const [cook, setCook] = useState<CookDetail | null>(null);
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [eventType, setEventType] = useState('');
  const [guestCount, setGuestCount] = useState('4');
  const [venueAddress, setVenueAddress] = useState('');
  const [description, setDescription] = useState('');
  const [dietaryReqs, setDietaryReqs] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!cookId) return;
    Promise.all([
      cooksApi.get(cookId),
      chefAvailabilityApi.forCook(cookId),
    ]).then(([cookRes, avRes]) => {
      setCook(cookRes.cook);
      setAvailability(avRes.slots);
    }).catch(() => {});
  }, [cookId]);

  const availableDates = useMemo(() => {
    const today = new Date();
    const dates: string[] = [];
    for (let i = 1; i <= 60; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const slot = availability.find(s => s.date === dateStr);
      if (!slot || slot.is_available) dates.push(dateStr);
    }
    return dates;
  }, [availability]);

  const selectedTimeSlots = useMemo(() => {
    if (!selectedDate) return [];
    const slot = availability.find(s => s.date === selectedDate);
    return slot?.time_slots ?? [];
  }, [selectedDate, availability]);

  const canProceedToDetails = !!selectedDate;
  const canSubmit = !!selectedDate && !!eventType && venueAddress.length > 5 && parseInt(guestCount) > 0;

  const handleSubmit = async () => {
    if (!cookId || !selectedDate) return;
    setSubmitting(true);
    try {
      const { booking } = await privateChefApi.create({
        cook_id: cookId,
        event_type: eventType,
        event_date: selectedDate,
        event_time: selectedSlot ?? undefined,
        guest_count: parseInt(guestCount),
        venue_address: venueAddress,
        description: description || undefined,
        dietary_requirements: dietaryReqs || undefined,
      });
      trackEvent('chef_booking_enquiry', { event_date: selectedDate }, { cook_id: cookId });
      feedback.success('Booking enquiry sent! The chef will respond shortly.');
      router.replace({ pathname: '/booking/[id]', params: { id: booking.id } } as any);
    } catch (err: any) {
      feedback.error(err.error ?? 'Failed to send enquiry');
    } finally { setSubmitting(false); }
  };

  const formatDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <Text style={styles.title}>Book Private Chef</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Progress */}
      <View style={styles.progress}>
        {(['date', 'details', 'review'] as Step[]).map((s, i) => {
          const done = (step === 'details' && i === 0) || (step === 'review' && i <= 1);
          const active = step === s;
          return (
            <React.Fragment key={s}>
              <View style={[styles.progressDot, active && styles.progressDotActive, done && styles.progressDotDone]}>
                <Text style={styles.progressDotText}>{i + 1}</Text>
              </View>
              {i < 2 && <View style={[styles.progressLine, done && styles.progressLineDone]} />}
            </React.Fragment>
          );
        })}
      </View>

      {cook && (
        <View style={styles.cookPreview}>
          <Avatar avatarUrl={cook.avatar_url} name={cook.display_name} size={44} />
          <View style={{ flex: 1 }}>
            <Text style={styles.cookPreviewName}>{cook.display_name}</Text>
            <Text style={styles.cookPreviewMeta}>
              {cook.location}{cook.booking_lead_days ? ` · ${cook.booking_lead_days}d lead time` : ''}
            </Text>
          </View>
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {step === 'date' && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Choose a Date</Text>
            <View style={styles.calendarGrid}>
              {availableDates.slice(0, 28).map(date => {
                const blocked = availability.find(s => s.date === date && !s.is_available);
                const d = new Date(date + 'T00:00:00');
                return (
                  <TouchableOpacity
                    key={date}
                    style={[styles.dateCell, selectedDate === date && styles.dateCellSelected, !!blocked && styles.dateCellBlocked]}
                    onPress={() => !blocked && setSelectedDate(date)}
                    disabled={!!blocked}
                  >
                    <Text style={[styles.dateCellDay, selectedDate === date && styles.dateCellSelectedText]}>
                      {d.toLocaleDateString('en', { weekday: 'short' })}
                    </Text>
                    <Text style={[styles.dateCellNum, selectedDate === date && styles.dateCellSelectedText]}>
                      {d.getDate()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {selectedDate && selectedTimeSlots.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>Available Time Slots</Text>
                <View style={styles.slotRow}>
                  {selectedTimeSlots.map((slot, i) => (
                    <TouchableOpacity
                      key={i}
                      style={[styles.slotBtn, selectedSlot === slot.start && styles.slotBtnSelected]}
                      onPress={() => setSelectedSlot(slot.start)}
                    >
                      <Text style={[styles.slotBtnText, selectedSlot === slot.start && styles.slotBtnTextSelected]}>
                        {slot.start} – {slot.end}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
          </View>
        )}

        {step === 'details' && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Event Details</Text>
            <Text style={styles.sectionLabel}>Event Type</Text>
            <View style={styles.eventTypeGrid}>
              {EVENT_TYPES.map(et => (
                <TouchableOpacity
                  key={et}
                  style={[styles.eventTypeBtn, eventType === et && styles.eventTypeBtnSelected]}
                  onPress={() => setEventType(et)}
                >
                  <Text style={[styles.eventTypeBtnText, eventType === et && styles.eventTypeBtnTextSelected]}>{et}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.sectionLabel}>Number of Guests</Text>
            <View style={styles.guestCountRow}>
              <TouchableOpacity style={styles.counterBtn} onPress={() => setGuestCount(v => String(Math.max(1, parseInt(v) - 1)))}>
                <Ionicons name="remove" size={20} color={C.ink} />
              </TouchableOpacity>
              <Text style={styles.guestCountText}>{guestCount}</Text>
              <TouchableOpacity style={styles.counterBtn} onPress={() => setGuestCount(v => String(parseInt(v) + 1))}>
                <Ionicons name="add" size={20} color={C.ink} />
              </TouchableOpacity>
            </View>

            <AddressInput
              label="Venue Address"
              value={venueAddress}
              onChangeText={setVenueAddress}
              onSelectPlace={(p: PlaceResult) => setVenueAddress(p.description)}
              placeholder="Enter the event venue address"
            />

            <Text style={styles.sectionLabel}>Description (optional)</Text>
            <TextInput
              style={styles.textArea}
              value={description}
              onChangeText={setDescription}
              placeholder="Menu preferences, service style, special requests..."
              placeholderTextColor={C.stone}
              multiline numberOfLines={4} textAlignVertical="top"
            />

            <Text style={styles.sectionLabel}>Dietary Requirements (optional)</Text>
            <TextInput
              style={styles.textInput}
              value={dietaryReqs}
              onChangeText={setDietaryReqs}
              placeholder="e.g. halal, nut allergy, vegetarian"
              placeholderTextColor={C.stone}
            />
          </View>
        )}

        {step === 'review' && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Review & Send</Text>
            <View style={styles.reviewCard}>
              {[
                ['Date', selectedDate ? formatDate(selectedDate) : ''],
                selectedSlot ? ['Time', selectedSlot] : null,
                ['Event', eventType],
                ['Guests', guestCount],
                ['Venue', venueAddress],
                description ? ['Description', description] : null,
                dietaryReqs ? ['Dietary', dietaryReqs] : null,
              ].filter((x): x is string[] => !!x).map(([label, val], i) => (
                <View key={i} style={styles.reviewRow}>
                  <Text style={styles.reviewLabel}>{label}</Text>
                  <Text style={styles.reviewValue} numberOfLines={2}>{val}</Text>
                </View>
              ))}
            </View>
            <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={18} color={C.infoFg} />
              <Text style={styles.infoText}>No payment required yet. The chef will send you a personalised quote within 24 hours.</Text>
            </View>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.footerRow}>
          {step !== 'date' && (
            <TouchableOpacity style={styles.prevBtn} onPress={() => setStep(step === 'review' ? 'details' : 'date')}>
              <Ionicons name="arrow-back" size={18} color={C.spice} />
              <Text style={styles.prevBtnText}>Back</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.nextBtn, !(step === 'date' ? canProceedToDetails : canSubmit) && styles.nextBtnDisabled]}
            onPress={step === 'review' ? handleSubmit : () => setStep(step === 'date' ? 'details' : 'review')}
            disabled={step === 'date' ? !canProceedToDetails : !canSubmit}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={C.canvas} />
            ) : (
              <>
                <Text style={styles.nextBtnText}>{step === 'review' ? 'Send Enquiry' : 'Continue'}</Text>
                <Ionicons name={step === 'review' ? 'send' : 'arrow-forward'} size={18} color={C.canvas} />
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
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
    title: { fontFamily: Fonts.sansMedium, fontSize: FontSize.lg, color: C.ink },
    progress: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.md },
    progressDot: { width: 30, height: 30, borderRadius: 15, backgroundColor: C.borderWarm, alignItems: 'center', justifyContent: 'center' },
    progressDotActive: { backgroundColor: C.spice },
    progressDotDone: { backgroundColor: C.leaf },
    progressDotText: { fontFamily: Fonts.sansMedium, fontSize: FontSize.sm, color: C.canvas },
    progressLine: { flex: 1, height: 2, backgroundColor: C.borderWarm, maxWidth: 60 },
    progressLineDone: { backgroundColor: C.leaf },
    cookPreview: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
      paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm,
      borderBottomWidth: 1, borderBottomColor: C.borderWarm,
    },
    cookPreviewName: { fontFamily: Fonts.sansMedium, fontSize: FontSize.body, color: C.ink },
    cookPreviewMeta: { fontFamily: Fonts.sans, fontSize: FontSize.sm, color: C.bodySoft },
    content: { padding: Spacing.lg },
    stepContent: { gap: Spacing.lg },
    stepTitle: { fontFamily: Fonts.serif, fontSize: FontSize.xl, color: C.ink },
    sectionLabel: { fontFamily: Fonts.sansMedium, fontSize: FontSize.sm, color: C.body },
    calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    dateCell: {
      width: '13%', aspectRatio: 0.85, backgroundColor: C.bgCard,
      borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: C.borderWarm,
    },
    dateCellSelected: { backgroundColor: C.spice, borderColor: C.spice },
    dateCellBlocked: { opacity: 0.3 },
    dateCellDay: { fontFamily: Fonts.sans, fontSize: 9, color: C.bodySoft, textTransform: 'uppercase' },
    dateCellNum: { fontFamily: Fonts.sansMedium, fontSize: FontSize.md, color: C.ink },
    dateCellSelectedText: { color: C.canvas },
    slotRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    slotBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full, borderWidth: 1, borderColor: C.borderWarm },
    slotBtnSelected: { backgroundColor: C.spice, borderColor: C.spice },
    slotBtnText: { fontFamily: Fonts.sansMedium, fontSize: FontSize.sm, color: C.body },
    slotBtnTextSelected: { color: C.canvas },
    eventTypeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    eventTypeBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.full, borderWidth: 1, borderColor: C.borderWarm },
    eventTypeBtnSelected: { backgroundColor: C.ink, borderColor: C.ink },
    eventTypeBtnText: { fontFamily: Fonts.sansMedium, fontSize: FontSize.sm, color: C.body },
    eventTypeBtnTextSelected: { color: C.canvas },
    guestCountRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
    counterBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.borderWarm, alignItems: 'center', justifyContent: 'center' },
    guestCountText: { fontFamily: Fonts.sansMedium, fontSize: FontSize.xl, color: C.ink, minWidth: 40, textAlign: 'center' },
    textArea: { backgroundColor: C.bgCard, borderRadius: Radius.md, borderWidth: 1, borderColor: C.borderWarm, padding: Spacing.md, fontFamily: Fonts.sans, fontSize: FontSize.body, color: C.ink, minHeight: 100, lineHeight: 24 },
    textInput: { backgroundColor: C.bgCard, borderRadius: Radius.md, borderWidth: 1, borderColor: C.borderWarm, paddingHorizontal: Spacing.md, paddingVertical: 12, fontFamily: Fonts.sans, fontSize: FontSize.body, color: C.ink },
    reviewCard: { backgroundColor: C.bgCard, borderRadius: Radius.lg, padding: Spacing.md, ...Shadow.card },
    reviewRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.borderWarm },
    reviewLabel: { fontFamily: Fonts.sans, fontSize: FontSize.sm, color: C.bodySoft },
    reviewValue: { fontFamily: Fonts.sansMedium, fontSize: FontSize.sm, color: C.ink, flex: 1, textAlign: 'right' },
    infoBox: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start', backgroundColor: C.infoBg, borderRadius: Radius.md, padding: Spacing.md },
    infoText: { flex: 1, fontFamily: Fonts.sans, fontSize: FontSize.sm, color: C.body, lineHeight: 20 },
    footer: { padding: Spacing.lg, borderTopWidth: 1, borderTopColor: C.borderWarm, backgroundColor: C.bg },
    footerRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
    nextBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: C.spice, borderRadius: Radius.full, paddingVertical: 16 },
    nextBtnDisabled: { opacity: 0.4 },
    nextBtnText: { fontFamily: Fonts.sansMedium, fontSize: FontSize.lg, color: C.canvas },
    prevBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.sm, paddingVertical: 16 },
    prevBtnText: { fontFamily: Fonts.sansMedium, fontSize: FontSize.body, color: C.spice },
  });
}
