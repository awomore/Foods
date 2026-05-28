import React, { useEffect, useRef, useState } from 'react';
import {
  View, ScrollView, Animated, StyleSheet, ViewStyle,
  AccessibilityInfo, Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColors } from '../../context/ThemeContext';
import { Radius, Spacing, Shadow } from '../../constants/theme';

// ─── Reduced-motion hook ──────────────────────────────────────────────────────

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduced)
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => sub.remove();
  }, []);
  return reduced;
}

// ─── Base shimmer bone ────────────────────────────────────────────────────────

interface BoneProps {
  width?: number | string;
  height?: number;
  radius?: number;
  style?: ViewStyle;
  color?: string;
  delay?: number;
}

export function Bone({ width = '100%', height = 16, radius = Radius.sm, style, color, delay = 0 }: BoneProps) {
  const C = useColors();
  const reduced = useReducedMotion();
  const bg = color ?? C.borderWarm;
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    if (reduced) {
      opacity.setValue(0.5);
      return;
    }
    let anim: Animated.CompositeAnimation;
    const timer = setTimeout(() => {
      anim = Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, {
            toValue: 0.65,
            duration: 900,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0.4,
            duration: 900,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      );
      anim.start();
    }, delay);
    return () => {
      clearTimeout(timer);
      anim?.stop();
    };
  }, [reduced, delay]);

  return (
    <Animated.View
      accessible={false}
      style={[{ width: width as any, height, borderRadius: radius, backgroundColor: bg, opacity }, style]}
    />
  );
}

// ─── Cook card skeleton ───────────────────────────────────────────────────────

export function SkeletonCookCard() {
  const C = useColors();
  return (
    <View style={[styles.cookCard, { backgroundColor: C.bgCard, borderColor: C.borderWarm }]}>
      <View style={styles.rowCenter}>
        <Bone width={42} height={42} radius={21} delay={0} />
        <View style={{ flex: 1, gap: 6 }}>
          <Bone width="55%" height={14} delay={80} />
          <Bone width="38%" height={11} delay={140} />
        </View>
      </View>
      {/* Stats row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingBottom: 10 }}>
        <Bone width={32} height={18} radius={4} delay={60} />
        <Bone width={60} height={11} delay={100} />
      </View>
      <View style={{ paddingHorizontal: 14 }}>
        <Bone width="100%" height={168} radius={12} delay={0} />
      </View>
      <View style={styles.dishInfoRow}>
        <View style={{ flex: 1, gap: 6 }}>
          <Bone width="70%" height={14} delay={80} />
          <Bone width="50%" height={11} delay={140} />
        </View>
        <Bone width={60} height={18} radius={8} delay={80} />
      </View>
      <View style={styles.footerRow}>
        <Bone width={80} height={24} radius={40} delay={0} />
        <Bone width={110} height={36} radius={40} delay={60} />
      </View>
    </View>
  );
}

// ─── Dish / item card skeleton ────────────────────────────────────────────────

export function SkeletonDishCard() {
  const C = useColors();
  return (
    <View style={[styles.dishCard, { backgroundColor: C.bgCard, borderColor: C.borderWarm }]}>
      <Bone width={56} height={56} radius={Radius.md} />
      <View style={{ flex: 1, gap: 6 }}>
        <Bone width="70%" height={14} delay={60} />
        <Bone width="40%" height={11} delay={120} />
      </View>
      <Bone width={54} height={18} radius={8} delay={60} />
    </View>
  );
}

// ─── Feed post skeleton ───────────────────────────────────────────────────────

export function SkeletonFeedPost() {
  const C = useColors();
  return (
    <View style={[styles.feedPost, { backgroundColor: C.bgCard, borderBottomColor: C.borderWarm }]}>
      {/* Author row */}
      <View style={[styles.rowCenter, { padding: 14, paddingBottom: 10 }]}>
        <Bone width={36} height={36} radius={18} delay={0} />
        <View style={{ flex: 1, gap: 5 }}>
          <Bone width="45%" height={13} delay={60} />
          <Bone width="32%" height={10} delay={100} />
        </View>
      </View>
      {/* Hero image — matches PostCard 240px */}
      <Bone width="100%" height={240} radius={0} delay={0} />
      {/* Body */}
      <View style={{ padding: 14, gap: 8 }}>
        <Bone width="92%" height={12} delay={80} />
        <Bone width="72%" height={12} delay={120} />
        {/* Action row */}
        <View style={{ flexDirection: 'row', gap: 20, paddingTop: 4 }}>
          <Bone width={52} height={20} radius={40} delay={160} />
          <Bone width={90} height={20} radius={40} delay={200} />
        </View>
      </View>
    </View>
  );
}

