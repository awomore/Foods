import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApi } from '../../src/api/auth';
import { useFeedback } from '../../src/components/feedback';
import { useAuth } from '../../src/context/AuthContext';
import { UserRole } from '../../src/types';
import { Fonts, Spacing, Radius, Shadow } from '../../src/constants/theme';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { ONBOARDING_DONE_KEY } from '../onboarding';

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
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const feedback = useFeedback();
  const [selected, setSelected] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleContinue() {
    if (!selected) return;
    setLoading(true);
    try {
      await authApi.updateProfile({ role: selected });
      await refreshUser();
      await setActiveMode(selected as 'cook' | 'customer');
      if (selected === 'customer') {
        const done = await AsyncStorage.getItem(ONBOARDING_DONE_KEY);
        router.replace(done ? '/(customer)' : '/onboarding' as any);
      } else {
        router.replace('/(cook)');
      }
    } catch (e: any) {
      const msg = e?.error ?? e?.message ?? String(e) ?? 'Could not save. Try again.';
      console.error('[FOODS] role handleContinue error:', JSON.stringify(e), msg);
      feedback.error('Error', msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={C.textInk} />
        </TouchableOpacity>

        <View style={styles.content}>
          <Text style={styles.title}>How will you use{'\n'}FOODS?</Text>
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
                    <Ionicons name={o.icon as any} size={22} color={active ? C.spice : C.bodySoft} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.optTitle, active && { color: C.spice }]}>{o.title}</Text>
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
              ? <ActivityIndicator color={C.canvas} />
              : <Text style={styles.btnText}>Continue</Text>
            }
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

function makeStyles(C: AppColors) { return StyleSheet.create({
  root:    { flex: 1, backgroundColor: C.bg },
  safe:    { flex: 1 },
  back:    { margin: Spacing.md, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1, padding: Spacing.lg },
  title:   { fontFamily: Fonts.serif, fontSize: 28, color: C.textInk, marginBottom: 8, lineHeight: 36 },
  subtitle:{ fontFamily: Fonts.sans,  fontSize: 15, color: C.bodySoft, marginBottom: Spacing.xl, lineHeight: 22 },
  options: { gap: 12, marginBottom: Spacing.xl },

  option: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 18, borderRadius: Radius.lg,
    backgroundColor: C.bgCard, borderWidth: 0.5, borderColor: C.borderWarm,
    ...Shadow.card,
  },
  optionSelected: { borderColor: C.spice, borderWidth: 1.5, backgroundColor: C.bgCook },

  iconWrap:         { width: 44, height: 44, borderRadius: 12, backgroundColor: C.bgCook, alignItems: 'center', justifyContent: 'center' },
  iconWrapSelected: { backgroundColor: C.bgCard },

  optTitle: { fontFamily: Fonts.sansMedium, fontSize: 16, color: C.textInk, marginBottom: 3 },
  optDesc:  { fontFamily: Fonts.sans, fontSize: 13, color: C.bodySoft, lineHeight: 18 },

  radio:         { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: C.borderWarm, alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: C.spice },
  radioDot:      { width: 10, height: 10, borderRadius: 5, backgroundColor: C.spice },

  btn:        { backgroundColor: C.ink, borderRadius: Radius.full, paddingVertical: 16, alignItems: 'center' },
  btnDisabled:{ opacity: 0.4 },
  btnText:    { fontFamily: Fonts.sansMedium, fontSize: 15, color: C.canvas },
}); }
