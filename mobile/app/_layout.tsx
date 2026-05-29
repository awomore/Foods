import React, { useEffect, useRef } from 'react';
import { Stack, useRouter } from 'expo-router';
import { useFonts } from 'expo-font';
import { useIsDark } from '../src/context/ThemeContext';
import {
  DMSerifDisplay_400Regular,
  DMSerifDisplay_400Regular_Italic,
} from '@expo-google-fonts/dm-serif-display';
import {
  DMSans_300Light,
  DMSans_400Regular,
  DMSans_500Medium,
} from '@expo-google-fonts/dm-sans';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from '../src/context/AuthContext';
import { CartProvider } from '../src/context/CartContext';
import { ThemeProvider } from '../src/context/ThemeContext';
import { FeedbackProvider } from '../src/components/feedback';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

function StatusBarWrapper() {
  const isDark = useIsDark();
  return <StatusBar style={isDark ? 'light' : 'dark'} />;
}

export default function RootLayout() {
  const router = useRouter();
  const notifListener = useRef<Notifications.EventSubscription | undefined>(undefined);
  const responseListener = useRef<Notifications.EventSubscription | undefined>(undefined);

  const [loaded, error] = useFonts({
    DMSerifDisplay_400Regular,
    DMSerifDisplay_400Regular_Italic,
    DMSans_300Light,
    DMSans_400Regular,
    DMSans_500Medium,
  });

  useEffect(() => {
    if (error) {
      // Font load failure is non-fatal — hide splash and continue with system fonts
      console.warn('[FOODS] Font load failed, continuing with system fonts:', error.message);
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [error]);

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync().catch(() => {});
  }, [loaded]);

  useEffect(() => {
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      try {
        const data = response.notification.request.content.data as Record<string, any>;
        if (!data) return;
        if (data.craving_id && data.user_id) {
          router.push(`/profile/${data.user_id}` as any);
        } else if (data.cook_id && data.post_id) {
          router.push(`/cook/${data.cook_id}` as any);
        } else if (data.order_id) {
          router.push(`/tracking/${data.order_id}` as any);
        }
      } catch (e) {
        console.warn('[FOODS] Notification navigation error:', e);
      }
    });

    return () => {
      notifListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <CartProvider>
              <FeedbackProvider>
                <Stack screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="index" />
                  <Stack.Screen name="(auth)" />
                  <Stack.Screen name="(cook)" />
                  <Stack.Screen name="(customer)" />
                  <Stack.Screen name="cook/[id]"         options={{ animation: 'slide_from_right' }} />
                  <Stack.Screen name="item/[id]"         options={{ animation: 'slide_from_right' }} />
                  <Stack.Screen name="checkout"          options={{ animation: 'slide_from_bottom' }} />
                  <Stack.Screen name="confirmation"      options={{ animation: 'fade', gestureEnabled: false }} />
                  <Stack.Screen name="tracking/[id]"    options={{ animation: 'slide_from_right' }} />
                  <Stack.Screen name="profile/[userId]"  options={{ animation: 'slide_from_right' }} />
                  <Stack.Screen name="c/[id]"            options={{ animation: 'fade' }} />
                  <Stack.Screen name="cook-onboarding"   options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />
                  <Stack.Screen name="diary-post"        options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
                  <Stack.Screen name="legal/terms"       options={{ animation: 'slide_from_right' }} />
                  <Stack.Screen name="legal/privacy"     options={{ animation: 'slide_from_right' }} />
                </Stack>
                <StatusBarWrapper />
              </FeedbackProvider>
            </CartProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