// ─── Order card skeleton ──────────────────────────────────────────────────────

export function SkeletonOrderCard() {
  const C = useColors();
  return (
    <View style={[styles.orderCard, { backgroundColor: C.bgCard, borderColor: C.borderWarm }]}>
      {/* Status row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <Bone width={8} height={8} radius={4} delay={0} />
        <Bone width="38%" height={12} delay={60} />
        <View style={{ flex: 1 }} />
        <Bone width="22%" height={11} delay={80} />
      </View>
      <Bone width="52%" height={14} delay={60} style={{ marginBottom: 6 }} />
      <Bone width="80%" height={11} delay={100} style={{ marginBottom: 4 }} />
      <Bone width="62%" height={11} delay={130} style={{ marginBottom: 14 }} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Bone width="28%" height={11} delay={80} />
        <Bone width="24%" height={16} delay={100} />
      </View>
    </View>
  );
}

// ─── Profile row skeleton ─────────────────────────────────────────────────────

export function SkeletonRow() {
  return (
    <View style={styles.profileRow}>
      <Bone width={36} height={36} radius={10} />
      <Bone width="55%" height={13} delay={60} />
    </View>
  );
}

// ─── Notification row skeleton ────────────────────────────────────────────────

export function SkeletonNotification() {
  const C = useColors();
  return (
    <View style={[styles.notifRow, { borderBottomColor: C.borderWarm }]}>
      <Bone width={40} height={40} radius={12} delay={0} />
      <View style={{ flex: 1, gap: 5 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Bone width="62%" height={13} delay={60} />
          <Bone width={7} height={7} radius={4} delay={80} />
        </View>
        <Bone width="88%" height={11} delay={100} />
        <Bone width="58%" height={11} delay={130} />
        <Bone width="26%" height={10} delay={160} />
      </View>
    </View>
  );
}

// ─── Discover result card skeleton ────────────────────────────────────────────

export function SkeletonDiscoverCard() {
  const C = useColors();
  return (
    <View style={[styles.discoverCard, { backgroundColor: C.bgCard, borderColor: C.borderWarm }]}>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
        <Bone width={80} height={80} radius={10} delay={0} />
        <View style={{ flex: 1, gap: 7 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Bone width={20} height={20} radius={10} delay={40} />
            <Bone width="48%" height={13} delay={60} />
          </View>
          <Bone width="82%" height={12} delay={100} />
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Bone width={48} height={15} radius={4} delay={130} />
            <Bone width={4} height={4} radius={2} delay={140} />
            <Bone width="30%" height={12} delay={150} />
          </View>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
        <Bone width={96} height={20} radius={40} delay={80} />
        <Bone width={80} height={20} radius={40} delay={130} />
      </View>
    </View>
  );
}

// ─── Cook profile full-screen skeleton ───────────────────────────────────────

export function SkeletonProfile() {
  const C = useColors();
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 140 }}>
        {/* Hero */}
        <Bone width="100%" height={280} radius={0} delay={0} />

        {/* Identity card — overlaps hero */}
        <View style={[styles.profileCard, { backgroundColor: C.bgCard, borderColor: C.borderWarm }]}>
          <View style={{ flexDirection: 'row', gap: 14, alignItems: 'flex-start' }}>
            <Bone width={54} height={54} radius={27} delay={0} />
            <View style={{ flex: 1, gap: 8 }}>
              <Bone width="58%" height={20} radius={Radius.sm} delay={60} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Bone width={8} height={8} radius={4} delay={80} />
                <Bone width="35%" height={12} delay={90} />
              </View>
              <Bone width="48%" height={11} delay={130} />
            </View>
            <Bone width={72} height={36} radius={40} delay={80} />
          </View>
          {/* Stats */}
          <View style={[styles.profileStatsRow, { borderTopColor: C.borderWarm }]}>
            {[0, 1, 2, 3].map(i => (
              <View key={i} style={[styles.profileStatCell, i < 3 && { borderRightWidth: 0.5, borderRightColor: C.borderWarm }]}>
                <Bone width={34} height={18} radius={Radius.sm} delay={i * 50} />
                <Bone width={42} height={10} radius={4} delay={i * 50 + 70} style={{ marginTop: 5 }} />
              </View>
            ))}
          </View>
        </View>

        {/* Credential pills */}
        <View style={styles.profilePills}>
          <Bone width={102} height={24} radius={40} delay={0} />
          <Bone width={80} height={24} radius={40} delay={80} />
          <Bone width={110} height={24} radius={40} delay={150} />
        </View>

        {/* Bio */}
        <View style={{ marginHorizontal: 20, marginTop: 16, paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: C.borderWarm }}>
          <Bone width="88%" height={13} delay={60} style={{ marginBottom: 5 }} />
          <Bone width="62%" height={13} delay={100} />
        </View>

        {/* Tab bar */}
        <View style={[styles.profileTabBar, { borderBottomColor: C.borderWarm }]}>
          {[0, 1, 2, 3].map(i => (
            <View key={i} style={styles.profileTabCell}>
              <Bone width="72%" height={12} radius={4} delay={i * 60} />
            </View>
          ))}
        </View>

        {/* Dish cards */}
        <View style={{ padding: Spacing.lg, gap: 20 }}>
          {[0, 1].map(i => (
            <View key={i} style={[styles.profileDishCard, { backgroundColor: C.bgCard, borderColor: C.borderWarm }]}>
              <Bone width="100%" height={180} radius={0} delay={i * 120} />
              <View style={{ padding: 14, gap: 10 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Bone width="54%" height={18} radius={Radius.sm} delay={60 + i * 120} />
                  <Bone width={58} height={18} radius={4} delay={100 + i * 120} />
                </View>
                <Bone width="82%" height={12} delay={110 + i * 120} />
                <Bone width="65%" height={12} delay={145 + i * 120} />
                <Bone width="100%" height={44} radius={14} delay={170 + i * 120} style={{ marginTop: 4 }} />
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Tracking screen skeleton ─────────────────────────────────────────────────

export function SkeletonTracking() {
  const C = useColors();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header */}
      <View style={styles.trackingHeader}>
        <Bone width={36} height={36} radius={18} delay={0} />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Bone width="42%" height={16} radius={Radius.sm} delay={60} />
        </View>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: Spacing.lg, gap: 16, paddingBottom: 48 }}
      >
        {/* Status hero */}
        <View style={[styles.trackingHero, { backgroundColor: C.bgCard, borderColor: C.borderWarm }]}>
          <Bone width={52} height={52} radius={26} delay={0} />
          <Bone width="50%" height={16} radius={Radius.sm} delay={80} style={{ marginTop: 16 }} />
          <Bone width="70%" height={12} radius={4} delay={120} style={{ marginTop: 8 }} />
        </View>

        {/* Order ref */}
        <View style={[styles.trackingRefRow, { backgroundColor: C.bgCard, borderColor: C.borderWarm }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Bone width={14} height={14} radius={4} delay={0} />
            <Bone width="28%" height={13} delay={50} />
          </View>
          <Bone width="35%" height={13} delay={60} />
        </View>

        {/* Timeline */}
        <View style={[styles.trackingCard, { backgroundColor: C.bgCard, borderColor: C.borderWarm }]}>
          <Bone width="44%" height={14} radius={Radius.sm} delay={0} style={{ marginBottom: 16 }} />
          {[0, 1, 2, 3, 4].map(i => (
            <View key={i} style={{ flexDirection: 'row', gap: 14, minHeight: 40 }}>
              <View style={{ width: 20, alignItems: 'center' }}>
                {i > 0 && (
                  <View style={[styles.trackingConnector, { backgroundColor: C.borderWarm }]} />
                )}
                <Bone width={20} height={20} radius={10} delay={i * 55} />
              </View>
              <View style={{ flex: 1, paddingBottom: 20, justifyContent: 'center' }}>
                <Bone width={i % 2 === 0 ? '58%' : '44%'} height={13} delay={65 + i * 55} />
              </View>
            </View>
          ))}
        </View>

        {/* Cook card */}
        <View style={[styles.trackingCard, { backgroundColor: C.bgCard, borderColor: C.borderWarm }]}>
          <Bone width="36%" height={14} radius={Radius.sm} delay={0} style={{ marginBottom: 14 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Bone width={44} height={44} radius={22} delay={60} />
            <Bone width="50%" height={14} delay={100} />
          </View>
        </View>

        {/* Dish summary */}
        <View style={[styles.trackingCard, { backgroundColor: C.bgCard, borderColor: C.borderWarm }]}>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <Bone width={60} height={60} radius={10} delay={0} />
            <View style={{ flex: 1, gap: 8 }}>
              <Bone width="75%" height={13} delay={60} />
              <Bone width="38%" height={16} radius={4} delay={100} />
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Cook card
  cookCard: {
    borderRadius: 20, borderWidth: 0.5, overflow: 'hidden', paddingBottom: 14,
  },
  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, paddingBottom: 10 },
  dishInfoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, paddingBottom: 6 },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, paddingTop: 8 },

  // Dish card
  dishCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, borderWidth: 0.5 },

  // Feed post
  feedPost: { borderBottomWidth: 0.5, marginBottom: 8 },

  // Order card
  orderCard: { borderRadius: 16, borderWidth: 0.5, padding: 14 },

  // Profile row
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },

  // Notification
  notifRow: {
    flexDirection: 'row', gap: 12,
    paddingHorizontal: Spacing.lg, paddingVertical: 14,
    borderBottomWidth: 0.5,
  },

  // Discover card
  discoverCard: {
    borderRadius: 12, padding: 14, borderWidth: 0.5, gap: 10, ...Shadow.card,
  },

  // Profile skeleton
  profileCard: {
    marginHorizontal: 20, marginTop: -24, zIndex: 2,
    borderRadius: 20, borderWidth: 0.5, padding: 16,
    ...Shadow.card,
  },
  profileStatsRow: {
    flexDirection: 'row', marginTop: 16, paddingTop: 14,
    borderTopWidth: 0.5,
  },
  profileStatCell: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  profilePills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 20, marginTop: 14 },
  profileTabBar: { flexDirection: 'row', borderBottomWidth: 0.5, marginTop: 20 },
  profileTabCell: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  profileDishCard: { borderRadius: 20, overflow: 'hidden', borderWidth: 0.5, ...Shadow.card },

  // Tracking skeleton
  trackingHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12,
  },
  trackingHero: {
    borderRadius: 16, padding: 28, alignItems: 'center',
    borderWidth: 0.5, ...Shadow.card,
  },
  trackingRefRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderRadius: 12, padding: 14, borderWidth: 0.5, ...Shadow.card,
  },
  trackingCard: { borderRadius: 16, padding: 16, borderWidth: 0.5, ...Shadow.card },
  trackingConnector: { position: 'absolute', top: -20, bottom: 12, width: 1.5, left: 9 },
});
