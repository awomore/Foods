import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView,
  Platform, Modal, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Google from 'expo-auth-session/providers/google';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import { authApi } from '../../src/api/auth';
import { useAuth } from '../../src/context/AuthContext';
import { useFeedback } from '../../src/components/feedback';
import { Fonts, Spacing, Radius } from '../../src/constants/theme';
import { useColors, type AppColors } from '../../src/context/ThemeContext';

WebBrowser.maybeCompleteAuthSession();

const AFRICAN_COUNTRIES = [
  { name: 'Nigeria',       dial: '234', flag: '🇳🇬', maxLen: 10 },
  { name: 'Ghana',         dial: '233', flag: '🇬🇭', maxLen: 9  },
  { name: 'Kenya',         dial: '254', flag: '🇰🇪', maxLen: 9  },
  { name: 'South Africa',  dial: '27',  flag: '🇿🇦', maxLen: 9  },
  { name: 'Ethiopia',      dial: '251', flag: '🇪🇹', maxLen: 9  },
  { name: 'Tanzania',      dial: '255', flag: '🇹🇿', maxLen: 9  },
  { name: 'Uganda',        dial: '256', flag: '🇺🇬', maxLen: 9  },
  { name: 'Rwanda',        dial: '250', flag: '🇷🇼', maxLen: 9  },
  { name: 'Cameroon',      dial: '237', flag: '🇨🇲', maxLen: 9  },
  { name: 'Ivory Coast',   dial: '225', flag: '🇨🇮', maxLen: 10 },
  { name: 'Senegal',       dial: '221', flag: '🇸🇳', maxLen: 9  },
  { name: 'Zambia',        dial: '260', flag: '🇿🇲', maxLen: 9  },
  { name: 'Zimbabwe',      dial: '263', flag: '🇿🇼', maxLen: 9  },
  { name: 'Egypt',         dial: '20',  flag: '🇪🇬', maxLen: 10 },
  { name: 'Morocco',       dial: '212', flag: '🇲🇦', maxLen: 9  },
  { name: 'Algeria',       dial: '213', flag: '🇩🇿', maxLen: 9  },
  { name: 'Tunisia',       dial: '216', flag: '🇹🇳', maxLen: 8  },
  { name: 'Angola',        dial: '244', flag: '🇦🇴', maxLen: 9  },
  { name: 'Mozambique',    dial: '258', flag: '🇲🇿', maxLen: 9  },
  { name: 'Mali',          dial: '223', flag: '🇲🇱', maxLen: 8  },
  { name: 'Burkina Faso',  dial: '226', flag: '🇧🇫', maxLen: 8  },
  { name: 'Niger',         dial: '227', flag: '🇳🇪', maxLen: 8  },
  { name: 'Guinea',        dial: '224', flag: '🇬🇳', maxLen: 9  },
  { name: 'Benin',         dial: '229', flag: '🇧🇯', maxLen: 8  },
  { name: 'Togo',          dial: '228', flag: '🇹🇬', maxLen: 8  },
  { name: 'Sierra Leone',  dial: '232', flag: '🇸🇱', maxLen: 8  },
  { name: 'Liberia',       dial: '231', flag: '🇱🇷', maxLen: 8  },
  { name: 'Gambia',        dial: '220', flag: '🇬🇲', maxLen: 7  },
  { name: 'Somalia',       dial: '252', flag: '🇸🇴', maxLen: 8  },
  { name: 'Sudan',         dial: '249', flag: '🇸🇩', maxLen: 9  },
];

type Country = typeof AFRICAN_COUNTRIES[0];

const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? '';
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '';
const GOOGLE_ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? '';

function normalize(raw: string, country: Country): string {
  const digits = raw.replace(/\D/g, '');
  const stripped = digits.startsWith('0') ? digits.slice(1) : digits;
  return country.dial + stripped;
}

