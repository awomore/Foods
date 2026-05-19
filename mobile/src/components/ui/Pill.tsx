import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Fonts } from '../../constants/theme';

type PillVariant = 'cream' | 'honey' | 'success' | 'error' | 'warn' | 'info' | 'health';

const variants: Record<PillVariant, { bg: string; text: string }> = {
  cream:   { bg: Colors.cream,    text: Colors.textInk },
  honey:   { bg: Colors.honey,    text: '#5C3B16' },
  success: { bg: Colors.successBg, text: Colors.successFg },
  error:   { bg: Colors.errorBg,  text: Colors.errorFg },
  warn:    { bg: Colors.warnBg,   text: Colors.warnFg },
  info:    { bg: Colors.infoBg,   text: Colors.infoFg },
  health:  { bg: Colors.healthBg, text: Colors.healthFg },
};

interface Props {
  label: string;
  variant?: PillVariant;
  style?: ViewStyle;
}

export default function Pill({ label, variant = 'cream', style }: Props) {
  const v = variants[variant];
  return (
    <View style={[styles.pill, { backgroundColor: v.bg, borderColor: Colors.borderWarm }, style]}>
      <Text style={[styles.text, { color: v.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 40, borderWidth: 0.5 },
  text: { fontFamily: Fonts.sansMedium, fontSize: 11, fontWeight: '500' },
});
