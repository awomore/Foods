import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Modal, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { cooksApi } from '../src/api/cooks';
import { useAuth } from '../src/context/AuthContext';
import { Fonts, Spacing, Radius } from '../src/constants/theme';
import { useColors, type AppColors } from '../src/context/ThemeContext';

const PRONOUNS_OPTIONS = [
  { label: 'She / Her', value: 'she_her' },
  { label: 'He / Him', value: 'he_him' },
  { label: 'They / Them', value: 'they_them' },
];

const NIGERIAN_BANKS = [
  { name: 'Access Bank', code: '044' },
  { name: 'Citibank', code: '023' },
  { name: 'EcoBank', code: '050' },
  { name: 'Fidelity Bank', code: '070' },
  { name: 'First Bank', code: '011' },
  { name: 'First City Monument Bank (FCMB)', code: '214' },
  { name: 'GTBank', code: '058' },
  { name: 'Heritage Bank', code: '030' },
  { name: 'Keystone Bank', code: '082' },
  { name: 'Kuda Bank', code: '90267' },
  { name: 'Moniepoint', code: '50515' },
  { name: 'OPay', code: '999992' },
  { name: 'PalmPay', code: '999991' },
  { name: 'Polaris Bank', code: '076' },
  { name: 'Stanbic IBTC', code: '221' },
  { name: 'Standard Chartered', code: '068' },
  { name: 'Sterling Bank', code: '232' },
  { name: 'UBA', code: '033' },
  { name: 'Union Bank', code: '032' },
  { name: 'Unity Bank', code: '215' },
  { name: 'Wema Bank', code: '035' },
  { name: 'Zenith Bank', code: '057' },
];

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode; placeholder?: string }) {
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
      {hint && <Text style={styles.fieldHint}>{hint}</Text>}
    </View>
  );
}

