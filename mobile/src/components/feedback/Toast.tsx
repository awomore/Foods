import React, { useEffect, useRef, useCallback, useState } from 'react';
import {
  View, Text, Pressable, Animated, PanResponder,
  StyleSheet, AccessibilityInfo, LayoutAnimation,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../../context/ThemeContext';
import { Fonts, Radius, FontSize, Shadow } from '../../constants/theme';
import { haptic } from './haptics';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration: number;
  action?: { label: string; onPress: () => void };
}

const ICON: Record<ToastType, string> = {
  success: 'checkmark-circle',
  error:   'close-circle',
  warning: 'warning',
  info:    'information-circle',
};

// ─── Single toast ─────────────────────────────────────────────────────────────

interface ToastProps {
  item: ToastItem;
  onDismiss: (id: string) => void;
}

export function Toast({ item, onDismiss }: ToastProps) {
  const C = useColors();
  const col = getColors(item.type, C);

  const enterY  = useRef(new Animated.Value(-80)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const swipeY  = useRef(new Animated.Value(0)).current;
  const timer   = useRef<ReturnType<typeof setTimeout>>();

  const dismiss = useCallback(() => {
    clearTimeout(timer.current);
    haptic.light();
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(enterY,  { toValue: -80, duration: 220, useNativeDriver: true }),
    ]).start(() => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      onDismiss(item.id);
    });
  }, [item.id]);

  useEffect(() => {
    // Fire haptic based on type
    if (item.type === 'success')      haptic.success();
    else if (item.type === 'error')   haptic.error();
    else if (item.type === 'warning') haptic.warning();

    // Announce to screen readers
    AccessibilityInfo.announceForAccessibility(
      `${item.title}${item.message ? '. ' + item.message : ''}`,
    );

    // Spring entrance
    Animated.parallel([
      Animated.spring(enterY, {
        toValue: 0,
        damping: 18,
        stiffness: 280,
        mass: 0.9,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }),
    ]).start();

    // Auto-dismiss
    timer.current = setTimeout(dismiss, item.duration);
    return () => clearTimeout(timer.current);
  }, []);

  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6 && g.dy < 0,
    onPanResponderMove: (_, g) => {
      if (g.dy < 0) swipeY.setValue(g.dy);
    },
    onPanResponderRelease: (_, g) => {
      if (g.dy < -36 || g.vy < -0.5) {
        dismiss();
      } else {
        Animated.spring(swipeY, { toValue: 0, useNativeDriver: true }).start();
      }
    },
  })).current;

  return (
    <Animated.View
      accessible
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      style={[
        styles.card,
        {
          backgroundColor: col.bg,
          borderColor: col.border,
          opacity,
          transform: [{ translateY: Animated.add(enterY, swipeY) }],
        },
      ]}
      {...pan.panHandlers}
    >
      {/* Icon badge */}
      <View style={[styles.iconWrap, { backgroundColor: col.iconBg }]}>
        <Ionicons name={ICON[item.type] as any} size={18} color={col.fg} />
      </View>

      {/* Text */}
      <View style={styles.textWrap}>
        <Text style={[styles.title, { color: col.fg }]} numberOfLines={1}>
          {item.title}
        </Text>
        {item.message ? (
          <Text style={[styles.msg, { color: col.fg }]} numberOfLines={2}>
            {item.message}
          </Text>
        ) : null}
      </View>

      {/* Action or close */}
      {item.action ? (
        <Pressable
          onPress={() => { item.action!.onPress(); dismiss(); }}
          style={[styles.actionBtn, { borderColor: col.border }]}
          accessibilityRole="button"
        >
          <Text style={[styles.actionLabel, { color: col.fg }]}>{item.action.label}</Text>
        </Pressable>
      ) : (
        <Pressable
          onPress={dismiss}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
        >
          <Ionicons name="close" size={15} color={col.fg} style={{ opacity: 0.55 }} />
        </Pressable>
      )}
    </Animated.View>
  );
}

// ─── Toast stack container ────────────────────────────────────────────────────

interface StackProps {
  toasts: ToastItem[];
  topOffset: number;
  onDismiss: (id: string) => void;
}

export function ToastStack({ toasts, topOffset, onDismiss }: StackProps) {
  const visible = toasts.slice(0, 3);
  if (visible.length === 0) return null;

  return (
    <View
      style={[styles.stack, { top: topOffset }]}
      pointerEvents="box-none"
    >
      {visible.map(t => (
        <Toast key={t.id} item={t} onDismiss={onDismiss} />
      ))}
    </View>
  );
}

// ─── Color helpers ────────────────────────────────────────────────────────────

function getColors(type: ToastType, C: ReturnType<typeof useColors>) {
  switch (type) {
    case 'success': return { bg: C.successBg, fg: C.successFg, border: C.successFg + '28', iconBg: C.successFg + '1A' };
    case 'error':   return { bg: C.errorBg,   fg: C.errorFg,   border: C.errorFg   + '28', iconBg: C.errorFg   + '1A' };
    case 'warning': return { bg: C.warnBg,    fg: C.warnFg,    border: C.warnFg    + '28', iconBg: C.warnFg    + '1A' };
    case 'info':    return { bg: C.infoBg,    fg: C.infoFg,    border: C.infoFg    + '28', iconBg: C.infoFg    + '1A' };
  }
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  stack: {
    position: 'absolute',
    left: 14,
    right: 14,
    gap: 8,
    zIndex: 9999,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 13,
    borderRadius: Radius.lg,
    borderWidth: 1,
    ...Shadow.lift,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: { flex: 1, gap: 2 },
  title: {
    fontFamily: Fonts.sansMedium,
    fontSize: FontSize.sm + 1,
    lineHeight: 18,
  },
  msg: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.xs + 1,
    opacity: 0.82,
    lineHeight: 15,
  },
  actionBtn: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  actionLabel: {
    fontFamily: Fonts.sansMedium,
    fontSize: FontSize.xs,
  },
});
