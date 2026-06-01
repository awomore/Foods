import React, { useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { Fonts, Spacing, Radius, Shadow } from '../../src/constants/theme';
import { useColors, type AppColors } from '../../src/context/ThemeContext';

const TRUST_FACTORS: { key: string; label: string; desc: string; weight: number; icon: string }[] = [
  { key: 'rating',       label: 'Customer Rating',      desc: 'Average star rating from all reviews',      weight: 35, icon: 'star-outline' },
  { key: 'completion',   label: 'Order Completion',     desc: 'Percentage of orders fulfilled, not cancelled', weight: 30, icon: 'checkmark-circle-outline' },
  { key: 'repeat',       label: 'Repeat Customer Rate', desc: 'Customers who order from you more than once', weight: 20, icon: 'refresh-outline' },
  { key: 'verification', label: 'ID Verification',      desc: 'Identity or food safety documents verified', weight: 10, icon: 'finger-print-outline' },
  { key: 'certs',        label: 'Certifications',       desc: 'Approved food, health, or business certs',   weight: 5,  icon: 'ribbon-outline' },
];

const BADGE_TIERS = [
  { min: 90, label: 'Elite Kitchen',   color: '#7C3AED', bg: '#F5F3FF', icon: 'diamond' },
  { min: 75, label: 'Trusted Kitchen', color: '#059669', bg: '#F0FDF4', icon: 'shield-checkmark' },
  { min: 60, label: 'Good Standing',   color: '#D97706', bg: '#FFFBEB', icon: 'star' },
  { min: 0,  label: 'Building Trust',  color: '#6B7280', bg: '#F9FAFB', icon: 'construct-outline' },
];

export default function TrustScoreScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);

  // Trust score is loaded from cook profile — use 0 as placeholder if not yet loaded
  const trustScore = 0; // In a real impl, read from cook profile state
  const tier = BADGE_TIERS.find(t => trustScore >= t.min) ?? BADGE_TIERS[BADGE_TIERS.length - 1];

  const scoreAngle = (trustScore / 100) * 180;

  return (
    <View style={styles.root}>
      <SafeAreaView>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={C.textInk} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Trust Score</Text>
        </View>
      </SafeAreaView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: Spacing.lg, gap: 20, paddingBottom: 60 }}
      >
        {/* Score display */}
        <View style={styles.scoreCard}>
          <View style={[styles.tierBadge, { backgroundColor: tier.bg }]}>
            <Ionicons name={tier.icon as any} size={16} color={tier.color} />
            <Text style={[styles.tierLabel, { color: tier.color }]}>{tier.label}</Text>
          </View>
          <Text style={styles.scoreNum}>{Math.round(trustScore)}</Text>
          <Text style={styles.scoreLabel}>out of 100</Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${trustScore}%` }]} />
          </View>
          <Text style={styles.scoreDesc}>
            Your trust score influences your ranking in search results and discovery. Higher scores unlock better placement and more customer confidence.
          </Text>
        </View>

        {/* Factors breakdown */}
        <View>
          <Text style={styles.sectionLabel}>What affects your score</Text>
          {TRUST_FACTORS.map(f => (
            <View key={f.key} style={styles.factorCard}>
              <View style={styles.factorIcon}>
                <Ionicons name={f.icon as any} size={18} color={C.spice} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.factorLabel}>{f.label}</Text>
                  <Text style={styles.factorWeight}>{f.weight}%</Text>
                </View>
                <Text style={styles.factorDesc}>{f.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* How to improve */}
        <View style={styles.tipsCard}>
          <Text style={styles.tipsTitle}>How to improve your score</Text>
          {[
            { icon: 'star',              tip: 'Deliver consistently high-quality food to raise your rating' },
            { icon: 'checkmark-circle',  tip: 'Avoid cancellations — every cancellation lowers your completion rate' },
            { icon: 'people',            tip: 'Build loyalty by giving returning customers a reason to come back' },
            { icon: 'shield-checkmark',  tip: 'Get your identity and food safety verified in Certifications' },
            { icon: 'ribbon',            tip: 'Upload culinary or health certifications to earn bonus points' },
          ].map((t, i) => (
            <View key={i} style={styles.tipRow}>
              <View style={styles.tipIcon}>
                <Ionicons name={t.icon as any} size={14} color={C.spice} />
              </View>
              <Text style={styles.tipText}>{t.tip}</Text>
            </View>
          ))}
        </View>

        {/* CTA */}
        <TouchableOpacity
          style={styles.ctaBtn}
          onPress={() => router.push('/(cook)/certifications' as any)}
        >
          <Ionicons name="shield-checkmark-outline" size={18} color={C.canvas} />
          <Text style={styles.ctaBtnText}>Upload certifications</Text>
          <Ionicons name="arrow-forward" size={16} color={C.canvas} />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function makeStyles(C: AppColors) { return StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingTop: 8, paddingBottom: 12, gap: 12 },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.bgCook, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: Fonts.serif, fontSize: 20, color: C.textInk, flex: 1 },
  sectionLabel: { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.bodySoft, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 },

  scoreCard: {
    backgroundColor: C.bgCard, borderRadius: Radius.xl, padding: 24,
    alignItems: 'center', gap: 10, borderWidth: 0.5, borderColor: C.borderWarm, ...Shadow.card,
  },
  tierBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 40, marginBottom: 6 },
  tierLabel: { fontFamily: Fonts.sansMedium, fontSize: 13 },
  scoreNum: { fontFamily: Fonts.serif, fontSize: 64, color: C.spice, lineHeight: 72 },
  scoreLabel: { fontFamily: Fonts.sans, fontSize: 14, color: C.bodySoft },
  progressBar: { width: '100%', height: 8, backgroundColor: C.bgCook, borderRadius: 4, overflow: 'hidden', marginTop: 6 },
  progressFill: { height: '100%', backgroundColor: C.spice, borderRadius: 4 },
  scoreDesc: { fontFamily: Fonts.sans, fontSize: 13, color: C.bodySoft, textAlign: 'center', lineHeight: 20, marginTop: 4 },

  factorCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 14,
    backgroundColor: C.bgCard, borderRadius: Radius.lg, padding: 14,
    borderWidth: 0.5, borderColor: C.borderWarm, marginBottom: 8,
  },
  factorIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.bgCook, alignItems: 'center', justifyContent: 'center' },
  factorLabel: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.textInk },
  factorWeight: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.spice },
  factorDesc: { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft, marginTop: 3, lineHeight: 18 },

  tipsCard: { backgroundColor: C.honey, borderRadius: Radius.xl, padding: 16, gap: 12 },
  tipsTitle: { fontFamily: Fonts.sansMedium, fontSize: 14, color: '#5C3B16', marginBottom: 4 },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  tipIcon: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.6)', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  tipText: { fontFamily: Fonts.sans, fontSize: 13, color: '#5C3B16', lineHeight: 20, flex: 1 },

  ctaBtn: {
    backgroundColor: C.ink, borderRadius: Radius.lg, paddingVertical: 16, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  ctaBtnText: { fontFamily: Fonts.sansMedium, fontSize: 15, color: C.canvas, flex: 1, marginLeft: 8 },
}); }
