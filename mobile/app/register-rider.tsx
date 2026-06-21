import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useColors, type AppColors } from '../src/context/ThemeContext';
import { Fonts, Spacing, Radius, FontSize, Shadow } from '../src/constants/theme';
import { fleetApi, type VehicleType } from '../src/api/fleet';
import { useFeedback } from '../src/components/feedback';
import { uploadApi } from '../src/api/upload';

const STEPS = ['About You', 'Vehicle', 'Documents', 'Bank', 'Done'] as const;


export default function RegisterRiderScreen() {
  const router = useRouter();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const feedback = useFeedback();

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Step 0 — About You
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [areaInput, setAreaInput] = useState('');

  // Step 1 — Vehicle
  const [vehicleType, setVehicleType] = useState<VehicleType | null>(null);
  const [vehiclePlate, setVehiclePlate] = useState('');

  // Step 2 — Documents
  const [govtIdUrl, setGovtIdUrl] = useState('');
  const [vehicleRegUrl, setVehicleRegUrl] = useState('');

  // Step 3 — Bank
  const [bankName, setBankName] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [bankAccountName, setBankAccountName] = useState('');
  const [bankCode, setBankCode] = useState('');

  const toggleArea = (area: string) =>
    setSelectedAreas(prev => prev.includes(area) ? prev.filter(x => x !== area) : [...prev, area]);

  function addAreaTag() {
    const trimmed = areaInput.trim().replace(/,+$/, '');
    if (!trimmed) return;
    const tags = trimmed.split(',').map(t => t.trim()).filter(Boolean);
    setSelectedAreas(prev => {
      const next = [...prev];
      tags.forEach(t => { if (!next.includes(t)) next.push(t); });
      return next;
    });
    setAreaInput('');
  }

  const pickAndUpload = useCallback(async (setter: (url: string) => void) => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        feedback.toast('Allow photo access in Settings to upload documents.', 'error');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
        base64: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      setUploading(true);
      const asset = result.assets[0];
      const ext = asset.uri.split('.').pop() ?? 'jpg';
      const mime = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
      const uploadRes = await uploadApi.uploadBase64(`data:${mime};base64,${asset.base64}`, 'fleet-docs');
      setter(uploadRes.url);
    } catch {
      feedback.toast('Upload failed. Please try again.', 'error');
    } finally {
      setUploading(false);
    }
  }, [feedback]);

  const canNext = useMemo(() => {
    if (step === 0) return fullName.trim() && phone.trim() && selectedAreas.length > 0;
    if (step === 1) return !!vehicleType;
    if (step === 2) return true; // docs are optional
    if (step === 3) return bankName.trim() && bankAccount.trim() && bankAccountName.trim();
    return false;
  }, [step, fullName, phone, selectedAreas, vehicleType, bankName, bankAccount, bankAccountName]);

  const handleNext = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step < STEPS.length - 2) {
      setStep(s => s + 1);
      return;
    }
    setSubmitting(true);
    try {
      await fleetApi.registerRider({
        full_name: fullName.trim(),
        phone: phone.trim(),
        vehicle_type: vehicleType!,
        vehicle_plate: vehiclePlate.trim() || undefined,
        government_id_url: govtIdUrl || undefined,
        vehicle_registration_url: vehicleRegUrl || undefined,
        service_areas: selectedAreas,
        bank_name: bankName.trim() || undefined,
        bank_account_number: bankAccount.trim() || undefined,
        bank_account_name: bankAccountName.trim() || undefined,
        bank_code: bankCode.trim() || undefined,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep(STEPS.length - 1);
    } catch (err: any) {
      feedback.toast(err?.error ?? 'Registration failed. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (step === STEPS.length - 1) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: C.bg }]}>
        <View style={styles.successWrap}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={72} color={C.spice} />
          </View>
          <Text style={[styles.successTitle, { color: C.textInk }]}>Application Submitted!</Text>
          <Text style={[styles.successBody, { color: C.bodySoft }]}>
            Your rider profile is under review. We'll notify you within 1–2 business days. Once approved, download the FOODS Rider app to start earning.
          </Text>
          <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: C.spice }]} onPress={() => router.replace('/')}>
            <Text style={styles.primaryBtnText}>Back to Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.bg }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: C.borderWarm }]}>
        <TouchableOpacity onPress={() => step > 0 ? setStep(s => s - 1) : router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={C.textInk} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: C.textInk }]}>Register as Rider</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Progress */}
      <View style={[styles.progressWrap, { backgroundColor: C.borderWarm }]}>
        <View style={[styles.progressBar, { backgroundColor: C.spice, width: `${((step + 1) / (STEPS.length - 1)) * 100}%` }]} />
      </View>
      <Text style={[styles.stepLabel, { color: C.bodySoft }]}>Step {step + 1} of {STEPS.length - 1} — {STEPS[step]}</Text>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* ── STEP 0: About You ── */}
          {step === 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: C.textInk }]}>Tell us about yourself</Text>
              <FieldRow label="Full Name *" value={fullName} onChange={setFullName} placeholder="Your full legal name" styles={styles} C={C} />
              <FieldRow label="Phone Number *" value={phone} onChange={setPhone} placeholder="+2348012345678" keyboardType="phone-pad" styles={styles} C={C} />
              <Text style={[styles.fieldLabel, { color: C.body }]}>Areas You Cover *</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  placeholder="e.g. Lagos Island, Ikeja"
                  placeholderTextColor={C.bodySoft}
                  value={areaInput}
                  onChangeText={setAreaInput}
                  onSubmitEditing={addAreaTag}
                  blurOnSubmit={false}
                  returnKeyType="done"
                />
                <Pressable
                  onPress={addAreaTag}
                  style={{ backgroundColor: C.spice, paddingHorizontal: 14, borderRadius: 10, justifyContent: 'center' }}
                >
                  <Text style={{ color: '#fff', fontFamily: Fonts.semiBold, fontSize: 13 }}>Add</Text>
                </Pressable>
              </View>
              {selectedAreas.length > 0 && (
                <View style={styles.chipGrid}>
                  {selectedAreas.map(area => (
                    <Pressable
                      key={area}
                      style={[styles.areaChip, { backgroundColor: C.spice, borderColor: C.spice, flexDirection: 'row', alignItems: 'center', gap: 4 }]}
                      onPress={() => toggleArea(area)}
                    >
                      <Text style={[styles.areaChipText, { color: '#fff' }]}>{area}</Text>
                      <Ionicons name="close" size={11} color="#fff" />
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* ── STEP 1: Vehicle ── */}
          {step === 1 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: C.textInk }]}>Your Vehicle</Text>
              <Text style={[styles.fieldLabel, { color: C.body }]}>Vehicle Type *</Text>
              <View style={styles.typeRow}>
                <VehicleCard
                  icon="bicycle"
                  label="Motorbike"
                  selected={vehicleType === 'bike'}
                  onPress={() => setVehicleType('bike')}
                  C={C} styles={styles}
                />
                <VehicleCard
                  icon="bicycle-outline"
                  label="Bicycle"
                  selected={vehicleType === 'bicycle'}
                  onPress={() => setVehicleType('bicycle')}
                  C={C} styles={styles}
                />
              </View>
              <FieldRow label="Plate Number" value={vehiclePlate} onChange={setVehiclePlate} placeholder="e.g. LAG-123-AB (optional)" autoCapitalize="characters" styles={styles} C={C} />
            </View>
          )}

          {/* ── STEP 2: Documents ── */}
          {step === 2 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: C.textInk }]}>Documents</Text>
              <Text style={[styles.docsNote, { color: C.bodySoft }]}>
                Uploading these now speeds up your approval. You can also submit them later.
              </Text>
              <DocRow label="Government ID (NIN / Driver's Licence / Passport)" url={govtIdUrl} onPress={() => pickAndUpload(setGovtIdUrl)} uploading={uploading} C={C} styles={styles} />
              <DocRow label="Vehicle Registration / Road Worthiness" url={vehicleRegUrl} onPress={() => pickAndUpload(setVehicleRegUrl)} uploading={uploading} C={C} styles={styles} />
              <TouchableOpacity onPress={() => setStep(s => s + 1)} style={styles.skipBtn}>
                <Text style={[styles.skipText, { color: C.bodySoft }]}>Skip for now</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── STEP 3: Bank ── */}
          {step === 3 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: C.textInk }]}>Bank Details</Text>
              <Text style={[styles.docsNote, { color: C.bodySoft }]}>Weekly payouts will be sent to this account.</Text>
              <FieldRow label="Bank Name *" value={bankName} onChange={setBankName} placeholder="e.g. Zenith Bank" styles={styles} C={C} />
              <FieldRow label="Account Number *" value={bankAccount} onChange={setBankAccount} placeholder="10-digit account number" keyboardType="number-pad" styles={styles} C={C} />
              <FieldRow label="Account Name *" value={bankAccountName} onChange={setBankAccountName} placeholder="As it appears on your account" styles={styles} C={C} />
              <FieldRow label="Bank Code" value={bankCode} onChange={setBankCode} placeholder="Optional — e.g. 057" keyboardType="number-pad" styles={styles} C={C} />
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Bottom CTA */}
      <View style={[styles.bottomBar, { backgroundColor: C.bg, borderTopColor: C.borderWarm }]}>
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: canNext ? C.spice : C.borderWarm }]}
          onPress={handleNext}
          disabled={!canNext || submitting || uploading}
          activeOpacity={0.85}
        >
          {submitting
            ? <ActivityIndicator color="#fff" />
            : <Text style={[styles.primaryBtnText, !canNext && { color: C.bodySoft }]}>
                {step < STEPS.length - 2 ? 'Continue' : 'Submit Application'}
              </Text>
          }
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function VehicleCard({ icon, label, selected, onPress, C, styles }: any) {
  return (
    <Pressable
      style={[styles.vehicleCard, selected && { borderColor: C.spice, backgroundColor: '#FFF1EB' }]}
      onPress={onPress}
    >
      <Ionicons name={icon} size={32} color={selected ? C.spice : C.body} />
      <Text style={[styles.vehicleLabel, { color: selected ? C.spice : C.body }]}>{label}</Text>
      {selected && <Ionicons name="checkmark-circle" size={18} color={C.spice} style={{ position: 'absolute', top: 8, right: 8 }} />}
    </Pressable>
  );
}