export default function PhoneScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const feedback = useFeedback();
  const [country, setCountry] = useState<Country>(AFRICAN_COUNTRIES[0]);
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<'google' | 'apple' | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');

  // expo-auth-session throws at render time if ALL client IDs are undefined.
  // Provide a placeholder so the hook can mount safely; the sign-in handler
  // below already guards against actually using it when unconfigured.
  const [, , googlePromptAsync] = Google.useAuthRequest({
    clientId: GOOGLE_CLIENT_ID || 'not-configured',
    iosClientId: GOOGLE_IOS_CLIENT_ID || undefined,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID || undefined,
  });

  const filtered = useMemo(() =>
    AFRICAN_COUNTRIES.filter(c =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.dial.includes(search.replace('+', ''))
    ), [search]);

  const digits = phone.replace(/\D/g, '').replace(/^0/, '');
  const isValid = digits.length >= 7 && digits.length <= country.maxLen;

  async function handleSendOtp() {
    setLoading(true);
    try {
      const full = normalize(phone, country);
      const res = await authApi.sendOtp(full);
      router.push({
        pathname: '/(auth)/otp',
        params: { phone: full, tos_accepted: '1' },
      });
    } catch (e: any) {
      feedback.error('Error', e.error ?? 'Could not send code. Try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    if (!GOOGLE_CLIENT_ID && !GOOGLE_IOS_CLIENT_ID && !GOOGLE_ANDROID_CLIENT_ID) {
      feedback.warn('Not configured', 'Google Sign-In is not set up yet. Use phone number instead.');
      return;
    }
    setSocialLoading('google');
    try {
      const result = await googlePromptAsync();
      if (result.type !== 'success') { setSocialLoading(null); return; }
      const accessToken = result.authentication?.accessToken;
      if (!accessToken) throw new Error('Google did not return an access token.');
      const { token, user, is_new_user } = await authApi.socialAuth('google', accessToken);
      await signIn(token, user);
      if (is_new_user || !user.role) {
        router.replace('/(auth)/role' as any);
      } else if (user.role === 'cook' && !user.cook_id) {
        router.replace('/cook-onboarding' as any);
      } else {
        router.replace(user.role === 'cook' ? '/(cook)' : '/(customer)');
      }
    } catch (e: any) {
      feedback.error('Sign-in failed', e.error ?? 'Google sign-in failed. Try again.');
    } finally {
      setSocialLoading(null);
    }
  }

  async function handleAppleSignIn() {
    setSocialLoading('apple');
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      const full_name = credential.fullName
        ? [credential.fullName.givenName, credential.fullName.familyName].filter(Boolean).join(' ')
        : undefined;
      const { token, user, is_new_user } = await authApi.socialAuth(
        'apple',
        credential.user,
        credential.email ?? undefined,
        full_name,
      );
      await signIn(token, user);
      if (is_new_user || !user.role) {
        router.replace('/(auth)/role' as any);
      } else if (user.role === 'cook' && !user.cook_id) {
        router.replace('/cook-onboarding' as any);
      } else {
        router.replace(user.role === 'cook' ? '/(cook)' : '/(customer)');
      }
    } catch (e: any) {
      if ((e as any).code !== 'ERR_REQUEST_CANCELED') {
        feedback.error('Sign-in failed', e.error ?? 'Apple sign-in failed. Try again.');
      }
    } finally {
      setSocialLoading(null);
    }
  }

  const showApple = Platform.OS === 'ios';

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={C.textInk} />
        </TouchableOpacity>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={styles.content}>
            <Text style={styles.title}>Sign in to FOODS</Text>
            <Text style={styles.subtitle}>Order from real home cooks near you.</Text>

            {/* Social auth buttons */}
            <View style={styles.socialRow}>
              <TouchableOpacity
                style={styles.socialBtn}
                onPress={handleGoogleSignIn}
                disabled={!!socialLoading}
                activeOpacity={0.8}
                accessibilityLabel="Continue with Google"
              >
                {socialLoading === 'google'
                  ? <ActivityIndicator size="small" color={C.textInk} />
                  : <Text style={styles.socialBtnText}>G  Continue with Google</Text>
                }
              </TouchableOpacity>
              {showApple && (
                <TouchableOpacity
                  style={[styles.socialBtn, { backgroundColor: C.ink }]}
                  onPress={handleAppleSignIn}
                  disabled={!!socialLoading}
                  activeOpacity={0.8}
                  accessibilityLabel="Continue with Apple"
                >
                  {socialLoading === 'apple'
                    ? <ActivityIndicator size="small" color={C.canvas} />
                    : <>
                        <Ionicons name="logo-apple" size={16} color={C.canvas} />
                        <Text style={[styles.socialBtnText, { color: C.canvas, marginLeft: 8 }]}>Continue with Apple</Text>
                      </>
                  }
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.divider}>
              <View style={[styles.dividerLine, { backgroundColor: C.borderWarm }]} />
              <Text style={[styles.dividerText, { color: C.bodySoft }]}>or use your phone number</Text>
              <View style={[styles.dividerLine, { backgroundColor: C.borderWarm }]} />
            </View>

            <View style={styles.inputRow}>
              <TouchableOpacity style={styles.dialPicker} onPress={() => setPickerOpen(true)} activeOpacity={0.7}>
                <Text style={styles.dialText}>{country.flag}  +{country.dial}</Text>
                <Ionicons name="chevron-down" size={14} color={C.bodySoft} style={{ marginLeft: 2 }} />
              </TouchableOpacity>
              <TextInput
                style={styles.input}
                placeholder="800 000 0000"
                placeholderTextColor={C.bodySoft}
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
                onSubmitEditing={handleSendOtp}
                returnKeyType="send"
                maxLength={12}
              />
            </View>

            <TouchableOpacity
              style={[styles.btn, !isValid && styles.btnDisabled]}
              onPress={handleSendOtp}
              disabled={loading || !isValid}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color={C.canvas} />
                : <Text style={styles.btnText}>Send code</Text>
              }
            </TouchableOpacity>

            <Text style={styles.note}>
              We'll text a 6-digit code to this number. Standard SMS rates may apply.
            </Text>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <Modal visible={pickerOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPickerOpen(false)}>
        <SafeAreaView style={styles.modalRoot}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select country</Text>
            <TouchableOpacity onPress={() => { setPickerOpen(false); setSearch(''); }}>
              <Ionicons name="close" size={24} color={C.textInk} />
            </TouchableOpacity>
          </View>

          <View style={styles.searchRow}>
            <Ionicons name="search" size={16} color={C.bodySoft} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search country or code"
              placeholderTextColor={C.bodySoft}
              value={search}
              onChangeText={setSearch}
              autoFocus
            />
          </View>

          <FlatList
            data={filtered}
            keyExtractor={item => item.dial + item.name}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.countryRow, item.dial === country.dial && styles.countryRowActive]}
                onPress={() => { setCountry(item); setPickerOpen(false); setSearch(''); }}
                activeOpacity={0.7}
              >
                <Text style={styles.countryFlag}>{item.flag}</Text>
                <Text style={styles.countryName}>{item.name}</Text>
                <Text style={styles.countryDial}>+{item.dial}</Text>
                {item.dial === country.dial && (
                  <Ionicons name="checkmark" size={16} color={C.spice} />
                )}
              </TouchableOpacity>
            )}
            keyboardShouldPersistTaps="handled"
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

