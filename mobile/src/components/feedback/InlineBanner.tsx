import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../../context/ThemeContext';
import { Fonts, Radius, FontSize, Spacing } from '../../constants/theme';

type BannerType = 'success' | 'error' | 'warning' | 'info';

interface Props {
  type?: BannerType;
  title: string;
  message?: string;
  onDismiss?: () => void;
  action?: { label: string; onPress: () => void };
  style?: object;
}

const ICON: Record<BannerType, string> = {
  success: 'checkmark-circle-outline',
  error:   'alert-circle-outline',
  warning: 'warning-outline',
  info:    'information-circle-outline',
};

export function InlineBanner({ type = 'info', title, message, onDismiss, action, style }: Props) {
  const C = useColors();

  const bgMap: Record<BannerType, string>     = { success: C.successBg, error: C.errorBg, warning: C.warnBg, info: C.infoBg };
  const fgMap: Record<BannerType, string>     = { success: C.successFg, error: C.errorFg, warning: C.warnFg, info: C.infoFg };
  const borderMap: Record<BannerType, string> = {
    success: C.successFg + '28',
    error:   C.errorFg   + '28',
    warning: C.warnFg    + '28',
    info:    C.infoFg    + '28',
  };

  const bg     = bgMap[type];
  const fg     = fgMap[type];
  const border = borderMap[type];

  return (
    <View
      style={[styles.wrap, { backgroundColor: bg, borderColor: border }, style]}
      accessibilityRole="alert"
      accessible
    >
      <View style={styles.iconCol}>
        <Ionicons name={ICON[type] as any} size={18} color={fg} />
      </View>

      <View style={styles.textCol}>
        <Text style={[styles.title, { color: fg }]}>{title}</Text>
        {message ? <Text style={[styles.msg, { color: fg }]}>{message}</Text> : null}
        {action ? (
          <Pressable onPress={action.onPress} accessibilityRole="button">
            <Text style={[styles.actionText, { color: fg }]}>{action.label}</Text>
          </Pressable>
        ) : null}
      </View>

      {onDismiss ? (
        <Pressable onPress={onDismiss} hitSlop={10} accessibilityRole="button" accessibilityLabel="Dismiss">
          <Ionicons name="close" size={16} color={fg} style={{ opacity: 0.6 }} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  iconCol: {
    paddingTop: 1,
  },
  textCol: { flex: 1, gap: 3 },
  title: {
    fontFamily: Fonts.sansMedium,
    fontSize: FontSize.sm + 1,
    lineHeight: 18,
  },
  msg: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.sm,
    lineHeight: 17,
    opacity: 0.9,
  },
  actionText: {
    fontFamily: Fonts.sansMedium,
    fontSize: FontSize.sm,
    textDecorationLine: 'underline',
    marginTop: 4,
  },
});
