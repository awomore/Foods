import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { cooksApi } from '../../src/api/cooks';
import { useAuth } from '../../src/context/AuthContext';
import { Fonts, Spacing, Radius, Shadow } from '../../src/constants/theme';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { useFeedback } from '../../src/components/feedback';

const SPECIALISATIONS: { value: string; label: string; icon: string; desc: string }[] = [
  { value: 'keto',             label: 'Keto',               icon: '🥑', desc: 'High fat, very low carb meals' },
  { value: 'vegan',            label: 'Vegan',              icon: '🌱', desc: 'No animal products whatsoever' },
  { value: 'vegetarian',       label: 'Vegetarian',         icon: '🥦', desc: 'Plant-based, may include dairy & eggs' },
  { value: 'halal',            label: 'Halal',              icon: '☪️',  desc: 'Prepared according to Islamic dietary law' },
  { value: 'low_carb',         label: 'Low Carb',           icon: '📉', desc: 'Reduced carbohydrate options' },
  { value: 'diabetic_friendly',label: 'Diabetic Friendly',  icon: '🩺', desc: 'Low glycaemic index meals' },
  { value: 'gluten_free',      label: 'Gluten Free',        icon: '🌾', desc: 'No wheat, barley, or rye' },
  { value: 'high_protein',     label: 'High Protein',       icon: '💪', desc: 'Muscle-building, protein-rich meals' },
  { value: 'dairy_free',       label: 'Dairy Free',         icon: '🥛', desc: 'No milk, cheese, or dairy products' },
  { value: 'low_sodium',       label: 'Low Sodium',         icon: '🧂', desc: 'Heart-friendly, low salt meals' },
  { value: 'heart_healthy',    label: 'Heart Healthy',      icon: '❤️',  desc: 'Cardiovascular health focused' },
  { value: 'pregnancy',        label: 'Pregnancy Safe',     icon: '🤰', desc: 'Meals safe and nutritious for pregnant women' },
];

export default function HealthSpecialisationsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const feedback = useFeedback();

  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!user?.cook_id) { setLoading(false); return; }
    try {
      const { cook } = await cooksApi.get(user.cook_id);
      setSelected(cook.health_specialisations ?? []);
    } catch {}
    setLoading(false);
  }, [user?.cook_id]);

  useEffect(() => { load(); }, [load]);

  function toggle(value: string) {
    setSelected(prev =>
      prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
      await cooksApi.updateHealthSpecialisations(selected);
      feedback.success(
        selected.length > 0 ? 'Health Kitchen activated' : 'Health Kitchen deactivated',
        selected.length > 0
          ? `Your kitchen is now discoverable for ${selected.length} health categor${selected.length === 1 ? 'y' : 'ies'}`
          : 'Your health specialisations have been cleared'
      );
      router.back();
    } catch (e: any) {
      feedback.error('Error', e?.error ?? 'Could not save specialisations');
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={C.spice} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <SafeAreaView>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={C.textInk} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Health Kitchen</Text>
          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? <ActivityIndicator size="small" color={C.canvas} /> : <Text style={styles.saveBtnText}>Save</Text>}
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: Spacing.lg, gap: 14, paddingBottom: 60 }}
      >
        <View style={styles.infoCard}>
          <Text style={styles.infoEmoji}>🌿</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.infoTitle}>What is Health Kitchen?</Text>
            <Text style={styles.infoText}>
              Select the dietary needs your kitchen specialises in. Customers filtering by these categories will discover your kitchen first. You must maintain consistent quality to keep the Health Kitchen badge.
            </Text>
          </View>
        </View>

        {SPECIALISATIONS.map(opt => {
          const isSelected = selected.includes(opt.value);
          return (
            <TouchableOpacity
              key={opt.value}
              onPress={() => toggle(opt.value)}
              style={[styles.optionCard, isSelected && styles.optionCardActive]}
              activeOpacity={0.75}
            >
              <Text style={styles.optionEmoji}>{opt.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.optionLabel, isSelected && { color: C.canvas }]}>{opt.label}</Text>
                <Text style={[styles.optionDesc, isSelected && { color: 'rgba(250,246,240,0.7)' }]}>{opt.desc}</Text>
              </View>
              <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                {isSelected && <Ionicons name="checkmark" size={14} color={C.canvas} />}
              </View>
            </TouchableOpacity>
          );
        })}

        {selected.length > 0 && (
          <View style={styles.summaryBox}>
            <Ionicons name="leaf" size={16} color={C.healthFg} />
            <Text style={styles.summaryText}>
              {selected.length} specialisation{selected.length !== 1 ? 's' : ''} selected. Your kitchen will appear in Health Kitchen discovery.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function makeStyles(C: AppColors) { return StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingTop: 8, paddingBottom: 12, gap: 12 },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.bgCook, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: Fonts.serif, fontSize: 20, color: C.textInk, flex: 1 },
  saveBtn: { backgroundColor: C.spice, borderRadius: 40, paddingHorizontal: 20, paddingVertical: 9, minWidth: 72, alignItems: 'center' },
  saveBtnText: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.canvas },
  infoCard: { flexDirection: 'row', gap: 12, backgroundColor: C.healthBg, borderRadius: Radius.lg, padding: 14 },
  infoEmoji: { fontSize: 24 },
  infoTitle: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.healthFg, marginBottom: 4 },
  infoText: { fontFamily: Fonts.sans, fontSize: 13, color: C.healthFg, lineHeight: 20, opacity: 0.85 },
  optionCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: C.bgCard, borderRadius: Radius.lg, padding: 16,
    borderWidth: 0.5, borderColor: C.borderWarm, ...Shadow.card,
  },
  optionCardActive: { backgroundColor: C.ink, borderColor: C.ink },
  optionEmoji: { fontSize: 22 },
  optionLabel: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.textInk },
  optionDesc: { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft, marginTop: 2 },
  checkbox: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: C.borderWarm, alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: C.spice, borderColor: C.spice },
  summaryBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.healthBg, borderRadius: Radius.lg, padding: 14 },
  summaryText: { fontFamily: Fonts.sans, fontSize: 13, color: C.healthFg, flex: 1, lineHeight: 20 },
}); }
