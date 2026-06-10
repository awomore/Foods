export { ErrorBoundary } from '../../src/components/LoggingErrorBoundary';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Fonts } from '../../src/constants/theme';
import { useColors } from '../../src/context/ThemeContext';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({ name, focused }: { name: IoniconsName; focused: boolean }) {
  const C = useColors();
  return <Ionicons name={name} size={23} color={focused ? C.spice : C.bodySoft} />;
}

export default function CookLayout() {
  const C = useColors();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.spice,
        tabBarInactiveTintColor: C.bodySoft,
        tabBarStyle: {
          backgroundColor: C.bgCard,
          borderTopWidth: 0.5,
          borderTopColor: C.borderWarm,
          height: 84,
          paddingBottom: 24,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontFamily: Fonts.sans, fontSize: 10, marginTop: 2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Studio', tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'aperture' : 'aperture-outline'} focused={focused} /> }}
      />
      <Tabs.Screen
        name="orders"
        options={{ title: 'Orders', tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'receipt' : 'receipt-outline'} focused={focused} /> }}
      />
      <Tabs.Screen
        name="menu"
        options={{ title: 'Menu', tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'restaurant' : 'restaurant-outline'} focused={focused} /> }}
      />
      <Tabs.Screen
        name="enquiries"
        options={{ title: 'Inbox', tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'mail' : 'mail-outline'} focused={focused} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'You', tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'person-circle' : 'person-circle-outline'} focused={focused} /> }}
      />
      {/* Hidden — accessible via Studio shortcuts or Profile */}
      <Tabs.Screen name="cravings"               options={{ href: null }} />
      <Tabs.Screen name="earnings"               options={{ href: null }} />
      <Tabs.Screen name="chef-settings"          options={{ href: null }} />
      <Tabs.Screen name="analytics"              options={{ href: null }} />
      <Tabs.Screen name="followers"              options={{ href: null }} />
      <Tabs.Screen name="content-insights"       options={{ href: null }} />
      <Tabs.Screen name="certifications"         options={{ href: null }} />
      <Tabs.Screen name="meal-archive"           options={{ href: null }} />
      <Tabs.Screen name="review-center"          options={{ href: null }} />
      <Tabs.Screen name="trust-score"            options={{ href: null }} />
      <Tabs.Screen name="health-specialisations" options={{ href: null }} />
      <Tabs.Screen name="health-plans"           options={{ href: null }} />
      <Tabs.Screen name="health-subscribers"     options={{ href: null }} />
      <Tabs.Screen name="content"                options={{ href: null }} />
      <Tabs.Screen name="commerce"               options={{ href: null }} />
      <Tabs.Screen name="calendar"               options={{ href: null }} />
    </Tabs>
  );
}
