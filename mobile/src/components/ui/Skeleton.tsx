import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, ViewStyle } from 'react-native';
import { useColors } from '../../context/ThemeContext';
import { Radius } from '../../constants/theme';

// --- Base shimmer bone ---

interface BoneProps {
  width?: number | string;
  height?: number;
  radius?: number;
  style?: ViewStyle;
  color?: string;
}

function Bone({ width = '100%', height = 16, radius = Radius.sm, style, color }: BoneProps) {
  const C = useColors();
  const bg = color ?? C.borderWarm;
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7,  duration: 750, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.35, duration: 750, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <Animated.View
      style={[{ width: width as any, height, borderRadius: radius, backgroundColor: bg, opacity }, style]}
    />
  );
}

// --- Cook card skeleton ---

export function SkeletonCookCard() {
  const C = useColors();
  return (
    <View style={[styles.card, { backgroundColor: C.bgCard, borderColor: C.borderWarm }]}>
      <View style={styles.header}>
        <Bone width={42} height={42} radius={21} />
        <View style={{ flex: 1, gap: 6 }}>
          <Bone width="55%" height={14} />
          <Bone width="38%" height={11} />
        </View>
      </View>
      <View style={{ paddingHorizontal: 14 }}>
        <Bone width="100%" height={160} radius={12} />
      </View>
      <View style={styles.dishInfo}>
        <View style={{ flex: 1, gap: 6 }}>
          <Bone width="70%" height={14} />
          <Bone width="50%" height={11} />
        </View>
        <Bone width={60} height={18} radius={8} />
      </View>
      <View style={styles.footer}>
        <Bone width={80} height={24} radius={40} />
        <Bone width={110} height={36} radius={40} />
      </View>
    </View>
  );
}

// --- Dish / item card skeleton ---

export function SkeletonDishCard() {
  const C = useColors();
  return (
    <View style={[styles.dishCard, { backgroundColor: C.bgCard, borderColor: C.borderWarm }]}>
      <Bone width={56} height={56} radius={Radius.md} />
      <View style={{ flex: 1, gap: 6 }}>
        <Bone width="70%" height={14} />
        <Bone width="40%" height={11} />
      </View>
      <Bone width={54} height={18} radius={8} />
    </View>
  );
}

// --- Feed post skeleton ---

export function SkeletonFeedPost() {
  const C = useColors();
  return (
    <View style={[styles.feedCard, { backgroundColor: C.bgCard, borderColor: C.borderWarm }]}>
      <View style={styles.header}>
        <Bone width={40} height={40} radius={20} />
        <View style={{ flex: 1, gap: 5 }}>
          <Bone width="45%" height={13} />
          <Bone width="30%" height={10} />
        </View>
      </View>
      <Bone width="90%" height={12} style={{ marginBottom: 6 }} />
      <Bone width="65%" height={12} style={{ marginBottom: 12 }} />
      <Bone width="100%" height={180} radius={12} />
    </View>
  );
}

// --- Order card skeleton ---

export function SkeletonOrderCard() {
  const C = useColors();
  return (
    <View style={[styles.orderCard, { backgroundColor: C.bgCard, borderColor: C.borderWarm }]}>
      <View style={styles.header}>
        <Bone width={40} height={40} radius={20} />
        <View style={{ flex: 1, gap: 5 }}>
          <Bone width="55%" height={14} />
          <Bone width="35%" height={11} />
        </View>
        <Bone width={70} height={24} radius={40} />
      </View>
      <View style={{ paddingTop: 8, gap: 6 }}>
        <Bone width="80%" height={11} />
        <Bone width="60%" height={11} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 12 }}>
        <Bone width={90} height={32} radius={Radius.md} />
        <Bone width={70} height={18} radius={8} />
      </View>
    </View>
  );
}

// --- Profile row skeleton ---

export function SkeletonRow() {
  return (
    <View style={styles.rowSkeleton}>
      <Bone width={36} height={36} radius={10} />
      <Bone width="55%" height={13} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20, borderWidth: 0.5, overflow: 'hidden', paddingBottom: 14, gap: 0,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, paddingBottom: 10 },
  dishInfo: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, paddingBottom: 6 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, paddingTop: 8 },

  dishCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, borderWidth: 0.5 },

  feedCard: { borderRadius: 16, borderWidth: 0.5, padding: 16 },

  orderCard: { borderRadius: 16, borderWidth: 0.5, padding: 14 },

  rowSkeleton: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
});
