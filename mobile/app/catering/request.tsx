import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { cateringApi, type CateringEventType } from '../../src/api/catering';
import AddressInput, { type PlaceResult } from '../../src/components/ui/AddressInput';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { Fonts, Spacing, Radius, Shadow, FontSize } from '../../src/constants/theme';
import { useFeedback } from '../../src/components/feedback';
import { trackEvent } from '../../src/utils/analytics';
import { useTranslation } from 'react-i18next';

function useEventTypes() {
  const { t } = useTranslation();
  return useMemo((): { key: CateringEventType; label: string; icon: string }[] => [
    { key: 'wedding',     label: t('catering.request.type_wedding'),     icon: '💍' },
    { key: 'birthday',    label: t('catering.request.type_birthday'),    icon: '🎂' },
    { key: 'corporate',   label: t('catering.request.type_corporate'),   icon: '💼' },
    { key: 'graduation',  label: t('catering.request.type_graduation'),  icon: '🎓' },
    { key: 'naming',      label: t('catering.request.type_naming'),      icon: '👶' },
    { key: 'anniversary', label: t('catering.request.type_anniversary'), icon: '🥂' },
    { key: 'funeral',     label: t('catering.request.type_funeral'),     icon: '🕊️' },
    { key: 'other',       label: t('catering.request.type_other'),       icon: '🎉' },
  ], [t]);
}

