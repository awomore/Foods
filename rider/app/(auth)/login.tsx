import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { C, Sp, R, Fs, F } from '../../src/theme';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!email.trim() || !password) { setError('Enter your email and password'); return; }
    setLoading(true);
    setError('');
    try {
      await login(email.trim().toLowerCase(), password);
      router.replace('/(tabs)/orders');
    } catch (e: any) {
      setError(e?.message ?? 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

          {/* Brand header */}
          <View style={s.brand}>
            <View style={s.logoWrap}>
              <Ionicons name="bicycle" size={36} color="#fff" />
            </View>
            <Text style={s.brandTitle}>FOODS Rider</Text>
            <Text style={s.brandSub}>Sign in to start delivering</Text>
          </View>

          {/* Form */}
          <View style={s.form}>
            {!!error && (
              <View style={s.errorBanner}>
                <Ionicons name="alert-circle" size={16} color={C.errorFg} />
                <Text style={s.errorText}>{error}</Text>
              </View>
            )}

            <Text style={s.fieldLabel}>Email address</Text>
            <TextInput
              style={s.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={C.stone}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={s.fieldLabel}>Password</Text>
            <View style={s.pwWrap}>
              <TextInput
                style={[s.input, { flex: 1, borderWidth: 0 }]}
                value={password}
                onChangeText={setPassword}
                placeholder="Your password"
                placeholderTextColor={C.stone}
                secureTextEntry={!showPw}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowPw(v => !v)} hitSlop={8}>
                <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={20} color={C.stone} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[s.loginBtn, loading && { opacity: 0.7 }]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.loginBtnText}>Sign In</Text>
              }
            </TouchableOpacity>
          </View>

          <Text style={s.footer}>
            Not registered yet? Open the{' '}
            <Text style={s.footerBold}>FOODS</Text>
            {' '}app and go to{' '}
            <Text style={s.footerBold}>Register as Rider</Text>
            {' '}to apply.
          </Text>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: C.bg },
  scroll:      { flexGrow: 1, padding: Sp.lg },
  brand:       { alignItems: 'center', paddingTop: 40, paddingBottom: 40, gap: 10 },
  logoWrap:    { width: 72, height: 72, borderRadius: 36, backgroundColor: C.spice, alignItems: 'center', justifyContent: 'center' },
  brandTitle:  { fontFamily: F.sansMedium, fontSize: Fs.xxl, color: C.textInk },
  brandSub:    { fontFamily: F.sans, fontSize: Fs.md, color: C.bodySoft },
  form:        { gap: 14 },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.errorBg, padding: 12, borderRadius: R.md },
  errorText:   { fontFamily: F.sans, fontSize: Fs.sm, color: C.errorFg, flex: 1 },
  fieldLabel:  { fontFamily: F.sansMedium, fontSize: Fs.sm, color: C.body },
  input:       {
    borderWidth: 1, borderColor: C.borderWarm, borderRadius: R.md,
    paddingHorizontal: 14, paddingVertical: 12, fontFamily: F.sans, fontSize: Fs.md, color: C.textInk,
  },
  pwWrap:      { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.borderWarm, borderRadius: R.md, paddingRight: 14 },
  loginBtn:    { height: 52, borderRadius: R.full, backgroundColor: C.spice, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  loginBtnText:{ fontFamily: F.sansMedium, fontSize: Fs.lg, color: '#fff' },
  footer:      { textAlign: 'center', fontFamily: F.sans, fontSize: Fs.sm, color: C.bodySoft, marginTop: 32, lineHeight: 20 },
  footerBold:  { fontFamily: F.sansMedium, color: C.textInk },
});
