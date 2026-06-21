import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Fonts, Spacing, Radius } from '../../src/constants/theme';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import Wordmark from '../../src/components/ui/Wordmark';
import * as Haptics from 'expo-haptics';

export default function WelcomeScreen() {
  const router = useRouter();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const { t } = useTranslation();

  const FEATURES: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string }[] = [
    { icon: 'storefront-outline',       text: t('auth.feature1') },
    { icon: 'time-outline',             text: t('auth.feature2') },
    { icon: 'shield-checkmark-outline', text: t('auth.feature3') },
  ];

  const handleGetStarted = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(auth)/phone' as any);
  };

  return (
    <View style={styles.root}>
      <View style={styles.accent} />
      <SafeAreaView style={styles.safe}>
        {router.canGoBack() && (
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.closeBtn}
            accessibilityLabel="Close"
            accessibilityRole="button"
          >
            <Ionicons name="close" size={22} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>
        )}
        <View style={styles.hero}>
          <Wordmark size="hero" on="dark" />
          <Text style={styles.tagline}>{t('auth.tagline')}</Text>
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
          <TouchableOpacity
            onPress={handleGetStarted}
            style={styles.btn}
            activeOpacity={0.85}
            accessibilityLabel="Get started"
            accessibilityRole="button"
          >
            <Text style={styles.btnText}>{t('auth.get_started')}</Text>
          </TouchableOpacity>

          <Text style={styles.consentText}>
            {t('auth.consent')}{' '}
            <Text
              style={styles.legalLink}
              onPress={() => router.push('/legal/terms' as any)}
              accessibilityRole="link"
            >
              {t('auth.terms')}
            </Text>
            {' '}{t('auth.and')}{' '}
            <Text
              style={styles.legalLink}
              onPress={() => router.push('/legal/privacy' as any)}
              accessibilityRole="link"
            >
              {t('auth.privacy')}
            </Text>
          </Text>
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
  closeBtn: { alignSelf: 'flex-end', padding: 8 },
  hero: { paddingTop: 60, alignItems: 'flex-start' },
  tagline: { fontFamily: Fonts.sans, fontSize: 13, color: 'rgba(232,146,74,0.75)', marginTop: 10, letterSpacing: 0.5 },
  features: { gap: 18 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  featureIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(232,146,74,0.12)', alignItems: 'center', justifyContent: 'center' },
  featureText: { fontFamily: Fonts.sans, fontSize: 15, color: 'rgba(255, 255, 255,0.88)', flex: 1, lineHeight: 22 },
  cta: { gap: 12 },
  consentText: { fontFamily: Fonts.sans, fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 18, textAlign: 'center' },
  btn: { backgroundColor: C.canvas, borderRadius: Radius.full, paddingVertical: 16, alignItems: 'center' },
  btnText: { fontFamily: Fonts.sansMedium, fontSize: 15, color: C.ink },
  legalLink: { color: 'rgba(232,146,74,0.80)', textDecorationLine: 'underline' },
}); }
