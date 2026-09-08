// Landing route for the Google OAuth redirect.
//
// Google sends the browser to com.foodsbyme.app:/oauthredirect?code=... . Two
// listeners receive that URL: expo-web-browser's, which resolves promptAsync in
// (auth)/phone.tsx, and expo-router's, which routes on the path. Without a
// screen at this path expo-router rendered +not-found — "This screen doesn't
// exist." — on top of a sign-in that was otherwise working.
//
// So this screen exists only to be somewhere harmless to land. The sign-in
// handler navigates away as soon as the token exchange finishes; the timeout
// below is the safety net for when it doesn't, so nobody is stranded on a
// spinner with no way back.
import React, { useEffect, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useColors } from '../src/context/ThemeContext';
import AppText from '../src/components/ui/Text';

const STRANDED_AFTER_MS = 10000;

export default function OAuthRedirectScreen() {
  const C = useColors();
  const router = useRouter();
  const { t } = useTranslation();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timer.current = setTimeout(() => {
      router.replace('/(auth)/phone' as any);
    }, STRANDED_AFTER_MS);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [router]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.container, { backgroundColor: C.canvas }]}>
        <ActivityIndicator color={C.spice} />
        <AppText style={[styles.label, { color: C.ink }]}>
          {t('auth.finishing_sign_in', 'Finishing sign-in…')}
        </AppText>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  label: { fontSize: 14, marginTop: 12 },
});