function FieldRow({ label, value, onChange, placeholder, keyboardType = 'default', autoCapitalize = 'words', styles, C }: any) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, { color: C.body }]}>{label}</Text>
      <TextInput
        style={[styles.input, { borderColor: C.borderWarm, color: C.textInk, backgroundColor: C.bg }]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={C.stone}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
      />
    </View>
  );
}

function DocRow({ label, url, onPress, uploading, C, styles }: any) {
  return (
    <TouchableOpacity
      style={[styles.docRow, { borderColor: url ? C.spice : C.borderWarm, backgroundColor: url ? '#FFF1EB' : C.bg }]}
      onPress={onPress}
      disabled={uploading}
      activeOpacity={0.8}
    >
      <Ionicons name={url ? 'document-text' : 'cloud-upload-outline'} size={20} color={url ? C.spice : C.bodySoft} />
      <Text style={[styles.docLabel, { color: url ? C.spice : C.bodySoft }]} numberOfLines={1}>
        {url ? 'Uploaded' : label}
      </Text>
      {uploading ? <ActivityIndicator size="small" color={C.spice} /> : null}
    </TouchableOpacity>
  );
}

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1 },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: Spacing.md, paddingVertical: 14, borderBottomWidth: 1,
    },
    headerTitle: { fontFamily: Fonts.sansMedium, fontSize: FontSize.lg },
    progressWrap: { height: 3, marginHorizontal: Spacing.md, borderRadius: 2, marginTop: 10 },
    progressBar: { height: 3, borderRadius: 2 },
    stepLabel: { fontFamily: Fonts.sans, fontSize: FontSize.sm, marginLeft: Spacing.md, marginTop: 6, marginBottom: 4 },
    scroll: { padding: Spacing.md, paddingBottom: 120 },
    section: { gap: 16 },
    sectionTitle: { fontFamily: Fonts.sansMedium, fontSize: FontSize.xl, marginBottom: 4 },
    fieldWrap: { gap: 6 },
    fieldLabel: { fontFamily: Fonts.sansMedium, fontSize: FontSize.sm },
    input: {
      borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 12,
      fontFamily: Fonts.sans, fontSize: FontSize.md,
    },
    chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    areaChip: {
      paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.full,
      borderWidth: 1, borderColor: C.borderWarm,
    },
    areaChipText: { fontFamily: Fonts.sans, fontSize: FontSize.xs, color: C.body },
    typeRow: { flexDirection: 'row', gap: 12 },
    vehicleCard: {
      flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8,
      paddingVertical: 24, borderRadius: Radius.lg, borderWidth: 1.5, borderColor: C.borderWarm,
      ...Shadow.card,
    },
    vehicleLabel: { fontFamily: Fonts.sansMedium, fontSize: FontSize.md },
    docsNote: { fontFamily: Fonts.sans, fontSize: FontSize.sm, lineHeight: 20 },
    docRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      padding: 14, borderRadius: Radius.md, borderWidth: 1.5, borderStyle: 'dashed',
    },
    docLabel: { flex: 1, fontFamily: Fonts.sans, fontSize: FontSize.sm },
    skipBtn: { alignSelf: 'center', paddingVertical: 8 },
    skipText: { fontFamily: Fonts.sans, fontSize: FontSize.sm, textDecorationLine: 'underline' },
    bottomBar: {
      position: 'absolute', bottom: 0, left: 0, right: 0,
      padding: Spacing.md, borderTopWidth: 1, paddingBottom: Platform.OS === 'ios' ? 32 : Spacing.md,
    },
    primaryBtn: {
      height: 52, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center',
    },
    primaryBtnText: { fontFamily: Fonts.sansMedium, fontSize: FontSize.md, color: '#fff' },
    successWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, gap: 18 },
    successIcon: { marginBottom: 8 },
    successTitle: { fontFamily: Fonts.sansMedium, fontSize: FontSize.xl, textAlign: 'center' },
    successBody: { fontFamily: Fonts.sans, fontSize: FontSize.md, textAlign: 'center', lineHeight: 24 },
  });
}
