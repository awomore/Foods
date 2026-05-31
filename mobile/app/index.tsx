import { View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';

export default function Index() {
  const { isAuthenticated, isLoading, user, activeMode } = useAuth();

  if (isLoading) {
    return <View style={{ flex: 1, backgroundColor: '#1A1009' }} />;
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/welcome" />;
  }

  if (user?.role === 'cook' && activeMode !== 'customer') {
    return <Redirect href="/(cook)" />;
  }

  return <Redirect href="/(customer)" />;
}