export default function CateringRequestScreen() {
  const router = useRouter();
  const { cookId } = useLocalSearchParams<{ cookId?: string }>();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const feedback = useFeedback();
  const { t } = useTranslation();
  const EVENT_TYPES = useEventTypes();

  const [eventType, setEventType] = useState<CateringEventType | null>(null);
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [guestCount, setGuestCount] = useState('50');
  const [venueAddress, setVenueAddress] = useState('');
  const [menuDescription, setMenuDescription] = useState('');
  const [dietaryRequirements, setDietaryRequirements] = useState('');
  const [equipmentNeeded, setEquipmentNeeded] = useState(false);
  const [serviceStaffNeeded, setServiceStaffNeeded] = useState(false);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = !!eventType && !!eventDate && parseInt(guestCount) > 0 && venueAddress.length > 5;

  const handleSubmit = async () => {
    if (!eventType) return;
    setSubmitting(true);
    try {
      const { event } = await cateringApi.create({
        cook_id: cookId,
        event_type: eventType,
        event_name: eventName || undefined,
        event_date: eventDate,
        guest_count: parseInt(guestCount),
        venue_address: venueAddress,
        menu_description: menuDescription || undefined,
        dietary_requirements: dietaryRequirements || undefined,
        equipment_needed: equipmentNeeded,
        service_staff_needed: serviceStaffNeeded,
        notes: notes || undefined,
      });
      trackEvent('catering_enquiry', { event_type: eventType, guest_count: guestCount });
      feedback.success(t('catering.request.submit_success'));
      router.replace({ pathname: '/catering/[id]', params: { id: event.id } } as any);
    } catch (err: any) {
      feedback.error(err.error ?? t('catering.request.submit_error'));
    } finally { setSubmitting(false); }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('catering.request.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>{t('catering.request.occasion_question')}</Text>
        <View style={styles.eventTypeGrid}>
          {EVENT_TYPES.map(et => (
            <TouchableOpacity
              key={et.key}
              style={[styles.eventTypeCard, eventType === et.key && styles.eventTypeCardSelected]}
              onPress={() => setEventType(et.key)}
            >
              <Text style={styles.eventTypeEmoji}>{et.icon}</Text>
              <Text style={[styles.eventTypeLabel, eventType === et.key && styles.eventTypeLabelSelected]}>
                {et.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>{t('catering.request.event_details')}</Text>
        <View style={styles.fieldGroup}>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t('catering.request.event_name_label')}</Text>
            <TextInput
              style={styles.textInput}
              value={eventName}
              onChangeText={setEventName}
              placeholder={t('catering.request.event_name_placeholder')}
              placeholderTextColor={C.stone}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t('catering.request.event_date_label')}</Text>
            <TextInput
              style={styles.textInput}
              value={eventDate}
              onChangeText={setEventDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={C.stone}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t('catering.request.guest_count_label')}</Text>
            <View style={styles.guestCountRow}>
              <TouchableOpacity style={styles.counterBtn} onPress={() => setGuestCount(v => String(Math.max(1, parseInt(v) - 10)))}>
                <Ionicons name="remove" size={20} color={C.ink} />
              </TouchableOpacity>
              <Text style={styles.guestCountText}>{guestCount}</Text>
              <TouchableOpacity style={styles.counterBtn} onPress={() => setGuestCount(v => String(parseInt(v) + 10))}>
                <Ionicons name="add" size={20} color={C.ink} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.field}>
            <AddressInput
              label={t('catering.request.venue_address_label')}
              value={venueAddress}
              onChangeText={setVenueAddress}
              onSelectPlace={(p: PlaceResult) => setVenueAddress(p.description)}
              placeholder={t('catering.request.venue_address_placeholder')}
            />
          </View>
        </View>

        <Text style={styles.sectionTitle}>{t('catering.request.menu_and_requirements')}</Text>
        <View style={styles.fieldGroup}>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t('catering.request.menu_description_label')}</Text>
            <TextInput
              style={styles.textArea}
              value={menuDescription}
              onChangeText={setMenuDescription}
              placeholder={t('catering.request.menu_description_placeholder')}
              placeholderTextColor={C.stone}
              multiline numberOfLines={4} textAlignVertical="top"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t('catering.request.dietary_requirements_label')}</Text>
            <TextInput
              style={styles.textInput}
              value={dietaryRequirements}
              onChangeText={setDietaryRequirements}
              placeholder={t('catering.request.dietary_requirements_placeholder')}
              placeholderTextColor={C.stone}
            />
          </View>
        </View>

        <Text style={styles.sectionTitle}>{t('catering.request.additional_services')}</Text>
        <View style={styles.fieldGroup}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleLabel}>{t('catering.request.equipment_needed')}</Text>
              <Text style={styles.toggleHint}>{t('catering.request.equipment_needed_hint')}</Text>
            </View>
            <Switch
              value={equipmentNeeded}
              onValueChange={setEquipmentNeeded}
              trackColor={{ false: C.borderWarm, true: C.spice }}
              thumbColor={C.canvas}
            />
          </View>
          <View style={[styles.toggleRow, { borderBottomWidth: 0 }]}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleLabel}>{t('catering.request.service_staff_needed')}</Text>
              <Text style={styles.toggleHint}>{t('catering.request.service_staff_needed_hint')}</Text>
            </View>
            <Switch
              value={serviceStaffNeeded}
              onValueChange={setServiceStaffNeeded}
              trackColor={{ false: C.borderWarm, true: C.spice }}
              thumbColor={C.canvas}
            />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t('catering.request.additional_notes_label')}</Text>
          <TextInput
            style={styles.textArea}
            value={notes}
            onChangeText={setNotes}
            placeholder={t('catering.request.additional_notes_placeholder')}
            placeholderTextColor={C.stone}
            multiline numberOfLines={3} textAlignVertical="top"
          />
        </View>

        <View style={styles.submitBox}>
          <Text style={styles.submitNote}>
            {t('catering.request.submit_note')}
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitBtn, (!canSubmit || submitting) && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit || submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color={C.canvas} />
          ) : (
            <Text style={styles.submitBtnText}>{t('catering.request.submit_button')}</Text>
          )}
        </TouchableOpacity>
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
    content: { padding: Spacing.lg, gap: Spacing.lg },
    sectionTitle: { fontFamily: Fonts.sansMedium, fontSize: FontSize.lg, color: C.ink },
    eventTypeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    eventTypeCard: {
      width: '22%', backgroundColor: C.bgCard, borderRadius: Radius.lg,
      padding: 10, alignItems: 'center', gap: 4,
      borderWidth: 1.5, borderColor: C.borderWarm,
    },
    eventTypeCardSelected: { borderColor: C.spice, backgroundColor: C.honey },
    eventTypeEmoji: { fontSize: 24 },
    eventTypeLabel: { fontFamily: Fonts.sans, fontSize: FontSize.xs, color: C.body, textAlign: 'center' },
    eventTypeLabelSelected: { color: C.spice, fontFamily: Fonts.sansMedium },
    fieldGroup: { backgroundColor: C.bgCard, borderRadius: Radius.lg, ...Shadow.card, overflow: 'visible' },
    field: { padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: C.borderWarm },
    fieldLabel: { fontFamily: Fonts.sansMedium, fontSize: FontSize.sm, color: C.body, marginBottom: 6 },
    textInput: {
      backgroundColor: C.bg, borderRadius: Radius.md, borderWidth: 1, borderColor: C.borderWarm,
      paddingHorizontal: Spacing.md, paddingVertical: 11,
      fontFamily: Fonts.sans, fontSize: FontSize.body, color: C.ink,
    },
    textArea: {
      backgroundColor: C.bg, borderRadius: Radius.md, borderWidth: 1, borderColor: C.borderWarm,
      padding: Spacing.md, fontFamily: Fonts.sans, fontSize: FontSize.body,
      color: C.ink, minHeight: 90, lineHeight: 24,
    },
    guestCountRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
    counterBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.bg, borderWidth: 1, borderColor: C.borderWarm, alignItems: 'center', justifyContent: 'center' },
    guestCountText: { fontFamily: Fonts.sansMedium, fontSize: FontSize.xl, color: C.ink, minWidth: 50, textAlign: 'center' },
    toggleRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: C.borderWarm,
    },
    toggleInfo: { flex: 1, marginRight: Spacing.md },
    toggleLabel: { fontFamily: Fonts.sansMedium, fontSize: FontSize.body, color: C.ink },
    toggleHint: { fontFamily: Fonts.sans, fontSize: FontSize.sm, color: C.bodySoft, marginTop: 2 },
    submitBox: {
      backgroundColor: C.honey, borderRadius: Radius.lg, padding: Spacing.md,
    },
    submitNote: { fontFamily: Fonts.sans, fontSize: FontSize.sm, color: C.body, lineHeight: 20 },
    footer: { padding: Spacing.lg, borderTopWidth: 1, borderTopColor: C.borderWarm, backgroundColor: C.bg },
    submitBtn: { backgroundColor: C.spice, borderRadius: Radius.full, paddingVertical: 16, alignItems: 'center' },
    submitBtnDisabled: { opacity: 0.4 },
    submitBtnText: { fontFamily: Fonts.sansMedium, fontSize: FontSize.lg, color: C.canvas },
  });
}
