import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { giftingApi, type MealSubscription, type SubscriptionMeal } from '../../src/api/gifting';
import { Fonts, Spacing, Radius, Shadow } from '../../src/constants/theme';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { useFeedback } from '../../src/components/feedback';
import { Bone } from '../../src/components/ui/Skeleton';
import { useCurrency } from '../../src/hooks/useCurrency';
import { useTranslation } from 'react-i18next';

type Tab = 'cards' | 'subscribe' | 'myplans' | 'redeem';

const AMOUNTS = [1000, 2500, 5000, 10000, 20000, 50000];

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
}

const MEAL_RATE_BASE = 3500;
const DIETICIAN_RATE_BASE = 1500;

interface SubscriptionPlan {
  id: string; label: string; duration: string; days: number;
  badge?: string; highlight?: boolean;
}

function getSubscriptionPlans(tr: (key: string) => string): SubscriptionPlan[] {
  return [
    { id: 'weekly',    label: tr('gifting.plan_weekly'),    duration: tr('gifting.plan_weekly_dur'),    days: 7 },
    { id: 'monthly',   label: tr('gifting.plan_monthly'),   duration: tr('gifting.plan_monthly_dur'),   days: 30, badge: tr('gifting.plan_monthly_badge'), highlight: true },
    { id: 'quarterly', label: tr('gifting.plan_quarterly'), duration: tr('gifting.plan_quarterly_dur'), days: 90, badge: tr('gifting.plan_quarterly_badge') },
    { id: 'annual',    label: tr('gifting.plan_annual'),    duration: tr('gifting.plan_annual_dur'),    days: 365, badge: tr('gifting.plan_annual_badge') },
  ];
}

function calcTotalMeals(days: number, slots: string[]) {
  return days * (slots.length || 1);
}

function calcTotalPrice(days: number, slots: string[], addDietician: boolean, planId: string) {
  const meals = calcTotalMeals(days, slots);
  const ratePerMeal = MEAL_RATE_BASE + (addDietician ? DIETICIAN_RATE_BASE : 0);
  // Small bulk discounts matching badge claims
  const discount = planId === 'quarterly' ? 0.90 : planId === 'annual' ? 0.82 : 1;
  return Math.round(meals * ratePerMeal * discount);
}

interface SubscriptionType { id: string; icon: string; label: string; desc: string; }
function getSubscriptionTypes(tr: (key: string) => string): SubscriptionType[] {
  return [
    { id: 'daily',    icon: 'restaurant-outline',  label: tr('gifting.type_daily'),    desc: tr('gifting.type_daily_desc') },
    { id: 'senior',   icon: 'heart-outline',        label: tr('gifting.type_senior'),   desc: tr('gifting.type_senior_desc') },
    { id: 'wellness', icon: 'leaf-outline',         label: tr('gifting.type_wellness'), desc: tr('gifting.type_wellness_desc') },
    { id: 'office',   icon: 'briefcase-outline',    label: tr('gifting.type_office'),   desc: tr('gifting.type_office_desc') },
    { id: 'birthday', icon: 'gift-outline',         label: tr('gifting.type_birthday'), desc: tr('gifting.type_birthday_desc') },
    { id: 'family',   icon: 'people-outline',       label: tr('gifting.type_family'),   desc: tr('gifting.type_family_desc') },
  ];
}

