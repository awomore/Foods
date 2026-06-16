import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../../context/ThemeContext';
import { Fonts, Spacing, Radius } from '../../constants/theme';

interface Props {
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  subtitle: string;
}

export default function GuestWall({ icon = 'person-circle-outline', title, subtitle }: Props) {
  const router = useRouter();
  const C = useColors();

  return (
    <View style={[styles.root, { backgroundColor: C.bg }]}>
      <Ionicons name={icon} size={64} color={C.stone} style={{ marginBottom: 16 }} />
      <Text style={[styles.title, { color: C.textInk }]}>{title}</Text>
      <Text style={[styles.sub, { color: C.bodySoft }]}>{subtitle}</Text>
      <TouchableOpacity
        style={[styles.btn, { backgroundColor: C.ink }]}
        onPress={() => router.push('/(auth)/welcome' as any)}
        activeOpacity={0.85}
      >
        <Text style={[styles.btnText, { color: C.canvas }]}>Sign in</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.secondaryBtn, { borderColor: C.borderWarm }]}
        onPress={() => router.push('/(auth)/welcome' as any)}
        activeOpacity={0.8}
      >
        <Text style={[styles.secondaryText, { color: C.bodySoft }]}>Create a free account</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  title: { fontFamily: Fonts.serif, fontSize: 24, textAlign: 'center', marginBottom: 10 },
  sub: { fontFamily: Fonts.sans, fontSize: 14, textAlign: 'center', lineHeight: 21, marginBottom: 32 },
  btn: { borderRadius: Radius.full, paddingVertical: 15, paddingHorizontal: 48, marginBottom: 12 },
  btnText: { fontFamily: Fonts.sansMedium, fontSize: 15 },
  secondaryBtn: { borderRadius: Radius.full, paddingVertical: 13, paddingHorizontal: 32, borderWidth: 1 },
  secondaryText: { fontFamily: Fonts.sans, fontSize: 14 },
});
