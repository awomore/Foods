import React, { useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Fonts, Spacing, Radius } from '../../src/constants/theme';
import { useColors, type AppColors } from '../../src/context/ThemeContext';

const LAST_UPDATED = 'May 2026';

const SECTIONS = [
  {
    title: '1. Who We Are',
    body: `FOODSbyme ("we", "us", "our") operates the FOODSbyme mobile application and related services. We are committed to protecting your personal information and your right to privacy.`,
  },
  {
    title: '2. Information We Collect',
    body: `We collect information you provide directly: your phone number (for authentication), full name, email address, delivery addresses, and dietary/allergen preferences. We also collect order history, payment transaction references (not card details — these are handled by Flutterwave), device identifiers for push notifications, and approximate location data when you grant permission.`,
  },
  {
    title: '3. How We Use Your Information',
    body: `We use your data to: process and fulfil your orders; send order status notifications; personalise your discovery experience; show allergen warnings on dishes; calculate proximity to cooks; process payments via Flutterwave; and improve our platform. We do not sell your personal data to third parties.`,
  },
  {
    title: '4. Payment Data',
    body: `All payment processing is handled by Flutterwave. FOODSbyme does not store your card details. We only retain transaction references and amounts for your order history. Flutterwave's privacy policy governs their handling of your payment information.`,
  },
  {
    title: '5. Location Data',
    body: `We request location permission to show cooks near you. Location data is used only during active sessions to filter search results. We do not track your location in the background or store precise location history.`,
  },
  {
    title: '6. Allergen & Health Data',
    body: `Allergen information you provide is used solely to display warnings when a dish may contain your listed allergens. This information is not shared with third parties beyond the Cooks fulfilling your order.`,
  },
  {
    title: '7. Push Notifications',
    body: `With your permission, we send push notifications for: order status updates, messages from Cooks, and platform announcements. You can withdraw permission at any time in your device settings or the app's notification preferences.`,
  },
  {
    title: '8. Data Sharing',
    body: `We share your name and delivery address with the Cook fulfilling your order, and your phone number/email with Flutterwave for payment processing. We do not share your data with advertisers. We may disclose data if required by law or to protect the safety of users.`,
  },
  {
    title: '9. Data Retention',
    body: `We retain your account data for as long as your account is active. After account deletion, we anonymise or delete your personal data within 30 days, except where required to retain it for legal compliance (e.g., financial records for 7 years).`,
  },
  {
    title: '10. Your Rights',
    body: `You have the right to: access the personal data we hold about you; request correction of inaccurate data; request deletion of your account and data; withdraw consent for optional data uses; and lodge a complaint with your local data protection authority.`,
  },
  {
    title: '11. Security',
    body: `We use industry-standard security measures including HTTPS encryption, JWT authentication, and restricted database access. Despite our efforts, no system is 100% secure. Please use a strong, unique phone number and report any suspicious activity immediately.`,
  },
  {
    title: '12. Children',
    body: `FOODSbyme is not intended for users under 18. We do not knowingly collect data from minors. If you believe a minor has provided us with personal data, please contact us at privacy@foodsbyme.com.`,
  },
  {
    title: '13. Contact Us',
    body: `For privacy enquiries, data access requests, or to exercise your rights, contact: privacy@foodsbyme.com\n\nYou can also submit requests through the Help & Support section in the app.`,
  },
];

export default function PrivacyScreen() {
  const router = useRouter();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: C.bg }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Go back">
            <Ionicons name="chevron-back" size={22} color={C.textInk} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Privacy Policy</Text>
          <View style={{ width: 36 }} />
        </View>
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={styles.lastUpdated}>Last updated: {LAST_UPDATED}</Text>
        <Text style={styles.intro}>
          Your privacy matters to us. This Policy explains what data we collect, why we collect it, and how you can control it.
        </Text>

        {SECTIONS.map((s, i) => (
          <View key={i} style={styles.section}>
            <Text style={styles.sectionTitle}>{s.title}</Text>
            <Text style={styles.sectionBody}>{s.body}</Text>
          </View>
        ))}

        <View style={styles.footer}>
          <Ionicons name="shield-checkmark-outline" size={20} color={C.leaf} style={{ marginBottom: 8 }} />
          <Text style={styles.footerText}>
            FOODSbyme is committed to handling your data with care. We will never sell your personal information.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function makeStyles(C: AppColors) { return StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontFamily: Fonts.sansMedium, fontSize: 16, color: C.textInk },

  scroll: { padding: Spacing.lg, paddingBottom: 60 },
  lastUpdated: { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft, marginBottom: 8 },
  intro: { fontFamily: Fonts.sans, fontSize: 14, color: C.body, lineHeight: 22, marginBottom: Spacing.lg, padding: 16, backgroundColor: C.bgCook, borderRadius: Radius.md },

  section: { marginBottom: Spacing.lg },
  sectionTitle: { fontFamily: Fonts.sansMedium, fontSize: 15, color: C.textInk, marginBottom: 8 },
  sectionBody: { fontFamily: Fonts.sans, fontSize: 14, color: C.body, lineHeight: 22 },

  footer: { marginTop: Spacing.lg, padding: 16, backgroundColor: C.bgCook, borderRadius: Radius.md, alignItems: 'center' },
  footerText: { fontFamily: Fonts.sans, fontSize: 13, color: C.bodySoft, lineHeight: 20, textAlign: 'center' },
}); }
