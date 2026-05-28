import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Fonts, Spacing, Radius } from '../../src/constants/theme';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import Wordmark from '../../src/components/ui/Wordmark';
import * as Haptics from 'expo-haptics';

const FEATURES = [
  { emoji: '🍲', text: 'Real cooks, real kitchens in your area' },
  { emoji: '📍', text: 'Limited slots — when it sells out, it sells out' },
  { emoji: '✅', text: 'NIN-verified, NAFDAC-certified cooks' },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);

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
              <Text style={styles.emoji}>{f.emoji}</Text>
              <Text style={styles.featureText}>{f.text}</Text>
            </View>
          ))}
        </View>

        <View style={styles.cta}>
          <TouchableOpacity
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/(auth)/phone'); }}
            style={styles.btn}
            activeOpacity={0.85}
            accessibilityLabel="Get started"
            accessibilityRole="button"
          >
            <Text style={styles.btnText}>Get started</Text>
          </TouchableOpacity>
          <Text style={styles.legal}>
            By continuing you agree to our{' '}
            <Text
              style={styles.legalLink}
              onPress={() => router.push('/legal/terms' as any)}
              accessibilityRole="link"
              accessibilityLabel="Terms of Use"
            >
              Terms of Use
            </Text>
            {' '}and{' '}
            <Text
              style={styles.legalLink}
              onPress={() => router.push('/legal/privacy' as any)}
              accessibilityRole="link"
              accessibilityLabel="Privacy Policy"
            >
              Privacy Policy
            </Text>.
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

function makeStyles(C: AppColors) { return StyleSheet.create({
  root: { flex: 1, backgroundColor: '#110a04' },
  accent: {
    position: 'absolute', top: -120, left: '20%',
    width: 320, height: 320, borderRadius: 160,
    backgroundColor: 'rgba(232,146,74,0.07)',
  },
  safe: { flex: 1, justifyContent: 'space-between', padding: Spacing.lg },
  hero: { paddingTop: 60, alignItems: 'flex-start' },
  tagline: { fontFamily: Fonts.sans, fontSize: 13, color: 'rgba(232,146,74,0.7)', marginTop: 10, letterSpacing: 0.5 },
  features: { gap: 18 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  emoji: { fontSize: 22, width: 32, textAlign: 'center' },
  featureText: { fontFamily: Fonts.sans, fontSize: 15, color: 'rgba(250,246,240,0.82)', flex: 1, lineHeight: 22 },
  cta: { gap: 14 },
  btn: { backgroundColor: C.canvas, borderRadius: Radius.full, paddingVertical: 16, alignItems: 'center' },
  btnText: { fontFamily: Fonts.sansMedium, fontSize: 15, color: C.ink },
  legal: { fontFamily: Fonts.sans, fontSize: 12, color: 'rgba(250,246,240,0.60)', textAlign: 'center', lineHeight: 18 },
  legalLink: { color: 'rgba(232,146,74,0.90)', textDecorationLine: 'underline' },
}); }