export default function CookOnboardingScreen() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [pronouns, setPronouns] = useState('she_her');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [bankAccountName, setBankAccountName] = useState('');
  const [showBankPicker, setShowBankPicker] = useState(false);
  const [bankSearch, setBankSearch] = useState('');

  async function handleSubmit() {
    if (!displayName.trim() || !username.trim()) {
      Alert.alert('Required', 'Display name and username are required');
      return;
    }

    if (username.length < 3 || !/^[a-z0-9_]+$/.test(username)) {
      Alert.alert('Invalid username', 'Username must be at least 3 characters, lowercase letters, numbers and underscores only');
      return;
    }

    setSubmitting(true);
    try {
      await cooksApi.onboard({
        display_name: displayName.trim(),
        username: username.trim().toLowerCase(),
        pronouns: pronouns as any,
        bio: bio.trim() || undefined,
        location: location.trim() || undefined,
        bank_name: bankName || undefined,
        bank_code: bankCode || undefined,
        bank_account_number: bankAccount.trim() || undefined,
        bank_account_name: bankAccountName.trim() || undefined,
      });
      await refreshUser();
      router.replace('/(cook)' as any);
    } catch (e: any) {
      Alert.alert('Error', e.error ?? 'Could not create cook profile. Username may be taken.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.root}>
        <SafeAreaView>
          <View style={styles.topBar}>
            <Text style={styles.step}>Step {step} of 2</Text>
            <View style={styles.progress}>
              <View style={[styles.progressFill, { width: step === 1 ? '50%' : '100%' }]} />
            </View>
          </View>
        </SafeAreaView>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 120 }}>
          {step === 1 && (
            <View style={{ gap: 20 }}>
              <View>
                <Text style={styles.pageTitle}>Set up your kitchen</Text>
                <Text style={styles.pageSub}>This is how customers will find and know you</Text>
              </View>

              <Field label="Kitchen / display name *" placeholder="e.g. Mama Ify's Kitchen">
                <TextInput
                  style={styles.input}
                  value={displayName}
                  onChangeText={setDisplayName}
                  placeholder="Your kitchen or chef name"
                  placeholderTextColor={C.stone}
                  autoCapitalize="words"
                  maxLength={50}
                />
              </Field>

              <Field label="Username *" placeholder="e.g. mama_ify" hint="Lowercase letters, numbers, underscores only">
                <View style={styles.usernameWrap}>
                  <Text style={styles.atSign}>@</Text>
                  <TextInput
                    style={[styles.input, { flex: 1, borderWidth: 0, paddingLeft: 0 }]}
                    value={username}
                    onChangeText={t => setUsername(t.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    placeholder="yourkitchen"
                    placeholderTextColor={C.stone}
                    autoCapitalize="none"
                    maxLength={30}
                  />
                </View>
              </Field>

              <Field label="Pronouns">
                <View style={styles.pronounsRow}>
                  {PRONOUNS_OPTIONS.map(o => (
                    <TouchableOpacity
                      key={o.value}
                      style={[styles.pronounsChip, pronouns === o.value && styles.pronounsChipActive]}
                      onPress={() => setPronouns(o.value)}
                    >
                      <Text style={[styles.pronounsText, pronouns === o.value && styles.pronounsTextActive]}>{o.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </Field>

              <Field label="Bio" hint="Tell customers about your cooking style">
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={bio}
                  onChangeText={setBio}
                  placeholder="I cook authentic Nigerian dishes with ingredients from local markets…"
                  placeholderTextColor={C.stone}
                  multiline
                  numberOfLines={4}
                  maxLength={300}
                />
              </Field>

              <Field label="Location" hint="Your city or area">
                <TextInput
                  style={styles.input}
                  value={location}
                  onChangeText={setLocation}
                  placeholder="Lagos, Lekki"
                  placeholderTextColor={C.stone}
                  autoCapitalize="words"
                />
              </Field>
            </View>
          )}

          {step === 2 && (
            <View style={{ gap: 20 }}>
              <View>
                <Text style={styles.pageTitle}>Payment details</Text>
                <Text style={styles.pageSub}>How would you like to receive your earnings? You can update this later.</Text>
              </View>

              <Field label="Bank" hint="Select your bank for Flutterwave payouts">
                <TouchableOpacity
                  style={[styles.input, styles.bankPickerBtn]}
                  onPress={() => { setBankSearch(''); setShowBankPicker(true); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.bankPickerText, !bankName && { color: C.stone }]}>
                    {bankName || 'Select a bank'}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color={C.bodySoft} />
                </TouchableOpacity>
              </Field>

              <Field label="Account number">
                <TextInput
                  style={styles.input}
                  value={bankAccount}
                  onChangeText={setBankAccount}
                  placeholder="10-digit account number"
                  placeholderTextColor={C.stone}
                  keyboardType="numeric"
                  maxLength={10}
                />
              </Field>

              <Field label="Account name">
                <TextInput
                  style={styles.input}
                  value={bankAccountName}
                  onChangeText={setBankAccountName}
                  placeholder="Name on the account"
                  placeholderTextColor={C.stone}
                  autoCapitalize="words"
                />
              </Field>

              <View style={styles.skipNote}>
                <Ionicons name="information-circle-outline" size={14} color={C.bodySoft} />
                <Text style={styles.skipNoteText}>You can skip this for now and add it from your Profile settings.</Text>
              </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.stickyBar}>
          {step === 2 && (
            <TouchableOpacity style={styles.backBtn} onPress={() => setStep(1)}>
              <Ionicons name="arrow-back" size={18} color={C.textInk} />
              <Text style={styles.backBtnText}>Back</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.nextBtn, submitting && { opacity: 0.6 }]}
            onPress={step === 1 ? () => setStep(2) : handleSubmit}
            disabled={submitting || (step === 1 && (!displayName.trim() || !username.trim()))}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color={C.canvas} />
            ) : (
              <>
                <Text style={styles.nextBtnText}>{step === 1 ? 'Continue' : 'Launch my kitchen'}</Text>
                <Ionicons name="arrow-forward" size={16} color={C.canvas} />
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <Modal visible={showBankPicker} animationType="slide" transparent onRequestClose={() => setShowBankPicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Select bank</Text>
            <View style={styles.bankSearchWrap}>
              <Ionicons name="search-outline" size={16} color={C.bodySoft} />
              <TextInput
                style={styles.bankSearchInput}
                placeholder="Search banks…"
                placeholderTextColor={C.stone}
                value={bankSearch}
                onChangeText={setBankSearch}
                autoFocus
              />
            </View>
            <FlatList
              data={NIGERIAN_BANKS.filter(b => b.name.toLowerCase().includes(bankSearch.toLowerCase()))}
              keyExtractor={b => b.code}
              showsVerticalScrollIndicator={false}
              style={{ maxHeight: 360 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.bankRow, bankCode === item.code && styles.bankRowActive]}
                  onPress={() => { setBankName(item.name); setBankCode(item.code); setShowBankPicker(false); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.bankRowText, bankCode === item.code && styles.bankRowTextActive]}>
                    {item.name}
                  </Text>
                  {bankCode === item.code && <Ionicons name="checkmark" size={16} color={C.spice} />}
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowBankPicker(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function makeStyles(C: AppColors) { return StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  topBar: { paddingHorizontal: Spacing.lg, paddingTop: 12, paddingBottom: 8, gap: 8 },
  step: { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft },
  progress: { height: 3, backgroundColor: C.bgCook, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: C.spice },

  pageTitle: { fontFamily: Fonts.serif, fontSize: 26, color: C.textInk, marginBottom: 4 },
  pageSub: { fontFamily: Fonts.sans, fontSize: 14, color: C.bodySoft, lineHeight: 21 },

  fieldLabel: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.textInk },
  fieldHint: { fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft },

  input: {
    fontFamily: Fonts.sans, fontSize: 15, color: C.textInk,
    backgroundColor: C.bgCard, borderRadius: Radius.md,
    borderWidth: 0.5, borderColor: C.borderWarm,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  textArea: { minHeight: 96, textAlignVertical: 'top', paddingTop: 12 },
  usernameWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bgCard, borderRadius: Radius.md, borderWidth: 0.5, borderColor: C.borderWarm, paddingLeft: 14 },
  atSign: { fontFamily: Fonts.sansMedium, fontSize: 15, color: C.spice },

  pronounsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  pronounsChip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 40, backgroundColor: C.bgCard, borderWidth: 0.5, borderColor: C.borderWarm },
  pronounsChipActive: { backgroundColor: C.spice, borderColor: C.spice },
  pronounsText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.body },
  pronounsTextActive: { color: C.canvas },

  skipNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: C.bgCook, borderRadius: Radius.md, padding: 12 },
  skipNoteText: { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft, lineHeight: 18, flex: 1 },

  stickyBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', gap: 10, padding: 16, paddingBottom: 36, backgroundColor: C.bg, borderTopWidth: 0.5, borderTopColor: C.borderWarm },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 14, borderRadius: Radius.lg, backgroundColor: C.bgCard, borderWidth: 0.5, borderColor: C.borderWarm },
  backBtnText: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.textInk },
  nextBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.ink, borderRadius: Radius.lg, paddingVertical: 16 },
  nextBtnText: { fontFamily: Fonts.sansMedium, fontSize: 15, color: C.canvas },

  bankPickerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bankPickerText: { fontFamily: Fonts.sans, fontSize: 15, color: C.textInk },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: C.bgCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.lg, paddingBottom: 36 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: C.borderWarm, alignSelf: 'center', marginBottom: 12 },
  modalTitle: { fontFamily: Fonts.serif, fontSize: 20, color: C.textInk, marginBottom: 14 },
  bankSearchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.bg, borderRadius: Radius.md, borderWidth: 0.5, borderColor: C.borderWarm, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 10 },
  bankSearchInput: { flex: 1, fontFamily: Fonts.sans, fontSize: 14, color: C.textInk },
  bankRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: C.borderWarm },
  bankRowActive: { backgroundColor: 'transparent' },
  bankRowText: { fontFamily: Fonts.sans, fontSize: 14, color: C.textInk },
  bankRowTextActive: { fontFamily: Fonts.sansMedium, color: C.spice },
  modalCancelBtn: { alignItems: 'center', paddingVertical: 16 },
  modalCancelText: { fontFamily: Fonts.sans, fontSize: 14, color: C.bodySoft },
}); }
