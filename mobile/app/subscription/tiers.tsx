import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { subscriptionsApi, type SubscriptionTier } from '../../src/api/subscriptions';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { Fonts, Spacing, Radius, Shadow } from '../../src/constants/theme';
import { useFeedback } from '../../src/components/feedback';
import { Bone } from '../../src/components/ui/Skeleton';
import { fmtCurrency } from '../../src/utils/format';

const BILLING_OPTIONS = [
  { key: 'monthly',   label: 'Monthly' },
  { key: 'quarterly', label: 'Quarterly' },
  { key: 'yearly',    label: 'Yearly' },
] as const;

export default function SubscriptionTiersScreen() {
  const router = useRouter();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const feedback = useFeedback();

  const [tiers, setTiers]       = useState<SubscriptionTier[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [editTier, setEditTier] = useState<SubscriptionTier | null>(null);

  // Form state
  const [name, setName]               = useState('');
  const [price, setPrice]             = useState('');
  const [billing, setBilling]         = useState<'monthly'|'quarterly'|'yearly'>('monthly');
  const [benefitText, setBenefitText] = useState('');
  const [benefits, setBenefits]       = useState<string[]>([]);
  const [isActive, setIsActive]       = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { tiers: t } = await subscriptionsApi.tiers('me');
      setTiers(t ?? []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditTier(null);
    setName(''); setPrice(''); setBilling('monthly');
    setBenefits([]); setBenefitText(''); setIsActive(true);
    setShowForm(true);
  }

  function openEdit(tier: SubscriptionTier) {
    setEditTier(tier);
    setName(tier.name);
    setPrice(String(tier.price));
    setBilling(tier.billing_period);
    setBenefits(tier.benefits ?? []);
    setBenefitText('');
    setIsActive(tier.is_active);
    setShowForm(true);
  }

  function addBenefit() {
    const trimmed = benefitText.trim();
    if (!trimmed) return;
    setBenefits(prev => [...prev, trimmed]);
    setBenefitText('');
  }

  function removeBenefit(i: number) {
    setBenefits(prev => prev.filter((_, idx) => idx !== i));
  }

  async function handleSave() {
    if (!name.trim()) return feedback.warn('Name required', 'Enter a tier name.');
    const p = parseFloat(price);
    if (isNaN(p) || p <= 0) return feedback.warn('Invalid price', 'Enter a valid price greater than 0.');

    setSaving(true);
    try {
      if (editTier) {
        const { tier } = await subscriptionsApi.updateTier(editTier.id, {
          name: name.trim(), price: p, billing_period: billing,
          benefits, is_active: isActive,
        });
        setTiers(prev => prev.map(t => t.id === tier.id ? tier : t));
        feedback.success('Saved', 'Tier updated.');
      } else {
        const { tier } = await subscriptionsApi.createTier({
          name: name.trim(), price: p, billing_period: billing, benefits,
        });
        setTiers(prev => [...prev, tier]);
        feedback.success('Created', 'New membership tier created.');
      }
      setShowForm(false);
    } catch (e: any) {
      feedback.error('Error', e.message ?? 'Could not save tier');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.root}>
        <SafeAreaView style={{ flex: 1, padding: Spacing.lg, gap: 14 }}>
          <Bone width="55%" height={22} radius={6} />
          <Bone width="100%" height={100} radius={14} />
          <Bone width="100%" height={100} radius={14} />
          <Bone width="100%" height={100} radius={14} />
        </SafeAreaView>
      </View>
    );
  }

  if (showForm) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setShowForm(false)} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={C.ink} />
          </TouchableOpacity>
          <Text style={styles.title}>{editTier ? 'Edit Tier' : 'New Tier'}</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.fieldLabel}>Tier name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. VIP Member, Inner Circle"
            placeholderTextColor={C.bodySoft}
          />

          <Text style={styles.fieldLabel}>Price (NGN)</Text>
          <TextInput
            style={styles.input}
            value={price}
            onChangeText={setPrice}
            placeholder="e.g. 5000"
            placeholderTextColor={C.bodySoft}
            keyboardType="numeric"
          />

          <Text style={styles.fieldLabel}>Billing period</Text>
          <View style={styles.segmentRow}>
            {BILLING_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.segment, billing === opt.key && styles.segmentActive]}
                onPress={() => setBilling(opt.key)}
              >
                <Text style={[styles.segmentText, billing === opt.key && styles.segmentTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.fieldLabel}>Benefits</Text>
          <View style={styles.benefitInputRow}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              value={benefitText}
              onChangeText={setBenefitText}
              placeholder="Add a benefit and tap +"
              placeholderTextColor={C.bodySoft}
              onSubmitEditing={addBenefit}
              returnKeyType="done"
            />
            <TouchableOpacity style={styles.addBenefitBtn} onPress={addBenefit}>
              <Ionicons name="add" size={20} color={C.canvas} />
            </TouchableOpacity>
          </View>
          {benefits.map((b, i) => (
            <View key={i} style={styles.benefitChip}>
              <Ionicons name="checkmark-circle-outline" size={14} color={C.spice} />
              <Text style={styles.benefitChipText}>{b}</Text>
              <TouchableOpacity onPress={() => removeBenefit(i)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <Ionicons name="close" size={14} color={C.bodySoft} />
              </TouchableOpacity>
            </View>
          ))}

          {editTier && (
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Active</Text>
              <Switch value={isActive} onValueChange={setIsActive} trackColor={{ true: C.spice }} />
            </View>
          )}

          <TouchableOpacity
            style={[styles.submitBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color={C.canvas} />
            ) : (
              <Text style={styles.submitBtnText}>{editTier ? 'Save changes' : 'Create tier'}</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <Text style={styles.title}>Membership Tiers</Text>
        <TouchableOpacity onPress={openCreate} style={styles.addBtn}>
          <Ionicons name="add" size={22} color={C.canvas} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.listContent}>
        {tiers.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="star-outline" size={40} color={C.stone} />
            <Text style={styles.emptyTitle}>No membership tiers yet</Text>
            <Text style={styles.emptySub}>Create tiers to offer exclusive benefits to your subscribers.</Text>
            <TouchableOpacity style={styles.submitBtn} onPress={openCreate}>
              <Text style={styles.submitBtnText}>Create your first tier</Text>
            </TouchableOpacity>
          </View>
        ) : (
          tiers.map(tier => (
            <TouchableOpacity key={tier.id} style={styles.tierCard} onPress={() => openEdit(tier)} activeOpacity={0.8}>
              <View style={styles.tierCardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.tierName}>{tier.name}</Text>
                  <Text style={styles.tierPrice}>
                    {fmtCurrency(tier.price, 'NGN')} / {tier.billing_period}
                  </Text>
                </View>
                <View style={[styles.activePill, { backgroundColor: tier.is_active ? C.successBg : C.cream }]}>
                  <Text style={[styles.activePillText, { color: tier.is_active ? C.successFg : C.bodySoft }]}>
                    {tier.is_active ? 'Active' : 'Inactive'}
                  </Text>
                </View>
              </View>
              {tier.benefits?.length > 0 && (
                <View style={{ gap: 3, marginTop: 8 }}>
                  {tier.benefits.slice(0, 3).map((b, i) => (
                    <View key={i} style={styles.benefitRow}>
                      <Ionicons name="checkmark-outline" size={13} color={C.spice} />
                      <Text style={styles.benefitRowText}>{b}</Text>
                    </View>
                  ))}
                  {tier.benefits.length > 3 && (
                    <Text style={styles.moreBenefits}>+{tier.benefits.length - 3} more</Text>
                  )}
                </View>
              )}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    root:            { flex: 1, backgroundColor: C.bg },
    header:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingTop: 16, paddingBottom: 12, gap: 8 },
    backBtn:         { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    addBtn:          { width: 44, height: 44, backgroundColor: C.spice, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    title:           { flex: 1, fontFamily: Fonts.serif, fontSize: 22, color: C.textInk, textAlign: 'center' },
    listContent:     { padding: Spacing.lg, gap: 12, paddingBottom: 40 },
    formContent:     { padding: Spacing.lg, gap: 4, paddingBottom: 40 },
    fieldLabel:      { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.textInk, marginTop: 14, marginBottom: 6 },
    input:           { backgroundColor: C.bgCard, borderRadius: Radius.md, borderWidth: 1, borderColor: C.borderWarm, paddingHorizontal: 14, paddingVertical: 12, fontFamily: Fonts.sans, fontSize: 15, color: C.textInk, marginBottom: 4 },
    segmentRow:      { flexDirection: 'row', gap: 8 },
    segment:         { flex: 1, paddingVertical: 10, borderRadius: Radius.md, borderWidth: 1, borderColor: C.borderWarm, alignItems: 'center', backgroundColor: C.bgCard },
    segmentActive:   { backgroundColor: C.spice, borderColor: C.spice },
    segmentText:     { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.bodySoft },
    segmentTextActive: { color: C.canvas },
    benefitInputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    addBenefitBtn:   { width: 44, height: 44, backgroundColor: C.spice, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
    benefitChip:     { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.cream, paddingHorizontal: 10, paddingVertical: 7, borderRadius: Radius.md, marginTop: 6 },
    benefitChipText: { flex: 1, fontFamily: Fonts.sans, fontSize: 13, color: C.textInk },
    toggleRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, paddingVertical: 8 },
    toggleLabel:     { fontFamily: Fonts.sansMedium, fontSize: 15, color: C.textInk },
    submitBtn:       { backgroundColor: C.spice, borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center', marginTop: 24 },
    submitBtnText:   { fontFamily: Fonts.sansMedium, fontSize: 15, color: C.canvas },
    tierCard:        { backgroundColor: C.bgCard, borderRadius: Radius.lg, padding: 16, borderWidth: 0.5, borderColor: C.borderWarm, ...Shadow.card },
    tierCardHeader:  { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    tierName:        { fontFamily: Fonts.sansMedium, fontSize: 16, color: C.textInk },
    tierPrice:       { fontFamily: Fonts.sans, fontSize: 13, color: C.spice, marginTop: 2 },
    activePill:      { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 40 },
    activePillText:  { fontFamily: Fonts.sansMedium, fontSize: 11 },
    benefitRow:      { flexDirection: 'row', alignItems: 'center', gap: 5 },
    benefitRowText:  { fontFamily: Fonts.sans, fontSize: 13, color: C.body },
    moreBenefits:    { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft, marginTop: 2 },
    empty:           { alignItems: 'center', paddingTop: 60, gap: 10, paddingHorizontal: 20 },
    emptyTitle:      { fontFamily: Fonts.sansMedium, fontSize: 17, color: C.textInk },
    emptySub:        { fontFamily: Fonts.sans, fontSize: 14, color: C.bodySoft, textAlign: 'center', lineHeight: 21 },
    stone:           { color: C.stone },
  });
}
