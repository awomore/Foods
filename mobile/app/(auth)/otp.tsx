import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { authApi } from '../../src/api/auth';
import { useAuth } from '../../src/context/AuthContext';
import { Fonts, Spacing, Radius } from '../../src/constants/theme';
import { useColors, type AppColors } from '../../src/context/ThemeContext';

const OTP_LENGTH = 6;

export default function OtpScreen() {
  const router = useRouter();
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const { signIn } = useAuth();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [resending, setResending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  async function handleVerify(otpOverride?: string) {
    const code = (otpOverride ?? otp).trim();
    if (code.length < OTP_LENGTH) {
      setErrorMsg(`Please enter all ${OTP_LENGTH} digits.`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setErrorMsg(null);
    setLoading(true);
    try {
      const res = await authApi.verifyOtp(phone, code);
      await signIn(res.token, res.user);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (res.is_new_user || !res.user.role) {
        router.replace('/(auth)/role');
      } else if (res.user.role === 'cook') {
        router.replace('/(cook)');
      } else {
        router.replace('/(customer)');
      }
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErrorMsg(e.error ?? 'That code doesn\'t match. Please try again.');
      setOtp('');
      inputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (countdown > 0 || resending) return;
    setResending(true);
    setErrorMsg(null);
    try {
      await authApi.sendOtp(phone);
      setCountdown(60);
      setOtp('');
    } catch {
      setErrorMsg('Could not resend. Please try again in a moment.');
    } finally {
      setResending(false);
    }
  }

  function handleOtpChange(text: string) {
    const digits = text.replace(/\D/g, '').slice(0, OTP_LENGTH);
    setOtp(digits);
    setErrorMsg(null);
    if (digits.length === OTP_LENGTH) {
      setTimeout(() => handleVerify(digits), 100);
    }
  }

  const canVerify = otp.length === OTP_LENGTH && !loading;

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.back}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Ionicons name="chevron-back" size={22} color={C.textInk} />
        </TouchableOpacity>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={styles.content}>
            <Text style={styles.title}>Enter the code</Text>
            <Text style={styles.subtitle}>
              We sent a {OTP_LENGTH}-digit code to{'\n'}
              <Text style={{ color: C.textInk }}>{phone}</Text>
            </Text>

            <TextInput
              ref={inputRef}
              style={[styles.otpInput, errorMsg ? styles.otpInputError : null]}
              placeholder="• • • • • •"
              placeholderTextColor={C.stone}
              keyboardType="number-pad"
              maxLength={OTP_LENGTH}
              value={otp}
              onChangeText={handleOtpChange}
              autoFocus
              textAlign="center"
              textContentType="oneTimeCode"
              accessibilityLabel="One-time verification code"
              accessibilityHint={`Enter the ${OTP_LENGTH}-digit code sent to your phone`}
            />

            {errorMsg ? (
              <View style={styles.errorRow}>
                <Ionicons name="alert-circle-outline" size={14} color={C.errorFg} />
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.btn, !canVerify && styles.btnDisabled]}
              onPress={() => handleVerify()}
              disabled={!canVerify}
              activeOpacity={0.85}
              accessibilityLabel="Verify code"
              accessibilityRole="button"
              accessibilityState={{ disabled: !canVerify }}
            >
              {loading
                ? <ActivityIndicator color={C.canvas} />
                : <Text style={styles.btnText}>Verify</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleResend}
              disabled={countdown > 0 || resending}
              style={styles.resend}
              accessibilityLabel={countdown > 0 ? `Resend available in ${countdown} seconds` : 'Resend code'}
              accessibilityRole="button"
            >
              {resending ? (
                <ActivityIndicator size="small" color={C.spice} />
              ) : (
                <Text style={[styles.resendText, countdown > 0 && styles.resendDisabled]}>
                  {countdown > 0 ? `Resend in ${countdown}s` : 'Resend code'}
                </Text>
              )}
            </TouchableOpacity>

            <Text style={styles.note}>
              Didn't receive it? Check that your number is correct and try resending.
            </Text>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function makeStyles(C: AppColors) { return StyleSheet.create({
  root:     { flex: 1, backgroundColor: C.bg },
  safe:     { flex: 1 },
  back:     { margin: Spacing.md, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  content:  { flex: 1, padding: Spacing.lg, paddingTop: Spacing.xl },
  title:    { fontFamily: Fonts.serif, fontSize: 28, color: C.textInk, marginBottom: 8 },
  subtitle: { fontFamily: Fonts.sans, fontSize: 15, color: C.bodySoft, marginBottom: Spacing.xl, lineHeight: 22 },
  otpInput: {
    borderWidth: 1, borderColor: C.borderWarm, borderRadius: Radius.md,
    backgroundColor: C.bgCard, paddingVertical: 20,
    fontFamily: Fonts.sans, fontSize: 32, color: C.textInk,
    letterSpacing: 14, marginBottom: Spacing.sm,
  },
  otpInputError: { borderColor: C.errorFg, borderWidth: 1.5 },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.md },
  errorText: { fontFamily: Fonts.sans, fontSize: 13, color: C.errorFg, flex: 1, lineHeight: 18 },
  btn:         { backgroundColor: C.ink, borderRadius: Radius.full, paddingVertical: 16, alignItems: 'center', marginBottom: Spacing.md },
  btnDisabled: { opacity: 0.4 },
  btnText:     { fontFamily: Fonts.sansMedium, fontSize: 15, color: C.canvas },
  resend:      { alignItems: 'center', paddingVertical: Spacing.sm },
  resendText:  { fontFamily: Fonts.sans, fontSize: 13, color: C.spice },
  resendDisabled: { opacity: 0.4, color: C.bodySoft },
  note: { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft, textAlign: 'center', lineHeight: 18, marginTop: Spacing.sm },
}); }
