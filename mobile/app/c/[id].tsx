import { useEffect } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { api } from '../../src/api/client';
import { useColors } from '../../src/context/ThemeContext';

/**
 * Deep link handler for foodsbyme://c/:id  (shared craving links).
 * Fetches the craving and redirects to the correct in-app destination.
 */
export default function CravingDeepLink() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const C = useColors();

  useEffect(() => {
    if (!id) { router.replace('/(customer)' as any); return; }

    api.get<{ craving: any }>(`/cravings/public/${id}`)
      .then(({ craving }) => {
        if (craving.is_fulfilled) {
          if (craving.cook_id) {
            router.replace({ pathname: '/cook/[id]', params: { id: craving.cook_id } });
          } else {
            router.replace('/(customer)' as any);
          }
        } else {
          router.replace({ pathname: '/profile/[userId]', params: { userId: craving.user_id } } as any);
        }
      })
      .catch(() => {
        router.replace('/(customer)' as any);
      });
  }, [id]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg }}>
      <ActivityIndicator color={C.spice} />
    </View>
  );
}
