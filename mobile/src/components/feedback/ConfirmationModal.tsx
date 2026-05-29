import React, { useEffect, useRef } from 'react';
import {
  Modal, View, Text, Pressable, Animated,
  StyleSheet, AccessibilityInfo,
} from 'react-native';
import { useColors } from '../../context/ThemeContext';
import { Fonts, Radius, FontSize, Shadow, Spacing } from '../../constants/theme';
import { haptic } from './haptics';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
}

interface Props {
  visible: boolean;
  opts: ConfirmOptions | null;
  onClose: () => void;
}

export function ConfirmationModal({ visible, opts, onClose }: Props) {
  const C = useColors();
  const scale   = useRef(new Animated.Value(0.92)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, damping: 20, stiffness: 340, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }),
      ]).start();
      if (opts?.title) AccessibilityInfo.announceForAccessibility(opts.title);
    } else {
      scale.setValue(0.92);
      opacity.setValue(0);
    }
  }, [visible]);

  if (!opts) return null;

  const danger = opts.danger ?? false;

  async function handleConfirm() {
    haptic.medium();
    onClose();
    await opts!.onConfirm();
  }

  function handleCancel() {
    haptic.light();
    onClose();
    opts!.onCancel?.();
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleCancel}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={handleCancel} accessible={false}>
        <Animated.View
          style={[
            styles.card,
            { backgroundColor: C.bgCard, borderColor: C.borderWarm, opacity, transform: [{ scale }] },
          ]}
          accessible
          accessibilityViewIsModal
        >
          <Pressable onPress={() => {}}>
            {/* Prevent backdrop press from firing on card */}
            <Text style={[styles.title, { color: C.textInk }]}>{opts.title}</Text>
            {opts.message ? (
              <Text style={[styles.message, { color: C.body }]}>{opts.message}</Text>
            ) : null}

            <View style={[styles.divider, { backgroundColor: C.borderWarm }]} />

            <View style={styles.actions}>
              <Pressable
                style={[styles.btn, styles.cancelBtn, { borderColor: C.borderWarm }]}
                onPress={handleCancel}
                accessibilityRole="button"
                accessibilityLabel={opts.cancelLabel ?? 'Cancel'}
              >
                <Text style={[styles.cancelLabel, { color: C.body }]}>
                  {opts.cancelLabel ?? 'Cancel'}
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.btn,
                  styles.confirmBtn,
                  danger
                    ? { backgroundColor: C.errorBg, borderColor: C.errorFg + '30' }
                    : { backgroundColor: C.ink, borderColor: 'transparent' },
                ]}
                onPress={handleConfirm}
                accessibilityRole="button"
                accessibilityLabel={opts.confirmLabel ?? 'Confirm'}
              >
                <Text
                  style={[
                    styles.confirmLabel,
                    { color: danger ? C.errorFg : C.canvas },
                  ]}
                >
                  {opts.confirmLabel ?? 'Confirm'}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.42)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  card: {
    width: '100%',
    borderRadius: Radius.xl,
    borderWidth: 1,
    paddingTop: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    paddingBottom: 4,
    ...Shadow.lift,
  },
  title: {
    fontFamily: Fonts.serif,
    fontSize: FontSize.xl,
    lineHeight: 28,
    marginBottom: 8,
  },
  message: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.body,
    lineHeight: 22,
    marginBottom: Spacing.md,
  },
  divider: {
    height: 1,
    marginHorizontal: -Spacing.lg,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 14,
  },
  btn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  cancelBtn: {},
  confirmBtn: {},
  cancelLabel: {
    fontFamily: Fonts.sansMedium,
    fontSize: FontSize.md,
  },
  confirmLabel: {
    fontFamily: Fonts.sansMedium,
    fontSize: FontSize.md,
  },
});