function getMealSlots(tr: (key: string) => string) {
  return [
    { id: 'breakfast', label: tr('gifting.slot_breakfast'), time: tr('gifting.slot_breakfast_time') },
    { id: 'lunch',     label: tr('gifting.slot_lunch'),     time: tr('gifting.slot_lunch_time') },
    { id: 'dinner',    label: tr('gifting.slot_dinner'),    time: tr('gifting.slot_dinner_time') },
  ];
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function GiftingScreen() {
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const { fmt: fmtCurrency, currency } = useCurrency();
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('cards');

  const TABS: { id: Tab; label: string }[] = [
    { id: 'cards',     label: t('gifting.tab_cards') },
    { id: 'subscribe', label: t('gifting.tab_subscribe') },
    { id: 'myplans',   label: t('gifting.tab_myplans') },
    { id: 'redeem',    label: t('gifting.tab_redeem') },
  ];

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: C.bg }}>
        <View style={styles.topBar}>
          <Text style={styles.pageTitle}>{t('gifting.title')}</Text>
          <Text style={styles.pageSub}>{t('gifting.subtitle')}</Text>
        </View>
      </SafeAreaView>

      <View style={styles.tabRow}>
        {TABS.map(t => (
          <TouchableOpacity key={t.id} onPress={() => setTab(t.id)}
            style={[styles.tab, tab === t.id && styles.tabActive]}>
            <Text style={[styles.tabText, tab === t.id && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'cards'     && <BuyTab />}
      {tab === 'subscribe' && <SubscribeTab />}
      {tab === 'myplans'   && <MyPlansTab />}
      {tab === 'redeem'    && <RedeemTab />}
    </View>
  );
}

// ─── Gift card tab ────────────────────────────────────────────────────────────

function BuyTab() {
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [amount, setAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<{ code: string; amount: number } | null>(null);
  const feedback = useFeedback();

  const selectedAmount = amount ?? (customAmount ? parseInt(customAmount.replace(/\D/g, ''), 10) : null);

  async function handlePurchase() {
    if (!selectedAmount || selectedAmount < 500) {
      feedback.warn('Amount required', `Minimum gift card value is ${fmtCurrency(500)}.`);
      return;
    }
    setLoading(true);
    try {
      const { gift_card } = await giftingApi.purchaseGiftCard({
        denomination: selectedAmount,
        recipient_phone: recipientPhone || undefined,
        gift_message: message || undefined,
      });
      setDone({ code: gift_card.code, amount: gift_card.denomination });
    } catch (e: any) {
      feedback.error('Error', e.message ?? 'Could not purchase gift card');
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setDone(null); setAmount(null); setCustomAmount('');
    setRecipientName(''); setRecipientPhone(''); setMessage('');
  }

  if (done) {
    return (
      <View style={styles.successWrap}>
        <View style={styles.successCard}>
          <View style={styles.successIcon}><Ionicons name="gift-outline" size={32} color={C.spice} /></View>
          <Text style={styles.successTitle}>Gift card created!</Text>
          <Text style={styles.successSub}>Share this code with {recipientName || 'the recipient'}</Text>
          <View style={styles.codeBox}><Text style={styles.codeText}>{done.code}</Text></View>
          <Text style={styles.codeValue}>{fmtCurrency(done.amount)} value</Text>
          <TouchableOpacity style={styles.doneBtn} onPress={reset}>
            <Text style={styles.doneBtnText}>Create another</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionLabel}>Select amount</Text>
        <View style={styles.amountGrid}>
          {AMOUNTS.map(a => (
            <TouchableOpacity key={a} onPress={() => { setAmount(a); setCustomAmount(''); }}
              style={[styles.amountPill, amount === a && styles.amountPillActive]}>
              <Text style={[styles.amountText, amount === a && styles.amountTextActive]}>{fmtCurrency(a)}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TextInput style={styles.input} placeholder={`Or enter a custom amount (${currency.symbol})`}
          placeholderTextColor={C.caps} keyboardType="numeric" value={customAmount}
          onChangeText={v => { setCustomAmount(v); setAmount(null); }} />

        <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Recipient (optional)</Text>
        <TextInput style={styles.input} placeholder="Recipient name" placeholderTextColor={C.caps}
          value={recipientName} onChangeText={setRecipientName} />
        <TextInput style={styles.input} placeholder="Recipient phone (e.g. 2348012345678)"
          placeholderTextColor={C.caps} keyboardType="phone-pad" value={recipientPhone} onChangeText={setRecipientPhone} />
        <TextInput style={[styles.input, styles.messageInput]} placeholder="Add a personal message…"
          placeholderTextColor={C.caps} multiline numberOfLines={3} value={message} onChangeText={setMessage} />

        <TouchableOpacity style={[styles.primaryBtn, (!selectedAmount || selectedAmount < 500) && { opacity: 0.45 }]}
          onPress={handlePurchase} disabled={loading || !selectedAmount || selectedAmount < 500} activeOpacity={0.85}>
          {loading ? <ActivityIndicator color={C.canvas} /> : (
            <><Ionicons name="gift-outline" size={18} color={C.canvas} />
              <Text style={styles.primaryBtnText}>
                {selectedAmount ? `Buy ${fmtCurrency(selectedAmount)} gift card` : 'Buy gift card'}
              </Text></>
          )}
        </TouchableOpacity>
        <Text style={styles.note}>Gift cards never expire and can be redeemed on any order.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Subscribe tab ────────────────────────────────────────────────────────────

type SubscribeStep = 'type' | 'plan' | 'details' | 'confirm';

function SubscribeTab() {
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const feedback = useFeedback();

  const [step, setStep] = useState<SubscribeStep>('type');
  const [subType, setSubType] = useState<string | null>(null);
  const [plan, setPlan] = useState<string | null>(null);
  const [mealSlots, setMealSlots] = useState<string[]>([]);
  const [addDietician, setAddDietician] = useState(false);
  const [forSelf, setForSelf] = useState(false);
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [preferences, setPreferences] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const selectedPlan = SUBSCRIPTION_PLANS.find(p => p.id === plan);
  const selectedType = SUBSCRIPTION_TYPES.find(t => t.id === subType);

  const totalMeals = selectedPlan ? calcTotalMeals(selectedPlan.days, mealSlots) : 0;
  const totalPrice = selectedPlan ? calcTotalPrice(selectedPlan.days, mealSlots, addDietician, plan!) : 0;
  const perMealPrice = totalMeals > 0 ? Math.round(totalPrice / totalMeals) : 0;

  function toggleSlot(id: string) {
    setMealSlots(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  }

  function goBack() {
    if (step === 'plan')    setStep('type');
    if (step === 'details') setStep('plan');
    if (step === 'confirm') setStep('details');
  }

  async function handleSubmit() {
    if (!forSelf && (!recipientName.trim() || !recipientPhone.trim() || !recipientAddress.trim())) {
      feedback.warn('Required fields', 'Please fill in recipient name, phone, and address.');
      return;
    }
    setLoading(true);
    try {
      await giftingApi.createSubscription({
        plan_id: plan!,
        sub_type: subType!,
        meal_slots: mealSlots,
        add_dietician: addDietician,
        recipient_name: recipientName,
        recipient_phone: recipientPhone,
        recipient_address: recipientAddress,
        preferences: preferences || undefined,
        total_amount: totalPrice,
        currency_code: 'NGN',
      });
      setDone(true);
    } catch (e: any) {
      feedback.error('Could not create subscription', e.message ?? 'Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setStep('type'); setSubType(null); setPlan(null); setMealSlots([]);
    setAddDietician(false); setForSelf(false); setRecipientName('');
    setRecipientPhone(''); setRecipientAddress(''); setPreferences(''); setDone(false);
  }

  if (done) {
    return (
      <View style={styles.successWrap}>
        <View style={styles.successCard}>
          <View style={[styles.successIcon, { backgroundColor: C.honey }]}>
            <Ionicons name="heart-circle-outline" size={36} color={C.spice} />
          </View>
          <Text style={styles.successTitle}>Subscription started!</Text>
          <Text style={styles.successSub}>
            {forSelf ? 'Your' : `${recipientName}'s`} {selectedPlan?.label.toLowerCase()} meal plan is being set up.
            {'\n'}FOODS will assign and rotate the best available cooks.
            {addDietician ? '\nA nutritionist will reach out within 24 hours to plan the menu.' : ''}
          </Text>
          <Text style={[styles.note, { marginTop: 8 }]}>
            View meal schedules, approve or reject meals in the My Plans tab.
          </Text>
          <TouchableOpacity style={styles.doneBtn} onPress={reset}>
            <Text style={styles.doneBtnText}>Set up another plan</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Step indicator */}
      <View style={styles.stepRow}>
        {(['type', 'plan', 'details', 'confirm'] as SubscribeStep[]).map((s, i) => {
          const steps = ['type','plan','details','confirm'];
          const currentIdx = steps.indexOf(step);
          return (
            <View key={s} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={[styles.stepDot, step === s && styles.stepDotActive, currentIdx > i && styles.stepDotDone]}>
                <Text style={[styles.stepNum, (step === s || currentIdx > i) && { color: C.canvas }]}>{i + 1}</Text>
              </View>
              {i < 3 && <View style={[styles.stepLine, currentIdx > i && styles.stepLineDone]} />}
            </View>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* STEP 1: Type */}
        {step === 'type' && (
          <View style={{ gap: 10 }}>
            <Text style={styles.stepTitle}>What kind of subscription?</Text>
            <Text style={styles.stepSub}>Choose the plan that fits the recipient best.</Text>
            {SUBSCRIPTION_TYPES.map(t => (
              <TouchableOpacity key={t.id}
                style={[styles.typeCard, subType === t.id && styles.typeCardActive]}
                onPress={() => setSubType(t.id)} activeOpacity={0.8}>
                <View style={[styles.typeIcon, subType === t.id && { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                  <Ionicons name={t.icon as any} size={22} color={subType === t.id ? C.canvas : C.spice} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.typeLabel, subType === t.id && styles.typeLabelActive]}>{t.label}</Text>
                  <Text style={[styles.typeDesc, subType === t.id && styles.typeDescActive]}>{t.desc}</Text>
                </View>
                {subType === t.id && <Ionicons name="checkmark-circle" size={20} color={C.canvas} />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[styles.primaryBtn, !subType && { opacity: 0.4 }]}
              onPress={() => subType && setStep('plan')} disabled={!subType}>
              <Text style={styles.primaryBtnText}>Continue</Text>
              <Ionicons name="arrow-forward" size={16} color={C.canvas} />
            </TouchableOpacity>
          </View>
        )}

        {/* STEP 2: Meal slots + duration + pricing */}
        {step === 'plan' && (
          <View style={{ gap: 12 }}>
            <Text style={styles.stepTitle}>Set up the meal plan</Text>

            {/* FOODS matching banner */}
            <View style={[styles.infoChip, { backgroundColor: C.bgCook, borderColor: C.spice + '40', padding: 14 }]}>
              <Ionicons name="shuffle-outline" size={16} color={C.spice} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 13, color: C.textInk }}>FOODS assigns the cooks</Text>
                <Text style={{ fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft, lineHeight: 17 }}>
                  We match and rotate the best available home cooks based on availability, location, and dietary needs — so meals are always fresh and reliable.
                </Text>
              </View>
            </View>

            {/* Meal times — drives price */}
            <Text style={styles.sectionLabel}>Which meals? <Text style={{ color: C.bodySoft, fontFamily: Fonts.sans, textTransform: 'none', letterSpacing: 0 }}>(select all that apply)</Text></Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {MEAL_SLOTS.map(s => (
                <TouchableOpacity key={s.id}
                  style={[styles.slotPill, mealSlots.includes(s.id) && styles.slotPillActive]}
                  onPress={() => toggleSlot(s.id)}>
                  <Text style={[styles.slotText, mealSlots.includes(s.id) && styles.slotTextActive]}>{s.label}</Text>
                  <Text style={[styles.slotTime, mealSlots.includes(s.id) && { color: 'rgba(255, 255, 255,0.7)' }]}>{s.time}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {mealSlots.length > 0 && (
              <Text style={{ fontFamily: Fonts.sans, fontSize: 12, color: C.spice }}>
                {mealSlots.length} meal{mealSlots.length > 1 ? 's' : ''}/day · {fmtCurrency(MEAL_RATE_BASE)}/meal
              </Text>
            )}
            {mealSlots.length === 0 && (
              <Text style={[styles.note, { color: C.warnFg }]}>Select at least one meal to continue.</Text>
            )}

            {/* Duration */}
            <Text style={[styles.sectionLabel, { marginTop: 4 }]}>Duration</Text>
            {SUBSCRIPTION_PLANS.map(p => {
              const planMeals = calcTotalMeals(p.days, mealSlots);
              const planPrice = calcTotalPrice(p.days, mealSlots.length > 0 ? mealSlots : ['lunch'], addDietician, p.id);
              const planPerMeal = planMeals > 0 ? Math.round(planPrice / planMeals) : MEAL_RATE_BASE;
              return (
                <TouchableOpacity key={p.id}
                  style={[styles.planCard, plan === p.id && styles.planCardActive, p.highlight && styles.planCardHighlight]}
                  onPress={() => setPlan(p.id)} activeOpacity={0.85}>
                  {p.badge && (
                    <View style={[styles.planBadge, plan === p.id && { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                      <Text style={[styles.planBadgeText, plan === p.id && { color: C.canvas }]}>{p.badge}</Text>
                    </View>
                  )}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View>
                      <Text style={[styles.planLabel, plan === p.id && styles.planLabelActive]}>{p.label}</Text>
                      <Text style={[styles.planDuration, plan === p.id && styles.planDurationActive]}>{p.duration}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.planPrice, plan === p.id && styles.planPriceActive]}>
                        {mealSlots.length > 0 ? fmtCurrency(planPrice) : '—'}
                      </Text>
                      <Text style={[styles.planPerDay, plan === p.id && { color: 'rgba(255, 255, 255,0.6)' }]}>
                        {mealSlots.length > 0 ? `${fmtCurrency(planPerMeal)}/meal` : 'select meals first'}
                      </Text>
                    </View>
                  </View>
                  {plan === p.id && (
                    <View style={styles.planCheckRow}>
                      <Ionicons name="checkmark-circle" size={16} color={C.canvas} />
                      <Text style={{ fontFamily: Fonts.sans, fontSize: 12, color: 'rgba(255, 255, 255,0.8)' }}>
                        {mealSlots.length > 0 ? `${planMeals} meals total` : 'Selected'}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}

            {/* Dietician add-on */}
            <TouchableOpacity style={[styles.addOnCard, addDietician && styles.addOnCardActive]}
              onPress={() => setAddDietician(v => !v)} activeOpacity={0.8}>
              <View style={[styles.addOnIcon, addDietician && { backgroundColor: 'rgba(255,255,255,0.12)' }]}>
                <Ionicons name="medkit-outline" size={20} color={addDietician ? C.canvas : C.healthFg} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.addOnLabel, addDietician && styles.addOnLabelActive]}>Add a dietician/nutritionist</Text>
                <Text style={[styles.addOnDesc, addDietician && styles.addOnDescActive]}>
                  A certified nutritionist designs every meal for specific health goals and restrictions.{'\n'}
                  +{fmtCurrency(DIETICIAN_RATE_BASE)}/meal extra
                </Text>
              </View>
              <View style={[styles.addOnCheck, addDietician && styles.addOnCheckActive]}>
                {addDietician && <Ionicons name="checkmark" size={14} color={C.canvas} />}
              </View>
            </TouchableOpacity>

            {plan && mealSlots.length > 0 && (
              <View style={styles.totalRow}>
                <View>
                  <Text style={styles.totalLabel}>Total</Text>
                  <Text style={{ fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft, marginTop: 2 }}>
                    {totalMeals} meals · {fmtCurrency(perMealPrice)}/meal
                  </Text>
                </View>
                <Text style={styles.totalPrice}>{fmtCurrency(totalPrice)}</Text>
              </View>
            )}

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
              <TouchableOpacity style={styles.backBtn} onPress={goBack}>
                <Ionicons name="arrow-back" size={16} color={C.body} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryBtn, { flex: 1 }, (!plan || mealSlots.length === 0) && { opacity: 0.4 }]}
                onPress={() => (plan && mealSlots.length > 0) && setStep('details')}
                disabled={!plan || mealSlots.length === 0}>
                <Text style={styles.primaryBtnText}>Continue</Text>
                <Ionicons name="arrow-forward" size={16} color={C.canvas} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* STEP 3: Recipient details */}
        {step === 'details' && (
          <View style={{ gap: 12 }}>
            <Text style={styles.stepTitle}>Who is this for?</Text>

            {/* For self / for someone else toggle */}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[{ label: 'For me', val: true }, { label: 'Gift someone', val: false }].map(opt => (
                <TouchableOpacity
                  key={String(opt.val)}
                  style={[styles.slotPill, { flex: 1 }, forSelf === opt.val && styles.slotPillActive]}
                  onPress={() => setForSelf(opt.val)}
                >
                  <Text style={[styles.slotText, forSelf === opt.val && styles.slotTextActive]}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {!forSelf && (
              <>
                <Text style={styles.sectionLabel}>Recipient details</Text>
                <TextInput style={styles.input} placeholder="Full name *" placeholderTextColor={C.caps}
                  value={recipientName} onChangeText={setRecipientName} />
                <TextInput style={styles.input} placeholder="Phone number * (e.g. 2348012345678)"
                  placeholderTextColor={C.caps} keyboardType="phone-pad" value={recipientPhone} onChangeText={setRecipientPhone} />
              </>
            )}

            <TextInput style={[styles.input, { minHeight: 72, textAlignVertical: 'top' }]}
              placeholder="Delivery address *" placeholderTextColor={C.caps}
              multiline value={recipientAddress} onChangeText={setRecipientAddress} />

            <Text style={[styles.sectionLabel, { marginTop: 4 }]}>Meal preferences &amp; dietary notes</Text>
            <TextInput style={[styles.input, styles.messageInput]}
              placeholder="e.g. no pork, prefers Yoruba cuisine, diabetic-friendly, low sodium, nut allergy…"
              placeholderTextColor={C.caps} multiline numberOfLines={4}
              value={preferences} onChangeText={setPreferences} />
            <Text style={{ fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft, lineHeight: 16 }}>
              These notes go to the assigned cook and nutritionist (if added). The more detail you provide, the better the meals.
            </Text>

            {addDietician && (
              <View style={[styles.infoChip, { backgroundColor: C.healthBg, borderColor: C.leaf }]}>
                <Ionicons name="leaf" size={14} color={C.healthFg} />
                <Text style={[styles.infoChipText, { color: C.healthFg }]}>
                  A nutritionist will review these notes and reach out within 24 hours.
                </Text>
              </View>
            )}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
              <TouchableOpacity style={styles.backBtn} onPress={goBack}>
                <Ionicons name="arrow-back" size={16} color={C.body} />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.primaryBtn, { flex: 1 }]} onPress={() => setStep('confirm')}>
                <Text style={styles.primaryBtnText}>Review order</Text>
                <Ionicons name="arrow-forward" size={16} color={C.canvas} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* STEP 4: Confirm */}
        {step === 'confirm' && (
          <View style={{ gap: 14 }}>
            <Text style={styles.stepTitle}>Confirm subscription</Text>
            <View style={styles.summaryCard}>
              <SummaryRow label="Type"       value={selectedType?.label ?? '—'} />
              <SummaryRow label="Duration"   value={`${selectedPlan?.label} (${selectedPlan?.duration})`} />
              <SummaryRow label="Meals"      value={mealSlots.map(s => MEAL_SLOTS.find(m => m.id === s)?.label ?? s).join(' + ')} />
              <SummaryRow label="Total meals" value={`${totalMeals} meals`} />
              <SummaryRow label="Per meal"   value={fmtCurrency(perMealPrice)} />
              {!forSelf && <SummaryRow label="Recipient" value={recipientName} />}
              {!forSelf && <SummaryRow label="Phone"     value={recipientPhone} />}
              {addDietician && <SummaryRow label="Add-on" value="Nutritionist included" highlight />}
              <View style={[styles.summaryDivider, { marginVertical: 10 }]} />
              <SummaryRow label="Total" value={fmtCurrency(totalPrice)} bold />
            </View>

            <View style={[styles.infoChip, { backgroundColor: C.bgCook, borderColor: C.spice + '40' }]}>
              <Ionicons name="shuffle-outline" size={14} color={C.spice} />
              <Text style={styles.infoChipText}>
                FOODS will assign and rotate the best available cooks. You'll always see who is cooking each meal.
              </Text>
            </View>

            <View style={[styles.infoChip, { backgroundColor: C.infoBg, borderColor: C.infoFg + '40' }]}>
              <Ionicons name="eye-outline" size={14} color={C.infoFg} />
              <Text style={[styles.infoChipText, { color: C.infoFg }]}>
                You can view every meal {forSelf ? "you're" : `${recipientName} is`} being fed and approve or reject meals from the My Plans tab.
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={styles.backBtn} onPress={goBack}>
                <Ionicons name="arrow-back" size={16} color={C.body} />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.primaryBtn, { flex: 1 }]}
                onPress={handleSubmit} disabled={loading} activeOpacity={0.85}>
                {loading
                  ? <ActivityIndicator color={C.canvas} />
                  : <><Ionicons name="heart-outline" size={18} color={C.canvas} />
                      <Text style={styles.primaryBtnText}>Start subscription</Text></>}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function SummaryRow({ label, value, bold, highlight }: { label: string; value: string; bold?: boolean; highlight?: boolean }) {
  const C = useColors();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 5 }}>
      <Text style={{ fontFamily: Fonts.sans, fontSize: 13, color: C.bodySoft, flex: 1 }}>{label}</Text>
      <Text style={{ fontFamily: bold ? Fonts.serif : Fonts.sansMedium, fontSize: bold ? 18 : 13,
        color: highlight ? C.leaf : bold ? C.spice : C.textInk, textAlign: 'right', flex: 1 }}>
        {value}
      </Text>
    </View>
  );
}

// ─── My Plans tab ─────────────────────────────────────────────────────────────

function MyPlansTab() {
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [subscriptions, setSubscriptions] = useState<MealSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<MealSubscription | null>(null);
  const feedback = useFeedback();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await giftingApi.listSubscriptions();
      setSubscriptions(data.subscriptions ?? []);
    } catch { setSubscriptions([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function pause(sub: MealSubscription) {
    feedback.confirm({
      title: 'Pause subscription',
      message: `Pause ${sub.recipient_name}'s meal plan?`,
      confirmLabel: 'Pause',
      onConfirm: async () => {
        try {
          await giftingApi.pauseSubscription(sub.id);
          load();
        } catch (e: any) { feedback.error('Error', e.message ?? 'Could not pause'); }
      },
    });
  }

  async function cancel(sub: MealSubscription) {
    feedback.confirm({
      title: 'Cancel subscription',
      message: `Cancel ${sub.recipient_name}'s meal plan? This cannot be undone.`,
      confirmLabel: 'Cancel plan',
      danger: true,
      onConfirm: async () => {
        try {
          await giftingApi.cancelSubscription(sub.id);
          load();
        } catch (e: any) { feedback.error('Error', e.message ?? 'Could not cancel'); }
      },
    });
  }

  if (loading) {
    return (
      <View style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1, padding: Spacing.lg, gap: 14 }}>
          <Bone width="45%" height={22} radius={6} />
          <Bone width="100%" height={120} radius={14} />
          <Bone width="100%" height={120} radius={14} />
          <Bone width="100%" height={64} radius={12} />
        </SafeAreaView>
      </View>
    );
  }

  if (subscriptions.length === 0) {
    return (
      <View style={styles.successWrap}>
        <Ionicons name="heart-circle-outline" size={48} color={C.stone} />
        <Text style={[styles.successTitle, { marginTop: 12, fontSize: 18 }]}>No active plans</Text>
        <Text style={styles.successSub}>Subscriptions you gift will appear here with full meal schedules.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={[styles.scroll, { gap: 14 }]} showsVerticalScrollIndicator={false}>
      {subscriptions.map(sub => {
        const plan = SUBSCRIPTION_PLANS.find(p => p.id === sub.plan_id);
        const slots = (sub.meal_slots ?? []).map((s: string) => MEAL_SLOTS.find(m => m.id === s)?.label ?? s).join(' + ');
        const statusColor = sub.status === 'active' ? C.successFg : sub.status === 'paused' ? C.warnFg : C.errorFg;

        return (
          <View key={sub.id} style={styles.planCard}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.planLabel, { color: C.textInk }]}>{sub.recipient_name}</Text>
                <Text style={[styles.planDuration, { color: C.bodySoft }]}>
                  {plan?.label ?? sub.plan_id} · {slots || 'No time set'}
                </Text>
                <Text style={{ fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft, marginTop: 2 }}>
                  {sub.recipient_phone} · {sub.recipient_address}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <View style={{ backgroundColor: statusColor + '20', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 11, color: statusColor, textTransform: 'capitalize' }}>
                    {sub.status}
                  </Text>
                </View>
                {sub.add_dietician && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="leaf" size={12} color={C.healthFg} />
                    <Text style={{ fontFamily: Fonts.sans, fontSize: 11, color: C.healthFg }}>Nutritionist</Text>
                  </View>
                )}
              </View>
            </View>

            <View style={[styles.summaryDivider, { marginVertical: 10 }]} />

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                style={[styles.actionBtn, { flex: 1 }]}
                onPress={() => setSelected(sub)}>
                <Ionicons name="calendar-outline" size={14} color={C.spice} />
                <Text style={[styles.actionBtnText, { color: C.spice }]}>View meals</Text>
              </TouchableOpacity>
              {sub.status === 'active' && (
                <TouchableOpacity style={styles.iconBtn} onPress={() => pause(sub)}>
                  <Ionicons name="pause-circle-outline" size={16} color={C.warnFg} />
                </TouchableOpacity>
              )}
              {sub.status !== 'cancelled' && (
                <TouchableOpacity style={[styles.iconBtn, { borderColor: C.errorFg + '40' }]} onPress={() => cancel(sub)}>
                  <Ionicons name="close-circle-outline" size={16} color={C.errorFg} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        );
      })}

      {selected && (
        <MealScheduleModal
          subscription={selected}
          onClose={() => setSelected(null)}
          onUpdated={load}
        />
      )}
    </ScrollView>
  );
}

// ─── Meal schedule modal ──────────────────────────────────────────────────────

function MealScheduleModal({ subscription, onClose, onUpdated }: {
  subscription: MealSubscription;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [meals, setMeals] = useState<SubscriptionMeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectModal, setRejectModal] = useState<SubscriptionMeal | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const feedback = useFeedback();

  useEffect(() => {
    (async () => {
      try {
        const data = await giftingApi.getSubscriptionMeals(subscription.id);
        setMeals(data.meals ?? []);
      } catch { setMeals([]); }
      finally { setLoading(false); }
    })();
  }, [subscription.id]);

  async function handleFeedback(meal: SubscriptionMeal, action: 'approve' | 'reject', reason?: string) {
    setSubmitting(true);
    try {
      await giftingApi.submitMealFeedback(subscription.id, meal.id, { action, reason });
      setMeals(prev => prev.map(m => m.id === meal.id
        ? { ...m, status: action === 'approve' ? 'approved' : 'rejected',
            approved_by: action === 'approve' ? 'gifter' : null,
            rejected_by: action === 'reject' ? 'gifter' : null,
            rejection_reason: reason ?? null }
        : m));
      if (action === 'approve') feedback.success('Approved', 'The cook has been notified.');
      else { feedback.info('Rejected', 'The cook will propose a new meal.'); setRejectModal(null); }
    } catch (e: any) {
      feedback.error('Error', e.message ?? 'Could not save feedback');
    } finally { setSubmitting(false); }
  }

  const statusIcon: Record<string, string> = {
    scheduled: 'time-outline', delivered: 'checkmark-done-outline',
    approved: 'checkmark-circle', rejected: 'close-circle', skipped: 'remove-circle-outline',
  };
  const statusColor = (s: string) => ({
    scheduled: C.bodySoft, delivered: C.infoFg,
    approved: C.successFg, rejected: C.errorFg, skipped: C.stone,
  }[s] ?? C.bodySoft);

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <SafeAreaView edges={['top']}>
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: Spacing.lg, gap: 12 }}>
            <TouchableOpacity onPress={onClose} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, borderWidth: 1, borderColor: C.borderWarm }}>
              <Ionicons name="arrow-back" size={18} color={C.textInk} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: Fonts.serif, fontSize: 20, color: C.textInk }}>Meal schedule</Text>
              <Text style={{ fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft }}>{subscription.recipient_name}</Text>
            </View>
          </View>
        </SafeAreaView>

        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={C.spice} />
          </View>
        ) : meals.length === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg, gap: 10 }}>
            <Ionicons name="restaurant-outline" size={40} color={C.stone} />
            <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 15, color: C.textInk }}>No meals scheduled yet</Text>
            <Text style={{ fontFamily: Fonts.sans, fontSize: 13, color: C.bodySoft, textAlign: 'center', lineHeight: 19 }}>
              Your cook will upload the meal schedule before deliveries begin. You'll be notified when it's ready.
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: Spacing.lg, gap: 12, paddingBottom: 40 }}>
            {meals.map(meal => (
              <View key={meal.id} style={[styles.planCard, { borderColor: C.borderWarm }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 13, color: C.bodySoft }}>
                      {fmtDate(meal.delivery_date)} · {MEAL_SLOTS.find(s => s.id === meal.meal_slot)?.label ?? meal.meal_slot}
                    </Text>
                    <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 15, color: C.textInk, marginTop: 3 }}>
                      {meal.meal_title ?? 'Meal not yet assigned'}
                    </Text>
                    {meal.meal_description ? (
                      <Text style={{ fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft, marginTop: 2, lineHeight: 17 }}>
                        {meal.meal_description}
                      </Text>
                    ) : null}
                    {meal.cook_note ? (
                      <Text style={{ fontFamily: Fonts.sans, fontSize: 12, color: C.body, marginTop: 4, fontStyle: 'italic' }}>
                        Cook: "{meal.cook_note}"
                      </Text>
                    ) : null}
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginLeft: 8 }}>
                    <Ionicons name={statusIcon[meal.status] as any} size={16} color={statusColor(meal.status)} />
                    <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 12, color: statusColor(meal.status), textTransform: 'capitalize' }}>
                      {meal.status}
                    </Text>
                  </View>
                </View>

                {meal.rejection_reason ? (
                  <View style={[styles.infoChip, { backgroundColor: C.errorBg, borderColor: C.errorFg + '30', marginTop: 8 }]}>
                    <Text style={[styles.infoChipText, { color: C.errorFg }]}>Reason: {meal.rejection_reason}</Text>
                  </View>
                ) : null}

                {(meal.status === 'scheduled' || meal.status === 'delivered') && meal.meal_title && (
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                    <TouchableOpacity
                      style={[styles.actionBtn, { flex: 1, borderColor: C.successFg + '50' }]}
                      onPress={() => handleFeedback(meal, 'approve')}
                      disabled={submitting}>
                      <Ionicons name="checkmark-circle-outline" size={14} color={C.successFg} />
                      <Text style={[styles.actionBtnText, { color: C.successFg }]}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, { flex: 1, borderColor: C.errorFg + '50' }]}
                      onPress={() => { setRejectReason(''); setRejectModal(meal); }}
                      disabled={submitting}>
                      <Ionicons name="close-circle-outline" size={14} color={C.errorFg} />
                      <Text style={[styles.actionBtnText, { color: C.errorFg }]}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Reject reason modal */}
      <Modal visible={!!rejectModal} transparent animationType="slide" onRequestClose={() => setRejectModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Reject meal</Text>
            <Text style={styles.modalSub}>Tell the cook why — they'll suggest a replacement.</Text>
            <TextInput style={[styles.input, styles.messageInput]}
              placeholder="e.g. recipient is allergic to seafood, prefers vegetarian…"
              placeholderTextColor={C.caps} multiline numberOfLines={3}
              value={rejectReason} onChangeText={setRejectReason} autoFocus />
            <TouchableOpacity
              style={[styles.primaryBtn, submitting && { opacity: 0.6 }]}
              onPress={() => rejectModal && handleFeedback(rejectModal, 'reject', rejectReason || undefined)}
              disabled={submitting}>
              {submitting ? <ActivityIndicator color={C.canvas} /> : <Text style={styles.primaryBtnText}>Send rejection</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setRejectModal(null)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

// ─── Redeem tab ───────────────────────────────────────────────────────────────

function RedeemTab() {
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [redeemed, setRedeemed] = useState<{ amount: number } | null>(null);
  const feedback = useFeedback();

  async function handleRedeem() {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) { feedback.warn('Enter a code', 'Paste or type your gift card code.'); return; }
    setLoading(true);
    try {
      const { credits_added } = await giftingApi.redeemGiftCard(trimmed);
      setRedeemed({ amount: credits_added });
    } catch (e: any) {
      feedback.error('Invalid code', e.message ?? 'This code could not be redeemed.');
    } finally {
      setLoading(false);
    }
  }

  if (redeemed) {
    return (
      <View style={styles.successWrap}>
        <View style={styles.successCard}>
          <View style={styles.successIcon}><Ionicons name="checkmark-circle-outline" size={32} color={C.successFg} /></View>
          <Text style={styles.successTitle}>Redeemed!</Text>
          <Text style={styles.successSub}>{fmtCurrency(redeemed.amount)} added to your wallet</Text>
          <TouchableOpacity style={styles.doneBtn} onPress={() => { setRedeemed(null); setCode(''); }}>
            <Text style={styles.doneBtnText}>Redeem another</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionLabel}>Enter your code</Text>
        <TextInput style={[styles.input, styles.codeInput]} placeholder="e.g. FBM-XXXXXXXX"
          placeholderTextColor={C.caps} value={code} onChangeText={t => setCode(t.toUpperCase())}
          autoCapitalize="characters" autoCorrect={false} />
        <TouchableOpacity style={[styles.primaryBtn, !code.trim() && { opacity: 0.45 }]}
          onPress={handleRedeem} disabled={loading || !code.trim()} activeOpacity={0.85}>
          {loading ? <ActivityIndicator color={C.canvas} /> : (
            <><Ionicons name="checkmark-circle-outline" size={18} color={C.canvas} />
              <Text style={styles.primaryBtnText}>Redeem code</Text></>
          )}
        </TouchableOpacity>
        <Text style={styles.note}>Credits are added instantly to your wallet and applied to your next order.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(C: AppColors) { return StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  topBar: { paddingHorizontal: Spacing.lg, paddingTop: 12, paddingBottom: 10 },
  pageTitle: { fontFamily: Fonts.serif, fontSize: 28, color: C.textInk },
  pageSub: { fontFamily: Fonts.sans, fontSize: 13, color: C.bodySoft, marginTop: 3 },

  tabRow: { flexDirection: 'row', marginHorizontal: Spacing.lg, marginBottom: 16,
    backgroundColor: C.bgCard, borderRadius: Radius.md, borderWidth: 0.5, borderColor: C.borderWarm, overflow: 'hidden' },
  tab: { flex: 1, paddingVertical: 11, alignItems: 'center' },
  tabActive: { backgroundColor: C.ink },
  tabText: { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.body },
  tabTextActive: { color: C.canvas },

  scroll: { padding: Spacing.lg, paddingTop: 4, gap: 10, paddingBottom: 60 },

  sectionLabel: { fontFamily: Fonts.sansMedium, fontSize: 11, color: C.caps, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  stepTitle: { fontFamily: Fonts.serif, fontSize: 22, color: C.textInk, marginBottom: 2 },
  stepSub: { fontFamily: Fonts.sans, fontSize: 13, color: C.bodySoft, lineHeight: 19, marginBottom: 6 },

  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: Spacing.lg },
  stepDot: { width: 26, height: 26, borderRadius: 13, backgroundColor: C.bgCard, borderWidth: 1.5, borderColor: C.borderWarm, alignItems: 'center', justifyContent: 'center' },
  stepDotActive: { backgroundColor: C.spice, borderColor: C.spice },
  stepDotDone: { backgroundColor: C.ink, borderColor: C.ink },
  stepNum: { fontFamily: Fonts.sansMedium, fontSize: 11, color: C.bodySoft },
  stepLine: { width: 32, height: 1.5, backgroundColor: C.borderWarm, marginHorizontal: 3 },
  stepLineDone: { backgroundColor: C.ink },

  typeCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: C.borderWarm, backgroundColor: C.bg },
  typeCardActive: { backgroundColor: C.ink, borderColor: C.ink },
  typeIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.bgCook, alignItems: 'center', justifyContent: 'center' },
  typeLabel: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.textInk },
  typeLabelActive: { color: C.canvas },
  typeDesc: { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft, marginTop: 2, lineHeight: 17 },
  typeDescActive: { color: 'rgba(255, 255, 255,0.65)' },

  planCard: { padding: 16, borderRadius: Radius.lg, borderWidth: 1, borderColor: C.borderWarm, backgroundColor: C.bgCard, gap: 6 },
  planCardActive: { backgroundColor: C.spice, borderColor: C.spice },
  planCardHighlight: { borderColor: C.spice },
  planBadge: { alignSelf: 'flex-start', backgroundColor: C.honey, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, marginBottom: 4 },
  planBadgeText: { fontFamily: Fonts.sansMedium, fontSize: 10, color: C.spice },
  planLabel: { fontFamily: Fonts.serif, fontSize: 18, color: C.textInk },
  planLabelActive: { color: C.canvas },
  planDuration: { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft, marginTop: 2 },
  planDurationActive: { color: 'rgba(255, 255, 255,0.7)' },
  planPrice: { fontFamily: Fonts.serif, fontSize: 20, color: C.spice },
  planPriceActive: { color: C.canvas },
  planPerDay: { fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft },
  planCheckRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },

  slotPill: { flex: 1, padding: 10, borderRadius: Radius.md, borderWidth: 1, borderColor: C.borderWarm, backgroundColor: C.bgCard, alignItems: 'center' },
  slotPillActive: { backgroundColor: C.ink, borderColor: C.ink },
  slotText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.textInk },
  slotTextActive: { color: C.canvas },
  slotTime: { fontFamily: Fonts.sans, fontSize: 10, color: C.bodySoft, marginTop: 2 },

  addOnCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14, borderRadius: Radius.lg,
    borderWidth: 1.5, borderColor: C.borderWarm, backgroundColor: C.bg, borderStyle: 'dashed' },
  addOnCardActive: { backgroundColor: C.ink, borderColor: C.ink, borderStyle: 'solid' },
  addOnIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.healthBg, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  addOnLabel: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.textInk },
  addOnLabelActive: { color: C.canvas },
  addOnDesc: { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft, marginTop: 2, lineHeight: 17 },
  addOnDescActive: { color: 'rgba(255, 255, 255,0.65)' },
  addOnCheck: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: C.borderWarm, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  addOnCheckActive: { backgroundColor: C.successFg, borderColor: C.successFg },

  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10,
    borderTopWidth: 0.5, borderTopColor: C.borderWarm, marginTop: 4 },
  totalLabel: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.bodySoft },
  totalPrice: { fontFamily: Fonts.serif, fontSize: 22, color: C.spice },

  summaryCard: { backgroundColor: C.bgCard, borderRadius: Radius.lg, padding: 16, borderWidth: 0.5, borderColor: C.borderWarm },
  summaryDivider: { height: 0.5, backgroundColor: C.borderWarm },

  infoChip: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: Radius.md, borderWidth: 0.5 },
  infoChipText: { fontFamily: Fonts.sans, fontSize: 12, color: C.body, flex: 1, lineHeight: 17 },

  amountGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  amountPill: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 40, backgroundColor: C.bgCard, borderWidth: 0.5, borderColor: C.borderWarm },
  amountPillActive: { backgroundColor: C.ink, borderColor: 'transparent' },
  amountText: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.body },
  amountTextActive: { color: C.canvas },

  input: { backgroundColor: C.bgCard, borderWidth: 0.5, borderColor: C.borderWarm, borderRadius: Radius.md,
    paddingHorizontal: 14, paddingVertical: 12, fontFamily: Fonts.sans, fontSize: 15, color: C.textInk },
  messageInput: { minHeight: 88, textAlignVertical: 'top' },
  codeInput: { fontFamily: Fonts.sansMedium, fontSize: 18, letterSpacing: 2, textAlign: 'center' },

  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: C.spice, borderRadius: Radius.lg, paddingVertical: 16 },
  primaryBtnText: { fontFamily: Fonts.sansMedium, fontSize: 15, color: C.canvas },
  backBtn: { width: 50, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bgCard,
    borderRadius: Radius.lg, borderWidth: 0.5, borderColor: C.borderWarm },

  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 40, borderWidth: 1, borderColor: C.borderWarm },
  actionBtnText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.body },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center',
    borderRadius: 18, borderWidth: 1, borderColor: C.borderWarm, backgroundColor: C.bgCard },

  note: { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft, textAlign: 'center', lineHeight: 17, marginTop: 4 },

  successWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  successCard: { width: '100%', backgroundColor: C.bgCard, borderRadius: Radius.lg, padding: 28,
    alignItems: 'center', gap: 10, borderWidth: 0.5, borderColor: C.borderWarm, ...Shadow.lift },
  successIcon: { width: 68, height: 68, borderRadius: 34, backgroundColor: C.bgCook, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  successTitle: { fontFamily: Fonts.serif, fontSize: 24, color: C.textInk },
  successSub: { fontFamily: Fonts.sans, fontSize: 14, color: C.bodySoft, textAlign: 'center', lineHeight: 20 },
  codeBox: { backgroundColor: C.bgCook, borderRadius: Radius.md, paddingHorizontal: 20, paddingVertical: 12, marginVertical: 4 },
  codeText: { fontFamily: Fonts.sansMedium, fontSize: 20, color: C.textInk, letterSpacing: 3 },
  codeValue: { fontFamily: Fonts.serif, fontSize: 16, color: C.spice },
  doneBtn: { marginTop: 8, paddingVertical: 12, paddingHorizontal: 28, backgroundColor: C.ink, borderRadius: Radius.lg },
  doneBtnText: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.canvas },

  cancelBtn: { alignItems: 'center', paddingVertical: 8 },
  cancelBtnText: { fontFamily: Fonts.sans, fontSize: 14, color: C.bodySoft },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: C.bgCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.lg, gap: 12, paddingBottom: 36 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: C.borderWarm, alignSelf: 'center', marginBottom: 4 },
  modalTitle: { fontFamily: Fonts.serif, fontSize: 20, color: C.textInk },
  modalSub: { fontFamily: Fonts.sans, fontSize: 13, color: C.bodySoft, lineHeight: 18, marginTop: -6 },
}); }
