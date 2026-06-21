import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Switch, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { Fonts, Spacing, Radius, FontSize } from '../../src/constants/theme';
import { chefServiceSettingsApi } from '../../src/api/chefServiceSettings';
import { useFeedback } from '../../src/components/feedback';
import { Bone } from '../../src/components/ui/Skeleton';
import { useCurrency } from '../../src/hooks/useCurrency';

type GuestTier = {
  label: string;
  min_guests: number;
  max_guests: number;
  rate_per_head?: number;
  flat_rate?: number;
};

type Tab = 'geography' | 'pricing' | 'requirements';

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'geography', label: 'Geography', icon: 'location-outline' },
  { key: 'pricing',   label: 'Pricing',   icon: 'pricetag-outline' },
  { key: 'requirements', label: 'Requirements', icon: 'list-outline' },
];

export default function ChefSettingsScreen() {
  const router = useRouter();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const feedback = useFeedback();
  const { currency } = useCurrency();

  const [activeTab, setActiveTab] = useState<Tab>('geography');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Geography
  const [nationwide, setNationwide] = useState(false);
  const [cities, setCities] = useState('');
  const [states, setStates] = useState('');
  const [travelRadius, setTravelRadius] = useState('50');
  const [travelFeeFlat, setTravelFeeFlat] = useState('');
  const [travelFeePerKm, setTravelFeePerKm] = useState('');

  // Pricing
  const [hourlyRate, setHourlyRate] = useState('');
  const [dayRate, setDayRate] = useState('');
  const [eventRate, setEventRate] = useState('');
  const [minimumSpend, setMinimumSpend] = useState('');
  const [guestTiers, setGuestTiers] = useState<GuestTier[]>([
    { label: '1–10 guests',  min_guests: 1,  max_guests: 10,  rate_per_head: undefined },
    { label: '11–25 guests', min_guests: 11, max_guests: 25,  rate_per_head: undefined },
    { label: '26–50 guests', min_guests: 26, max_guests: 50,  rate_per_head: undefined },
    { label: '50+ guests',   min_guests: 51, max_guests: 999, rate_per_head: undefined },
  ]);

  // Requirements
  const [noticeHours, setNoticeHours] = useState('48');
  const [depositPct, setDepositPct] = useState('30');
  const [equipmentNotes, setEquipmentNotes] = useState('');
  const [kitchenNotes, setKitchenNotes] = useState('');
  const [ingredientsByClient, setIngredientsByClient] = useState(false);
  const [accommodationRequired, setAccommodationRequired] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await chefServiceSettingsApi.getMy();
        if (res.settings) {
          const s = res.settings;
          setNationwide(s.nationwide ?? false);
          setCities((s.cities_served ?? []).join(', '));
          setStates((s.states_served ?? []).join(', '));
          setTravelRadius(String(s.travel_radius_km ?? 50));
          setTravelFeeFlat(s.travel_fee_flat ? String(s.travel_fee_flat) : '');
          setTravelFeePerKm(s.travel_fee_per_km ? String(s.travel_fee_per_km) : '');
          setHourlyRate(s.hourly_rate ? String(s.hourly_rate) : '');
          setDayRate(s.day_rate ? String(s.day_rate) : '');
          setEventRate(s.event_rate ? String(s.event_rate) : '');
          setMinimumSpend(s.minimum_spend ? String(s.minimum_spend) : '');
          if (s.guest_tiers?.length) setGuestTiers(s.guest_tiers);
          setNoticeHours(String(s.notice_hours ?? 48));
          setDepositPct(String(s.deposit_pct ?? 30));
          setEquipmentNotes(s.equipment_notes ?? '');
          setKitchenNotes(s.kitchen_notes ?? '');
          setIngredientsByClient(s.ingredients_by_client ?? false);
          setAccommodationRequired(s.accommodation_required ?? false);
        }
      } catch { /* new chef, no settings yet */ } finally {
        setLoading(false);
      }
    })();
  }, []);

  const saveGeography = useCallback(async () => {
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await chefServiceSettingsApi.updateGeography({
        cities_served: cities.split(',').map(s => s.trim()).filter(Boolean),
        states_served: states.split(',').map(s => s.trim()).filter(Boolean),
        travel_radius_km: parseInt(travelRadius, 10) || 50,
        nationwide,
        travel_fee_flat: travelFeeFlat ? parseFloat(travelFeeFlat) : undefined,
        travel_fee_per_km: travelFeePerKm ? parseFloat(travelFeePerKm) : undefined,
      });
      feedback.success('Saved', 'Geography settings updated.');
    } catch {
      feedback.error('Error', 'Could not save settings.');
    } finally {
      setSaving(false);
    }
  }, [cities, states, travelRadius, nationwide, travelFeeFlat, travelFeePerKm]);

  const savePricing = useCallback(async () => {
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await chefServiceSettingsApi.updatePricing({
        hourly_rate: hourlyRate ? parseFloat(hourlyRate) : undefined,
        day_rate: dayRate ? parseFloat(dayRate) : undefined,
        event_rate: eventRate ? parseFloat(eventRate) : undefined,
        minimum_spend: minimumSpend ? parseFloat(minimumSpend) : undefined,
        guest_tiers: guestTiers.filter(t => t.rate_per_head || t.flat_rate),
      });
      feedback.success('Saved', 'Pricing updated.');
    } catch {
      feedback.error('Error', 'Could not save pricing.');
    } finally {
      setSaving(false);
    }
  }, [hourlyRate, dayRate, eventRate, minimumSpend, guestTiers]);

  const saveAll = useCallback(async () => {
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    let errors = 0;
    const run = async (fn: () => Promise<void>) => { try { await fn(); } catch { errors++; } };
    await run(() => chefServiceSettingsApi.updateGeography({
      cities_served: cities.split(',').map(s => s.trim()).filter(Boolean),
      states_served: states.split(',').map(s => s.trim()).filter(Boolean),
      travel_radius_km: parseInt(travelRadius, 10) || 50,
      nationwide,
      travel_fee_flat: travelFeeFlat ? parseFloat(travelFeeFlat) : undefined,
      travel_fee_per_km: travelFeePerKm ? parseFloat(travelFeePerKm) : undefined,
    }));
    await run(() => chefServiceSettingsApi.updatePricing({
      hourly_rate: hourlyRate ? parseFloat(hourlyRate) : undefined,
      day_rate: dayRate ? parseFloat(dayRate) : undefined,
      event_rate: eventRate ? parseFloat(eventRate) : undefined,
      minimum_spend: minimumSpend ? parseFloat(minimumSpend) : undefined,
      guest_tiers: guestTiers.filter(t => t.rate_per_head || t.flat_rate),
    }));
    await run(() => chefServiceSettingsApi.updateRequirements({
      notice_hours: parseInt(noticeHours, 10) || 48,
      deposit_pct: parseFloat(depositPct) || 30,
      equipment_notes: equipmentNotes || undefined,
      kitchen_notes: kitchenNotes || undefined,
      ingredients_by_client: ingredientsByClient,
      accommodation_required: accommodationRequired,
    }));
    setSaving(false);
    if (errors === 0) {
      feedback.success('All saved', 'Geography, pricing & requirements updated.');
    } else {
      feedback.warn('Partial save', `${errors} section${errors > 1 ? 's' : ''} failed — check your connection.`);
    }
  }, [cities, states, travelRadius, nationwide, travelFeeFlat, travelFeePerKm,
      hourlyRate, dayRate, eventRate, minimumSpend, guestTiers,
      noticeHours, depositPct, equipmentNotes, kitchenNotes, ingredientsByClient, accommodationRequired]);

  const saveRequirements = useCallback(async () => {
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await chefServiceSettingsApi.updateRequirements({
        notice_hours: parseInt(noticeHours, 10) || 48,
        deposit_pct: parseFloat(depositPct) || 30,
        equipment_notes: equipmentNotes || undefined,
        kitchen_notes: kitchenNotes || undefined,
        ingredients_by_client: ingredientsByClient,
        accommodation_required: accommodationRequired,
      });
      feedback.success('Saved', 'Requirements updated.');
    } catch {
      feedback.error('Error', 'Could not save requirements.');
    } finally {
      setSaving(false);
    }
  }, [noticeHours, depositPct, equipmentNotes, kitchenNotes, ingredientsByClient, accommodationRequired]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={{ flex: 1, padding: Spacing.lg, gap: 14 }}>
          <Bone width="50%" height={22} radius={6} />
          <Bone width="100%" height={56} radius={10} />
          <Bone width="100%" height={56} radius={10} />
          <Bone width="100%" height={56} radius={10} />
          <Bone width="100%" height={56} radius={10} />
          <Bone width="100%" height={56} radius={10} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
            <Ionicons name="arrow-back" size={22} color={C.ink} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Chef Service Settings</Text>
          <TouchableOpacity
            onPress={saveAll}
            disabled={saving}
            style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.full, backgroundColor: saving ? C.bgCook : C.spice }}
          >
            {saving
              ? <ActivityIndicator size="small" color={C.canvas} />
              : <Text style={{ fontFamily: Fonts.sansMedium, fontSize: FontSize.xs, color: C.canvas }}>Save all</Text>
            }
          </TouchableOpacity>
        </View>

        {/* Tab Bar */}
        <View style={styles.tabBar}>
          {TABS.map(tab => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.tabActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Ionicons
                name={tab.icon as any}
                size={16}
                color={activeTab === tab.key ? C.spice : C.caps}
              />
              <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          {/* ── GEOGRAPHY TAB ── */}
          {activeTab === 'geography' && (
            <>
              <View style={styles.row}>
                <Text style={styles.label}>Nationwide availability</Text>
                <Switch
                  value={nationwide}
                  onValueChange={setNationwide}
                  trackColor={{ true: C.spice }}
                />
              </View>

              {!nationwide && (
                <>
                  <Text style={styles.label}>Cities served <Text style={styles.hint}>(comma-separated)</Text></Text>
                  <TextInput
                    style={styles.input}
                    value={cities}
                    onChangeText={setCities}
                    placeholder="Lagos, Abuja, Port Harcourt"
                    placeholderTextColor={C.caps}
                  />

                  <Text style={styles.label}>States served <Text style={styles.hint}>(comma-separated)</Text></Text>
                  <TextInput
                    style={styles.input}
                    value={states}
                    onChangeText={setStates}
                    placeholder="Lagos, FCT, Rivers"
                    placeholderTextColor={C.caps}
                  />

                  <Text style={styles.label}>Travel radius (km)</Text>
                  <TextInput
                    style={styles.input}
                    value={travelRadius}
                    onChangeText={setTravelRadius}
                    keyboardType="number-pad"
                    placeholder="50"
                    placeholderTextColor={C.caps}
                  />
                </>
              )}

              <Text style={styles.sectionTitle}>Travel Fees</Text>
              <Text style={styles.label}>Flat travel fee ({currency.symbol})</Text>
              <TextInput
                style={styles.input}
                value={travelFeeFlat}
                onChangeText={setTravelFeeFlat}
                keyboardType="decimal-pad"
                placeholder="Leave blank for no flat fee"
                placeholderTextColor={C.caps}
              />

              <Text style={styles.label}>Per-km rate ({currency.symbol})</Text>
              <TextInput
                style={styles.input}
                value={travelFeePerKm}
                onChangeText={setTravelFeePerKm}
                keyboardType="decimal-pad"
                placeholder="e.g. 200"
                placeholderTextColor={C.caps}
              />

              <TouchableOpacity
                style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                onPress={saveGeography}
                disabled={saving}
              >
                {saving ? <ActivityIndicator color={C.white} size="small" /> : <Text style={styles.saveBtnText}>Save Geography</Text>}
              </TouchableOpacity>
            </>
          )}

          {/* ── PRICING TAB ── */}
          {activeTab === 'pricing' && (
            <>
              <Text style={styles.sectionTitle}>Base Rates</Text>

              <Text style={styles.label}>Hourly rate ({currency.symbol})</Text>
              <TextInput style={styles.input} value={hourlyRate} onChangeText={setHourlyRate}
                keyboardType="decimal-pad" placeholder="e.g. 25,000" placeholderTextColor={C.caps} />

              <Text style={styles.label}>Day rate ({currency.symbol})</Text>
              <TextInput style={styles.input} value={dayRate} onChangeText={setDayRate}
                keyboardType="decimal-pad" placeholder="e.g. 150,000" placeholderTextColor={C.caps} />

              <Text style={styles.label}>Event rate ({currency.symbol})</Text>
              <TextInput style={styles.input} value={eventRate} onChangeText={setEventRate}
                keyboardType="decimal-pad" placeholder="e.g. 200,000" placeholderTextColor={C.caps} />

              <Text style={styles.label}>Minimum spend ({currency.symbol})</Text>
              <TextInput style={styles.input} value={minimumSpend} onChangeText={setMinimumSpend}
                keyboardType="decimal-pad" placeholder="e.g. 50,000" placeholderTextColor={C.caps} />

              <Text style={styles.sectionTitle}>Guest Tiers</Text>
              <Text style={styles.hint}>Set a rate per head or flat rate for each guest range.</Text>

              {guestTiers.map((tier, i) => (
                <View key={tier.label} style={styles.tierCard}>
                  <Text style={styles.tierLabel}>{tier.label}</Text>
                  <View style={styles.tierRow}>
                    <View style={styles.tierField}>
                      <Text style={styles.tierFieldLabel}>Per head ({currency.symbol})</Text>
                      <TextInput
                        style={styles.tierInput}
                        value={tier.rate_per_head ? String(tier.rate_per_head) : ''}
                        onChangeText={v => {
                          const updated = [...guestTiers];
                          updated[i] = { ...tier, rate_per_head: v ? parseFloat(v) : undefined };
                          setGuestTiers(updated);
                        }}
                        keyboardType="decimal-pad"
                        placeholder="0"
                        placeholderTextColor={C.caps}
                      />
                    </View>
                    <View style={styles.tierField}>
                      <Text style={styles.tierFieldLabel}>Flat ({currency.symbol})</Text>
                      <TextInput
                        style={styles.tierInput}
                        value={tier.flat_rate ? String(tier.flat_rate) : ''}
                        onChangeText={v => {
                          const updated = [...guestTiers];
                          updated[i] = { ...tier, flat_rate: v ? parseFloat(v) : undefined };
                          setGuestTiers(updated);
                        }}
                        keyboardType="decimal-pad"
                        placeholder="0"
                        placeholderTextColor={C.caps}
                      />
                    </View>
                  </View>
                </View>
              ))}

              <TouchableOpacity
                style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                onPress={savePricing}
                disabled={saving}
              >
                {saving ? <ActivityIndicator color={C.white} size="small" /> : <Text style={styles.saveBtnText}>Save Pricing</Text>}
              </TouchableOpacity>
            </>
          )}

          {/* ── REQUIREMENTS TAB ── */}
          {activeTab === 'requirements' && (
            <>
              <Text style={styles.label}>Notice period (hours)</Text>
              <TextInput style={styles.input} value={noticeHours} onChangeText={setNoticeHours}
                keyboardType="number-pad" placeholder="48" placeholderTextColor={C.caps} />

              <Text style={styles.label}>Deposit required (%)</Text>
              <TextInput style={styles.input} value={depositPct} onChangeText={setDepositPct}
                keyboardType="decimal-pad" placeholder="30" placeholderTextColor={C.caps} />

              <Text style={styles.label}>Equipment notes</Text>
              <TextInput style={[styles.input, styles.multiline]} value={equipmentNotes}
                onChangeText={setEquipmentNotes} multiline numberOfLines={3}
                placeholder="List equipment you require (knives, blender, stand mixer…)"
                placeholderTextColor={C.caps} textAlignVertical="top" />

              <Text style={styles.label}>Kitchen requirements</Text>
              <TextInput style={[styles.input, styles.multiline]} value={kitchenNotes}
                onChangeText={setKitchenNotes} multiline numberOfLines={3}
                placeholder="Minimum kitchen spec (oven, gas burners, prep space…)"
                placeholderTextColor={C.caps} textAlignVertical="top" />

              <View style={styles.row}>
                <View style={styles.rowLeft}>
                  <Text style={styles.label}>Ingredients supplied by client</Text>
                  <Text style={styles.hint}>Client provides raw ingredients</Text>
                </View>
                <Switch
                  value={ingredientsByClient}
                  onValueChange={setIngredientsByClient}
                  trackColor={{ true: C.spice }}
                />
              </View>

              <View style={styles.row}>
                <View style={styles.rowLeft}>
                  <Text style={styles.label}>Accommodation required</Text>
                  <Text style={styles.hint}>For multi-day or remote events</Text>
                </View>
                <Switch
                  value={accommodationRequired}
                  onValueChange={setAccommodationRequired}
                  trackColor={{ true: C.spice }}
                />
              </View>

              <TouchableOpacity
                style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                onPress={saveRequirements}
                disabled={saving}
              >
                {saving ? <ActivityIndicator color={C.white} size="small" /> : <Text style={styles.saveBtnText}>Save Requirements</Text>}
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    flex: { flex: 1 },
    center: { alignItems: 'center', justifyContent: 'center' },
    safe: { flex: 1, backgroundColor: C.canvas },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.md,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: C.borderWarm,
    },
    headerBtn: { padding: 4, marginRight: Spacing.sm },
    headerTitle: {
      flex: 1,
      fontFamily: Fonts.sansMedium,
      fontSize: FontSize.md,
      color: C.ink,
    },
    tabBar: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: C.borderWarm,
    },
    tab: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 10,
      gap: 3,
    },
    tabActive: { borderBottomWidth: 2, borderBottomColor: C.spice },
    tabLabel: {
      fontFamily: Fonts.sans,
      fontSize: FontSize.xs,
      color: C.caps,
    },
    tabLabelActive: {
      fontFamily: Fonts.sansMedium,
      color: C.spice,
    },
    content: { padding: Spacing.md, paddingBottom: 60 },
    sectionTitle: {
      fontFamily: Fonts.sansMedium,
      fontSize: FontSize.md,
      color: C.ink,
      marginTop: Spacing.md,
      marginBottom: Spacing.sm,
    },
    label: {
      fontFamily: Fonts.sansMedium,
      fontSize: FontSize.sm,
      color: C.body,
      marginBottom: 6,
      marginTop: Spacing.sm,
    },
    hint: {
      fontFamily: Fonts.sans,
      fontSize: FontSize.xs,
      color: C.caps,
    },
    input: {
      borderWidth: 1,
      borderColor: C.borderWarm,
      borderRadius: Radius.sm,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 10,
      fontFamily: Fonts.sans,
      fontSize: FontSize.md,
      color: C.ink,
      backgroundColor: C.bgCard,
    },
    multiline: { height: 80, paddingTop: 10 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: Spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: C.borderWarm,
    },
    rowLeft: { flex: 1, marginRight: Spacing.sm },
    tierCard: {
      borderWidth: 1,
      borderColor: C.borderWarm,
      borderRadius: Radius.sm,
      padding: Spacing.sm,
      marginBottom: Spacing.sm,
      backgroundColor: C.bgCard,
    },
    tierLabel: {
      fontFamily: Fonts.sansMedium,
      fontSize: FontSize.sm,
      color: C.ink,
      marginBottom: Spacing.sm,
    },
    tierRow: { flexDirection: 'row', gap: Spacing.sm },
    tierField: { flex: 1 },
    tierFieldLabel: {
      fontFamily: Fonts.sans,
      fontSize: FontSize.xs,
      color: C.caps,
      marginBottom: 4,
    },
    tierInput: {
      borderWidth: 1,
      borderColor: C.borderWarm,
      borderRadius: Radius.sm,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 8,
      fontFamily: Fonts.sans,
      fontSize: FontSize.sm,
      color: C.ink,
    },
    saveBtn: {
      backgroundColor: C.spice,
      borderRadius: Radius.md,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: Spacing.lg,
    },
    saveBtnDisabled: { backgroundColor: C.borderWarm },
    saveBtnText: {
      fontFamily: Fonts.sansMedium,
      fontSize: FontSize.md,
      color: C.white,
    },
  });
}
