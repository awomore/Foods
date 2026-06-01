import { Stack } from 'expo-router';

export default function AdminLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="disputes" />
      <Stack.Screen name="refunds" />
      <Stack.Screen name="verifications" />
      <Stack.Screen name="moderation" />
      <Stack.Screen name="payouts" />
      <Stack.Screen name="fraud" />
      <Stack.Screen name="settings" />
    </Stack>
  );
}
