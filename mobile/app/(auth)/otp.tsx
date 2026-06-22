import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
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
import { useTranslation } from 'react-i18next';
import { useColors, type AppColors } from '../../src/context/ThemeContext';

const OTP_LENGTH = 6;
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 5 * 60 * 1000; // 5 minutes

export default function OtpScreen() {
  const router = useRouter();
  const { phone, tos_accepted } = useLocalSearchParams<{ phone: string; tos_accepted?: string }>();
  const { signIn } = useAuth();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const { t } = useTranslation();
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [resending, setResending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);
  const verifyingRef = useRef(false);
  const failCountRef = useRef(0);
  const [lockedOutUntil, setLockedOutUntil] = useState<number | null>(null);
  const [lockSecondsLeft, setLockSecondsLeft] = useState(0);

  // Resend countdown
  useEffect(() => {
    if (countdown <= 0) return;
    const id = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(id);
  }, [countdown]);

  // Lockout countdown
  useEffect(() => {
    if (!lockedOutUntil) return;
    const tick = () => {
      const remaining = Math.ceil((lockedOutUntil - Date.now()) / 1000);
      if (remaining <= 0) {
        setLockedOutUntil(null);
        setLockSecondsLeft(0);
        failCountRef.current = 0;
      } else {
        setLockSecondsLeft(remaining);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lockedOutUntil]);

  const isLockedOut = lockedOutUntil !== null && Date.now() < lockedOutUntil;

  async function handleVerify(otpOverride?: string) {
    if (isLockedOut) return;
    const code = (otpOverride ?? otp).trim();
    if (code.length < OTP_LENGTH) {
      setErrorMsg(t('auth.otp_digits'));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    if (verifyingRef.current) return;
    verifyingRef.current = true;
    setErrorMsg(null);
    setLoading(true);
    try {
      const res = await authApi.verifyOtp(phone, code, tos_accepted === '1');
      await signIn(res.token, res.user);
      failCountRef.current = 0;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (res.is_new_user || !res.user.role) {
        router.replace('/(auth)/role');
      } else if (res.user.role === 'cook') {
        // Guard: if the cook profile was deleted, send to role selection instead of crashing
        if (!res.user.cook_id) {
          router.replace('/(auth)/role');
        } else {
          router.replace('/(cook)');
        }
      } else {
        router.replace('/(customer)');
      }
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      failCountRef.current += 1;
      if (failCountRef.current >= MAX_ATTEMPTS) {
        const until = Date.now() + LOCKOUT_MS;
        setLockedOutUntil(until);
        setErrorMsg('Too many failed attempts. Please wait 5 minutes before trying again.');
      } else {
        const remaining = MAX_ATTEMPTS - failCountRef.current;
        setErrorMsg(
          (e.error ?? t('auth.otp_error')) +
          (remaining <= 2 ? ` (${remaining} attempt${remaining !== 1 ? 's' : ''} left)` : '')
        );
      }
      setOtp('');
      inputRef.current?.focus();
    } finally {
      setLoading(false);
      verifyingRef.current = false;
    }
  }

  async function handleResend() {
    if (countdown > 0 || resending || isLockedOut) return;
    setResending(true);
    setErrorMsg(null);
    try {
      await authApi.sendOtp(phone);
      setCountdown(60);
      setOtp('');
      failCountRef.current = 0;
    } catch (e: any) {
      setErrorMsg(e?.error ?? 'Could not resend. Please try again in a moment.');
    } finally {
      setResending(false);
    }
  }

  function handleOtpChange(text: string) {
    if (isLockedOut) return;
    const digits = text.replace(/\D/g, '').slice(0, OTP_LENGTH);
    setOtp(digits);
    setErrorMsg(null);
    if (digits.length === OTP_LENGTH) {
      setTimeout(() => handleVerify(digits), 80);
    }
  }

  const canVerify = otp.length === OTP_LENGTH && !loading && !verifyingRef.current && !isLockedOut;

  if (!phone) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ fontSize: 16, color: '#111827', marginBottom: 16 }}>Something went wrong. Please try again.</Text>
        <TouchableOpacity onPress={() => router.replace('/(auth)/phone' as any)}>
          <Text style={{ color: '#FF6B35', fontSize: 15 }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

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
            <Text style={styles.title}>{t('auth.otp_title')}</Text>
            <Text style={styles.subtitle}>
              {t('auth.otp_subtitle')}{'\n'}
              <Text style={{ color: C.textInk }}>{phone}</Text>
            </Text>

            {isLockedOut && (
              <View style={[styles.lockoutBanner, { backgroundColor: C.errorBg ?? '#FEF2F2' }]}>
                <Ionicons name="lock-closed-outline" size={16} color={C.errorFg} />
                <Text style={[styles.lockoutText, { color: C.errorFg }]}>
                  Too many attempts. Try again in {Math.floor(lockSecondsLeft / 60)}:{String(lockSecondsLeft % 60).padStart(2, '0')}
                </Text>
              </View>
            )}

            <TextInput
              ref={inputRef}
              style={[styles.otpInput, errorMsg ? styles.otpInputError : null, isLockedOut && styles.otpInputDisabled]}
              placeholder="• • • • • •"
              placeholderTextColor={C.stone}
              keyboardType="number-pad"
              maxLength={OTP_LENGTH}
              value={otp}
              onChangeText={handleOtpChange}
              autoFocus
              textAlign="center"
              textContentType="oneTimeCode"
              editable={!isLockedOut && !loading}
              accessibilityLabel="One-time verification code"
              accessibilityHint={`Enter the ${OTP_LENGTH}-digit code sent to your phone`}
            />

            {errorMsg && !isLockedOut ? (
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
                : <Text style={styles.btnText}>{t('auth.verify')}</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleResend}
              disabled={countdown > 0 || resending || isLockedOut}
              style={styles.resend}
              accessibilityLabel={countdown > 0 ? `Resend available in ${countdown} seconds` : 'Resend code'}
              accessibilityRole="button"
            >
              {resending ? (
                <ActivityIndicator size="small" color={C.spice} />
              ) : (
                <Text style={[styles.resendText, (countdown > 0 || isLockedOut) && styles.resendDisabled]}>
                  {countdown > 0 ? t('auth.resend_countdown', { countdown }) : t('auth.resend')}
                </Text>
              )}
            </TouchableOpacity>

            <Text style={styles.note}>{t('auth.otp_note')}</Text>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function makeStyles(C: AppColors) { return StyleSheet.create({
  root:     { flex: 1, backgroundColor: C.bg },
  safe:     { flex: 1 },
  back:     { margin: Spacing.md, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  content:  { flex: 1, padding: Spacing.lg, paddingTop: Spacing.xl },
  title:    { fontFamily: Fonts.serif, fontSize: 28, color: C.textInk, marginBottom: 8 },
  subtitle: { fontFamily: Fonts.sans, fontSize: 15, color: C.bodySoft, marginBottom: Spacing.xl, lineHeight: 22 },
  lockoutBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 12, borderRadius: Radius.sm, marginBottom: Spacing.md,
  },
  lockoutText: { fontFamily: Fonts.sans, fontSize: 13, flex: 1, lineHeight: 18 },
  otpInput: {
    borderWidth: 1, borderColor: C.borderWarm, borderRadius: Radius.md,
    backgroundColor: C.bgCard, paddingVertical: 20,
    fontFamily: Fonts.sans, fontSize: 32, color: C.textInk,
    letterSpacing: 14, marginBottom: Spacing.sm,
  },
  otpInputError: { borderColor: C.errorFg, borderWidth: 1.5 },
  otpInputDisabled: { opacity: 0.5 },
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
