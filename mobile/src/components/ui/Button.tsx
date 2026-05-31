import React from 'react';
import {
  TouchableOpacity, Text, ActivityIndicator,
  StyleSheet, ViewStyle, TextStyle, View,
} from 'react-native';
import { Fonts, Radius } from '../../constants/theme';
import { useColors } from '../../context/ThemeContext';

type Variant = 'primary' | 'ghost' | 'outline' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
  full?: boolean;
}

const sizeStyle: Record<Size, { px: number; py: number; fontSize: number; radius: number }> = {
  sm: { px: 14, py: 8,  fontSize: 13, radius: Radius.full },
  md: { px: 20, py: 13, fontSize: 14, radius: Radius.full },
  lg: { px: 24, py: 16, fontSize: 15, radius: Radius.lg },
};

export default function Button({
  label, onPress, variant = 'primary', size = 'md', loading, disabled,
  icon, iconRight, style, textStyle, full,
}: Props) {
  const C = useColors();
  const variantStyle = {
    primary: { bg: C.ink,        text: C.canvas },
    ghost:   { bg: 'transparent', text: C.bodySoft },
    outline: { bg: 'transparent', text: C.spice, border: C.spice },
    danger:  { bg: C.errorBg,    text: C.errorFg },
  };

  const v = variantStyle[variant];
  const s = sizeStyle[size];
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
      style={[
        styles.base,
        { backgroundColor: v.bg, paddingHorizontal: s.px, paddingVertical: s.py, borderRadius: s.radius },
        v.border ? { borderWidth: 1, borderColor: v.border } : null,
        full ? { width: '100%' } : null,
        isDisabled ? { opacity: 0.55 } : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={v.text} />
      ) : (
        <>
          {icon && <View style={styles.iconLeft}>{icon}</View>}
          <Text style={[styles.text, { color: v.text, fontSize: s.fontSize }, textStyle]}>{label}</Text>
          {iconRight && <View style={styles.iconRight}>{iconRight}</View>}
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  text: { fontFamily: Fonts.sansMedium, fontWeight: '500' },
  iconLeft:  { marginRight: 8 },
  iconRight: { marginLeft: 8 },
});
