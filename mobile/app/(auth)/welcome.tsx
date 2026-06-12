import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Fonts, Spacing, Radius } from '../../src/constants/theme';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import Wordmark from '../../src/components/ui/Wordmark';
import * as Haptics from 'expo-haptics';

const FEATURES: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string }[] = [
  { icon: 'storefront-outline',  text: 'Real cooks, real kitchens in your area' },
  { icon: 'time-outline',        text: 'Limited slots — when it sells out, it sells out' },
  { icon: 'shield-checkmark-outline', text: 'Verified, food-safety certified cooks' },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [tosAccepted, setTosAccepted] = useState(false);

  const handleGetStarted = () => {
    if (!tosAccepted) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: '/(auth)/phone', params: { tos_accepted: '1' } });
  };

  const toggleConsent = () => {
    Haptics.selectionAsync();
    setTosAccepted(v => !v);
  };

  return (
    <View style={styles.root}>
      <View style={styles.accent} />
      <SafeAreaView style={styles.safe}>
        <View style={styles.hero}>
          <Wordmark size="hero" on="dark" />
          <Text style={styles.tagline}>Real food · real kitchens · real people</Text>
        </View>

        <View style={styles.features}>
          {FEATURES.map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <View style={styles.featureIconWrap}>
                <Ionicons name={f.icon} size={18} color="rgba(232,146,74,0.85)" />
              </View>
              <Text style={styles.featureText}>{f.text}</Text>
            </View>
          ))}
        </View>

        <View style={styles.cta}>
          {/* Consent checkbox — required before sign-up (NDPR compliance) */}
          <TouchableOpacity
            style={styles.consentRow}
            onPress={toggleConsent}
            activeOpacity={0.7}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: tosAccepted }}
            accessibilityLabel="I agree to the Terms of Use and Privacy Policy"
          >
            <View style={[styles.checkbox, tosAccepted && styles.checkboxChecked]}>
              {tosAccepted && <Ionicons name="checkmark" size={14} color="#1C1006" />}
            </View>
            <Text style={styles.consentText}>
              I agree to the{' '}
              <Text
                style={styles.legalLink}
                onPress={() => router.push('/legal/terms' as any)}
                accessibilityRole="link"
              >
                Terms of Use
              </Text>
              {' '}and{' '}
              <Text
                style={styles.legalLink}
                onPress={() => router.push('/legal/privacy' as any)}
                accessibilityRole="link"
              >
                Privacy Policy
              </Text>
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleGetStarted}
            style={[styles.btn, !tosAccepted && styles.btnDisabled]}
            activeOpacity={tosAccepted ? 0.85 : 1}
            accessibilityLabel="Get started"
            accessibilityRole="button"
            accessibilityState={{ disabled: !tosAccepted }}
          >
            <Text style={[styles.btnText, !tosAccepted && styles.btnTextDisabled]}>Get started</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

function makeStyles(C: AppColors) { return StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1C1006' },
  accent: {
    position: 'absolute', top: -80, left: '10%',
    width: 380, height: 380, borderRadius: 190,
    backgroundColor: 'rgba(232,146,74,0.13)',
  },
  safe: { flex: 1, justifyContent: 'space-between', padding: Spacing.lg },
  hero: { paddingTop: 60, alignItems: 'flex-start' },
  tagline: { fontFamily: Fonts.sans, fontSize: 13, color: 'rgba(232,146,74,0.75)', marginTop: 10, letterSpacing: 0.5 },
  features: { gap: 18 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  featureIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(232,146,74,0.12)', alignItems: 'center', justifyContent: 'center' },
  featureText: { fontFamily: Fonts.sans, fontSize: 15, color: 'rgba(250,246,240,0.88)', flex: 1, lineHeight: 22 },
  cta: { gap: 14 },
  consentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  checkbox: {
    width: 20, height: 20, borderRadius: 5, marginTop: 1,
    borderWidth: 1.5, borderColor: 'rgba(232,146,74,0.60)',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  checkboxChecked: { backgroundColor: 'rgba(232,146,74,0.90)', borderColor: 'rgba(232,146,74,0.90)' },
  consentText: { fontFamily: Fonts.sans, fontSize: 13, color: 'rgba(250,246,240,0.70)', lineHeight: 20, flex: 1 },
  btn: { backgroundColor: C.canvas, borderRadius: Radius.full, paddingVertical: 16, alignItems: 'center' },
  btnDisabled: { backgroundColor: 'rgba(250,246,240,0.25)' },
  btnText: { fontFamily: Fonts.sansMedium, fontSize: 15, color: C.ink },
  btnTextDisabled: { color: 'rgba(28,16,6,0.40)' },
  legalLink: { color: 'rgba(232,146,74,0.90)', textDecorationLine: 'underline' },
}); }
