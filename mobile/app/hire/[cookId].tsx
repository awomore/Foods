import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { privateChefApi } from '../../src/api/privateChef';
import { Fonts, Spacing, Radius, Shadow } from '../../src/constants/theme';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { useFeedback } from '../../src/components/feedback';

const EVENT_TYPES = [
  'Birthday', 'Wedding', 'Corporate', 'Dinner party',
  'Naming ceremony', 'Anniversary', 'Other',
];

function Field({
  label, value, onChangeText, placeholder, keyboardType, multiline, required,
}: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; keyboardType?: TextInput['props']['keyboardType'];
  multiline?: boolean; required?: boolean;
}) {
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}{required && <Text style={{ color: C.errorFg }}> *</Text>}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMulti]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.stone}
        keyboardType={keyboardType}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
      />
    </View>
  );
}

export default function HireScreen() {
  const router = useRouter();
  const { cookId, cookName } = useLocalSearchParams<{ cookId: string; cookName?: string }>();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);

  const [eventType, setEventType] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [guestCount, setGuestCount] = useState('');
  const [venue, setVenue] = useState('');
  const [description, setDescription] = useState('');
  const [dietary, setDietary] = useState('');
  const feedback = useFeedback();
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!eventDate.trim()) { feedback.warn('Required', 'Please enter the event date'); return; }
    if (!guestCount || parseInt(guestCount) < 1) { feedback.warn('Required', 'Please enter the number of guests'); return; }
    if (!venue.trim()) { feedback.warn('Required', 'Please enter the venue address'); return; }

    setSubmitting(true);
    try {
      await privateChefApi.create({
        cook_id: cookId,
        event_type: eventType || undefined,
        event_date: eventDate,
        event_time: eventTime || undefined,
        guest_count: parseInt(guestCount),
        venue_address: venue,
        description: description || undefined,
        dietary_requirements: dietary || undefined,
      });

      feedback.success('Enquiry sent!', `Your enquiry has been sent to ${cookName ?? 'the cook'}. They'll review it and send you a quote.`);
      router.back();
    } catch (e: any) {
      feedback.error('Error', e?.error ?? 'Could not send enquiry. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.root}>
      <SafeAreaView>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={C.textInk} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Hire for an event</Text>
            {cookName && <Text style={styles.headerSub}>with {cookName}</Text>}
          </View>
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: Spacing.lg, gap: 20, paddingBottom: 100 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.infoBanner}>
            <Ionicons name="information-circle-outline" size={18} color={C.infoFg} />
            <Text style={styles.infoText}>
              Submit your event details. The cook will review and send a custom quote — no commitment yet.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Event type</Text>
            <View style={styles.typeGrid}>
              {EVENT_TYPES.map(t => (
                <TouchableOpacity
                  key={t}
                  onPress={() => setEventType(t === eventType ? '' : t)}
                  style={[styles.typeBtn, eventType === t && styles.typeBtnActive]}
                >
                  <Text style={[styles.typeBtnText, eventType === t && styles.typeBtnTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Event details</Text>
            <Field label="Event date" value={eventDate} onChangeText={setEventDate} placeholder="YYYY-MM-DD" required />
            <Field label="Preferred time" value={eventTime} onChangeText={setEventTime} placeholder="e.g. 6:00 PM" />
            <Field
              label="Number of guests"
              value={guestCount}
              onChangeText={setGuestCount}
              placeholder="e.g. 50"
              keyboardType="numeric"
              required
            />
            <Field
              label="Venue address"
              value={venue}
              onChangeText={setVenue}
              placeholder="Full venue address"
              multiline
              required
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tell the cook more</Text>
            <Field
              label="What's the occasion?"
              value={description}
              onChangeText={setDescription}
              placeholder="Share any context that helps the cook plan — e.g. theme, menu preferences, service style"
              multiline
            />
            <Field
              label="Dietary requirements"
              value={dietary}
              onChangeText={setDietary}
              placeholder="e.g. 10 guests are vegetarian, nut allergy"
              multiline
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.submitBar}>
        <TouchableOpacity
          onPress={handleSubmit}
          style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
          activeOpacity={0.85}
          disabled={submitting}
        >
          {submitting
            ? <ActivityIndicator color={C.canvas} />
            : <>
                <Text style={styles.submitText}>Send enquiry</Text>
                <Ionicons name="send" size={16} color={C.canvas} />
              </>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function makeStyles(C: AppColors) { return StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md,
    paddingTop: 8, paddingBottom: 12, gap: 12,
  },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.bgCook, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: Fonts.serif, fontSize: 20, color: C.textInk },
  headerSub: { fontFamily: Fonts.sans, fontSize: 13, color: C.bodySoft, marginTop: 2 },

  infoBanner: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: C.infoBg, borderRadius: Radius.md, padding: 14,
  },
  infoText: { fontFamily: Fonts.sans, fontSize: 13, color: C.infoFg, flex: 1, lineHeight: 19 },

  section: { backgroundColor: C.bgCard, borderRadius: Radius.lg, padding: 16, borderWidth: 0.5, borderColor: C.borderWarm, ...Shadow.card, gap: 12 },
  sectionTitle: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.textInk },

  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeBtn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 40, borderWidth: 0.5, borderColor: C.borderWarm, backgroundColor: C.bg },
  typeBtnActive: { backgroundColor: C.ink, borderColor: C.ink },
  typeBtnText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.bodySoft },
  typeBtnTextActive: { color: C.canvas },

  field: { gap: 6 },
  fieldLabel: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.body },
  input: {
    backgroundColor: C.bg, borderRadius: Radius.md, borderWidth: 0.5, borderColor: C.borderWarm,
    paddingHorizontal: 12, paddingVertical: 10, fontFamily: Fonts.sans, fontSize: 14, color: C.textInk,
  },
  inputMulti: { minHeight: 80, textAlignVertical: 'top', paddingTop: 10 },

  submitBar: { padding: 16, paddingBottom: 36, borderTopWidth: 0.5, borderTopColor: C.borderWarm, backgroundColor: C.bgCard },
  submitBtn: {
    backgroundColor: C.spice, borderRadius: Radius.lg, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  submitText: { fontFamily: Fonts.sansMedium, fontSize: 15, color: C.canvas },
}); }
