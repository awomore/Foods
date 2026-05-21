import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Alert, ActivityIndicator, SafeAreaView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { authApi } from '../../src/api/auth';
import { useAuth } from '../../src/context/AuthContext';
import { Colors, Fonts, Spacing, Radius } from '../../src/constants/theme';

export default function OtpScreen() {
  const router = useRouter();
  const { phone, dev_otp } = useLocalSearchParams<{ phone: string; dev_otp?: string }>();
  const { signIn } = useAuth();
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // DEV BYPASS: auto-submit when dev_otp is present
  useEffect(() => {
    if (!dev_otp) return;
    setOtp(dev_otp);
    const t = setTimeout(() => handleVerify(dev_otp), 800);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleVerify(otpOverride?: string) {
    const code = otpOverride ?? otp;
    if (code.length < 4) {
      Alert.alert('Invalid code', 'Please enter the full OTP.');
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.verifyOtp(phone, code);
      await signIn(res.token, res.user);
      if (res.is_new_user || !res.user.role) {
        router.replace('/(auth)/role');
      } else if (res.user.role === 'cook') {
        router.replace('/(cook)/');
      } else {
        router.replace('/(customer)/');
      }
    } catch (e: any) {
      Alert.alert('Wrong code', e.error ?? 'Invalid OTP. Check and try again.');
      setOtp('');
      inputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (countdown > 0) return;
    try {
      await authApi.sendOtp(phone);
      setCountdown(60);
      Alert.alert('Sent', 'A new code has been sent.');
    } catch {
      Alert.alert('Error', 'Could not resend. Try again.');
    }
  }

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={Colors.textInk} />
        </TouchableOpacity>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={styles.content}>
            <Text style={styles.title}>Enter the code</Text>
            <Text style={styles.subtitle}>Sent to {phone}</Text>

            {!!dev_otp && (
              <View style={styles.devBanner}>
                <Ionicons name="information-circle" size={15} color="#92610a" />
                <Text style={styles.devBannerText}>SMS unavailable — dev code: <Text style={styles.devCode}>{dev_otp}</Text></Text>
              </View>
            )}

            <TextInput
              ref={inputRef}
              style={styles.otpInput}
              placeholder="––––––"
              placeholderTextColor={Colors.bodySoft}
              keyboardType="number-pad"
              maxLength={6}
              value={otp}
              onChangeText={t => { setOtp(t); if (t.length === 6) setTimeout(() => handleVerify(t), 100); }}
              autoFocus
              textAlign="center"
            />

            <TouchableOpacity
              style={[styles.btn, otp.length < 4 && styles.btnDisabled]}
              onPress={() => handleVerify()}
              disabled={loading || otp.length < 4}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color={Colors.canvas} />
                : <Text style={styles.btnText}>Verify</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity onPress={handleResend} disabled={countdown > 0} style={styles.resend}>
              <Text style={[styles.resendText, countdown > 0 && { opacity: 0.4 }]}>
                {countdown > 0 ? `Resend in ${countdown}s` : 'Resend code'}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:     { flex: 1, backgroundColor: Colors.bg },
  safe:     { flex: 1 },
  back:     { margin: Spacing.md, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  content:  { flex: 1, padding: Spacing.lg, paddingTop: Spacing.xl },
  title:    { fontFamily: Fonts.serif,     fontSize: 28, color: Colors.textInk, marginBottom: 8 },
  subtitle: { fontFamily: Fonts.sans,      fontSize: 15, color: Colors.bodySoft, marginBottom: Spacing.xl },
  otpInput: {
    borderWidth: 0.5, borderColor: Colors.borderWarm, borderRadius: Radius.md,
    backgroundColor: Colors.bgCard, paddingVertical: 20,
    fontFamily: Fonts.sans, fontSize: 32, color: Colors.textInk,
    letterSpacing: 12, marginBottom: Spacing.md,
  },
  btn:     { backgroundColor: Colors.ink, borderRadius: Radius.full, paddingVertical: 16, alignItems: 'center', marginBottom: Spacing.md },
  btnDisabled: { opacity: 0.45 },
  btnText: { fontFamily: Fonts.sansMedium, fontSize: 15, color: Colors.canvas, fontWeight: '600' },
  resend:  { alignItems: 'center', padding: Spacing.sm },
  resendText: { fontFamily: Fonts.sans, fontSize: 13, color: Colors.spice },

  devBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fef3c7', borderRadius: 8, padding: 12, marginBottom: Spacing.md },
  devBannerText: { fontFamily: Fonts.sans, fontSize: 13, color: '#92610a', flex: 1 },
  devCode: { fontFamily: Fonts.sansMedium, fontWeight: '700', letterSpacing: 2 },
});
