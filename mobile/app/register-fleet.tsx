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
import { fleetApi, type OperatorType, type VehicleType } from '../src/api/fleet';
import { useFeedback } from '../src/components/feedback';
import { uploadApi } from '../src/api/upload';

const STEPS = ['Type', 'Contact', 'Fleet', 'Bank', 'Done'] as const;
type Step = typeof STEPS[number];


export default function RegisterFleetScreen() {
  const router = useRouter();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const feedback = useFeedback();

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Step 0 — Type
  const [operatorType, setOperatorType] = useState<OperatorType | null>(null);

  // Step 1 — Contact
  const [businessName, setBusinessName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');

  // Step 2 — Fleet
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  const [vehicleCount, setVehicleCount] = useState('1');
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [areaInput, setAreaInput] = useState('');
  const [idDocUrl, setIdDocUrl] = useState('');
  const [vehicleDocsUrl, setVehicleDocsUrl] = useState('');
  const [insuranceUrl, setInsuranceUrl] = useState('');

  // Step 3 — Bank
  const [bankName, setBankName] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [bankAccountName, setBankAccountName] = useState('');
  const [bankCode, setBankCode] = useState('');

  const stepLabel = STEPS[step];

  const toggleVehicle = (v: VehicleType) =>
    setVehicleTypes(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);

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
    if (step === 0) return !!operatorType;
    if (step === 1) return businessName.trim() && contactName.trim() && contactPhone.trim();
    if (step === 2) return vehicleTypes.length > 0 && selectedAreas.length > 0;
    if (step === 3) return bankName.trim() && bankAccount.trim() && bankAccountName.trim();
    return false;
  }, [step, operatorType, businessName, contactName, contactPhone, vehicleTypes, selectedAreas, bankName, bankAccount, bankAccountName]);

  const handleNext = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step < STEPS.length - 2) {
      setStep(s => s + 1);
      return;
    }
    // Final step — submit
    setSubmitting(true);
    try {
      await fleetApi.registerOperator({
        operator_type: operatorType!,
        business_name: businessName.trim(),
        contact_name: contactName.trim(),
        contact_phone: contactPhone.trim(),
        contact_email: contactEmail.trim() || undefined,
        vehicle_types: vehicleTypes,
        vehicle_count: parseInt(vehicleCount) || 1,
        service_areas: selectedAreas,
        id_document_url: idDocUrl || undefined,
        vehicle_docs_url: vehicleDocsUrl || undefined,
        insurance_url: insuranceUrl || undefined,
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
            Our team will review your fleet registration within 1–2 business days. We'll notify you once it's approved.
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
        <Text style={[styles.headerTitle, { color: C.textInk }]}>Register Fleet</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Progress bar */}
      <View style={[styles.progressWrap, { backgroundColor: C.borderWarm }]}>
        <View style={[styles.progressBar, { backgroundColor: C.spice, width: `${((step + 1) / (STEPS.length - 1)) * 100}%` }]} />
      </View>
      <Text style={[styles.stepLabel, { color: C.bodySoft }]}>Step {step + 1} of {STEPS.length - 1} — {stepLabel}</Text>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* ── STEP 0: Type ── */}
          {step === 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: C.textInk }]}>Are you registering as…</Text>
              <TypeCard
                icon="business-outline"
                title="Fleet Company"
                subtitle="You own multiple vehicles and manage riders"
                selected={operatorType === 'company'}
                onPress={() => setOperatorType('company')}
                C={C} styles={styles}
              />
              <TypeCard
                icon="bicycle-outline"
                title="Individual Rider-Owner"
                subtitle="You own your vehicle and ride yourself"
                selected={operatorType === 'individual'}
                onPress={() => setOperatorType('individual')}
                C={C} styles={styles}
              />
            </View>
          )}

          {/* ── STEP 1: Contact ── */}
          {step === 1 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: C.textInk }]}>Business & Contact Details</Text>
              <Field label="Business Name *" value={businessName} onChange={setBusinessName} placeholder="e.g. Swift Riders Ltd" styles={styles} C={C} />
              <Field label="Contact Person *" value={contactName} onChange={setContactName} placeholder="Full name of contact" styles={styles} C={C} />
              <Field label="Phone Number *" value={contactPhone} onChange={setContactPhone} placeholder="+2348012345678" keyboardType="phone-pad" styles={styles} C={C} />
              <Field label="Email Address" value={contactEmail} onChange={setContactEmail} placeholder="Optional — for approval notification" keyboardType="email-address" autoCapitalize="none" styles={styles} C={C} />
            </View>
          )}

          {/* ── STEP 2: Fleet ── */}
          {step === 2 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: C.textInk }]}>Fleet Details</Text>

              <Text style={[styles.fieldLabel, { color: C.body }]}>Vehicle Types *</Text>
              <View style={styles.chipRow}>
                {(['bike', 'bicycle'] as VehicleType[]).map(v => (
                  <Pressable
                    key={v}
                    style={[styles.chip, vehicleTypes.includes(v) && { backgroundColor: C.spice, borderColor: C.spice }]}
                    onPress={() => toggleVehicle(v)}
                  >
                    <Ionicons
                      name={v === 'bike' ? 'bicycle' : 'bicycle-outline'}
                      size={16}
                      color={vehicleTypes.includes(v) ? '#fff' : C.body}
                    />
                    <Text style={[styles.chipText, vehicleTypes.includes(v) && { color: '#fff' }]}>
                      {v === 'bike' ? 'Motorbike' : 'Bicycle'}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Field label="Number of Vehicles" value={vehicleCount} onChange={setVehicleCount} keyboardType="number-pad" placeholder="1" styles={styles} C={C} />

              <Text style={[styles.fieldLabel, { color: C.body }]}>Service Areas *</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  placeholder="e.g. Lagos, Abuja, Kano"
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

              <Text style={[styles.sectionSubTitle, { color: C.textInk }]}>Documents <Text style={[styles.optionalTag, { color: C.bodySoft }]}>(optional but speeds up approval)</Text></Text>
              <DocRow label="Government / CAC ID" url={idDocUrl} onPress={() => pickAndUpload(setIdDocUrl)} uploading={uploading} C={C} styles={styles} />
              <DocRow label="Vehicle Registration Docs" url={vehicleDocsUrl} onPress={() => pickAndUpload(setVehicleDocsUrl)} uploading={uploading} C={C} styles={styles} />
              <DocRow label="Insurance Certificate" url={insuranceUrl} onPress={() => pickAndUpload(setInsuranceUrl)} uploading={uploading} C={C} styles={styles} />
            </View>
          )}

          {/* ── STEP 3: Bank ── */}
          {step === 3 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: C.textInk }]}>Bank Details</Text>
              <Text style={[styles.bankNote, { color: C.bodySoft }]}>Weekly payouts will be sent to this account.</Text>
              <Field label="Bank Name *" value={bankName} onChange={setBankName} placeholder="e.g. Zenith Bank" styles={styles} C={C} />
              <Field label="Account Number *" value={bankAccount} onChange={setBankAccount} placeholder="10-digit account number" keyboardType="number-pad" styles={styles} C={C} />
              <Field label="Account Name *" value={bankAccountName} onChange={setBankAccountName} placeholder="As it appears on your account" styles={styles} C={C} />
              <Field label="Bank Code" value={bankCode} onChange={setBankCode} placeholder="Optional — e.g. 057" keyboardType="number-pad" styles={styles} C={C} />
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

