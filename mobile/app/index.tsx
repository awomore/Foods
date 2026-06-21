import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { hasLanguageBeenSelected } from '../src/context/LocaleContext';

export default function Index() {
  const { isAuthenticated, isLoading, user, activeMode } = useAuth();
  const [langChecked, setLangChecked] = useState(false);
  const [langSelected, setLangSelected] = useState(true);

  useEffect(() => {
    hasLanguageBeenSelected().then(selected => {
      setLangSelected(selected);
      setLangChecked(true);
    });
  }, []);

  if (isLoading || !langChecked) {
    return <View style={{ flex: 1, backgroundColor: '#FFFFFF' }} />;
  }

  if (!langSelected) {
    return <Redirect href={'/select-language' as any} />;
  }

  // New or social-auth users who haven't picked a role yet
  if (isAuthenticated && !user?.role) {
    return <Redirect href="/(auth)/role" />;
  }

  // Authenticated cooks in cook mode go to cook dashboard
  if (isAuthenticated && user?.role === 'cook' && activeMode !== 'customer') {
    return <Redirect href="/(cook)" />;
  }

  // Everyone else — authenticated or guest — lands on the customer browse experience
  return <Redirect href="/(customer)" />;
}
