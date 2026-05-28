import { useEffect, useRef } from 'react';
import { Stack, useRouter } from 'expo-router';
import { useFonts } from 'expo-font';
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
import { AuthProvider } from '../src/context/AuthContext';
import { CartProvider } from '../src/context/CartContext';
import { ThemeProvider } from '../src/context/ThemeContext';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

// Show notifications as banners when app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

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

  useEffect(() => { if (error) throw error; }, [error]);
  useEffect(() => { if (loaded) SplashScreen.hideAsync(); }, [loaded]);

  useEffect(() => {
    // Handle notification taps — navigate to the relevant screen
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as Record<string, any>;
      if (!data) return;

      if (data.craving_id && data.fulfilled_by) {
        // Craving fulfilled → show own cravings profile
        router.push(`/profile/${data.user_id}` as any);
      } else if (data.cook_id && data.post_id) {
        // New diary post → cook page
        router.push(`/cook/${data.cook_id}` as any);
      } else if (data.order_id) {
        router.push(`/tracking/${data.order_id}` as any);
      }
    });

    return () => {
      notifListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  if (!loaded) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <CartProvider>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(cook)" />
              <Stack.Screen name="(customer)" />
              {/* Detail screens */}
              <Stack.Screen name="cook/[id]"        options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="item/[id]"        options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="checkout"         options={{ animation: 'slide_from_bottom' }} />
              <Stack.Screen name="confirmation"     options={{ animation: 'fade', gestureEnabled: false }} />
              <Stack.Screen name="tracking/[id]"   options={{ animation: 'slide_from_right' }} />
              {/* Public profile & share deep-link handler */}
              <Stack.Screen name="profile/[userId]" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="c/[id]"           options={{ animation: 'fade' }} />
              {/* Cook onboarding */}
              <Stack.Screen name="cook-onboarding"  options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />
              {/* Cook diary post composer */}
              <Stack.Screen name="diary-post"       options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
            </Stack>
            <StatusBar style="auto" />
          </CartProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
