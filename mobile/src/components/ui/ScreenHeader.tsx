import React from 'react';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts } from '../../constants/theme';

interface Props {
  title?: string;
  right?: React.ReactNode;
  onBack?: () => void;
  transparent?: boolean;
}

export default function ScreenHeader({ title, right, onBack, transparent }: Props) {
  const router = useRouter();
  const handleBack = onBack ?? (() => router.back());

  return (
    <View style={[styles.header, transparent && styles.transparent]}>
      <TouchableOpacity onPress={handleBack} style={styles.back} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="chevron-back" size={22} color={Colors.textInk} />
      </TouchableOpacity>
      {title ? (
        <Text style={styles.title}>{title}</Text>
      ) : (
        <View style={{ flex: 1 }} />
      )}
      <View style={styles.right}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 58, paddingBottom: 12,
    backgroundColor: Colors.bg,
    zIndex: 10,
  },
  transparent: { backgroundColor: 'transparent', position: 'absolute', top: 0, left: 0, right: 0 },
  back:  { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontFamily: Fonts.sansMedium, fontSize: 16, color: Colors.textInk, fontWeight: '600' },
  right: { width: 36, alignItems: 'flex-end' },
});
