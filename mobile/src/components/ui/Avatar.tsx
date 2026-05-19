import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Fonts } from '../../constants/theme';

interface Props {
  name: string;
  avatarBg?: string;
  size?: number;
}

export default function Avatar({ name, avatarBg = '#B36A2E', size = 44 }: Props) {
  const initial = name?.charAt(0)?.toUpperCase() ?? '?';
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: avatarBg }]}>
      <Text style={[styles.initial, { fontSize: size * 0.4 }]}>{initial}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  initial: { fontFamily: Fonts.serif, color: '#FAF6F0', includeFontPadding: false },
});
