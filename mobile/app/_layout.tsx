import { useEffect } from 'react';
import { Stack } from 'expo-router';
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
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../src/context/AuthContext';
import { CartProvider } from '../src/context/CartContext';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    DMSerifDisplay_400Regular,
    DMSerifDisplay_400Regular_Italic,
    DMSans_300Light,
    DMSans_400Regular,
    DMSans_500Medium,
  });

  useEffect(() => { if (error) throw error; }, [error]);
  useEffect(() => { if (loaded) SplashScreen.hideAsync(); }, [loaded]);

  if (!loaded) return null;

  return (
    <AuthProvider>
      <CartProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(cook)" />
          <Stack.Screen name="(customer)" />
          {/* Customer detail stack screens */}
          <Stack.Screen name="cook/[id]"        options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="item/[id]"        options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="checkout"         options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="confirmation"     options={{ animation: 'fade', gestureEnabled: false }} />
          <Stack.Screen name="tracking/[id]"   options={{ animation: 'slide_from_right' }} />
        </Stack>
        <StatusBar style="dark" />
      </CartProvider>
    </AuthProvider>
  );
}
