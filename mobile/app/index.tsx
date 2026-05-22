import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '../src/context/AuthContext';
import { Colors } from '../src/constants/theme';

export default function Index() {
  const { isAuthenticated, isLoading, user, activeMode } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bg }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/welcome" />;
  }

  if (user?.role === 'cook' && activeMode !== 'customer') {
    return <Redirect href="/(cook)" />;
  }

  return <Redirect href="/(customer)" />;
}
