import React from 'react';
export { ErrorBoundary } from '../../src/components/LoggingErrorBoundary';
import { Tabs } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Fonts } from '../../src/constants/theme';
import { useTheme } from '../../src/context/ThemeContext';
import { useTranslation } from 'react-i18next';
type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

export default function CustomerLayout() {
  const { colors } = useTheme();
  const { t } = useTranslation();

  function TabIcon({ name, focused }: { name: IoniconsName; focused: boolean }) {
    return <Ionicons name={name} size={23} color={focused ? colors.spice : colors.bodySoft} />;
  }

  return (
    <View style={{ flex: 1 }}>
      <Tabs
      // Most screens here are hidden tabs (href: null) opened from Home or
      // Account. The tab default, 'firstRoute', sends Back from any of them to
      // Home, so Account → Bookings → Back landed on Home and the user had to
      // start over. 'history' returns to wherever they came from.
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.bgCard,
          borderTopWidth: 0.5,
          borderTopColor: colors.borderWarm,
          height: 84,
          paddingBottom: 24,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.spice,
        tabBarInactiveTintColor: colors.bodySoft,
        tabBarLabelStyle: styles.label,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.home'),
          tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'home' : 'home-outline'} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: t('tabs.search'),
          tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'search' : 'search-outline'} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="spin"
        options={{
          title: '',
          tabBarIcon: () => (
            <View style={[styles.exploreBtn, { backgroundColor: colors.ink, shadowColor: colors.ink }]}>
              <Ionicons name="compass" size={24} color={colors.ember} />
            </View>
          ),
          tabBarLabel: () => null,
        }}
      />
      <Tabs.Screen
        name="feed"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: t('tabs.orders'),
          tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'bag' : 'bag-outline'} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: t('tabs.you'),
          tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'person' : 'person-outline'} focused={focused} />,
        }}
      />
      <Tabs.Screen name="create-food-post" options={{ href: null }} />
      <Tabs.Screen name="gifting"        options={{ href: null }} />
      <Tabs.Screen name="bookings"       options={{ href: null }} />
      <Tabs.Screen name="notifications"  options={{ href: null }} />
      <Tabs.Screen name="following"      options={{ href: null }} />
      <Tabs.Screen name="health-plans"   options={{ href: null }} />
      <Tabs.Screen name="library"        options={{ href: null }} />
    </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: Fonts.sans, fontSize: 10, marginTop: 2 },
  exploreBtn: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
    marginTop: -12,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 8,
  },
});
