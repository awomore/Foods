export { ErrorBoundary } from '../../src/components/LoggingErrorBoundary';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Fonts } from '../../src/constants/theme';
import { useColors } from '../../src/context/ThemeContext';
import { useTranslation } from 'react-i18next';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({ name, focused }: { name: IoniconsName; focused: boolean }) {
  const C = useColors();
  return <Ionicons name={name} size={23} color={focused ? C.spice : C.bodySoft} />;
}

export default function CookLayout() {
  const C = useColors();
  const { t } = useTranslation();
  return (
    <Tabs
      // The twenty hidden tabs below are opened from Studio or Profile; with
      // the default 'firstRoute', Back from any of them jumped to Studio rather
      // than the screen the creator came from.
      backBehavior="history"
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
        options={{ title: t('tabs.studio'), tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'aperture' : 'aperture-outline'} focused={focused} /> }}
      />
      <Tabs.Screen
        name="orders"
        options={{ title: t('tabs.orders'), tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'receipt' : 'receipt-outline'} focused={focused} /> }}
      />
      <Tabs.Screen
        name="menu"
        options={{ title: t('tabs.menu'), tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'restaurant' : 'restaurant-outline'} focused={focused} /> }}
      />
      <Tabs.Screen
        name="enquiries"
        options={{ title: t('tabs.inbox'), tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'mail' : 'mail-outline'} focused={focused} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: t('tabs.you'), tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'person-circle' : 'person-circle-outline'} focused={focused} /> }}
      />
      {/* Hidden — accessible via Studio shortcuts or Profile */}
      <Tabs.Screen name="cravings"               options={{ href: null }} />
      <Tabs.Screen name="earnings"               options={{ href: null }} />
      <Tabs.Screen name="chef-settings"          options={{ href: null }} />
      <Tabs.Screen name="connected-accounts"     options={{ href: null }} />
      <Tabs.Screen name="analytics"              options={{ href: null }} />
      <Tabs.Screen name="followers"              options={{ href: null }} />
      <Tabs.Screen name="content-insights"       options={{ href: null }} />
      <Tabs.Screen name="certifications"         options={{ href: null }} />
      <Tabs.Screen name="meal-archive"           options={{ href: null }} />
      <Tabs.Screen name="gallery"                options={{ href: null }} />
      <Tabs.Screen name="review-center"          options={{ href: null }} />
      <Tabs.Screen name="trust-score"            options={{ href: null }} />
      <Tabs.Screen name="health-specialisations" options={{ href: null }} />
      <Tabs.Screen name="health-plans"           options={{ href: null }} />
      <Tabs.Screen name="health-subscribers"     options={{ href: null }} />
      <Tabs.Screen name="content"                options={{ href: null }} />
      <Tabs.Screen name="commerce"               options={{ href: null }} />
      <Tabs.Screen name="calendar"               options={{ href: null }} />
      <Tabs.Screen name="diary"                  options={{ href: null }} />
      <Tabs.Screen name="referrals"             options={{ href: null }} />
      <Tabs.Screen name="delivery-stats"        options={{ href: null }} />
    </Tabs>
  );
}