function makeStyles(C: AppColors) { return StyleSheet.create({
  root:    { flex: 1, backgroundColor: C.bg },
  safe:    { flex: 1 },
  back:    { margin: Spacing.md, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1, padding: Spacing.lg, paddingTop: Spacing.xl },
  title:   { fontFamily: Fonts.serif, fontSize: 28, color: C.textInk, marginBottom: 8 },
  subtitle:{ fontFamily: Fonts.sans, fontSize: 15, color: C.bodySoft, marginBottom: Spacing.xl, lineHeight: 22 },
  socialRow:   { gap: 10, marginBottom: Spacing.lg },
  socialBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.borderWarm, borderRadius: Radius.full, paddingVertical: 14, backgroundColor: C.bgCard },
  socialBtnText: { fontFamily: Fonts.sansMedium, fontSize: 15, color: C.textInk },
  divider:     { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: Spacing.lg },
  dividerLine: { flex: 1, height: 0.5 },
  dividerText: { fontFamily: Fonts.sans, fontSize: 12 },

  inputRow:  { flexDirection: 'row', borderWidth: 0.5, borderColor: C.borderWarm, borderRadius: Radius.md, backgroundColor: C.bgCard, marginBottom: Spacing.md, overflow: 'hidden' },
  dialPicker:{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, borderRightWidth: 0.5, borderRightColor: C.borderWarm },
  dialText:  { fontFamily: Fonts.sans, fontSize: 15, color: C.textInk },
  input:     { flex: 1, padding: 16, fontFamily: Fonts.sans, fontSize: 16, color: C.textInk },

  btn:        { backgroundColor: C.ink, borderRadius: Radius.full, paddingVertical: 16, alignItems: 'center', marginBottom: Spacing.md },
  btnDisabled:{ opacity: 0.45 },
  btnText:    { fontFamily: Fonts.sansMedium, fontSize: 15, color: C.canvas },
  note:       { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft, textAlign: 'center', lineHeight: 18 },

  modalRoot:   { flex: 1, backgroundColor: C.bg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.lg, paddingBottom: Spacing.sm },
  modalTitle:  { fontFamily: Fonts.serif, fontSize: 22, color: C.textInk },
  searchRow:   { flexDirection: 'row', alignItems: 'center', marginHorizontal: Spacing.lg, marginBottom: Spacing.sm, borderWidth: 0.5, borderColor: C.borderWarm, borderRadius: Radius.md, backgroundColor: C.bgCard, paddingHorizontal: 14 },
  searchInput: { flex: 1, paddingVertical: 12, fontFamily: Fonts.sans, fontSize: 15, color: C.textInk },
  countryRow:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: 14 },
  countryRowActive: { backgroundColor: C.bgCard },
  countryFlag: { fontSize: 22, marginRight: 12 },
  countryName: { flex: 1, fontFamily: Fonts.sans, fontSize: 15, color: C.textInk },
  countryDial: { fontFamily: Fonts.sans, fontSize: 14, color: C.bodySoft, marginRight: 8 },
  separator:   { height: 0.5, backgroundColor: C.borderWarm, marginLeft: Spacing.lg + 22 + 12 },
}); }
