import React, { useState, useMemo, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput,
  ActivityIndicator, KeyboardAvoidingView, Platform, Modal, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Linking } from 'react-native';
import { cooksApi, socialVerifyApi } from '../src/api/cooks';
import GooglePlacesInput, { type PlaceLocation } from '../src/components/ui/GooglePlacesInput';
import { useAuth } from '../src/context/AuthContext';
import { Fonts, Spacing, Radius } from '../src/constants/theme';
import { useColors, type AppColors } from '../src/context/ThemeContext';
import { useFeedback } from '../src/components/feedback';
import {
  type CreatorType, CREATOR_TYPE_LABELS, CREATOR_TYPE_ICONS,
} from '../src/types';

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

const CREATOR_TYPES: CreatorType[] = [
  'home_cook','chef','pastry_chef','baker',
  'mixologist','caterer','culinary_instructor','food_brand',
];

const CREATOR_TYPE_DESCS: Record<CreatorType, string> = {
  home_cook:           'You cook from home, selling meals to neighbours and friends.',
  chef:                'Trained or experienced chef offering meals and private services.',
  pastry_chef:         'Specialist in pastries, cakes and baked desserts.',
  baker:               'Breads, rolls, pastries and baked goods are your craft.',
  mixologist:          'Cocktails, mocktails and specialty drinks.',
  caterer:             'You serve events, parties and corporate functions.',
  culinary_instructor: 'You teach cooking — classes, courses and workshops.',
  food_brand:          'A food business, product line or packaged goods brand.',
  nutritionist:        'Certified nutrition professional offering meal plans and advice.',
  dietician:           'Registered dietician providing clinical nutrition guidance.',
};

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
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
  const [step, setStep] = useState(1); // 1=creator type, 2=kitchen/social, 3=bank
  const [submitting, setSubmitting] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [connectingTiktok, setConnectingTiktok] = useState(false);
  const [connectingTwitter, setConnectingTwitter] = useState(false);
  const [connectingInstagram, setConnectingInstagram] = useState(false);

  useEffect(() => {
    const sub = Linking.addEventListener('url', ({ url }) => {
      if (!url.startsWith('foodsbyme://social-verify/')) return;
      const parsed = new URL(url);
      if (parsed.hostname === 'social-verify' && parsed.pathname === '/success') {
        const platform = parsed.searchParams.get('platform');
        if (platform === 'tiktok') {
          setConnectingTiktok(false);
          setShowVerifyModal(false);
          setSocialVerified(true);
          const handle = parsed.searchParams.get('handle') ?? '';
          feedback.success('TikTok connected!', handle ? `Verified as ${handle}.` : 'Your TikTok account is verified.');
          setTimeout(() => setStep(3), 800);
        }
      } else if (parsed.hostname === 'social-verify' && parsed.pathname === '/error') {
        const platform = parsed.searchParams.get('platform');
        if (platform === 'tiktok') {
          setConnectingTiktok(false);
          const reason = parsed.searchParams.get('reason') ?? 'unknown error';
          feedback.error('TikTok connection failed', reason.replace(/_/g, ' '));
        }
      }
    });
    return () => sub.remove();
  }, [feedback]);

  // Step 1: creator types
  const [selectedTypes, setSelectedTypes] = useState<CreatorType[]>(['home_cook']);

  // Step 2: profile
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [pronouns, setPronouns] = useState('she_her');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [locationLat, setLocationLat] = useState<number | undefined>(undefined);
  const [locationLng, setLocationLng] = useState<number | undefined>(undefined);
  const [instagram, setInstagram] = useState('');
  const [tiktok, setTiktok] = useState('');
  const [twitter, setTwitter] = useState('');

  // Verify state
  const [verifyCode, setVerifyCode] = useState('');
  const [verifyPlatform, setVerifyPlatform] = useState('');
  const [verifyHandle, setVerifyHandle] = useState('');
  const [verifyUrl, setVerifyUrl] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [socialVerified, setSocialVerified] = useState(false);

  // Step 3: bank
  const [bankName, setBankName] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [bankAccountName, setBankAccountName] = useState('');
  const [showBankPicker, setShowBankPicker] = useState(false);
  const [bankSearch, setBankSearch] = useState('');

  function toggleType(t: CreatorType) {
    setSelectedTypes(prev =>
      prev.includes(t) ? (prev.length > 1 ? prev.filter(x => x !== t) : prev) : [...prev, t]
    );
  }

  const matchingHandle = (() => {
    const u = username.toLowerCase();
    if (instagram.toLowerCase() === u) return { platform: 'instagram' as const, handle: instagram };
    if (tiktok.toLowerCase() === u) return { platform: 'tiktok' as const, handle: tiktok };
    if (twitter.toLowerCase() === u) return { platform: 'twitter' as const, handle: twitter };
    return null;
  })();

  function handleStep1Continue() {
    if (!selectedTypes.length) {
      feedback.warn('Required', 'Select at least one creator type');
      return;
    }
    setStep(2);
  }

  function handleStep2Continue() {
    if (!displayName.trim() || !username.trim()) {
      feedback.warn('Required', 'Display name and username are required');
      return;
    }
    if (username.length < 3 || !/^[a-z0-9_]+$/.test(username)) {
      feedback.warn('Invalid username', 'Use at least 3 characters — lowercase letters, numbers, underscores only');
      return;
    }
    const hasSocialHandle = instagram.trim() || tiktok.trim() || twitter.trim();
    if (hasSocialHandle && !matchingHandle) {
      feedback.warn('Handle mismatch', 'Your username must exactly match one of your social handles above.');
      return;
    }
    setStep(3);
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
        latitude: locationLat,
        longitude: locationLng,
        instagram_handle: instagram.trim() || undefined,
        tiktok_handle: tiktok.trim() || undefined,
        twitter_handle: twitter.trim() || undefined,
        bank_name: bankName || undefined,
        bank_code: bankCode || undefined,
        bank_account_number: bankAccount.trim() || undefined,
        bank_account_name: bankAccountName.trim() || undefined,
        creator_types: selectedTypes,
      } as any);
      const refreshed = await refreshUser();
      if (!refreshed) console.warn('[FOODS] cook-onboarding: refreshUser failed, navigating anyway');
      router.replace('/(cook)' as any);
    } catch (e: any) {
      feedback.error('Error', e.error ?? 'Could not create profile. Username may be taken.');
    } finally {
      setSubmitting(false);
    }
  }

  const totalSteps = 3;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.root}>
        <SafeAreaView>
          <View style={styles.topBar}>
            <Text style={styles.step}>Step {step} of {totalSteps}</Text>
            <View style={styles.progress}>
              <View style={[styles.progressFill, { width: `${(step / totalSteps) * 100}%` }]} />
            </View>
          </View>
        </SafeAreaView>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 120 }}>
          {/* ── STEP 1: Creator Identity ──────────────────────────────── */}
          {step === 1 && (
            <View style={{ gap: 20 }}>
              <View>
                <Text style={styles.pageTitle}>What kind of creator are you?</Text>
                <Text style={styles.pageSub}>Select all that apply. This shapes your storefront and how customers discover you.</Text>
              </View>

              <View style={styles.typeGrid}>
                {CREATOR_TYPES.map(t => {
                  const selected = selectedTypes.includes(t);
                  return (
                    <TouchableOpacity
                      key={t}
                      style={[styles.typeCard, selected && styles.typeCardActive]}
                      onPress={() => toggleType(t)}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.typeIconWrap, selected && styles.typeIconWrapActive]}>
                        <Ionicons name={CREATOR_TYPE_ICONS[t] as any} size={22} color={selected ? C.canvas : C.spice} />
                      </View>
                      <Text style={[styles.typeLabel, selected && styles.typeLabelActive]}>
                        {CREATOR_TYPE_LABELS[t]}
                      </Text>
                      <Text style={[styles.typeDesc, selected && styles.typeDescActive]} numberOfLines={2}>
                        {CREATOR_TYPE_DESCS[t]}
                      </Text>
                      {selected && (
                        <View style={styles.typeCheck}>
                          <Ionicons name="checkmark-circle" size={18} color={C.canvas} />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {selectedTypes.length > 0 && (
                <View style={styles.selectedPill}>
                  <Ionicons name="checkmark-circle" size={14} color={C.successFg} />
                  <Text style={styles.selectedPillText}>
                    {selectedTypes.map(t => CREATOR_TYPE_LABELS[t]).join(' · ')}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* ── STEP 2: Profile + Social ──────────────────────────────── */}
          {step === 2 && (
            <View style={{ gap: 20 }}>
              <View>
                <Text style={styles.pageTitle}>Set up your profile</Text>
                <Text style={styles.pageSub}>This is how customers will find and know you</Text>
              </View>

              <Field label="Display name *">
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

              <View style={styles.socialBox}>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 6 }}>
                  <Ionicons name="shield-checkmark-outline" size={16} color={C.spice} style={{ marginTop: 1 }} />
                  <Text style={styles.socialBoxTitle}>Link your social account first</Text>
                </View>
                <Text style={styles.socialBoxBody}>
                  Your FOODS username must exactly match your Instagram, TikTok, or X handle. This ensures only the real owner can claim a handle.
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
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                              <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 11, color: C.spice }}>Verify</Text>
                              <Ionicons name="chevron-forward" size={11} color={C.spice} />
                            </View>
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
                  onSelect={(addr, loc) => {
                    setLocation(addr);
                    setLocationLat(loc?.lat);
                    setLocationLng(loc?.lng);
                  }}
                />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 }}>
                  <Ionicons name="lock-closed-outline" size={11} color={C.bodySoft} />
                  <Text style={{ fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft, flex: 1, lineHeight: 16 }}>
                    Only your city is shown publicly. Your full address is never shared.
                  </Text>
                </View>
              </Field>
            </View>
          )}

          {/* ── STEP 3: Bank ─────────────────────────────────────────── */}
          {step === 3 && (
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

        {/* Sticky bottom bar */}
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
                style={[styles.nextBtn, !selectedTypes.length && { opacity: 0.5 }]}
                onPress={handleStep1Continue}
                disabled={!selectedTypes.length}
                activeOpacity={0.85}
              >
                <Text style={styles.nextBtnText}>Continue</Text>
                <Ionicons name="arrow-forward" size={16} color={C.canvas} />
              </TouchableOpacity>
            )}
            {step === 2 && (
              <TouchableOpacity
                style={[styles.nextBtn, (!displayName.trim() || !username.trim()) && { opacity: 0.5 }]}
                onPress={handleStep2Continue}
                disabled={!displayName.trim() || !username.trim()}
                activeOpacity={0.85}
              >
                <Text style={styles.nextBtnText}>Continue</Text>
                <Ionicons name="arrow-forward" size={16} color={C.canvas} />
              </TouchableOpacity>
            )}
            {step === 3 && (
              <>
                <TouchableOpacity
                  style={[styles.nextBtn, submitting && { opacity: 0.6 }]}
                  onPress={handleSubmit}
                  disabled={submitting}
                  activeOpacity={0.85}
                >
                  {submitting ? <ActivityIndicator color={C.canvas} /> : (
                    <><Text style={styles.nextBtnText}>Launch my profile</Text><Ionicons name="arrow-forward" size={16} color={C.canvas} /></>
                  )}
                </TouchableOpacity>
                <TouchableOpacity style={styles.skipBtn} onPress={handleSubmit} disabled={submitting}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={styles.skipBtnText}>Skip bank details for now</Text>
                    <Ionicons name="chevron-forward" size={13} color={C.bodySoft} />
                  </View>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </View>

      {/* Bank picker modal */}
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
                  <Text style={[styles.bankRowText, bankCode === item.code && styles.bankRowTextActive]}>{item.name}</Text>
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

      {/* Social verification modal */}
      <Modal visible={showVerifyModal} animationType="slide" transparent onRequestClose={() => setShowVerifyModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Verify @{verifyHandle}</Text>
            {verifyPlatform === 'tiktok' && (
              <TouchableOpacity
                style={[styles.nextBtn, { marginBottom: 16 }, connectingTiktok && { opacity: 0.6 }]}
                onPress={async () => {
                  setConnectingTiktok(true);
                  try { await socialVerifyApi.connectTikTok(); } catch {
                    setConnectingTiktok(false);
                    feedback.error('Error', 'Could not open TikTok. Try the bio-code method below.');
                  }
                }}
                disabled={connectingTiktok}
                activeOpacity={0.85}
              >
                {connectingTiktok ? <ActivityIndicator color={C.canvas} /> : (
                  <><Ionicons name="logo-tiktok" size={16} color={C.canvas} /><Text style={styles.nextBtnText}>Continue with TikTok</Text></>
                )}
              </TouchableOpacity>
            )}
            {verifyPlatform === 'twitter' && (
              <TouchableOpacity
                style={[styles.nextBtn, { marginBottom: 16 }, connectingTwitter && { opacity: 0.6 }]}
                onPress={async () => {
                  setConnectingTwitter(true);
                  try { await socialVerifyApi.connectTwitter(); } catch {
                    setConnectingTwitter(false);
                    feedback.error('Error', 'Could not open Twitter. Please try again.');
                  }
                }}
                disabled={connectingTwitter}
                activeOpacity={0.85}
              >
                {connectingTwitter ? <ActivityIndicator color={C.canvas} /> : (
                  <><Ionicons name="logo-twitter" size={16} color={C.canvas} /><Text style={styles.nextBtnText}>Continue with Twitter</Text></>
                )}
              </TouchableOpacity>
            )}
            {verifyPlatform === 'instagram' && (
              <>
                <TouchableOpacity
                  style={[styles.nextBtn, { marginBottom: 8 }, connectingInstagram && { opacity: 0.6 }]}
                  onPress={async () => {
                    setConnectingInstagram(true);
                    try { await socialVerifyApi.connectInstagram(); } catch {
                      setConnectingInstagram(false);
                      feedback.error('Error', 'Could not open Instagram. Please try again.');
                    }
                  }}
                  disabled={connectingInstagram}
                  activeOpacity={0.85}
                >
                  {connectingInstagram ? <ActivityIndicator color={C.canvas} /> : (
                    <><Ionicons name="logo-instagram" size={16} color={C.canvas} /><Text style={styles.nextBtnText}>Continue with Instagram</Text></>
                  )}
                </TouchableOpacity>
                <Text style={[styles.codeNote, { marginBottom: 16, textAlign: 'center' }]}>
                  Requires a Business or Creator account. Switch to Professional in Instagram settings → Account type.
                </Text>
              </>
            )}
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
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={styles.skipBtnText}>Skip for now</Text>
                    <Ionicons name="chevron-forward" size={13} color={C.bodySoft} />
                  </View>
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

function makeStyles(C: AppColors) {
  return StyleSheet.create({
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
    // Creator type grid
    typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    typeCard: {
      width: '47%', backgroundColor: C.bgCard, borderRadius: Radius.lg,
      borderWidth: 1, borderColor: C.borderWarm,
      padding: 14, gap: 8, position: 'relative',
    },
    typeCardActive: { backgroundColor: C.ink, borderColor: C.ink },
    typeIconWrap: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: C.bgCook, alignItems: 'center', justifyContent: 'center',
    },
    typeIconWrapActive: { backgroundColor: 'rgba(255, 255, 255,0.15)' },
    typeLabel: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.textInk },
    typeLabelActive: { color: C.canvas },
    typeDesc: { fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft, lineHeight: 16 },
    typeDescActive: { color: 'rgba(255, 255, 255,0.6)' },
    typeCheck: { position: 'absolute', top: 10, right: 10 },
    selectedPill: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: C.successBg, borderRadius: Radius.md,
      paddingHorizontal: 12, paddingVertical: 10,
    },
    selectedPillText: { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.successFg, flex: 1 },
    // Social
    socialBox: { backgroundColor: C.bgCook, borderRadius: Radius.md, borderWidth: 0.5, borderColor: C.borderWarm, padding: 14, gap: 6 },
    socialBoxTitle: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.textInk },
    socialBoxBody: { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft, lineHeight: 18 },
    handleWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bgCard, borderRadius: Radius.md, borderWidth: 0.5, borderColor: C.borderWarm, paddingLeft: 14 },
    usernameWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bgCard, borderRadius: Radius.md, borderWidth: 0.5, borderColor: C.borderWarm, paddingLeft: 14 },
    atSign: { fontFamily: Fonts.sansMedium, fontSize: 15, color: C.spice },
    matchPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.md },
    matchPillOk: { backgroundColor: C.successBg },
    matchPillWarn: { backgroundColor: C.warnBg },
    matchPillText: { fontFamily: Fonts.sans, fontSize: 12, flex: 1, lineHeight: 17 },
    urlPreview: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6, paddingHorizontal: 2 },
    urlPreviewText: { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft },
    pronounsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    pronounsChip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 40, backgroundColor: C.bgCard, borderWidth: 0.5, borderColor: C.borderWarm },
    pronounsChipActive: { backgroundColor: C.spice, borderColor: C.spice },
    pronounsText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.body },
    pronounsTextActive: { color: C.canvas },
    // Verify
    codeCard: { backgroundColor: C.bgCard, borderRadius: Radius.lg, borderWidth: 1, borderColor: C.spice, padding: 20, alignItems: 'center', gap: 8 },
    codeLabel: { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft, textTransform: 'uppercase', letterSpacing: 0.8 },
    codeValue: { fontFamily: Fonts.sansMedium, fontSize: 28, color: C.spice, letterSpacing: 3 },
    codeNote: { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft, textAlign: 'center', lineHeight: 18 },
    openProfileBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.bgCard, borderRadius: Radius.md, borderWidth: 0.5, borderColor: C.borderWarm, paddingHorizontal: 14, paddingVertical: 12 },
    openProfileText: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.textInk, flex: 1 },
    // Bottom bar
    stickyBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', gap: 10, padding: 16, paddingBottom: 36, backgroundColor: C.bg, borderTopWidth: 0.5, borderTopColor: C.borderWarm },
    backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 14, borderRadius: Radius.lg, backgroundColor: C.bgCard, borderWidth: 0.5, borderColor: C.borderWarm },
    backBtnText: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.textInk },
    nextBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.ink, borderRadius: Radius.lg, paddingVertical: 16 },
    nextBtnText: { fontFamily: Fonts.sansMedium, fontSize: 15, color: C.canvas },
    skipBtn: { alignItems: 'center', paddingVertical: 6 },
    skipBtnText: { fontFamily: Fonts.sans, fontSize: 13, color: C.bodySoft, textDecorationLine: 'underline' },
    // Bank
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
  });
}
