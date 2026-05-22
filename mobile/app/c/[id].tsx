import { useEffect } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { Colors } from '../../src/constants/theme';
import { api } from '../../src/api/client';

/**
 * Deep link handler for foodsbyme://c/:id  (shared craving links).
 * Fetches the craving and redirects to the correct in-app destination.
 */
export default function CravingDeepLink() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  useEffect(() => {
    if (!id) { router.replace('/(customer)' as any); return; }

    api.get<{ craving: any }>(`/cravings/public/${id}`)
      .then(({ craving }) => {
        if (craving.is_fulfilled) {
          // Go to cook's page so they can order for themselves
          if (craving.cook_id) {
            router.replace({ pathname: '/cook/[id]', params: { id: craving.cook_id } });
          } else {
            router.replace('/(customer)' as any);
          }
        } else {
          // Go to the craving owner's profile so gifters can treat them
          router.replace({ pathname: '/profile/[userId]', params: { userId: craving.user_id } } as any);
        }
      })
      .catch(() => {
        router.replace('/(customer)' as any);
      });
  }, [id]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bg }}>
      <ActivityIndicator color={Colors.spice} />
    </View>
  );
}
