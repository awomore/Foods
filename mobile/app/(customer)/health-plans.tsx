import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import {
  healthKitchenApi, type MealPlan, type MealPlanItem, type PlanSubscription, type ConsentRecord,
  SPECIALISATION_LABELS, SPECIALISATION_ICONS,
} from '../../src/api/healthKitchen';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { Fonts, Spacing, Radius, Shadow } from '../../src/constants/theme';
import { useFeedback } from '../../src/components/feedback';
import { fmtCurrency, relativeTime } from '../../src/utils/format';
import Avatar from '../../src/components/ui/Avatar';
import { Bone } from '../../src/components/ui/Skeleton';

type Tab = 'browse' | 'mine' | 'consent';

const DAY_NAMES_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const MEAL_TYPE_ORDER = ['breakfast', 'lunch', 'dinner', 'snack'];

export default function CustomerHealthPlansScreen() {
  const router   = useRouter();
  const C        = useColors();
  const styles   = useMemo(() => makeStyles(C), [C]);
  const feedback = useFeedback();
  const { t }    = useTranslation();

  const [tab, setTab]                   = useState<Tab>('browse');
  const [plans, setPlans]               = useState<MealPlan[]>([]);
  const [myPlans, setMyPlans]           = useState<PlanSubscription[]>([]);
  const [consents, setConsents]         = useState<ConsentRecord[]>([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<{ plan: MealPlan; items: MealPlanItem[] } | null>(null);
  const [subscribing, setSubscribing]   = useState(false);
  const [filterCond, setFilterCond]     = useState('');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [plansRes, myRes, consentRes] = await Promise.all([
        healthKitchenApi.listPlans(),
        healthKitchenApi.myPlans().catch(() => ({ subscriptions: [] })),
        healthKitchenApi.myConsents().catch(() => ({ consents: [] })),
      ]);
      setPlans(plansRes.plans);
      setMyPlans(myRes.subscriptions);
      setConsents(consentRes.consents);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function openPlan(plan: MealPlan) {
    try {
      const { plan: full, items } = await healthKitchenApi.getPlan(plan.id);
      setSelectedPlan({ plan: full, items });
    } catch {}
  }

  async function subscribe() {
    if (!selectedPlan) return;
    setSubscribing(true);
    try {
      await healthKitchenApi.subscribeToPlan(selectedPlan.plan.id);
      feedback.success(t('customer_health_plans.subscribed_title'), t('customer_health_plans.subscribed_message', { title: selectedPlan.plan.title }));
      setSelectedPlan(null);
      load(true);
    } catch (e: any) {
      feedback.error(t('customer_health_plans.error_title'), e.message ?? t('customer_health_plans.subscribe_failed'));
    } finally {
      setSubscribing(false);
    }
  }

  async function cancelSubscription(sub: PlanSubscription) {
    feedback.confirm({
      title: t('customer_health_plans.cancel_subscription_title'),
      message: t('customer_health_plans.cancel_subscription_message', { title: sub.title }),
      confirmLabel: t('customer_health_plans.cancel_plan_label'),
      onConfirm: async () => {
        try {
          await healthKitchenApi.cancelPlan(sub.id);
          setMyPlans(prev => prev.filter(s => s.id !== sub.id));
          feedback.success(t('customer_health_plans.cancelled_title'), t('customer_health_plans.cancelled_message'));
        } catch {}
      },
    });
  }

  async function revokeConsent(consent: ConsentRecord) {
    feedback.confirm({
      title: t('customer_health_plans.revoke_access_title'),
      message: t('customer_health_plans.revoke_access_message', { name: consent.creator_name }),
      confirmLabel: t('customer_health_plans.revoke_label'),
      onConfirm: async () => {
        try {
          await healthKitchenApi.revokeConsent(consent.creator_id);
          setConsents(prev => prev.map(c => c.creator_id === consent.creator_id ? { ...c, is_active: false } : c));
          feedback.success(t('customer_health_plans.revoked_title'), t('customer_health_plans.revoked_message'));
        } catch {}
      },
    });
  }

  const conditions = [...new Set(plans.map(p => p.target_condition).filter(Boolean))] as string[];
  const filtered   = filterCond ? plans.filter(p => p.target_condition === filterCond) : plans;

  // ── Plan detail sheet ────────────────────────────────────────────────────────
  if (selectedPlan) {
    const { plan, items } = selectedPlan;
    const alreadySubscribed = myPlans.some(s => s.plan_id === plan.id);
    const byDayAndType = items.reduce<Record<string, MealPlanItem[]>>((acc, item) => {
      const key = `${item.week_number}-${item.day_number}-${item.meal_type}`;
      (acc[key] ??= []).push(item);
      return acc;
    }, {});

    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setSelectedPlan(null)} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={C.ink} />
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={1}>{plan.title}</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: Spacing.lg, gap: 14, paddingBottom: 100 }}>
          {/* Creator */}
          <View style={styles.creatorCard}>
            <Avatar name={plan.creator_name} avatarUrl={plan.creator_avatar} size={44} />
            <View style={{ flex: 1, gap: 2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.creatorName}>{plan.creator_name}</Text>
                {plan.health_credential_verified && (
                  <View style={styles.verifiedBadge}>
                    <Ionicons name="checkmark-circle" size={12} color={C.successFg} />
                    <Text style={styles.verifiedText}>{plan.health_credential_type}</Text>
                  </View>
                )}
              </View>
              {plan.target_condition && (
                <Text style={styles.condLabel}>{SPECIALISATION_LABELS[plan.target_condition] ?? plan.target_condition}</Text>
              )}
            </View>
          </View>

          {/* Description */}
          {plan.description && (
            <View style={styles.card}>
              <Text style={{ fontFamily: Fonts.sans, fontSize: 14, color: C.body, lineHeight: 20 }}>{plan.description}</Text>
            </View>
          )}

          {/* Plan stats */}
          <View style={[styles.card, { flexDirection: 'row', gap: 0 }]}>
            {[
              { label: t('customer_health_plans.duration_label'), value: t('customer_health_plans.duration_weeks', { count: plan.duration_weeks }) },
              { label: t('customer_health_plans.meals_per_day_label'), value: String(plan.meals_per_day) },
              { label: t('customer_health_plans.subscribers_label'), value: String(plan.subscriber_count) },
            ].map((stat, i) => (
              <View key={i} style={{ flex: 1, alignItems: 'center', borderLeftWidth: i > 0 ? 0.5 : 0, borderLeftColor: C.borderWarm }}>
                <Text style={{ fontFamily: Fonts.serif, fontSize: 18, color: C.textInk }}>{stat.value}</Text>
                <Text style={{ fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft, marginTop: 2 }}>{stat.label}</Text>
              </View>
            ))}
          </View>

          {/* Consent notice */}
          <View style={styles.consentNotice}>
            <Ionicons name="eye-outline" size={16} color={C.warnFg} />
            <Text style={styles.consentText}>
              {t('customer_health_plans.consent_notice', { name: plan.creator_name })}
            </Text>
          </View>

          {/* Week 1 preview */}
          {items.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>{t('customer_health_plans.week_1_preview')}</Text>
              {[1, 2, 3].map(day => {
                const dayItems = MEAL_TYPE_ORDER.flatMap(mt => byDayAndType[`1-${day}-${mt}`] ?? []);
                if (!dayItems.length) return null;
                return (
                  <View key={day} style={styles.dayCard}>
                    <Text style={styles.dayLabel}>{t(`customer_health_plans.day_${DAY_NAMES_KEYS[day - 1]}`)}</Text>
                    {dayItems.map(item => (
                      <View key={item.id} style={styles.mealRow}>
                        <View style={styles.mealTypePill}>
                          <Text style={styles.mealTypePillText}>{item.meal_type}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.mealTitle}>{item.title}</Text>
                          {item.calories && (
                            <Text style={styles.mealMeta}>
                              {item.protein_g
                                ? t('customer_health_plans.calories_with_protein', { calories: item.calories, protein: item.protein_g })
                                : t('customer_health_plans.calories_only', { calories: item.calories })}
                            </Text>
                          )}
                        </View>
                      </View>
                    ))}
                  </View>
                );
              })}
            </>
          )}
        </ScrollView>

        {/* Sticky CTA */}
        <View style={styles.stickyFooter}>
          <View style={{ flex: 1 }}>
            <Text style={styles.footerPrice}>{plan.price > 0 ? fmtCurrency(plan.price, plan.currency) : t('customer_health_plans.free')}</Text>
            <Text style={styles.footerSub}>{t('customer_health_plans.per_week_cycle', { count: plan.duration_weeks })}</Text>
          </View>
          {alreadySubscribed ? (
            <View style={styles.subscribedPill}>
              <Ionicons name="checkmark-circle" size={16} color={C.successFg} />
              <Text style={styles.subscribedText}>{t('customer_health_plans.subscribed_pill')}</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.subscribeBtn, subscribing && { opacity: 0.6 }]}
              onPress={subscribe}
              disabled={subscribing}
            >
              {subscribing
                ? <ActivityIndicator size="small" color={C.canvas} />
                : <Text style={styles.subscribeBtnText}>{t('customer_health_plans.subscribe_to_plan')}</Text>
              }
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    );
  }

  // ── Main tabs ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('customer_health_plans.header_title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabsRow}>
        {(['browse', 'mine', 'consent'] as Tab[]).map(tabKey => (
          <TouchableOpacity key={tabKey} style={[styles.tabBtn, tab === tabKey && styles.tabBtnActive]} onPress={() => setTab(tabKey)}>
            <Text style={[styles.tabText, tab === tabKey && { color: C.spice }]}>
              {tabKey === 'browse'
                ? t('customer_health_plans.tab_browse')
                : tabKey === 'mine'
                  ? (myPlans.length ? t('customer_health_plans.tab_my_plans_count', { count: myPlans.length }) : t('customer_health_plans.tab_my_plans'))
                  : t('customer_health_plans.tab_privacy')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={C.spice} />}
        contentContainerStyle={{ padding: Spacing.lg, gap: 12, paddingBottom: 40 }}
      >
        {/* ── Browse ── */}
        {tab === 'browse' && (
          <>
            {/* Condition filter */}
            {conditions.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {['', ...conditions].map(c => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.filterChip, filterCond === c && styles.filterChipActive]}
                    onPress={() => setFilterCond(c)}
                  >
                    {c ? <Ionicons name={(SPECIALISATION_ICONS[c] ?? 'leaf-outline') as any} size={12} color={filterCond === c ? C.canvas : C.spice} /> : null}
                    <Text style={[styles.filterChipText, filterCond === c && { color: C.canvas }]}>
                      {c ? (SPECIALISATION_LABELS[c] ?? c) : t('customer_health_plans.filter_all')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {loading ? (
              <View style={{ gap: 12, marginTop: 8 }}>
                <Bone width="100%" height={100} radius={14} />
                <Bone width="100%" height={100} radius={14} />
                <Bone width="100%" height={100} radius={14} />
              </View>
            ) : filtered.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="leaf-outline" size={40} color={C.stone} />
                <Text style={styles.emptyTitle}>{t('customer_health_plans.no_plans_title')}</Text>
                <Text style={styles.emptyBody}>{t('customer_health_plans.no_plans_body')}</Text>
              </View>
            ) : filtered.map(plan => (
              <TouchableOpacity key={plan.id} style={styles.planCard} onPress={() => openPlan(plan)} activeOpacity={0.85}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Avatar name={plan.creator_name} avatarUrl={plan.creator_avatar} size={40} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.planTitle}>{plan.title}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Text style={styles.planCreator}>{plan.creator_name}</Text>
                      {plan.health_credential_verified && (
                        <Ionicons name="checkmark-circle" size={12} color={C.successFg} />
                      )}
                    </View>
                  </View>
                  <Text style={styles.planPrice}>{plan.price > 0 ? fmtCurrency(plan.price, plan.currency) : t('customer_health_plans.free')}</Text>
                </View>
                {plan.description && (
                  <Text style={styles.planDesc} numberOfLines={2}>{plan.description}</Text>
                )}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  {plan.target_condition && (
                    <View style={styles.condPill}>
                      <Text style={styles.condPillText}>{SPECIALISATION_LABELS[plan.target_condition] ?? plan.target_condition}</Text>
                    </View>
                  )}
                  <Text style={styles.planMeta}>{t('customer_health_plans.plan_meta', { weeks: plan.duration_weeks, count: plan.subscriber_count })}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </>
        )}

        {/* ── My Plans ── */}
        {tab === 'mine' && (
          myPlans.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="calendar-outline" size={40} color={C.stone} />
              <Text style={styles.emptyTitle}>{t('customer_health_plans.no_active_plans_title')}</Text>
              <Text style={styles.emptyBody}>{t('customer_health_plans.no_active_plans_body')}</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => setTab('browse')}>
                <Text style={styles.emptyBtnText}>{t('customer_health_plans.browse_plans')}</Text>
              </TouchableOpacity>
            </View>
          ) : myPlans.map(sub => (
            <View key={sub.id} style={styles.planCard}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                <Avatar name={sub.creator_name ?? ''} avatarUrl={sub.creator_avatar} size={40} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.planTitle}>{sub.title}</Text>
                  <Text style={styles.planCreator}>{sub.creator_name}</Text>
                </View>
                <View style={styles.activePill}>
                  <View style={styles.activeDot} />
                  <Text style={styles.activeText}>{t('customer_health_plans.active')}</Text>
                </View>
              </View>
              {sub.expires_at && (
                <Text style={{ fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft }}>
                  {t('customer_health_plans.expires', { time: relativeTime(sub.expires_at) })}
                </Text>
              )}
              <TouchableOpacity onPress={() => cancelSubscription(sub)}>
                <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 13, color: C.errorFg }}>{t('customer_health_plans.cancel_subscription_link')}</Text>
              </TouchableOpacity>
            </View>
          ))
        )}

        {/* ── Privacy / Consent ── */}
        {tab === 'consent' && (
          <>
            <View style={styles.consentInfoCard}>
              <Ionicons name="shield-checkmark-outline" size={20} color={C.spice} />
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={styles.consentInfoTitle}>{t('customer_health_plans.your_feeding_history')}</Text>
                <Text style={styles.consentInfoBody}>
                  {t('customer_health_plans.feeding_history_body')}
                </Text>
              </View>
            </View>

            {consents.filter(c => c.is_active).length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>{t('customer_health_plans.no_active_consents_title')}</Text>
                <Text style={styles.emptyBody}>{t('customer_health_plans.no_active_consents_body')}</Text>
              </View>
            ) : consents.filter(c => c.is_active).map(consent => (
              <View key={consent.id} style={styles.consentCard}>
                <Avatar name={consent.creator_name} avatarUrl={consent.creator_avatar} size={40} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.consentCreatorName}>{consent.creator_name}</Text>
                  <Text style={styles.consentGranted}>{t('customer_health_plans.granted', { time: relativeTime(consent.granted_at) })}</Text>
                </View>
                <TouchableOpacity onPress={() => revokeConsent(consent)} style={styles.revokeBtn}>
                  <Text style={styles.revokeBtnText}>{t('customer_health_plans.revoke')}</Text>
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    root:               { flex: 1, backgroundColor: C.bg },
    header:             { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingTop: 16, paddingBottom: 12, gap: 8 },
    backBtn:            { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    title:              { flex: 1, fontFamily: Fonts.serif, fontSize: 22, color: C.textInk, textAlign: 'center' },
    tabsRow:            { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: C.borderWarm },
    tabBtn:             { flex: 1, alignItems: 'center', paddingVertical: 12 },
    tabBtnActive:       { borderBottomWidth: 2, borderBottomColor: C.spice },
    tabText:            { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.bodySoft },
    sectionLabel:       { fontFamily: Fonts.sansMedium, fontSize: 11, color: C.bodySoft, textTransform: 'uppercase', letterSpacing: 0.6 },
    filterChip:         { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.full, borderWidth: 1, borderColor: C.borderWarm, backgroundColor: C.bgCard },
    filterChipActive:   { backgroundColor: C.spice, borderColor: C.spice },
    filterChipText:     { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.body },
    planCard:           { backgroundColor: C.bgCard, borderRadius: Radius.lg, padding: 14, borderWidth: 0.5, borderColor: C.borderWarm, ...Shadow.card, gap: 8 },
    planTitle:          { fontFamily: Fonts.sansMedium, fontSize: 15, color: C.textInk },
    planCreator:        { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft },
    planPrice:          { fontFamily: Fonts.serif, fontSize: 16, color: C.spice },
    planDesc:           { fontFamily: Fonts.sans, fontSize: 13, color: C.body, lineHeight: 18 },
    planMeta:           { fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft },
    condPill:           { backgroundColor: C.warnBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
    condPillText:       { fontFamily: Fonts.sansMedium, fontSize: 11, color: C.ember },
    activePill:         { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.successBg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 40 },
    activeDot:          { width: 6, height: 6, borderRadius: 3, backgroundColor: C.leaf },
    activeText:         { fontFamily: Fonts.sansMedium, fontSize: 11, color: C.successFg },
    card:               { backgroundColor: C.bgCard, borderRadius: Radius.lg, padding: 14, borderWidth: 0.5, borderColor: C.borderWarm },
    creatorCard:        { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.bgCard, borderRadius: Radius.lg, padding: 14, borderWidth: 0.5, borderColor: C.borderWarm },
    creatorName:        { fontFamily: Fonts.sansMedium, fontSize: 15, color: C.textInk },
    condLabel:          { fontFamily: Fonts.sans, fontSize: 12, color: C.spice },
    verifiedBadge:      { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: C.successBg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    verifiedText:       { fontFamily: Fonts.sansMedium, fontSize: 10, color: C.successFg, textTransform: 'capitalize' },
    consentNotice:      { flexDirection: 'row', gap: 10, backgroundColor: C.warnBg, borderRadius: Radius.md, padding: 12, alignItems: 'flex-start' },
    consentText:        { fontFamily: Fonts.sans, fontSize: 12, color: C.warnFg, flex: 1, lineHeight: 18 },
    dayCard:            { backgroundColor: C.bgCard, borderRadius: Radius.lg, padding: 12, borderWidth: 0.5, borderColor: C.borderWarm, gap: 8 },
    dayLabel:           { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.spice, textTransform: 'uppercase', letterSpacing: 0.4 },
    mealRow:            { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    mealTypePill:       { backgroundColor: C.warnBg, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4, marginTop: 2 },
    mealTypePillText:   { fontFamily: Fonts.sansMedium, fontSize: 10, color: C.ember, textTransform: 'capitalize' },
    mealTitle:          { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.textInk },
    mealMeta:           { fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft },
    stickyFooter:       { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.bgCard, padding: Spacing.lg, borderTopWidth: 0.5, borderTopColor: C.borderWarm },
    footerPrice:        { fontFamily: Fonts.serif, fontSize: 20, color: C.textInk },
    footerSub:          { fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft },
    subscribeBtn:       { flex: 1, backgroundColor: C.spice, borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center' },
    subscribeBtnText:   { fontFamily: Fonts.sansMedium, fontSize: 15, color: C.canvas },
    subscribedPill:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: C.successBg, borderRadius: Radius.md, paddingVertical: 14 },
    subscribedText:     { fontFamily: Fonts.sansMedium, fontSize: 15, color: C.successFg },
    consentInfoCard:    { flexDirection: 'row', gap: 12, backgroundColor: C.bgCard, borderRadius: Radius.lg, padding: 14, borderWidth: 0.5, borderColor: C.borderWarm },
    consentInfoTitle:   { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.textInk },
    consentInfoBody:    { fontFamily: Fonts.sans, fontSize: 13, color: C.body, lineHeight: 19 },
    consentCard:        { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.bgCard, borderRadius: Radius.lg, padding: 14, borderWidth: 0.5, borderColor: C.borderWarm },
    consentCreatorName: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.textInk },
    consentGranted:     { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft },
    revokeBtn:          { paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.md, borderWidth: 1.5, borderColor: C.errorFg },
    revokeBtnText:      { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.errorFg },
    empty:              { alignItems: 'center', paddingVertical: 50, gap: 10 },
    emptyTitle:         { fontFamily: Fonts.sansMedium, fontSize: 16, color: C.textInk },
    emptyBody:          { fontFamily: Fonts.sans, fontSize: 13, color: C.bodySoft, textAlign: 'center', lineHeight: 19 },
    emptyBtn:           { backgroundColor: C.spice, borderRadius: Radius.full, paddingHorizontal: 24, paddingVertical: 12, marginTop: 8 },
    emptyBtnText:       { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.canvas },
  });
}
