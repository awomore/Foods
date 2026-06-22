import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, PanResponder, Dimensions,
} from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useCart } from '../../context/CartContext';
import { useColors } from '../../context/ThemeContext';
import { Fonts, Shadow } from '../../constants/theme';
import { fmtCurrency } from '../../utils/format';

const HIDDEN_ROUTES = ['/checkout', '/confirmation', '/tracking'];

const { width: SW, height: SH } = Dimensions.get('window');
const BW   = 100;
const BH   = 48;
const EDGE = 20;

export default function CartTray() {
  const router   = useRouter();
  const pathname = usePathname();
  const { count, total, currencyCode } = useCart();
  const C = useColors();

  const [dismissed, setDismissed] = useState(false);

  // Position — non-native so left/top work
  const pos     = useRef(new Animated.ValueXY({ x: SW - BW - EDGE, y: SH * 0.65 })).current;
  // Opacity — also non-native (must match pos driver)
  const opacity = useRef(new Animated.Value(0)).current;

  // Track current position values via listeners to avoid accessing the internal _value property
  const currentX = useRef(SW - BW - EDGE);
  const currentY = useRef(SH * 0.65);
  useEffect(() => {
    const xId = pos.x.addListener(({ value }) => { currentX.current = value; });
    const yId = pos.y.addListener(({ value }) => { currentY.current = value; });
    return () => {
      pos.x.removeListener(xId);
      pos.y.removeListener(yId);
    };
  }, []);

  const hidden  = HIDDEN_ROUTES.some(r => pathname?.startsWith(r) ?? false);
  const visible = count > 0 && !hidden && !dismissed;

  // Un-dismiss when new items arrive
  const prevCount = useRef(0);
  useEffect(() => {
    if (count > prevCount.current && dismissed) setDismissed(false);
    prevCount.current = count;
  }, [count, dismissed]);

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: 180,
      useNativeDriver: false, // must match left/top
    }).start();
  }, [visible]);

  const panResponder = useRef(
    PanResponder.create({
      // Don't steal taps — only claim on actual drag
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > 5 || Math.abs(gs.dy) > 5,
      onPanResponderGrant: () => {
        pos.setOffset({ x: currentX.current, y: currentY.current });
        pos.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event(
        [null, { dx: pos.x, dy: pos.y }],
        { useNativeDriver: false },
      ),
      onPanResponderRelease: () => {
        pos.flattenOffset();
        const cx = currentX.current;
        const cy = currentY.current;
        // Snap to nearest edge
        const snapX = cx + BW / 2 < SW / 2 ? EDGE : SW - BW - EDGE;
        const clampY = Math.max(100, Math.min(cy, SH - BH - 120));
        Animated.parallel([
          Animated.spring(pos.x, { toValue: snapX, useNativeDriver: false, tension: 65, friction: 8 }),
          Animated.spring(pos.y, { toValue: clampY, useNativeDriver: false, tension: 65, friction: 8 }),
        ]).start();
      },
    })
  ).current;

  if (count === 0) return null;

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      {...panResponder.panHandlers}
      style={[
        styles.bubble,
        {
          backgroundColor: C.ink,
          shadowColor: C.ink,
          left: pos.x,
          top: pos.y,
          opacity,
        },
      ]}
    >
      {/* Main tap → checkout */}
      <TouchableOpacity
        style={styles.inner}
        activeOpacity={0.85}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push('/checkout');
        }}
        accessibilityLabel={`${count} item${count !== 1 ? 's' : ''} in cart. Tap to checkout.`}
        accessibilityRole="button"
      >
        <Ionicons name="bag" size={20} color={C.ember} />
        <Text style={[styles.totalText, { color: C.canvas }]} numberOfLines={1}>
          {fmtCurrency(total, currencyCode)}
        </Text>
      </TouchableOpacity>

      {/* Count badge — top-left */}
      <View style={[styles.countBadge, { backgroundColor: C.spice }]}>
        <Text style={styles.countNum}>{count > 9 ? '9+' : count}</Text>
      </View>

      {/* Dismiss × — top-right */}
      <TouchableOpacity
        style={styles.dismissBtn}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setDismissed(true);
        }}
        hitSlop={6}
        accessibilityLabel="Dismiss cart bubble"
      >
        <Ionicons name="close" size={9} color="#fff" />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    position: 'absolute',
    width: BW,
    borderRadius: 28,
    zIndex: 999,
    ...Shadow.lift,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  totalText: { fontFamily: Fonts.sansMedium, fontSize: 13, flex: 1 },
  countBadge: {
    position: 'absolute',
    top: -5,
    left: -5,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  countNum: { fontFamily: Fonts.sansMedium, fontSize: 10, color: '#fff' },
  dismissBtn: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
});
