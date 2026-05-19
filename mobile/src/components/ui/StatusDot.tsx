import React from 'react';
import { View, StyleSheet, Animated } from 'react-native';

type Status = 'cooking-now' | 'prepping' | 'done';

const colorMap: Record<Status, string> = {
  'cooking-now': '#2E8B3F',
  'prepping':    '#E8924A',
  'done':        '#B8A88A',
};

export default function StatusDot({ status }: { status: Status }) {
  const color = colorMap[status] ?? '#B8A88A';
  return (
    <View style={styles.wrap}>
      <View style={[styles.dot, { backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: 10, height: 10, alignItems: 'center', justifyContent: 'center' },
  dot:  { width: 8,  height: 8,  borderRadius: 4 },
});
