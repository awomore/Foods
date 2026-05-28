import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors, Fonts, Spacing, Radius } from '../../src/constants/theme';
import Wordmark from '../../src/components/ui/Wordmark';

const FEATURES = [
  { emoji: '🍲', text: 'Real cooks, real kitchens in your area' },
  { emoji: '📍', text: 'Limited slots — when it sells out, it sells out' },
  { emoji: '✅', text: 'NIN-verified, NAFDAC-certified cooks' },
];

export default function WelcomeScreen() {
  const router = useRouter();

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
          <TouchableOpacity onPress={() => router.push('/(auth)/phone')} style={styles.btn} activeOpacity={0.85}>
            <Text style={styles.btnText}>Get started</Text>
          </TouchableOpacity>
          <Text style={styles.legal}>
            By continuing you agree to our Terms of Use and Privacy Policy.
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
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
  btn: { backgroundColor: Colors.canvas, borderRadius: Radius.full, paddingVertical: 16, alignItems: 'center' },
  btnText: { fontFamily: Fonts.sansMedium, fontSize: 15, color: Colors.ink },
  legal: { fontFamily: Fonts.sans, fontSize: 11, color: 'rgba(250,246,240,0.35)', textAlign: 'center', lineHeight: 16 },
});
