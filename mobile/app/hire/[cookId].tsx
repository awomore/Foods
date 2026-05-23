import React, { useState } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet,
  SafeAreaView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { privateChefApi } from '../../src/api/privateChef';
import { Colors, Fonts, Spacing, Radius, Shadow } from '../../src/constants/theme';

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
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}{required && <Text style={{ color: Colors.errorFg }}> *</Text>}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMulti]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.stone}
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

  const [eventType, setEventType] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [guestCount, setGuestCount] = useState('');
  const [venue, setVenue] = useState('');
  const [description, setDescription] = useState('');
  const [dietary, setDietary] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!eventDate.trim()) return Alert.alert('Required', 'Please enter the event date');
    if (!guestCount || parseInt(guestCount) < 1) return Alert.alert('Required', 'Please enter the number of guests');
    if (!venue.trim()) return Alert.alert('Required', 'Please enter the venue address');

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

      Alert.alert(
        'Enquiry sent!',
        `Your enquiry has been sent to ${cookName ?? 'the cook'}. They'll review it and send you a quote.`,
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } catch (e: any) {
      Alert.alert('Error', e?.error ?? 'Could not send enquiry. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.root}>
      <SafeAreaView>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={Colors.textInk} />
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
          {/* Info banner */}
          <View style={styles.infoBanner}>
            <Ionicons name="information-circle-outline" size={18} color={Colors.infoFg} />
            <Text style={styles.infoText}>
              Submit your event details. The cook will review and send a custom quote — no commitment yet.
            </Text>
          </View>

          {/* Event type */}
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

          {/* Event details */}
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

          {/* More info */}
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

      {/* Submit bar */}
      <View style={styles.submitBar}>
        <TouchableOpacity
          onPress={handleSubmit}
          style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
          activeOpacity={0.85}
          disabled={submitting}
        >
          {submitting
            ? <ActivityIndicator color={Colors.canvas} />
            : <>
                <Text style={styles.submitText}>Send enquiry</Text>
                <Ionicons name="send" size={16} color={Colors.canvas} />
              </>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md,
    paddingTop: 8, paddingBottom: 12, gap: 12,
  },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.bgCook, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: Fonts.serif, fontSize: 20, color: Colors.textInk },
  headerSub: { fontFamily: Fonts.sans, fontSize: 13, color: Colors.bodySoft, marginTop: 2 },

  infoBanner: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: Colors.infoBg, borderRadius: Radius.md, padding: 14,
  },
  infoText: { fontFamily: Fonts.sans, fontSize: 13, color: Colors.infoFg, flex: 1, lineHeight: 19 },

  section: { backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: 16, borderWidth: 0.5, borderColor: Colors.borderWarm, ...Shadow.card, gap: 12 },
  sectionTitle: { fontFamily: Fonts.sansMedium, fontSize: 14, color: Colors.textInk },

  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeBtn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 40, borderWidth: 0.5, borderColor: Colors.borderWarm, backgroundColor: Colors.bg },
  typeBtnActive: { backgroundColor: Colors.ink, borderColor: Colors.ink },
  typeBtnText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: Colors.bodySoft },
  typeBtnTextActive: { color: Colors.canvas },

  field: { gap: 6 },
  fieldLabel: { fontFamily: Fonts.sansMedium, fontSize: 13, color: Colors.body },
  input: {
    backgroundColor: Colors.bg, borderRadius: Radius.md, borderWidth: 0.5, borderColor: Colors.borderWarm,
    paddingHorizontal: 12, paddingVertical: 10, fontFamily: Fonts.sans, fontSize: 14, color: Colors.textInk,
  },
  inputMulti: { minHeight: 80, textAlignVertical: 'top', paddingTop: 10 },

  submitBar: { padding: 16, paddingBottom: 36, borderTopWidth: 0.5, borderTopColor: Colors.borderWarm, backgroundColor: Colors.bgCard },
  submitBtn: {
    backgroundColor: Colors.spice, borderRadius: Radius.lg, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  submitText: { fontFamily: Fonts.sansMedium, fontSize: 15, color: Colors.canvas },
});
