import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Fonts, Colors } from '../../constants/theme';

interface Props {
  tint?: string;
  label?: string;
  height?: number;
  width?: number;
  radius?: number;
}

export default function DishPhoto({ tint = Colors.ember, label = 'Dish', height = 200, width, radius = 14 }: Props) {
  return (
    <View style={[styles.container, { backgroundColor: tint, height, borderRadius: radius, width: width ?? undefined }]}>
      <View style={styles.shine} />
      <View style={styles.grain} />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' },
  shine:     { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,236,200,0.18)' },
  grain:     { ...StyleSheet.absoluteFillObject, opacity: 0.04 },
  label:     { fontFamily: Fonts.serifItalic, fontSize: 22, color: 'rgba(255,247,232,0.88)', textAlign: 'center', paddingHorizontal: 16, lineHeight: 28 },
  sub:       { position: 'absolute', bottom: 10, right: 14, fontSize: 9, fontFamily: Fonts.sans, color: 'rgba(255,247,232,0.45)', letterSpacing: 1.5, textTransform: 'uppercase' },
});
