import { Redirect } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { View, ActivityIndicator } from 'react-native';

export default function IndexScreen() {
  const { user, loading } = useAuth();
  if (loading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color="#FF6B35" /></View>;
  return <Redirect href={user ? '/(tabs)/orders' : '/(auth)/login'} />;
}
