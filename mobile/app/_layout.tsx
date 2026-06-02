import React, { useEffect, useRef } from 'react';
import * as Sentry from '@sentry/react-native';
import { Stack, useRouter } from 'expo-router';

if (process.env.EXPO_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    environment: __DEV__ ? 'development' : 'production',
    tracesSampleRate: __DEV__ ? 0 : 0.2,
  });
}
import { useFonts } from 'expo-font';
import { initAnalytics, setAnalyticsUser } from '../src/utils/analytics';
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
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { CartProvider } from '../src/context/CartContext';
import { ThemeProvider } from '../src/context/ThemeContext';
import { FeedbackProvider } from '../src/components/feedback';
import { registerPushToken } from '../src/utils/pushNotifications';

export { ErrorBoundary } from 'expo-router';

/** Keeps analytics + Sentry user ID in sync with auth state, and registers push token on login. */
function AnalyticsSync() {
  const { user } = useAuth();
  useEffect(() => {
    initAnalytics(user?.id ?? null);
  }, []);
  useEffect(() => {
    setAnalyticsUser(user?.id ?? null);
    if (user?.id) {
      Sentry.setUser({ id: user.id, phone: user.phone ?? undefined });
      registerPushToken().catch(() => {});
    } else {
      Sentry.setUser(null);
    }
  }, [user?.id]);
  return null;
}

SplashScreen.preventAutoHideAsync();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function StatusBarWrapper() {
  return <StatusBar style="dark" />;
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
        const type = data.type as string | undefined;

        if (type === 'cook_live' && data.cook_id) {
          router.push(`/cook/${data.cook_id}` as any);
        } else if ((type === 'diary_post' || type === 'post_comment') && data.cook_id) {
          router.push(`/cook/${data.cook_id}` as any);
        } else if ((type === 'craving_available' || type === 'craving_fulfilled') && data.menu_item_id) {
          router.push({ pathname: '/item/[id]', params: { id: data.menu_item_id } } as any);
        } else if (type === 'craving_available' && data.cook_id) {
          router.push(`/cook/${data.cook_id}` as any);
        } else if (type === 'new_follower') {
          router.push('/(cook)/profile' as any);
        } else if (data.cook_id && data.post_id) {
          router.push(`/cook/${data.cook_id}` as any);
        } else if (data.order_id) {
          router.push(`/tracking/${data.order_id}` as any);
        } else if (data.cook_id) {
          router.push(`/cook/${data.cook_id}` as any);
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
            <AnalyticsSync />
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
                  <Stack.Screen name="create-post"       options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
                  <Stack.Screen name="legal/terms"           options={{ animation: 'slide_from_right' }} />
                  <Stack.Screen name="legal/privacy"         options={{ animation: 'slide_from_right' }} />
                  {/* Phase 5 — Marketplace */}
                  <Stack.Screen name="search"                options={{ animation: 'slide_from_right' }} />
                  <Stack.Screen name="dispute/[orderId]"     options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
                  <Stack.Screen name="dispute/status/[id]"   options={{ animation: 'slide_from_right' }} />
                  <Stack.Screen name="catering/request"      options={{ animation: 'slide_from_right' }} />
                  <Stack.Screen name="catering/[id]"         options={{ animation: 'slide_from_right' }} />
                  <Stack.Screen name="booking/[id]"          options={{ animation: 'slide_from_right' }} />
                  <Stack.Screen name="course/[id]"           options={{ animation: 'slide_from_right' }} />
                  <Stack.Screen name="course/create"         options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
                  <Stack.Screen name="product/[id]"          options={{ animation: 'slide_from_right' }} />
                  <Stack.Screen name="product/create"        options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
                  <Stack.Screen name="invoice/[id]"          options={{ animation: 'slide_from_right' }} />
                  <Stack.Screen name="invoice/create"        options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
                  <Stack.Screen name="quote/[id]"            options={{ animation: 'slide_from_right' }} />
                  <Stack.Screen name="quote/create"          options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
                  <Stack.Screen name="(admin)"               options={{ animation: 'slide_from_right' }} />
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
