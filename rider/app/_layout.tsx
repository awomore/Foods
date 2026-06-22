import React, { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, DMSans_400Regular, DMSans_500Medium } from '@expo-google-fonts/dm-sans';
import * as Notifications from 'expo-notifications';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { api } from '../src/api/client';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function registerRiderPushToken() {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return;
    const token = (await Notifications.getExpoPushTokenAsync()).data;
    await api.post('/auth/push-token', { token, platform: Platform.OS });
  } catch {
    // non-fatal: simulators or permission denied
  }
}

function PushSync() {
  const { user } = useAuth();
  useEffect(() => {
    if (user?.id) registerRiderPushToken();
  }, [user?.id]);
  return null;
}

export default function RootLayout() {
  const notifListener = useRef<Notifications.EventSubscription | undefined>(undefined);
  const [fontsLoaded] = useFonts({ DMSans_400Regular, DMSans_500Medium });
  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <PushSync />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="delivery/[orderId]" options={{ presentation: 'modal' }} />
          </Stack>
          <StatusBar style="dark" />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