// ── Sub-components ────────────────────────────────────────────────────────────

function TypeCard({ icon, title, subtitle, selected, onPress, C, styles }: any) {
  return (
    <Pressable
      style={[styles.typeCard, selected && { borderColor: C.spice, backgroundColor: '#FFF1EB' }]}
      onPress={onPress}
    >
      <View style={[styles.typeIconWrap, { backgroundColor: selected ? C.spice : C.borderWarm }]}>
        <Ionicons name={icon} size={26} color={selected ? '#fff' : C.body} />
      </View>
      <View style={{ flex: 1, marginLeft: 14 }}>
        <Text style={[styles.typeTitle, { color: C.textInk }]}>{title}</Text>
        <Text style={[styles.typeSub, { color: C.bodySoft }]}>{subtitle}</Text>
      </View>
      {selected && <Ionicons name="checkmark-circle" size={22} color={C.spice} />}
    </Pressable>
  );
}

function Field({ label, value, onChange, placeholder, keyboardType = 'default', autoCapitalize = 'words', styles, C }: any) {
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
        {url ? 'Document uploaded' : label}
      </Text>
      {uploading ? <ActivityIndicator size="small" color={C.spice} /> : null}
    </TouchableOpacity>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

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
    sectionSubTitle: { fontFamily: Fonts.sansMedium, fontSize: FontSize.md, marginTop: 8 },
    optionalTag: { fontFamily: Fonts.sans, fontSize: FontSize.sm },

    // Type cards
    typeCard: {
      flexDirection: 'row', alignItems: 'center', padding: Spacing.md,
      borderRadius: Radius.lg, borderWidth: 1.5, borderColor: C.borderWarm, backgroundColor: C.bg,
      ...Shadow.card,
    },
    typeIconWrap: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
    typeTitle: { fontFamily: Fonts.sansMedium, fontSize: FontSize.md, marginBottom: 2 },
    typeSub: { fontFamily: Fonts.sans, fontSize: FontSize.sm, lineHeight: 18 },

    // Fields
    fieldWrap: { gap: 6 },
    fieldLabel: { fontFamily: Fonts.sansMedium, fontSize: FontSize.sm },
    input: {
      borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 12,
      fontFamily: Fonts.sans, fontSize: FontSize.md,
    },

    // Vehicle/area chips
    chipRow: { flexDirection: 'row', gap: 10 },
    chip: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: 14, paddingVertical: 10, borderRadius: Radius.full,
      borderWidth: 1.5, borderColor: C.borderWarm,
    },
    chipText: { fontFamily: Fonts.sans, fontSize: FontSize.sm, color: C.body },
    chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    areaChip: {
      paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.full,
      borderWidth: 1, borderColor: C.borderWarm,
    },
    areaChipText: { fontFamily: Fonts.sans, fontSize: FontSize.xs, color: C.body },

    // Documents
    docRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      padding: 14, borderRadius: Radius.md, borderWidth: 1.5, borderStyle: 'dashed',
    },
    docLabel: { flex: 1, fontFamily: Fonts.sans, fontSize: FontSize.sm },

    // Bank
    bankNote: { fontFamily: Fonts.sans, fontSize: FontSize.sm, lineHeight: 20, marginBottom: 4 },

    // Bottom
    bottomBar: {
      position: 'absolute', bottom: 0, left: 0, right: 0,
      padding: Spacing.md, borderTopWidth: 1, paddingBottom: Platform.OS === 'ios' ? 32 : Spacing.md,
    },
    primaryBtn: {
      height: 52, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center',
    },
    primaryBtnText: { fontFamily: Fonts.sansMedium, fontSize: FontSize.md, color: '#fff' },

    // Success
    successWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, gap: 18 },
    successIcon: { marginBottom: 8 },
    successTitle: { fontFamily: Fonts.sansMedium, fontSize: FontSize.xl, textAlign: 'center' },
    successBody: { fontFamily: Fonts.sans, fontSize: FontSize.md, textAlign: 'center', lineHeight: 24 },
  });
}
