import React from 'react';
export { ErrorBoundary } from '../../src/components/LoggingErrorBoundary';
import { Tabs } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Fonts } from '../../src/constants/theme';
import { useTheme } from '../../src/context/ThemeContext';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

export default function CustomerLayout() {
  const { colors } = useTheme();

  function TabIcon({ name, focused }: { name: IoniconsName; focused: boolean }) {
    return <Ionicons name={name} size={23} color={focused ? colors.spice : colors.bodySoft} />;
  }

  return (
    <Tabs
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
          title: 'Home',
          tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'home' : 'home-outline'} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="feed"
        options={{
          title: 'Feed',
          tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'newspaper' : 'newspaper-outline'} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="spin"
        options={{
          title: 'Spin',
          tabBarIcon: () => (
            <View style={[styles.spinBtn, { backgroundColor: colors.ink, shadowColor: colors.ink }]}>
              <Ionicons name="dice" size={22} color={colors.ember} />
            </View>
          ),
          tabBarLabel: () => null,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'bag' : 'bag-outline'} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'You',
          tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'person' : 'person-outline'} focused={focused} />,
        }}
      />
      <Tabs.Screen name="create-food-post" options={{ href: null }} />
      <Tabs.Screen name="gifting"        options={{ href: null }} />
      <Tabs.Screen name="bookings"       options={{ href: null }} />
      <Tabs.Screen name="notifications"  options={{ href: null }} />
      <Tabs.Screen name="following"      options={{ href: null }} />
      <Tabs.Screen name="health-plans"   options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: Fonts.sans, fontSize: 10, marginTop: 2 },
  spinBtn: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
    marginTop: -10,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
});
