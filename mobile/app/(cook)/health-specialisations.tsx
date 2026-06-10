import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { cooksApi } from '../../src/api/cooks';
import { useAuth } from '../../src/context/AuthContext';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { Fonts, Spacing, Radius } from '../../src/constants/theme';
import { useFeedback } from '../../src/components/feedback';
import { Bone } from '../../src/components/ui/Skeleton';
import { SPECIALISATION_LABELS, SPECIALISATION_ICONS } from '../../src/api/healthKitchen';

const CREDENTIAL_TYPES = [
  { value: 'nutritionist', label: 'Nutritionist', icon: 'leaf-outline' },
  { value: 'dietician',    label: 'Dietician',    icon: 'medkit-outline' },
  { value: 'health_cook',  label: 'Health Cook',  icon: 'restaurant-outline' },
] as const;

const ALL_SPECS = Object.keys(SPECIALISATION_LABELS);

export default function HealthSpecialisationsScreen() {
  const router   = useRouter();
  const C        = useColors();
  const styles   = useMemo(() => makeStyles(C), [C]);
  const feedback = useFeedback();
  const { user } = useAuth();

  const [selected, setSelected]     = useState<string[]>([]);
  const [credType, setCredType]     = useState<string>('health_cook');
  const [credNumber, setCredNumber] = useState('');
  const [saving, setSaving]         = useState(false);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    if (!user?.cook_id) { setLoading(false); return; }
    cooksApi.get(user.cook_id).then(({ cook }) => {
      setSelected((cook as any).health_specialisations ?? []);
      setCredType((cook as any).health_credential_type ?? 'health_cook');
      setCredNumber((cook as any).health_credential_number ?? '');
    }).catch(() => {}).finally(() => setLoading(false));
  }, [user?.cook_id]);

  function toggle(s: string) {
    setSelected(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  }

  async function save() {
    setSaving(true);
    try {
      await cooksApi.updateHealthSpecialisations(selected);
      if (user?.cook_id) {
        await cooksApi.update(user.cook_id, {
          health_credential_type:   credType,
          health_credential_number: credType !== 'health_cook' ? credNumber.trim() || null : null,
        } as any);
      }
      feedback.success('Saved', selected.length > 0 ? 'Health Kitchen profile updated.' : 'Health Kitchen disabled.');
      router.back();
    } catch (e: any) {
      feedback.error('Error', e.message ?? 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={{ flex: 1, padding: Spacing.lg, gap: 14 }}>
          <Bone width="60%" height={22} radius={6} />
          <Bone width="100%" height={80} radius={14} />
          <Bone width="100%" height={80} radius={14} />
          <Bone width="100%" height={80} radius={14} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <Text style={styles.title}>Health Kitchen</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        <View style={styles.infoBanner}>
          <Ionicons name="leaf" size={18} color={C.successFg} />
          <Text style={styles.infoText}>
            Health Kitchen unlocks your profile in health-filtered discovery, lets you sell
            meal plans, and gives you access to subscriber feeding histories (with their consent).
          </Text>
        </View>

        <Text style={styles.sectionLabel}>Your health credential</Text>
        <View style={styles.credRow}>
          {CREDENTIAL_TYPES.map(ct => (
            <TouchableOpacity
              key={ct.value}
              style={[styles.credChip, credType === ct.value && styles.credChipActive]}
              onPress={() => setCredType(ct.value)}
            >
              <Ionicons name={ct.icon as any} size={14} color={credType === ct.value ? C.canvas : C.bodySoft} />
              <Text style={[styles.credChipText, credType === ct.value && { color: C.canvas }]}>{ct.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {credType !== 'health_cook' && (
          <>
            <Text style={styles.sectionLabel}>Registration / licence number</Text>
            <TextInput
              style={styles.input}
              value={credNumber}
              onChangeText={setCredNumber}
              placeholder="e.g. CFRDN/NUT/12345"
              placeholderTextColor={C.bodySoft}
              autoCapitalize="characters"
            />
            <Text style={styles.hint}>
              Enter your CFRDN registration number. We'll verify it before showing your credential badge.
            </Text>
          </>
        )}

        <Text style={styles.sectionLabel}>
          Specialisations{selected.length > 0 ? ` · ${selected.length} selected` : ''}
        </Text>
        <Text style={styles.hint}>Select every condition or dietary style you can support.</Text>

        <View style={styles.grid}>
          {ALL_SPECS.map(spec => {
            const active = selected.includes(spec);
            return (
              <TouchableOpacity
                key={spec}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => toggle(spec)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={(SPECIALISATION_ICONS[spec] ?? 'leaf-outline') as any}
                  size={14}
                  color={active ? C.canvas : C.spice}
                />
                <Text style={[styles.chipText, active && { color: C.canvas }]}>
                  {SPECIALISATION_LABELS[spec]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {selected.length === 0 && (
          <View style={styles.warnRow}>
            <Ionicons name="information-circle-outline" size={16} color={C.warnFg} />
            <Text style={styles.warnText}>
              No specialisations selected will disable your Health Kitchen status.
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          onPress={save}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator size="small" color={C.canvas} />
            : <Text style={styles.saveBtnText}>Save Health Kitchen profile</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    root:           { flex: 1, backgroundColor: C.bg },
    header:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingTop: 16, paddingBottom: 12, gap: 8 },
    backBtn:        { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    title:          { flex: 1, fontFamily: Fonts.serif, fontSize: 22, color: C.textInk, textAlign: 'center' },
    content:        { padding: Spacing.lg, gap: 8, paddingBottom: 50 },
    infoBanner:     { flexDirection: 'row', gap: 10, backgroundColor: C.successBg, borderRadius: Radius.md, padding: 14, borderWidth: 0.5, borderColor: C.leaf + '40', alignItems: 'flex-start' },
    infoText:       { fontFamily: Fonts.sans, fontSize: 13, color: C.successFg, flex: 1, lineHeight: 19 },
    sectionLabel:   { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.textInk, marginTop: 16, marginBottom: 6 },
    credRow:        { flexDirection: 'row', gap: 8 },
    credChip:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10, borderRadius: Radius.md, borderWidth: 1.5, borderColor: C.borderWarm, backgroundColor: C.bgCard },
    credChipActive: { backgroundColor: C.spice, borderColor: C.spice },
    credChipText:   { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.bodySoft },
    input:          { backgroundColor: C.bgCard, borderRadius: Radius.md, borderWidth: 1, borderColor: C.borderWarm, paddingHorizontal: 14, paddingVertical: 12, fontFamily: Fonts.sans, fontSize: 15, color: C.textInk },
    hint:           { fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft, lineHeight: 16, marginTop: 2 },
    grid:           { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
    chip:           { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.full, borderWidth: 1.5, borderColor: C.spice, backgroundColor: C.bgCard },
    chipActive:     { backgroundColor: C.spice },
    chipText:       { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.spice },
    warnRow:        { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: C.warnBg, borderRadius: Radius.md, padding: 12, marginTop: 8 },
    warnText:       { fontFamily: Fonts.sans, fontSize: 12, color: C.warnFg, flex: 1 },
    saveBtn:        { backgroundColor: C.spice, borderRadius: Radius.md, paddingVertical: 15, alignItems: 'center', marginTop: 24 },
    saveBtnText:    { fontFamily: Fonts.sansMedium, fontSize: 15, color: C.canvas },
  });
}
