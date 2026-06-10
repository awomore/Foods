import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useCart } from '../../context/CartContext';
import { useColors } from '../../context/ThemeContext';
import { Fonts, Radius, Shadow } from '../../constants/theme';
import { fmtCurrency } from '../../utils/format';

// Screens where the tray should be hidden even with items in the cart
const HIDDEN_ROUTES = ['/checkout', '/confirmation'];

export default function CartTray() {
  const router   = useRouter();
  const pathname = usePathname();
  const { count, total, currencyCode } = useCart();
  const C = useColors();

  const translateY = useRef(new Animated.Value(100)).current;
  const opacity    = useRef(new Animated.Value(0)).current;

  const hidden = HIDDEN_ROUTES.some(r => pathname.startsWith(r));
  const visible = count > 0 && !hidden;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: visible ? 0 : 100,
        useNativeDriver: true,
        tension: 65,
        friction: 10,
      }),
      Animated.timing(opacity, {
        toValue: visible ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible]);

  if (!visible && !count) return null;

  return (
    <Animated.View
      style={[
        styles.tray,
        {
          backgroundColor: C.ink,
          shadowColor: C.ink,
          transform: [{ translateY }],
          opacity,
        },
      ]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <TouchableOpacity
        style={styles.inner}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push('/checkout');
        }}
        activeOpacity={0.9}
        accessibilityLabel={`${count} item${count !== 1 ? 's' : ''} in cart. Tap to checkout.`}
        accessibilityRole="button"
      >
        <View style={[styles.badge, { backgroundColor: C.ember + '30' }]}>
          <Ionicons name="bag" size={16} color={C.ember} />
          <View style={styles.countBubble}>
            <Text style={styles.countText}>{count > 9 ? '9+' : count}</Text>
          </View>
        </View>
        <Text style={[styles.label, { color: C.canvas }]}>
          {count} {count === 1 ? 'item' : 'items'} in tray
        </Text>
        <View style={styles.right}>
          <Text style={[styles.total, { color: C.ember }]}>
            {fmtCurrency(total, currencyCode)}
          </Text>
          <Ionicons name="arrow-forward" size={14} color={C.ember} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tray: {
    position: 'absolute',
    bottom: 100,       // sits above the 84pt tab bar
    left: 16,
    right: 16,
    borderRadius: Radius.xl,
    ...Shadow.lift,
    zIndex: 999,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  badge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  countBubble: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#E8924A',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  countText: { fontFamily: Fonts.sansMedium, fontSize: 9, color: '#fff' },
  label:     { fontFamily: Fonts.sansMedium, fontSize: 13, flex: 1 },
  right:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  total:     { fontFamily: Fonts.serif, fontSize: 17 },
});
