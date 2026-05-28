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
    title: '1. Acceptance of Terms',
    body: `By accessing or using FOODSbyme ("the Platform"), you agree to be bound by these Terms of Use. If you do not agree, please do not use the Platform. These terms apply to all users, including customers and cooks.`,
  },
  {
    title: '2. The Platform',
    body: `FOODSbyme is a marketplace connecting home cooks and culinary professionals ("Cooks") with customers who wish to order home-cooked meals. FOODSbyme facilitates the connection and payment but is not itself a food business or restaurant.`,
  },
  {
    title: '3. User Accounts',
    body: `You must provide accurate information when creating an account. You are responsible for maintaining the confidentiality of your account credentials. You must be at least 18 years old to use the Platform. You may only hold one account per phone number.`,
  },
  {
    title: '4. Orders & Payments',
    body: `When you place an order, you enter into a direct contract with the Cook. FOODSbyme processes payments on behalf of Cooks via Flutterwave. A service fee of 3.75% applies to delivery orders to cover platform and payment processing costs. Tips are passed 100% to the Cook.`,
  },
  {
    title: '5. Cancellations & Refunds',
    body: `Orders may be cancelled before a Cook accepts them. After acceptance, cancellations are subject to the Cook's individual policy. Refunds for failed or significantly incorrect orders will be processed within 5-7 business days. Disputes must be raised within 24 hours of the expected delivery time.`,
  },
  {
    title: '6. Cook Obligations',
    body: `Cooks must hold valid food handling certifications where required by law. Cooks are responsible for the accuracy of their menu information, including allergen disclosures. FOODSbyme reserves the right to suspend Cooks who receive consistent negative feedback or violate food safety standards.`,
  },
  {
    title: '7. Prohibited Uses',
    body: `You may not use the Platform to post false reviews, impersonate others, list items that are illegal to sell, or engage in any fraudulent activity. Violations may result in permanent account suspension.`,
  },
  {
    title: '8. Intellectual Property',
    body: `All content on the Platform, including the FOODSbyme name, logo, and design, is owned by or licensed to FOODSbyme. You may not reproduce or use our brand assets without prior written consent.`,
  },
  {
    title: '9. Limitation of Liability',
    body: `FOODSbyme is not liable for the quality or safety of food prepared by Cooks. To the maximum extent permitted by law, our total liability for any claim arising out of these Terms is limited to the amount you paid for the relevant order.`,
  },
  {
    title: '10. Changes to Terms',
    body: `We may update these Terms from time to time. Continued use of the Platform after changes constitutes acceptance. We will notify users of significant changes via in-app notification.`,
  },
  {
    title: '11. Contact',
    body: `For questions about these Terms, please contact us at legal@foodsbyme.com or through the Help & Support section in the app.`,
  },
];

export default function TermsScreen() {
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
          <Text style={styles.headerTitle}>Terms of Use</Text>
          <View style={{ width: 36 }} />
        </View>
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={styles.lastUpdated}>Last updated: {LAST_UPDATED}</Text>
        <Text style={styles.intro}>
          Please read these Terms of Use carefully before using the FOODSbyme platform. They govern your use of our app and services.
        </Text>

        {SECTIONS.map((s, i) => (
          <View key={i} style={styles.section}>
            <Text style={styles.sectionTitle}>{s.title}</Text>
            <Text style={styles.sectionBody}>{s.body}</Text>
          </View>
        ))}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            By using FOODSbyme, you acknowledge that you have read and understood these Terms of Use.
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

  footer: { marginTop: Spacing.lg, padding: 16, backgroundColor: C.bgCook, borderRadius: Radius.md },
  footerText: { fontFamily: Fonts.sans, fontSize: 13, color: C.bodySoft, lineHeight: 20, textAlign: 'center' },
}); }
