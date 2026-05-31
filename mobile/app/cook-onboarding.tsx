import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, Modal, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Linking } from 'react-native';
import { cooksApi, socialVerifyApi } from '../src/api/cooks';
import GooglePlacesInput from '../src/components/ui/GooglePlacesInput';
import { useAuth } from '../src/context/AuthContext';
import { Fonts, Spacing, Radius } from '../src/constants/theme';
import { useColors, type AppColors } from '../src/context/ThemeContext';
import { useFeedback } from '../src/components/feedback';

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
  const feedback = useFeedback();
  const [step, setStep] = useState(1); // 1 = kitchen/social, 2 = bank
  const [submitting, setSubmitting] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [pronouns, setPronouns] = useState('she_her');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  // Social handles
  const [instagram, setInstagram] = useState('');
  const [tiktok, setTiktok] = useState('');
  const [twitter, setTwitter] = useState('');

  // Verification state (step 2)
  const [verifyCode, setVerifyCode] = useState('');
  const [verifyInstructions, setVerifyInstructions] = useState('');
  const [verifyPlatform, setVerifyPlatform] = useState('');
  const [verifyHandle, setVerifyHandle] = useState('');
  const [verifyUrl, setVerifyUrl] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [socialVerified, setSocialVerified] = useState(false);

  // Bank (step 3)
  const [bankName, setBankName] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [bankAccountName, setBankAccountName] = useState('');
  const [showBankPicker, setShowBankPicker] = useState(false);
  const [bankSearch, setBankSearch] = useState('');

  // Derived: which handle(s) match the username
  const matchingHandle = (() => {
    const u = username.toLowerCase();
    if (instagram.toLowerCase() === u) return { platform: 'instagram' as const, handle: instagram };
    if (tiktok.toLowerCase() === u) return { platform: 'tiktok' as const, handle: tiktok };
    if (twitter.toLowerCase() === u) return { platform: 'twitter' as const, handle: twitter };
    return null;
  })();

  function handleStep1Continue() {
    if (!displayName.trim() || !username.trim()) {
      feedback.warn('Required', 'Display name and username are required');
      return;
    }
    if (username.length < 3 || !/^[a-z0-9_]+$/.test(username)) {
      feedback.warn('Invalid username', 'Use at least 3 characters — lowercase letters, numbers, underscores only');
      return;
    }
    if (!matchingHandle) {
      feedback.warn('Social handle required', 'Your username must exactly match one of your social handles above.');
      return;
    }
    setStep(2);
  }

  async function openVerifyModal(platform: 'instagram' | 'tiktok' | 'twitter', handle: string) {
    setVerifyPlatform(platform);
    setVerifyHandle(handle);
    setVerifyCode('');
    setVerifyUrl('');
    setShowVerifyModal(true);
    try {
      const res = await socialVerifyApi.start(platform, handle);
      setVerifyCode(res.code);
      setVerifyUrl(res.profile_url);
    } catch (e: any) {
      feedback.error('Error', e.error ?? 'Could not start verification.');
      setShowVerifyModal(false);
    }
  }

  async function handleVerify() {
    setVerifying(true);
    try {
      await socialVerifyApi.check();
      setSocialVerified(true);
      feedback.success('Verified!', `@${verifyHandle} confirmed. You're good to go.`);
      setTimeout(() => setStep(3), 800);
    } catch (e: any) {
      feedback.error('Not found', e.error ?? 'Code not found in your bio yet. Add it and try again.');
    } finally {
      setVerifying(false);
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await cooksApi.onboard({
        display_name: displayName.trim(),
        username: username.trim().toLowerCase(),
        pronouns: pronouns as any,
        bio: bio.trim() || undefined,
        location: location.trim() || undefined,
        instagram_handle: instagram.trim() || undefined,
        tiktok_handle: tiktok.trim() || undefined,
        twitter_handle: twitter.trim() || undefined,
        bank_name: bankName || undefined,
        bank_code: bankCode || undefined,
        bank_account_number: bankAccount.trim() || undefined,
        bank_account_name: bankAccountName.trim() || undefined,
      });
      await refreshUser();
      router.replace('/(cook)' as any);
    } catch (e: any) {
      feedback.error('Error', e.error ?? 'Could not create profile. Username may be taken.');
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

              <Field label="Kitchen / display name *">
                <TextInput
                  style={styles.input}
                  value={displayName}
                  onChangeText={setDisplayName}
                  placeholder="e.g. Mama Ify's Kitchen"
                  placeholderTextColor={C.stone}
                  autoCapitalize="words"
                  maxLength={50}
                />
              </Field>

              {/* Social first — username must match */}
              <View style={styles.socialBox}>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 6 }}>
                  <Ionicons name="shield-checkmark-outline" size={16} color={C.spice} style={{ marginTop: 1 }} />
                  <Text style={styles.socialBoxTitle}>Link your social account first</Text>
                </View>
                <Text style={styles.socialBoxBody}>
                  Your Foods username must exactly match your Instagram, TikTok, or Twitter handle. This protects popular creators — only the real owner of a social handle can claim it here.
                </Text>
              </View>

              {([
                { label: 'Instagram', platform: 'instagram' as const, value: instagram, set: setInstagram },
                { label: 'TikTok',    platform: 'tiktok'    as const, value: tiktok,    set: setTiktok },
                { label: 'X / Twitter', platform: 'twitter' as const, value: twitter,   set: setTwitter },
              ]).map(({ label, platform, value, set }) => (
                <Field key={platform} label={label + ' handle'}>
                  <View style={styles.handleWrap}>
                    <Text style={styles.atSign}>@</Text>
                    <TextInput
                      style={[styles.input, { flex: 1, borderWidth: 0, paddingLeft: 0 }]}
                      value={value}
                      onChangeText={t => set(t.replace(/^@/, '').toLowerCase().replace(/[^a-z0-9_.]/g, ''))}
                      placeholder="yourkitchen"
                      placeholderTextColor={C.stone}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    {value.length > 2 && (
                      socialVerified && verifyPlatform === platform && verifyHandle === value
                        ? <Ionicons name="checkmark-circle" size={18} color={C.successFg} style={{ marginRight: 10 }} />
                        : <TouchableOpacity onPress={() => openVerifyModal(platform, value)} style={{ marginRight: 10, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: C.bgCook, borderRadius: 8, borderWidth: 0.5, borderColor: C.borderWarm }}>
                            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 11, color: C.spice }}>Verify →</Text>
                          </TouchableOpacity>
                    )}
                  </View>
                </Field>
              ))}

              <Field label="Username *" hint="Must match one of your handles above — lowercase, numbers, underscores">
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
                {username.length >= 3 && (
                  <View style={styles.urlPreview}>
                    <Ionicons name="link-outline" size={12} color={C.spice} />
                    <Text style={styles.urlPreviewText}>
                      foodsbyme.com/<Text style={{ color: C.spice }}>{username}</Text>
                    </Text>
                  </View>
                )}
                {(instagram || tiktok || twitter) && username.length >= 3 && (
                  <View style={[styles.matchPill, matchingHandle ? styles.matchPillOk : styles.matchPillWarn]}>
                    <Ionicons name={matchingHandle ? 'checkmark-circle' : 'alert-circle'} size={14} color={matchingHandle ? C.successFg : C.warnFg} />
                    <Text style={[styles.matchPillText, { color: matchingHandle ? C.successFg : C.warnFg }]}>
                      {matchingHandle ? `Matches your ${matchingHandle.platform} ✓` : 'Must exactly match one of your handles above'}
                    </Text>
                  </View>
                )}
              </Field>

              <Field label="Pronouns">
                <View style={styles.pronounsRow}>
                  {PRONOUNS_OPTIONS.map(o => (
                    <TouchableOpacity key={o.value} style={[styles.pronounsChip, pronouns === o.value && styles.pronounsChipActive]} onPress={() => setPronouns(o.value)}>
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

              <Field label="Location">
                <GooglePlacesInput
                  placeholder="Search your area or address…"
                  initialValue={location}
                  onSelect={addr => setLocation(addr)}
                />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 }}>
                  <Ionicons name="lock-closed-outline" size={11} color={C.bodySoft} />
                  <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 11, color: C.bodySoft, flex: 1, lineHeight: 16 }}>
                    Only your city is shown publicly. Your full address is never shared with customers.
                  </Text>
                </View>
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

            </View>
          )}
        </ScrollView>

        <View style={styles.stickyBar}>
          {step > 1 && (
            <TouchableOpacity style={styles.backBtn} onPress={() => setStep(s => s - 1)}>
              <Ionicons name="arrow-back" size={18} color={C.textInk} />
              <Text style={styles.backBtnText}>Back</Text>
            </TouchableOpacity>
          )}
          <View style={{ flex: 1, gap: 8 }}>
            {step === 1 && (
              <TouchableOpacity
                style={[styles.nextBtn, (submitting || !displayName.trim() || !username.trim()) && { opacity: 0.5 }]}
                onPress={handleStep1Continue}
                disabled={submitting || !displayName.trim() || !username.trim()}
                activeOpacity={0.85}
              >
                {submitting ? <ActivityIndicator color={C.canvas} /> : (
                  <><Text style={styles.nextBtnText}>Continue</Text><Ionicons name="arrow-forward" size={16} color={C.canvas} /></>
                )}
              </TouchableOpacity>
            )}
            {step === 2 && (
              <>
                <TouchableOpacity
                  style={[styles.nextBtn, submitting && { opacity: 0.6 }]}
                  onPress={handleSubmit}
                  disabled={submitting}
                  activeOpacity={0.85}
                >
                  {submitting ? <ActivityIndicator color={C.canvas} /> : (
                    <><Text style={styles.nextBtnText}>Launch my kitchen</Text><Ionicons name="arrow-forward" size={16} color={C.canvas} /></>
                  )}
                </TouchableOpacity>
                <TouchableOpacity style={styles.skipBtn} onPress={handleSubmit} disabled={submitting}>
                  <Text style={styles.skipBtnText}>Skip bank details for now →</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
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

      {/* Inline social verification modal */}
      <Modal visible={showVerifyModal} animationType="slide" transparent onRequestClose={() => setShowVerifyModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Verify @{verifyHandle}</Text>

            {verifyCode ? (
              <>
                <View style={styles.codeCard}>
                  <Text style={styles.codeLabel}>Your verification code</Text>
                  <Text style={styles.codeValue}>{verifyCode}</Text>
                  <Text style={styles.codeNote}>Add this anywhere in your {verifyPlatform} bio, then tap Verify.</Text>
                </View>

                {verifyUrl ? (
                  <TouchableOpacity
                    style={[styles.openProfileBtn, { marginTop: 12 }]}
                    onPress={() => Linking.openURL(verifyUrl)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name={`logo-${verifyPlatform}` as any} size={16} color={C.spice} />
                    <Text style={styles.openProfileText}>Open @{verifyHandle} on {verifyPlatform}</Text>
                    <Ionicons name="open-outline" size={14} color={C.bodySoft} />
                  </TouchableOpacity>
                ) : null}

                <TouchableOpacity
                  style={[styles.nextBtn, { marginTop: 16 }, verifying && { opacity: 0.6 }]}
                  onPress={handleVerify}
                  disabled={verifying}
                  activeOpacity={0.85}
                >
                  {verifying ? <ActivityIndicator color={C.canvas} /> : (
                    <><Text style={styles.nextBtnText}>I've added it — Verify</Text><Ionicons name="checkmark" size={16} color={C.canvas} /></>
                  )}
                </TouchableOpacity>

                <TouchableOpacity style={[styles.skipBtn, { marginTop: 8 }]} onPress={() => setShowVerifyModal(false)}>
                  <Text style={styles.skipBtnText}>Skip for now →</Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                <ActivityIndicator color={C.spice} />
                <Text style={[styles.codeNote, { marginTop: 12 }]}>Generating code…</Text>
              </View>
            )}
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

  skipBtn: { alignItems: 'center', paddingVertical: 6 },
  skipBtnText: { fontFamily: Fonts.sans, fontSize: 13, color: C.bodySoft, textDecorationLine: 'underline' },

  urlPreview: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6, paddingHorizontal: 2 },
  urlPreviewText: { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft },

  // Social verification
  socialBox: { backgroundColor: C.bgCook, borderRadius: Radius.md, borderWidth: 0.5, borderColor: C.borderWarm, padding: 14, gap: 6 },
  socialBoxTitle: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.textInk },
  socialBoxBody: { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft, lineHeight: 18 },
  handleWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bgCard, borderRadius: Radius.md, borderWidth: 0.5, borderColor: C.borderWarm, paddingLeft: 14 },
  matchPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.md },
  matchPillOk: { backgroundColor: C.successBg },
  matchPillWarn: { backgroundColor: C.warnBg },
  matchPillText: { fontFamily: Fonts.sans, fontSize: 12, flex: 1, lineHeight: 17 },

  // Verify step
  codeCard: { backgroundColor: C.bgCard, borderRadius: Radius.lg, borderWidth: 1, borderColor: C.spice, padding: 20, alignItems: 'center', gap: 8 },
  codeLabel: { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft, textTransform: 'uppercase', letterSpacing: 0.8 },
  codeValue: { fontFamily: Fonts.sansMedium, fontSize: 28, color: C.spice, letterSpacing: 3 },
  codeNote: { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft, textAlign: 'center', lineHeight: 18 },
  openProfileBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.bgCard, borderRadius: Radius.md, borderWidth: 0.5, borderColor: C.borderWarm, paddingHorizontal: 14, paddingVertical: 12 },
  openProfileText: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.textInk, flex: 1 },
  verifySteps: { gap: 14 },
  stepNum: { width: 22, height: 22, borderRadius: 11, backgroundColor: C.bgCook, borderWidth: 0.5, borderColor: C.borderWarm, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  stepNumText: { fontFamily: Fonts.sansMedium, fontSize: 11, color: C.spice },
  stepText: { fontFamily: Fonts.sans, fontSize: 13, color: C.body, flex: 1, lineHeight: 19 },

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
