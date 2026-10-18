import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform,
  Pressable, Modal, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useColors, type AppColors } from '../src/context/ThemeContext';
import { Fonts, Spacing, Radius, FontSize, Shadow } from '../src/constants/theme';
import { fleetApi, type VehicleType, type KycType, type IdTypeOption } from '../src/api/fleet';
import { COUNTRIES, deviceCountry, type Country } from '../src/constants/countries';
import { useFeedback } from '../src/components/feedback';
import { uploadApi } from '../src/api/upload';
import { useTranslation } from 'react-i18next';

export default function RegisterRiderScreen() {
  const router = useRouter();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const feedback = useFeedback();
  const { t } = useTranslation();

  const STEPS = [
    t('register_rider.step_about'),
    t('register_rider.step_vehicle'),
    t('register_rider.step_documents'),
    t('register_rider.step_verify_identity'),
    t('register_rider.step_bank'),
    t('register_rider.step_done'),
  ] as const;

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

  // Step 2 — Documents (the ID itself is step 3, stored privately)
  const [vehicleRegUrl, setVehicleRegUrl] = useState('');

  // Step 3 — Verify Identity: the rider's own country's national ID (no BVN).
  const [idCountry, setIdCountry] = useState<Country>(deviceCountry);
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [idTypes, setIdTypes] = useState<IdTypeOption[]>([]);
  const [kycType, setKycType] = useState<KycType | null>(null);
  const [kycValue, setKycValue] = useState('');
  const [idPhoto, setIdPhoto] = useState<string | null>(null); // data URI, sent privately on submit
  const [kycVerifying, setKycVerifying] = useState(false);
  const [kycInlineResult, setKycInlineResult] = useState<{ verified: boolean; name: string | null } | null>(null);
  const [kycInlineError, setKycInlineError] = useState('');
  const [kycResult, setKycResult] = useState<'verified' | 'review' | 'failed' | null>(null);

  const selectedIdType = idTypes.find(x => x.type === kycType) ?? null;

  useEffect(() => {
    let live = true;
    fleetApi.idTypes(idCountry.iso)
      .then(res => {
        if (!live) return;
        setIdTypes(res.id_types);
        setKycType(res.id_types[0]?.type ?? null);
      })
      .catch(() => { if (live) setIdTypes([]); });
    setKycValue(''); setKycInlineResult(null); setKycInlineError('');
    return () => { live = false; };
  }, [idCountry.iso]);

  const filteredCountries = useMemo(() =>
    COUNTRIES.filter(c => c.name.toLowerCase().includes(countrySearch.toLowerCase())), [countrySearch]);

  // Step 4 — Bank
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
        feedback.toast({ type: 'error', title: t('register_rider.photo_access_denied') });
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
      feedback.toast({ type: 'error', title: t('register_rider.upload_failed') });
    } finally {
      setUploading(false);
    }
  }, [feedback, t]);

  const canNext = useMemo(() => {
    if (step === 0) return fullName.trim() && phone.trim() && selectedAreas.length > 0;
    if (step === 1) return !!vehicleType;
    if (step === 2) return true; // docs are optional
    if (step === 3) return true; // KYC is optional
    if (step === 4) return bankName.trim() && bankAccount.trim() && bankAccountName.trim();
    return false;
  }, [step, fullName, phone, selectedAreas, vehicleType, bankName, bankAccount, bankAccountName]);

  // The ID photo stays on the device until submit, then goes to the private
  // KYC endpoint, never the public uploader.
  const pickIdPhoto = useCallback(async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        feedback.toast({ type: 'error', title: t('register_rider.photo_access_denied') });
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        base64: true,
      });
      if (result.canceled || !result.assets?.[0]?.base64) return;
      const asset = result.assets[0];
      const ext = (asset.uri.split('.').pop() ?? 'jpg').toLowerCase();
      const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      setIdPhoto(`data:${mime};base64,${asset.base64}`);
    } catch {
      feedback.toast({ type: 'error', title: t('register_rider.upload_failed') });
    }
  }, [feedback, t]);

  const handleVerifyKyc = async () => {
    if (!kycType || !kycValue.trim()) return;
    setKycVerifying(true);
    setKycInlineError('');
    setKycInlineResult(null);
    try {
      const res = await fleetApi.checkIdentity({ country: idCountry.iso, type: kycType, value: kycValue.trim() });
      if (res.verified) setKycInlineResult({ verified: true, name: res.verified_name ?? null });
      else setKycInlineError(t('register_rider.id_review_note'));
    } catch (err: any) {
      setKycInlineError(err?.error ?? t('register_rider.kyc_verification_failed'));
      setKycInlineResult({ verified: false, name: null });
    } finally {
      setKycVerifying(false);
    }
  };

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
        vehicle_registration_url: vehicleRegUrl || undefined,
        service_areas: selectedAreas,
        bank_name: bankName.trim() || undefined,
        bank_account_number: bankAccount.trim() || undefined,
        bank_account_name: bankAccountName.trim() || undefined,
        bank_code: bankCode.trim() || undefined,
      });

      // KYC now that the profile exists: verified at once where the country has
      // an automated check, otherwise the ID photo goes to our team for review.
      if (kycType && kycValue.trim()) {
        try {
          const res = await fleetApi.submitKyc({
            country: idCountry.iso, type: kycType, value: kycValue.trim(), document: idPhoto ?? undefined,
          });
          setKycResult(res.verified ? 'verified' : 'review');
        } catch {
          setKycResult('failed');
        }
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep(STEPS.length - 1);
    } catch (err: any) {
      feedback.toast({ type: 'error', title: err?.error ?? t('register_rider.registration_failed') });
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
          <Text style={[styles.successTitle, { color: C.textInk }]}>{t('register_rider.submitted_title')}</Text>
          <Text style={[styles.successBody, { color: C.bodySoft }]}>
            {t('register_rider.submitted_body')}
          </Text>
          {kycResult === 'verified' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F0FDF4', padding: 12, borderRadius: 10 }}>
              <Ionicons name="shield-checkmark" size={18} color="#16A34A" />
              <Text style={{ fontFamily: Fonts.sansMedium, fontSize: FontSize.sm, color: '#16A34A' }}>{t('register_rider.identity_verified')}</Text>
            </View>
          )}
          {kycResult === 'review' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.bgCard, padding: 12, borderRadius: 10 }}>
              <Ionicons name="time-outline" size={18} color={C.body} />
              <Text style={{ fontFamily: Fonts.sans, fontSize: FontSize.sm, color: C.body, flex: 1 }}>{t('register_rider.identity_in_review')}</Text>
            </View>
          )}
          {kycResult === 'failed' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEF2F2', padding: 12, borderRadius: 10 }}>
              <Ionicons name="alert-circle-outline" size={18} color="#DC2626" />
              <Text style={{ fontFamily: Fonts.sans, fontSize: FontSize.sm, color: '#DC2626', flex: 1 }}>
                {t('register_rider.identity_check_failed')}
              </Text>
            </View>
          )}
          <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: C.spice }]} onPress={() => router.replace('/')}>
            <Text style={styles.primaryBtnText}>{t('register_rider.back_to_home')}</Text>
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
        <Text style={[styles.headerTitle, { color: C.textInk }]}>{t('register_rider.title')}</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Progress */}
      <View style={[styles.progressWrap, { backgroundColor: C.borderWarm }]}>
        <View style={[styles.progressBar, { backgroundColor: C.spice, width: `${((step + 1) / (STEPS.length - 1)) * 100}%` }]} />
      </View>
      <Text style={[styles.stepLabel, { color: C.bodySoft }]}>{t('register_rider.step_progress', { current: step + 1, total: STEPS.length - 1, label: STEPS[step] })}</Text>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* ── STEP 0: About You ── */}
          {step === 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: C.textInk }]}>{t('register_rider.about_yourself')}</Text>
              <FieldRow label={t('register_rider.full_name')} value={fullName} onChange={setFullName} placeholder={t('register_rider.full_name_placeholder')} styles={styles} C={C} />
              <FieldRow label={t('register_rider.phone_number')} value={phone} onChange={setPhone} placeholder="+2348012345678" keyboardType="phone-pad" styles={styles} C={C} />
              <Text style={[styles.fieldLabel, { color: C.body }]}>{t('register_rider.areas_covered')}</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  placeholder={t('register_rider.areas_placeholder')}
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
                  <Text style={{ color: '#fff', fontFamily: Fonts.sansMedium, fontSize: 13 }}>{t('register_rider.add')}</Text>
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
              <Text style={[styles.sectionTitle, { color: C.textInk }]}>{t('register_rider.your_vehicle')}</Text>
              <Text style={[styles.fieldLabel, { color: C.body }]}>{t('register_rider.vehicle_type')}</Text>
              <View style={styles.typeRow}>
                <VehicleCard
                  icon="bicycle"
                  label={t('register_rider.motorbike')}
                  selected={vehicleType === 'bike'}
                  onPress={() => setVehicleType('bike')}
                  C={C} styles={styles}
                />
                <VehicleCard
                  icon="bicycle-outline"
                  label={t('register_rider.bicycle')}
                  selected={vehicleType === 'bicycle'}
                  onPress={() => setVehicleType('bicycle')}
                  C={C} styles={styles}
                />
              </View>
              <FieldRow label={t('register_rider.plate_number')} value={vehiclePlate} onChange={setVehiclePlate} placeholder={t('register_rider.plate_placeholder')} autoCapitalize="characters" styles={styles} C={C} />
            </View>
          )}

          {/* ── STEP 2: Documents ── */}
          {step === 2 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: C.textInk }]}>{t('register_rider.documents')}</Text>
              <Text style={[styles.docsNote, { color: C.bodySoft }]}>
                {t('register_rider.documents_hint')}
              </Text>
              <DocRow label={t('register_rider.vehicle_reg')} url={vehicleRegUrl} onPress={() => pickAndUpload(setVehicleRegUrl)} uploading={uploading} C={C} styles={styles} t={t} />
              <TouchableOpacity onPress={() => setStep(s => s + 1)} style={styles.skipBtn}>
                <Text style={[styles.skipText, { color: C.bodySoft }]}>{t('register_rider.skip_for_now')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── STEP 3: Verify Identity ── */}
          {step === 3 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: C.textInk }]}>{t('register_rider.verify_identity')}</Text>
              <Text style={[styles.docsNote, { color: C.bodySoft }]}>
                {t('register_rider.verify_identity_hint_v2')}
              </Text>

              {/* Country of the ID */}
              <View style={styles.fieldWrap}>
                <Text style={[styles.fieldLabel, { color: C.body }]}>{t('register_rider.id_country')}</Text>
                <TouchableOpacity
                  style={[styles.input, { borderColor: C.borderWarm, backgroundColor: C.bg, flexDirection: 'row', alignItems: 'center' }]}
                  onPress={() => setCountryPickerOpen(true)}
                  activeOpacity={0.8}
                >
                  <Text style={{ flex: 1, fontFamily: Fonts.sans, fontSize: FontSize.md, color: C.textInk }}>{idCountry.name}</Text>
                  <Ionicons name="chevron-down" size={18} color={C.bodySoft} />
                </TouchableOpacity>
              </View>

              {/* Which ID: only shown when the country accepts more than one */}
              {idTypes.length > 1 && (
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  {idTypes.map(opt => (
                    <Pressable
                      key={opt.type}
                      onPress={() => { setKycType(opt.type); setKycValue(''); setKycInlineResult(null); setKycInlineError(''); }}
                      style={{
                        flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1.5, alignItems: 'center',
                        borderColor: kycType === opt.type ? C.spice : C.borderWarm,
                        backgroundColor: kycType === opt.type ? '#FFF1EB' : C.bg,
                      }}
                    >
                      <Text style={{ fontFamily: Fonts.sansMedium, fontSize: FontSize.sm, color: kycType === opt.type ? C.spice : C.body }}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}

              <View style={{ gap: 10 }}>
                <FieldRow
                  label={selectedIdType?.label ?? t('register_rider.id_number')}
                  value={kycValue}
                  onChange={(v: string) => { setKycValue(v); setKycInlineResult(null); setKycInlineError(''); }}
                  placeholder={selectedIdType?.placeholder ?? ''}
                  autoCapitalize="characters"
                  styles={styles}
                  C={C}
                />

                {/* Instant check, only where the country has one */}
                {selectedIdType?.automatic && !kycInlineResult?.verified && (
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                      paddingVertical: 12, borderRadius: Radius.md, borderWidth: 1.5,
                      borderColor: kycValue.trim() ? C.spice : C.borderWarm,
                      backgroundColor: kycValue.trim() ? '#FFF1EB' : C.bg,
                      opacity: kycVerifying ? 0.7 : 1,
                    }}
                    onPress={handleVerifyKyc}
                    disabled={kycVerifying || !kycValue.trim()}
                    activeOpacity={0.8}
                  >
                    {kycVerifying
                      ? <ActivityIndicator size="small" color={C.spice} />
                      : <Ionicons name="shield-checkmark-outline" size={18} color={kycValue.trim() ? C.spice : C.stone} />
                    }
                    <Text style={{ fontFamily: Fonts.sansMedium, fontSize: FontSize.sm, color: kycValue.trim() ? C.spice : C.stone }}>
                      {kycVerifying ? t('register_rider.verifying') : t('register_rider.verify_now')}
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Photo of the ID — reviewed by our team where there's no instant check */}
                {!kycInlineResult?.verified && (
                  <>
                    <TouchableOpacity
                      style={[styles.docRow, { borderColor: idPhoto ? C.spice : C.borderWarm, backgroundColor: idPhoto ? '#FFF1EB' : C.bg }]}
                      onPress={pickIdPhoto}
                      activeOpacity={0.8}
                    >
                      <Ionicons name={idPhoto ? 'document-text' : 'camera-outline'} size={20} color={idPhoto ? C.spice : C.bodySoft} />
                      <Text style={[styles.docLabel, { color: idPhoto ? C.spice : C.bodySoft }]} numberOfLines={1}>
                        {idPhoto ? t('register_rider.id_photo_added') : t('register_rider.id_photo')}
                      </Text>
                    </TouchableOpacity>
                    <Text style={[styles.docsNote, { color: C.stone }]}>{t('register_rider.id_photo_hint')}</Text>
                  </>
                )}

                {/* Result banners */}
                {kycInlineResult?.verified && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F0FDF4', padding: 12, borderRadius: 10 }}>
                    <Ionicons name="shield-checkmark" size={18} color="#16A34A" />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: Fonts.sansMedium, fontSize: FontSize.sm, color: '#16A34A' }}>{t('register_rider.identity_verified')}</Text>
                      {kycInlineResult.name && (
                        <Text style={{ fontFamily: Fonts.sans, fontSize: FontSize.xs, color: '#16A34A' }}>{kycInlineResult.name}</Text>
                      )}
                    </View>
                  </View>
                )}
                {!!kycInlineError && (
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#FEF2F2', padding: 12, borderRadius: 10 }}>
                    <Ionicons name="alert-circle-outline" size={18} color="#DC2626" />
                    <Text style={{ fontFamily: Fonts.sans, fontSize: FontSize.sm, color: '#DC2626', flex: 1 }}>{kycInlineError}</Text>
                  </View>
                )}
              </View>

              <TouchableOpacity onPress={() => setStep(s => s + 1)} style={styles.skipBtn}>
                <Text style={[styles.skipText, { color: C.bodySoft }]}>{t('register_rider.skip_for_now')}</Text>
              </TouchableOpacity>

              <Modal visible={countryPickerOpen} animationType="slide" onRequestClose={() => setCountryPickerOpen(false)}>
                <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
                  <View style={[styles.header, { borderBottomColor: C.borderWarm }]}>
                    <TouchableOpacity onPress={() => setCountryPickerOpen(false)} hitSlop={12}>
                      <Ionicons name="close" size={24} color={C.textInk} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: C.textInk }]}>{t('register_rider.id_country')}</Text>
                    <View style={{ width: 24 }} />
                  </View>
                  <TextInput
                    style={[styles.input, { margin: Spacing.md, borderColor: C.borderWarm, color: C.textInk }]}
                    placeholder={t('auth.search_country')}
                    placeholderTextColor={C.stone}
                    value={countrySearch}
                    onChangeText={setCountrySearch}
                  />
                  <FlatList
                    data={filteredCountries}
                    keyExtractor={item => item.iso}
                    keyboardShouldPersistTaps="handled"
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: 14 }}
                        onPress={() => { setIdCountry(item); setCountryPickerOpen(false); setCountrySearch(''); }}
                      >
                        <Text style={{ flex: 1, fontFamily: Fonts.sans, fontSize: FontSize.md, color: C.textInk }}>{item.name}</Text>
                        {item.iso === idCountry.iso && <Ionicons name="checkmark" size={18} color={C.spice} />}
                      </TouchableOpacity>
                    )}
                  />
                </SafeAreaView>
              </Modal>
            </View>
          )}

          {step === 4 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: C.textInk }]}>{t('register_rider.bank_details')}</Text>
              <Text style={[styles.docsNote, { color: C.bodySoft }]}>{t('register_rider.bank_details_hint')}</Text>
              <FieldRow label={t('register_rider.bank_name')} value={bankName} onChange={setBankName} placeholder={t('register_rider.bank_name_placeholder')} styles={styles} C={C} />
              <FieldRow label={t('register_rider.account_number')} value={bankAccount} onChange={setBankAccount} placeholder={t('register_rider.account_number_placeholder')} keyboardType="number-pad" styles={styles} C={C} />
              <FieldRow label={t('register_rider.account_name')} value={bankAccountName} onChange={setBankAccountName} placeholder={t('register_rider.account_name_placeholder')} styles={styles} C={C} />
              <FieldRow label={t('register_rider.bank_code')} value={bankCode} onChange={setBankCode} placeholder={t('register_rider.bank_code_placeholder')} keyboardType="number-pad" styles={styles} C={C} />
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
                {step < STEPS.length - 2 ? t('register_rider.continue') : t('register_rider.submit_application')}
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

function DocRow({ label, url, onPress, uploading, C, styles, t }: any) {
  return (
    <TouchableOpacity
      style={[styles.docRow, { borderColor: url ? C.spice : C.borderWarm, backgroundColor: url ? '#FFF1EB' : C.bg }]}
      onPress={onPress}
      disabled={uploading}
      activeOpacity={0.8}
    >
      <Ionicons name={url ? 'document-text' : 'cloud-upload-outline'} size={20} color={url ? C.spice : C.bodySoft} />
      <Text style={[styles.docLabel, { color: url ? C.spice : C.bodySoft }]} numberOfLines={1}>
        {url ? t('register_rider.uploaded') : label}
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
