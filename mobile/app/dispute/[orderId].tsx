import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { disputesApi, type DisputeType } from '../../src/api/disputes';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { Fonts, Spacing, Radius, FontSize } from '../../src/constants/theme';
import { useFeedback } from '../../src/components/feedback';
import { trackEvent } from '../../src/utils/analytics';

const DISPUTE_TYPES: { key: DisputeType; label: string; icon: string; desc: string }[] = [
  { key: 'wrong_order',    label: 'Wrong Order',     icon: 'alert-circle-outline', desc: 'I received the wrong items' },
  { key: 'not_delivered',  label: 'Not Delivered',   icon: 'close-circle-outline', desc: 'My order never arrived' },
  { key: 'quality_issue',  label: 'Quality Issue',   icon: 'thumbs-down-outline',  desc: 'Food was spoiled or poor quality' },
  { key: 'late_delivery',  label: 'Late Delivery',   icon: 'time-outline',         desc: 'Order arrived very late' },
  { key: 'fraud',          label: 'Fraud',           icon: 'warning-outline',      desc: 'Suspicious or unauthorised charge' },
  { key: 'other',          label: 'Other Issue',     icon: 'help-circle-outline',  desc: 'Something else went wrong' },
];

export default function FileDisputeScreen() {
  const router = useRouter();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const feedback = useFeedback();

  const [selectedType, setSelectedType] = useState<DisputeType | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = !!selectedType && reason.trim().length >= 20;

  const handleSubmit = async () => {
    if (!selectedType || !orderId) return;
    setSubmitting(true);
    try {
      const { dispute } = await disputesApi.file({
        order_id: orderId,
        type: selectedType,
        reason: reason.trim(),
      });
      trackEvent('dispute_filed', {}, { order_id: orderId, type: selectedType });
      feedback.toast({ type: 'success', message: 'Dispute filed. We will review within 48 hours.' });
      router.replace({ pathname: '/dispute/status/[id]', params: { id: dispute.id } } as any);
    } catch (err: any) {
      feedback.toast({ type: 'error', message: err.error ?? 'Failed to file dispute' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <Text style={styles.title}>File a Dispute</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.banner}>
          <Ionicons name="shield-half-outline" size={24} color={C.infoFg} />
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>Buyer Protection</Text>
            <Text style={styles.bannerBody}>
              We hold your payment in escrow until the dispute is resolved. You are protected.
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>What went wrong?</Text>
        <View style={styles.typeGrid}>
          {DISPUTE_TYPES.map(dt => (
            <TouchableOpacity
              key={dt.key}
              style={[styles.typeCard, selectedType === dt.key && styles.typeCardSelected]}
              onPress={() => setSelectedType(dt.key)}
            >
              <Ionicons
                name={dt.icon as any}
                size={24}
                color={selectedType === dt.key ? C.canvas : C.spice}
              />
              <Text style={[styles.typeLabel, selectedType === dt.key && styles.typeLabelSelected]}>
                {dt.label}
              </Text>
              <Text style={[styles.typeDesc, selectedType === dt.key && styles.typeDescSelected]}>
                {dt.desc}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Describe the issue</Text>
        <Text style={styles.sectionHint}>Be specific — include what you ordered vs what you received.</Text>
        <TextInput
          style={styles.reasonInput}
          value={reason}
          onChangeText={setReason}
          placeholder="e.g. I ordered Jollof Rice with Chicken but received Fried Rice without any protein. The food was also cold on arrival..."
          placeholderTextColor={C.stone}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
        />
        <Text style={[styles.charCount, reason.length < 20 && styles.charCountWarn]}>
          {reason.length} characters {reason.length < 20 ? `(minimum 20)` : '✓'}
        </Text>

        <View style={styles.slaNote}>
          <Ionicons name="time-outline" size={16} color={C.warnFg} />
          <Text style={styles.slaNoteText}>
            Resolution within 48 hours. Both parties will be notified and asked to provide evidence.
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
            <Text style={styles.submitBtnText}>Submit Dispute</Text>
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
    backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    title: { fontFamily: Fonts.sansMedium, fontSize: FontSize.lg, color: C.ink },
    content: { padding: Spacing.lg, gap: Spacing.lg },
    banner: {
      flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start',
      backgroundColor: C.infoBg, borderRadius: Radius.lg, padding: Spacing.md,
    },
    bannerTitle: { fontFamily: Fonts.sansMedium, fontSize: FontSize.body, color: C.infoFg },
    bannerBody: { fontFamily: Fonts.sans, fontSize: FontSize.sm, color: C.body, marginTop: 2, lineHeight: 20 },
    sectionTitle: { fontFamily: Fonts.sansMedium, fontSize: FontSize.lg, color: C.ink },
    sectionHint: { fontFamily: Fonts.sans, fontSize: FontSize.sm, color: C.bodySoft, marginTop: -12 },
    typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    typeCard: {
      width: '47%', backgroundColor: C.bgCard, borderRadius: Radius.lg,
      padding: Spacing.md, alignItems: 'center', gap: 6,
      borderWidth: 1.5, borderColor: C.borderWarm,
    },
    typeCardSelected: { backgroundColor: C.spice, borderColor: C.spice },
    typeLabel: { fontFamily: Fonts.sansMedium, fontSize: FontSize.sm, color: C.ink, textAlign: 'center' },
    typeLabelSelected: { color: C.canvas },
    typeDesc: { fontFamily: Fonts.sans, fontSize: FontSize.xs, color: C.bodySoft, textAlign: 'center' },
    typeDescSelected: { color: C.canvas, opacity: 0.85 },
    reasonInput: {
      backgroundColor: C.bgCard, borderRadius: Radius.lg,
      borderWidth: 1.5, borderColor: C.borderWarm,
      padding: Spacing.md, fontFamily: Fonts.sans, fontSize: FontSize.body,
      color: C.ink, minHeight: 140, lineHeight: 24,
    },
    charCount: { fontFamily: Fonts.sans, fontSize: FontSize.xs, color: C.leaf, textAlign: 'right' },
    charCountWarn: { color: C.bodySoft },
    slaNote: {
      flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start',
      backgroundColor: C.warnBg, borderRadius: Radius.md, padding: Spacing.md,
    },
    slaNoteText: { flex: 1, fontFamily: Fonts.sans, fontSize: FontSize.sm, color: C.body, lineHeight: 20 },
    footer: {
      padding: Spacing.lg, borderTopWidth: 1, borderTopColor: C.borderWarm,
      backgroundColor: C.bg,
    },
    submitBtn: {
      backgroundColor: C.spice, borderRadius: Radius.full,
      paddingVertical: 16, alignItems: 'center',
    },
    submitBtnDisabled: { opacity: 0.4 },
    submitBtnText: { fontFamily: Fonts.sansMedium, fontSize: FontSize.lg, color: C.canvas },
  });
}
