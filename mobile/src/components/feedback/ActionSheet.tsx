import React, { useEffect, useRef } from 'react';
import {
  Modal, View, Text, Pressable, Animated,
  StyleSheet, ScrollView, AccessibilityInfo,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../../context/ThemeContext';
import { Fonts, Radius, FontSize, Shadow, Spacing } from '../../constants/theme';
import { haptic } from './haptics';

export interface ActionOption {
  label: string;
  onPress: () => void;
  destructive?: boolean;
  icon?: string;
}

export interface ActionSheetOptions {
  title?: string;
  message?: string;
  actions: ActionOption[];
  cancelLabel?: string;
}

interface Props {
  visible: boolean;
  opts: ActionSheetOptions | null;
  onClose: () => void;
}

export function ActionSheet({ visible, opts, onClose }: Props) {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const slideY  = useRef(new Animated.Value(400)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      if (opts?.title) AccessibilityInfo.announceForAccessibility(opts.title);
      Animated.parallel([
        Animated.spring(slideY, {
          toValue: 0,
          damping: 22,
          stiffness: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();
    } else {
      slideY.setValue(400);
      opacity.setValue(0);
    }
  }, [visible]);

  if (!opts) return null;

  function handleAction(action: ActionOption) {
    haptic.light();
    onClose();
    setTimeout(action.onPress, 50);
  }

  function handleCancel() {
    haptic.light();
    onClose();
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleCancel}
      statusBarTranslucent
    >
      <Animated.View style={[styles.backdrop, { opacity }]}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={handleCancel} />
      </Animated.View>

      <Animated.View
        style={[
          styles.sheet,
          {
            backgroundColor: C.bgCard,
            paddingBottom: insets.bottom + 8,
            transform: [{ translateY: slideY }],
          },
        ]}
        accessible
        accessibilityViewIsModal
      >
        {/* Handle */}
        <View style={[styles.handle, { backgroundColor: C.borderWarm }]} />

        {/* Header */}
        {(opts.title || opts.message) ? (
          <View style={[styles.header, { borderBottomColor: C.borderWarm }]}>
            {opts.title ? (
              <Text style={[styles.headerTitle, { color: C.textInk }]}>{opts.title}</Text>
            ) : null}
            {opts.message ? (
              <Text style={[styles.headerMsg, { color: C.bodySoft }]}>{opts.message}</Text>
            ) : null}
          </View>
        ) : null}

        {/* Actions */}
        <ScrollView
          bounces={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.actionsWrap}
        >
          {opts.actions.map((action, i) => (
            <Pressable
              key={i}
              style={({ pressed }) => [
                styles.actionRow,
                { borderBottomColor: C.borderWarm },
                pressed && { backgroundColor: C.bg },
              ]}
              onPress={() => handleAction(action)}
              accessibilityRole="button"
              accessibilityLabel={action.label}
            >
              {action.icon ? (
                <View style={[styles.iconWrap, { backgroundColor: action.destructive ? C.errorBg : C.bgCook }]}>
                  <Ionicons
                    name={action.icon as any}
                    size={18}
                    color={action.destructive ? C.errorFg : C.spice}
                  />
                </View>
              ) : null}
              <Text
                style={[
                  styles.actionLabel,
                  { color: action.destructive ? C.errorFg : C.textInk },
                ]}
              >
                {action.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Cancel */}
        <View style={[styles.cancelWrap, { borderTopColor: C.borderWarm }]}>
          <Pressable
            style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.7 }]}
            onPress={handleCancel}
            accessibilityRole="button"
            accessibilityLabel={opts.cancelLabel ?? 'Cancel'}
          >
            <Text style={[styles.cancelLabel, { color: C.bodySoft }]}>
              {opts.cancelLabel ?? 'Cancel'}
            </Text>
          </Pressable>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.38)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    ...Shadow.lift,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: 0.5,
  },
  headerTitle: {
    fontFamily: Fonts.sansMedium,
    fontSize: FontSize.md,
    textAlign: 'center',
    marginBottom: 2,
  },
  headerMsg: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.sm,
    textAlign: 'center',
  },
  actionsWrap: {
    paddingHorizontal: Spacing.md,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 4,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontFamily: Fonts.sansMedium,
    fontSize: FontSize.body,
    flex: 1,
  },
  cancelWrap: {
    borderTopWidth: 0.5,
    marginHorizontal: Spacing.md,
  },
  cancelBtn: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  cancelLabel: {
    fontFamily: Fonts.sansMedium,
    fontSize: FontSize.body,
  },
});
