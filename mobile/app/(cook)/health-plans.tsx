import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { healthKitchenApi, type MealPlan, type MealPlanItem, SPECIALISATION_LABELS } from '../../src/api/healthKitchen';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { Fonts, Spacing, Radius, Shadow } from '../../src/constants/theme';
import { useFeedback } from '../../src/components/feedback';
import { Bone } from '../../src/components/ui/Skeleton';
import { fmtCurrency } from '../../src/utils/format';
import { useTranslation } from 'react-i18next';

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
const CONDITIONS = Object.keys(SPECIALISATION_LABELS);

const getDayNames = (t: any) => DAY_KEYS.map(k => t(`cook_health.day_${k}`));

type Screen = 'list' | 'create' | 'edit';

export default function HealthPlansScreen() {
  const router   = useRouter();
  const C        = useColors();
  const styles   = useMemo(() => makeStyles(C), [C]);
  const { t } = useTranslation();
  const dayNames = useMemo(() => getDayNames(t), [t]);
  const feedback = useFeedback();
  const { t }    = useTranslation();

  const MEAL_TYPE_LABELS: Record<string, string> = useMemo(() => ({
    breakfast: t('cook_health.meal_breakfast'),
    lunch:     t('cook_health.meal_lunch'),
    dinner:    t('cook_health.meal_dinner'),
    snack:     t('cook_health.meal_snack'),
  }), [t]);

  const [screen, setScreen]       = useState<Screen>('list');
  const [plans, setPlans]         = useState<MealPlan[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activePlan, setActivePlan] = useState<MealPlan | null>(null);
  const [planItems, setPlanItems]   = useState<MealPlanItem[]>([]);
  const [notEnabled, setNotEnabled] = useState(false);

  // Form state
  const [title, setTitle]               = useState('');
  const [description, setDescription]   = useState('');
  const [condition, setCondition]       = useState('');
  const [weeks, setWeeks]               = useState('4');
  const [mealsPerDay, setMealsPerDay]   = useState('3');
  const [price, setPrice]               = useState('0');
  const [saving, setSaving]             = useState(false);

  // Item form
  const [showItemForm, setShowItemForm] = useState(false);
  const [itemDay, setItemDay]           = useState(1);
  const [itemWeek, setItemWeek]         = useState(1);
  const [itemMealType, setItemMealType] = useState<string>('breakfast');
  const [itemTitle, setItemTitle]       = useState('');
  const [itemDesc, setItemDesc]         = useState('');
  const [itemCals, setItemCals]         = useState('');
  const [itemProtein, setItemProtein]   = useState('');
  const [itemCarbs, setItemCarbs]       = useState('');
  const [itemFat, setItemFat]           = useState('');
  const [savingItem, setSavingItem]     = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { plans: p } = await healthKitchenApi.myCreatorPlans();
      setPlans(p);
      setNotEnabled(false);
    } catch (e: any) {
      if (e?.status === 403) setNotEnabled(true);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function loadPlanItems(planId: string) {
    try {
      const { items } = await healthKitchenApi.getPlan(planId);
      setPlanItems(items);
    } catch {}
  }

  function openCreate() {
    setActivePlan(null); setPlanItems([]);
    setTitle(''); setDescription(''); setCondition('');
    setWeeks('4'); setMealsPerDay('3'); setPrice('0');
    setScreen('create');
  }

  async function openEdit(plan: MealPlan) {
    setActivePlan(plan);
    setTitle(plan.title);
    setDescription(plan.description ?? '');
    setCondition(plan.target_condition ?? '');
    setWeeks(String(plan.duration_weeks));
    setMealsPerDay(String(plan.meals_per_day));
    setPrice(String(plan.price));
    await loadPlanItems(plan.id);
    setScreen('edit');
  }

  async function savePlan() {
    if (!title.trim()) return feedback.warn(t('cook_health.title_required'), t('cook_health.give_plan_name'));
    setSaving(true);
    try {
      if (activePlan) {
        const { plan } = await healthKitchenApi.updatePlan(activePlan.id, {
          title, description: description || undefined,
          target_condition: condition || undefined,
          duration_weeks: parseInt(weeks) || 4,
          meals_per_day: parseInt(mealsPerDay) || 3,
          price: parseFloat(price) || 0,
        });
        setActivePlan(plan);
        setPlans(prev => prev.map(p => p.id === plan.id ? plan : p));
        feedback.success(t('cook_health.saved'), t('cook_health.plan_updated'));
      } else {
        const { plan } = await healthKitchenApi.createPlan({
          title, description: description || undefined,
          target_condition: condition || undefined,
          duration_weeks: parseInt(weeks) || 4,
          meals_per_day: parseInt(mealsPerDay) || 3,
          price: parseFloat(price) || 0,
        });
        setActivePlan(plan);
        setPlans(prev => [plan, ...prev]);
        setScreen('edit');
        feedback.success(t('cook_health.created'), t('cook_health.now_add_meals'));
      }
    } catch (e: any) {
      feedback.error(t('common.error'), e.error ?? e.message ?? t('cook_health.save_plan_error'));
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish() {
    if (!activePlan) return;
    const next = !activePlan.is_published;
    try {
      const { plan } = await healthKitchenApi.updatePlan(activePlan.id, { is_published: next });
      setActivePlan(plan);
      setPlans(prev => prev.map(p => p.id === plan.id ? plan : p));
      feedback.success(next ? t('cook_health.published') : t('cook_health.unpublished'), next ? t('cook_health.published_body') : t('cook_health.unpublished_body'));
    } catch (e: any) {
      feedback.error(t('common.error'), e.error ?? e.message ?? t('cook_health.update_error'));
    }
  }

  async function addItem() {
    if (!activePlan || !itemTitle.trim()) return feedback.warn(t('cook_health.title_required'), '');
    setSavingItem(true);
    try {
      const { item } = await healthKitchenApi.addPlanItem(activePlan.id, {
        week_number: itemWeek, day_number: itemDay,
        meal_type: itemMealType as any, title: itemTitle,
        description: itemDesc || undefined,
        calories: itemCals ? parseInt(itemCals) : undefined,
        protein_g: itemProtein ? parseFloat(itemProtein) : undefined,
        carbs_g: itemCarbs ? parseFloat(itemCarbs) : undefined,
        fat_g: itemFat ? parseFloat(itemFat) : undefined,
      });
      setPlanItems(prev => [...prev, item]);
      setItemTitle(''); setItemDesc(''); setItemCals('');
      setItemProtein(''); setItemCarbs(''); setItemFat('');
      setShowItemForm(false);
      feedback.success(t('cook_health.added'), t('cook_health.meal_added'));
    } catch (e: any) {
      feedback.error(t('common.error'), e.message ?? t('cook_health.add_meal_error'));
    } finally {
      setSavingItem(false);
    }
  }

  async function deleteItem(itemId: string) {
    if (!activePlan) return;
    feedback.confirm({
      title: t('cook_health.remove_meal_title'),
      message: t('cook_health.remove_meal_message'),
      confirmLabel: t('common.remove'),
      onConfirm: async () => {
        try {
          await healthKitchenApi.deletePlanItem(activePlan.id, itemId);
          setPlanItems(prev => prev.filter(i => i.id !== itemId));
        } catch {}
      },
    });
  }

  // ── Render list ──────────────────────────────────────────────────────────────
  if (screen === 'list') {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={C.ink} />
          </TouchableOpacity>
          <Text style={styles.title}>{t('cook_health.plans_title')}</Text>
          <TouchableOpacity onPress={openCreate} style={styles.addBtn}>
            <Ionicons name="add" size={22} color={C.spice} />
          </TouchableOpacity>
        </View>

        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={C.spice} />}
          contentContainerStyle={{ padding: Spacing.lg, gap: 12, paddingBottom: 40 }}
        >
          {loading ? (
            <View style={{ gap: 12, marginTop: 8 }}>
              <Bone width="100%" height={100} radius={14} />
              <Bone width="100%" height={100} radius={14} />
              <Bone width="100%" height={100} radius={14} />
            </View>
          ) : notEnabled ? (
            <View style={styles.emptyState}>
              <Ionicons name="leaf-outline" size={40} color={C.stone} />
              <Text style={styles.emptyTitle}>{t('cook_health.not_enabled_title')}</Text>
              <Text style={styles.emptyBody}>{t('cook_health.not_enabled_body')}</Text>
            </View>
          ) : plans.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="documents-outline" size={40} color={C.stone} />
              <Text style={styles.emptyTitle}>{t('cook_health.no_plans_title')}</Text>
              <Text style={styles.emptyBody}>{t('cook_health.no_plans_body')}</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={openCreate}>
                <Text style={styles.emptyBtnText}>{t('cook_health.create_a_plan')}</Text>
              </TouchableOpacity>
            </View>
          ) : plans.map(plan => (
            <TouchableOpacity key={plan.id} style={styles.planCard} onPress={() => openEdit(plan)} activeOpacity={0.85}>
              <View style={styles.planCardTop}>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={styles.planCardTitle}>{plan.title}</Text>
                  {plan.target_condition && (
                    <Text style={styles.planCardCond}>{SPECIALISATION_LABELS[plan.target_condition] ?? plan.target_condition}</Text>
                  )}
                </View>
                <View style={[styles.planStatusPill, { backgroundColor: plan.is_published ? C.successBg : C.bgCook }]}>
                  <Text style={[styles.planStatusText, { color: plan.is_published ? C.successFg : C.bodySoft }]}>
                    {plan.is_published ? t('cook_health.live') : t('cook_health.draft')}
                  </Text>
                </View>
              </View>
              <View style={styles.planCardMeta}>
                <Text style={styles.planCardMetaText}>{t('cook_health.duration_meta', { weeks: plan.duration_weeks, mealsPerDay: plan.meals_per_day })}</Text>
                <Text style={styles.planCardMetaText}>{t('cook_health.subscribers_count', { count: plan.subscriber_count })}</Text>
                <Text style={styles.planCardPrice}>{plan.price > 0 ? fmtCurrency(plan.price, plan.currency) : t('cook_health.free')}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Render create/edit ───────────────────────────────────────────────────────
  const itemsByDayAndType = planItems.reduce<Record<string, MealPlanItem[]>>((acc, item) => {
    const key = `${item.week_number}-${item.day_number}-${item.meal_type}`;
    (acc[key] ??= []).push(item);
    return acc;
  }, {});

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setScreen('list')} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <Text style={styles.title}>{activePlan ? 'Edit Plan' : 'New Plan'}</Text>
        {activePlan && (
          <TouchableOpacity
            style={[styles.publishBtn, activePlan.is_published && { backgroundColor: C.bgCook }]}
            onPress={togglePublish}
          >
            <Text style={[styles.publishBtnText, activePlan.is_published && { color: C.bodySoft }]}>
              {activePlan.is_published ? 'Unpublish' : 'Publish'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={{ padding: Spacing.lg, gap: 8, paddingBottom: 50 }} keyboardShouldPersistTaps="handled">

        {/* Plan metadata */}
        <Text style={styles.sectionLabel}>{t('cook_health.plan_details')}</Text>
        <View style={styles.card}>
          <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder={t('cook_health.plan_title_placeholder')} placeholderTextColor={C.bodySoft} />
          <TextInput style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]} value={description} onChangeText={setDescription} placeholder={t('cook_health.description_optional')} placeholderTextColor={C.bodySoft} multiline />

          <Text style={styles.miniLabel}>{t('cook_health.target_condition')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 4 }}>
            {['', ...CONDITIONS].map(c => (
              <TouchableOpacity
                key={c}
                style={[styles.condChip, condition === c && styles.condChipActive]}
                onPress={() => setCondition(c)}
              >
                <Text style={[styles.condChipText, condition === c && { color: C.canvas }]}>
                  {c ? (SPECIALISATION_LABELS[c] ?? c) : t('cook_health.general')}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.metaRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.miniLabel}>{t('cook_health.duration_weeks_label')}</Text>
              <TextInput style={styles.input} value={weeks} onChangeText={setWeeks} keyboardType="numeric" placeholderTextColor={C.bodySoft} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.miniLabel}>{t('cook_health.meals_per_day')}</Text>
              <TextInput style={styles.input} value={mealsPerDay} onChangeText={setMealsPerDay} keyboardType="numeric" placeholderTextColor={C.bodySoft} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.miniLabel}>{t('cook_health.price_ngn')}</Text>
              <TextInput style={styles.input} value={price} onChangeText={setPrice} keyboardType="numeric" placeholderTextColor={C.bodySoft} />
            </View>
          </View>

          <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={savePlan} disabled={saving}>
            {saving ? <ActivityIndicator size="small" color={C.canvas} /> : <Text style={styles.saveBtnText}>{activePlan ? t('cook_health.update_plan') : t('cook_health.create_plan')}</Text>}
          </TouchableOpacity>
        </View>

        {/* Meal builder — only after plan is created */}
        {activePlan && (
          <>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionLabel}>{t('cook_health.meals_week')}</Text>
              <TouchableOpacity onPress={() => setShowItemForm(v => !v)} style={styles.addMealBtn}>
                <Ionicons name="add" size={16} color={C.spice} />
                <Text style={styles.addMealText}>{t('cook_health.add_meal')}</Text>
              </TouchableOpacity>
            </View>

            {/* Week tabs */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 4 }}>
              {Array.from({ length: parseInt(weeks) || 4 }, (_, i) => i + 1).map(w => (
                <TouchableOpacity
                  key={w}
                  style={[styles.weekTab, itemWeek === w && styles.weekTabActive]}
                  onPress={() => setItemWeek(w)}
                >
                  <Text style={[styles.weekTabText, itemWeek === w && { color: C.canvas }]}>{t('cook_health.week_short', { number: w })}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Add item form */}
            {showItemForm && (
              <View style={[styles.card, { gap: 8 }]}>
                <Text style={styles.miniLabel}>{t('cook_health.day_label')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {dayNames.map((d, i) => (
                    <TouchableOpacity
                      key={i}
                      style={[styles.dayChip, itemDay === i + 1 && styles.dayChipActive]}
                      onPress={() => setItemDay(i + 1)}
                    >
                      <Text style={[styles.dayChipText, itemDay === i + 1 && { color: C.canvas }]}>{d}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <Text style={styles.miniLabel}>{t('cook_health.meal_type')}</Text>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {MEAL_TYPES.map(mt => (
                    <TouchableOpacity
                      key={mt}
                      style={[styles.dayChip, itemMealType === mt && styles.dayChipActive, { flex: 1 }]}
                      onPress={() => setItemMealType(mt)}
                    >
                      <Text style={[styles.dayChipText, itemMealType === mt && { color: C.canvas }, { textAlign: 'center' }]}>{MEAL_TYPE_LABELS[mt]}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput style={styles.input} value={itemTitle} onChangeText={setItemTitle} placeholder={t('cook_health.meal_name_placeholder')} placeholderTextColor={C.bodySoft} />
                <TextInput style={styles.input} value={itemDesc} onChangeText={setItemDesc} placeholder={t('cook_health.description_optional')} placeholderTextColor={C.bodySoft} />
                <View style={styles.metaRow}>
                  {[[t('cook_health.calories'), itemCals, setItemCals], [t('cook_health.protein_g'), itemProtein, setItemProtein], [t('cook_health.carbs_g'), itemCarbs, setItemCarbs], [t('cook_health.fat_g'), itemFat, setItemFat]].map(([label, val, set]: any) => (
                    <View key={label} style={{ flex: 1 }}>
                      <Text style={styles.miniLabel}>{label}</Text>
                      <TextInput style={styles.input} value={val} onChangeText={set} keyboardType="numeric" placeholder="–" placeholderTextColor={C.bodySoft} />
                    </View>
                  ))}
                </View>
                <TouchableOpacity style={[styles.saveBtn, savingItem && { opacity: 0.6 }]} onPress={addItem} disabled={savingItem}>
                  {savingItem ? <ActivityIndicator size="small" color={C.canvas} /> : <Text style={styles.saveBtnText}>{t('cook_health.add_meal')}</Text>}
                </TouchableOpacity>
              </View>
            )}

            {/* Day-by-day grid for selected week */}
            {dayNames.map((dayName, di) => {
              const dayItems = MEAL_TYPES.flatMap(mt => itemsByDayAndType[`${itemWeek}-${di + 1}-${mt}`] ?? []);
              if (dayItems.length === 0) return null;
              return (
                <View key={di} style={styles.dayBlock}>
                  <Text style={styles.dayBlockLabel}>{dayName}</Text>
                  {dayItems.map(item => (
                    <View key={item.id} style={styles.mealRow}>
                      <View style={styles.mealTypePill}>
                        <Text style={styles.mealTypePillText}>{MEAL_TYPE_LABELS[item.meal_type]}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.mealRowTitle}>{item.title}</Text>
                        {item.calories && <Text style={styles.mealRowMeta}>{item.calories} kcal{item.protein_g ? ` · ${item.protein_g}g protein` : ''}</Text>}
                      </View>
                      <TouchableOpacity onPress={() => deleteItem(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="trash-outline" size={15} color={C.errorFg} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    root:             { flex: 1, backgroundColor: C.bg },
    header:           { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingTop: 16, paddingBottom: 12, gap: 8 },
    backBtn:          { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    addBtn:           { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    title:            { flex: 1, fontFamily: Fonts.serif, fontSize: 22, color: C.textInk, textAlign: 'center' },
    publishBtn:       { paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.full, backgroundColor: C.spice },
    publishBtnText:   { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.canvas },
    sectionLabel:     { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.bodySoft, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 12 },
    sectionRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
    card:             { backgroundColor: C.bgCard, borderRadius: Radius.lg, padding: 14, borderWidth: 0.5, borderColor: C.borderWarm, ...Shadow.card, gap: 10 },
    input:            { backgroundColor: C.bg, borderRadius: Radius.md, borderWidth: 1, borderColor: C.borderWarm, paddingHorizontal: 12, paddingVertical: 10, fontFamily: Fonts.sans, fontSize: 14, color: C.textInk },
    miniLabel:        { fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft, marginBottom: 2 },
    metaRow:          { flexDirection: 'row', gap: 8 },
    saveBtn:          { backgroundColor: C.spice, borderRadius: Radius.md, paddingVertical: 12, alignItems: 'center' },
    saveBtnText:      { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.canvas },
    condChip:         { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full, borderWidth: 1, borderColor: C.borderWarm, backgroundColor: C.bgCard },
    condChipActive:   { backgroundColor: C.spice, borderColor: C.spice },
    condChipText:     { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.body },
    weekTab:          { paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radius.full, borderWidth: 1, borderColor: C.borderWarm, backgroundColor: C.bgCard },
    weekTabActive:    { backgroundColor: C.spice, borderColor: C.spice },
    weekTabText:      { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.body },
    addMealBtn:       { flexDirection: 'row', alignItems: 'center', gap: 4 },
    addMealText:      { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.spice },
    dayChip:          { paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.full, borderWidth: 1, borderColor: C.borderWarm, backgroundColor: C.bgCard },
    dayChipActive:    { backgroundColor: C.spice, borderColor: C.spice },
    dayChipText:      { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.body },
    dayBlock:         { backgroundColor: C.bgCard, borderRadius: Radius.lg, padding: 12, borderWidth: 0.5, borderColor: C.borderWarm, gap: 8 },
    dayBlockLabel:    { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.spice, textTransform: 'uppercase', letterSpacing: 0.5 },
    mealRow:          { flexDirection: 'row', alignItems: 'center', gap: 8 },
    mealTypePill:     { backgroundColor: C.warnBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
    mealTypePillText: { fontFamily: Fonts.sansMedium, fontSize: 10, color: C.ember },
    mealRowTitle:     { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.textInk },
    mealRowMeta:      { fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft },
    planCard:         { backgroundColor: C.bgCard, borderRadius: Radius.lg, padding: 14, borderWidth: 0.5, borderColor: C.borderWarm, ...Shadow.card, gap: 10 },
    planCardTop:      { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    planCardTitle:    { fontFamily: Fonts.sansMedium, fontSize: 15, color: C.textInk },
    planCardCond:     { fontFamily: Fonts.sans, fontSize: 12, color: C.spice },
    planStatusPill:   { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 40 },
    planStatusText:   { fontFamily: Fonts.sansMedium, fontSize: 11 },
    planCardMeta:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    planCardMetaText: { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft },
    planCardPrice:    { fontFamily: Fonts.serif, fontSize: 14, color: C.spice },
    emptyState:       { alignItems: 'center', paddingVertical: 60, gap: 10 },
    emptyTitle:       { fontFamily: Fonts.sansMedium, fontSize: 16, color: C.textInk },
    emptyBody:        { fontFamily: Fonts.sans, fontSize: 13, color: C.bodySoft, textAlign: 'center', lineHeight: 19 },
    emptyBtn:         { backgroundColor: C.spice, borderRadius: Radius.full, paddingHorizontal: 24, paddingVertical: 12, marginTop: 8 },
    emptyBtnText:     { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.canvas },
  });
}
