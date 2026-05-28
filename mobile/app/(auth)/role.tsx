import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { authApi } from '../../src/api/auth';
import { useAuth } from '../../src/context/AuthContext';
import { UserRole } from '../../src/types';
import { Colors, Fonts, Spacing, Radius, Shadow } from '../../src/constants/theme';

const OPTIONS: { key: UserRole; icon: string; title: string; desc: string }[] = [
  {
    key: 'customer',
    icon: 'restaurant-outline',
    title: 'I want to eat',
    desc: 'Order home-cooked meals from cooks near me',
  },
  {
    key: 'cook',
    icon: 'storefront-outline',
    title: "I'm a cook",
    desc: 'Sell meals from my kitchen to my community',
  },
];

export default function RoleScreen() {
  const router = useRouter();
  const { refreshUser, setActiveMode } = useAuth();
  const [selected, setSelected] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleContinue() {
    if (!selected) return;
    setLoading(true);
    try {
      await authApi.updateProfile({ role: selected });
      await refreshUser();
      await setActiveMode(selected as 'cook' | 'customer');
      router.replace(selected === 'cook' ? '/(cook)' : '/(customer)');
    } catch (e: any) {
      Alert.alert('Error', e.error ?? 'Could not save. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={Colors.textInk} />
        </TouchableOpacity>

        <View style={styles.content}>
          <Text style={styles.title}>How will you use{'\n'}FOODSbyme?</Text>
          <Text style={styles.subtitle}>You can always switch later from your profile.</Text>

          <View style={styles.options}>
            {OPTIONS.map(o => {
              const active = selected === o.key;
              return (
                <TouchableOpacity
                  key={o.key}
                  onPress={() => setSelected(o.key)}
                  activeOpacity={0.8}
                  style={[styles.option, active && styles.optionSelected]}
                >
                  <View style={[styles.iconWrap, active && styles.iconWrapSelected]}>
                    <Ionicons name={o.icon as any} size={22} color={active ? Colors.spice : Colors.bodySoft} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.optTitle, active && { color: Colors.spice }]}>{o.title}</Text>
                    <Text style={styles.optDesc}>{o.desc}</Text>
                  </View>
                  <View style={[styles.radio, active && styles.radioSelected]}>
                    {active && <View style={styles.radioDot} />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={[styles.btn, !selected && styles.btnDisabled]}
            onPress={handleContinue}
            disabled={!selected || loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={Colors.canvas} />
              : <Text style={styles.btnText}>Continue</Text>
            }
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: Colors.bg },
  safe:    { flex: 1 },
  back:    { margin: Spacing.md, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1, padding: Spacing.lg },
  title:   { fontFamily: Fonts.serif, fontSize: 28, color: Colors.textInk, marginBottom: 8, lineHeight: 36 },
  subtitle:{ fontFamily: Fonts.sans,  fontSize: 15, color: Colors.bodySoft, marginBottom: Spacing.xl, lineHeight: 22 },
  options: { gap: 12, marginBottom: Spacing.xl },

  option: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 18, borderRadius: Radius.lg,
    backgroundColor: Colors.bgCard, borderWidth: 0.5, borderColor: Colors.borderWarm,
    ...Shadow.card,
  },
  optionSelected: { borderColor: Colors.spice, borderWidth: 1.5, backgroundColor: '#FEF6EE' },

  iconWrap:         { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.bgCook, alignItems: 'center', justifyContent: 'center' },
  iconWrapSelected: { backgroundColor: '#FAE8D4' },

  optTitle: { fontFamily: Fonts.sansMedium, fontSize: 16, color: Colors.textInk, marginBottom: 3 },
  optDesc:  { fontFamily: Fonts.sans, fontSize: 13, color: Colors.bodySoft, lineHeight: 18 },

  radio:         { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: Colors.borderWarm, alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: Colors.spice },
  radioDot:      { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.spice },

  btn:        { backgroundColor: Colors.ink, borderRadius: Radius.full, paddingVertical: 16, alignItems: 'center' },
  btnDisabled:{ opacity: 0.4 },
  btnText:    { fontFamily: Fonts.sansMedium, fontSize: 15, color: Colors.canvas },
});
