import { View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';

export default function Index() {
  const { isAuthenticated, isLoading, user, activeMode } = useAuth();

  if (isLoading) {
    return <View style={{ flex: 1, backgroundColor: '#111827' }} />;
  }

  // Authenticated cooks in cook mode go to cook dashboard
  if (isAuthenticated && user?.role === 'cook' && activeMode !== 'customer') {
    return <Redirect href="/(cook)" />;
  }

  // Everyone else — authenticated or guest — lands on the customer browse experience
  return <Redirect href="/(customer)" />;
}
