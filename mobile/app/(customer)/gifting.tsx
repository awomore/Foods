import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { giftingApi } from '../../src/api/gifting';
import { Fonts, Spacing, Radius, Shadow } from '../../src/constants/theme';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { useFeedback } from '../../src/components/feedback';

type Tab = 'cards' | 'subscribe' | 'redeem';

// ─── Gift card amounts ────────────────────────────────────────────────────────
const AMOUNTS = [1000, 2500, 5000, 10000, 20000, 50000];

function fmtCurrency(n: number) {
  return '₦' + n.toLocaleString('en-NG', { maximumFractionDigits: 0 });
}

// ─── Subscription plans ───────────────────────────────────────────────────────

interface SubscriptionPlan {
  id: string;
  label: string;
  duration: string;
  days: number;
  basePrice: number;   // per meal per day × days
  badge?: string;
  highlight?: boolean;
}

const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  { id: 'weekly',    label: 'Weekly',    duration: '7 days',   days: 7,   basePrice: 35000 },
  { id: 'monthly',   label: 'Monthly',   duration: '30 days',  days: 30,  basePrice: 120000, badge: 'Popular', highlight: true },
  { id: 'quarterly', label: 'Quarterly', duration: '3 months', days: 90,  basePrice: 320000, badge: 'Save 11%' },
  { id: 'annual',    label: 'Annual',    duration: '12 months', days: 365, basePrice: 1100000, badge: 'Save 18%' },
];

interface SubscriptionType {
  id: string;
  icon: string;
  label: string;
  desc: string;
}

const SUBSCRIPTION_TYPES: SubscriptionType[] = [
  { id: 'daily',     icon: 'restaurant-outline',   label: 'Daily meals',          desc: 'Breakfast, lunch or dinner delivered every day' },
  { id: 'senior',    icon: 'heart-outline',         label: 'Senior care',          desc: 'Nutritious home-cooked meals for an elderly loved one' },
  { id: 'wellness',  icon: 'leaf-outline',          label: 'Health & wellness',    desc: 'Dietician-curated clean eating plan' },
  { id: 'office',    icon: 'briefcase-outline',     label: 'Office lunch',         desc: 'Weekday lunches for someone at work' },
  { id: 'birthday',  icon: 'gift-outline',          label: 'Birthday surprise',    desc: 'Monthly surprise meals celebrating their special month' },
  { id: 'family',    icon: 'people-outline',        label: 'Family plan',          desc: 'Recurring meals for the whole household' },
];

const MEAL_SLOTS = [
  { id: 'breakfast', label: 'Breakfast', time: '6am – 11am' },
  { id: 'lunch',     label: 'Lunch',     time: '12pm – 4pm' },
  { id: 'dinner',    label: 'Dinner',    time: '5pm – 9pm' },
];

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function GiftingScreen() {
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [tab, setTab] = useState<Tab>('cards');

  const TABS: { id: Tab; label: string }[] = [
    { id: 'cards',     label: 'Gift card' },
    { id: 'subscribe', label: 'Subscribe' },
    { id: 'redeem',    label: 'Redeem' },
  ];

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: C.bg }}>
        <View style={styles.topBar}>
          <Text style={styles.pageTitle}>Gifting</Text>
          <Text style={styles.pageSub}>Give the gift of real home-cooked food</Text>
        </View>
      </SafeAreaView>

      <View style={styles.tabRow}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.id}
            onPress={() => setTab(t.id)}
            style={[styles.tab, tab === t.id && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === t.id && styles.tabTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'cards'     && <BuyTab />}
      {tab === 'subscribe' && <SubscribeTab />}
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
      feedback.warn('Amount required', 'Minimum gift card value is ₦500.');
      return;
    }
    setLoading(true);
    try {
      const { gift_card } = await giftingApi.purchaseGiftCard({
        amount: selectedAmount,
        currency_code: 'NGN',
        recipient_name: recipientName || undefined,
        recipient_phone: recipientPhone || undefined,
        message: message || undefined,
      });
      setDone({ code: gift_card.code, amount: gift_card.amount });
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

        <TextInput style={styles.input} placeholder="Or enter a custom amount (₦)"
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
            <>
              <Ionicons name="gift-outline" size={18} color={C.canvas} />
              <Text style={styles.primaryBtnText}>
                {selectedAmount ? `Buy ${fmtCurrency(selectedAmount)} gift card` : 'Buy gift card'}
              </Text>
            </>
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
  const [mealSlot, setMealSlot] = useState<string | null>(null);
  const [addDietician, setAddDietician] = useState(false);
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [preferences, setPreferences] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const selectedPlan = SUBSCRIPTION_PLANS.find(p => p.id === plan);
  const selectedType = SUBSCRIPTION_TYPES.find(t => t.id === subType);
  const dieticianFee = 15000;
  const totalPrice = selectedPlan
    ? selectedPlan.basePrice + (addDietician ? dieticianFee : 0)
    : 0;

  function goBack() {
    if (step === 'plan')    setStep('type');
    if (step === 'details') setStep('plan');
    if (step === 'confirm') setStep('details');
  }

  async function handleSubmit() {
    if (!recipientName.trim() || !recipientPhone.trim() || !recipientAddress.trim()) {
      feedback.warn('Required fields', 'Please fill in recipient name, phone, and address.');
      return;
    }
    setLoading(true);
    try {
      await giftingApi.createSubscription?.({
        plan_id: plan!,
        sub_type: subType!,
        meal_slot: mealSlot,
        add_dietician: addDietician,
        recipient_name: recipientName,
        recipient_phone: recipientPhone,
        recipient_address: recipientAddress,
        preferences: preferences || undefined,
      });
      setDone(true);
    } catch (e: any) {
      feedback.error('Could not create subscription', e.message ?? 'Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setStep('type'); setSubType(null); setPlan(null); setMealSlot(null);
    setAddDietician(false); setRecipientName(''); setRecipientPhone('');
    setRecipientAddress(''); setPreferences(''); setDone(false);
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
            {recipientName} will receive {selectedPlan?.label.toLowerCase()} home-cooked meals.
            {addDietician ? '\nA dietician will reach out within 24 hours to plan their menu.' : ''}
          </Text>
          {addDietician && (
            <View style={[styles.infoChip, { backgroundColor: C.healthBg, borderColor: C.leaf }]}>
              <Ionicons name="leaf" size={14} color={C.healthFg} />
              <Text style={[styles.infoChipText, { color: C.healthFg }]}>Dietician onboarding in progress</Text>
            </View>
          )}
          <TouchableOpacity style={styles.doneBtn} onPress={reset}>
            <Text style={styles.doneBtnText}>Gift to someone else</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Step indicator */}
      <View style={styles.stepRow}>
        {(['type', 'plan', 'details', 'confirm'] as SubscribeStep[]).map((s, i) => (
          <View key={s} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={[styles.stepDot, step === s && styles.stepDotActive,
              (['type','plan','details','confirm'].indexOf(step) > i) && styles.stepDotDone]}>
              <Text style={[styles.stepNum,
                step === s && { color: C.canvas },
                (['type','plan','details','confirm'].indexOf(step) > i) && { color: C.canvas }
              ]}>{i + 1}</Text>
            </View>
            {i < 3 && <View style={[styles.stepLine, (['type','plan','details','confirm'].indexOf(step) > i) && styles.stepLineDone]} />}
          </View>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* STEP 1: Choose subscription type */}
        {step === 'type' && (
          <View style={{ gap: 10 }}>
            <Text style={styles.stepTitle}>What kind of subscription?</Text>
            <Text style={styles.stepSub}>Choose the plan that fits the recipient best.</Text>
            {SUBSCRIPTION_TYPES.map(t => (
              <TouchableOpacity
                key={t.id}
                style={[styles.typeCard, subType === t.id && styles.typeCardActive]}
                onPress={() => setSubType(t.id)}
                activeOpacity={0.8}
              >
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
            <TouchableOpacity
              style={[styles.primaryBtn, !subType && { opacity: 0.4 }]}
              onPress={() => subType && setStep('plan')}
              disabled={!subType}
            >
              <Text style={styles.primaryBtnText}>Continue</Text>
              <Ionicons name="arrow-forward" size={16} color={C.canvas} />
            </TouchableOpacity>
          </View>
        )}

        {/* STEP 2: Choose plan duration */}
        {step === 'plan' && (
          <View style={{ gap: 12 }}>
            <Text style={styles.stepTitle}>Choose a plan</Text>
            <Text style={styles.stepSub}>All plans include daily deliveries from vetted home cooks.</Text>

            {SUBSCRIPTION_PLANS.map(p => (
              <TouchableOpacity
                key={p.id}
                style={[styles.planCard, plan === p.id && styles.planCardActive, p.highlight && styles.planCardHighlight]}
                onPress={() => setPlan(p.id)}
                activeOpacity={0.85}
              >
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
                    <Text style={[styles.planPrice, plan === p.id && styles.planPriceActive]}>{fmtCurrency(p.basePrice)}</Text>
                    <Text style={[styles.planPerDay, plan === p.id && { color: 'rgba(250,246,240,0.6)' }]}>
                      {fmtCurrency(Math.round(p.basePrice / p.days))}/day
                    </Text>
                  </View>
                </View>
                {plan === p.id && (
                  <View style={styles.planCheckRow}>
                    <Ionicons name="checkmark-circle" size={16} color={C.canvas} />
                    <Text style={{ fontFamily: Fonts.sans, fontSize: 12, color: 'rgba(250,246,240,0.8)' }}>Selected</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}

            {/* Meal slot */}
            <Text style={[styles.sectionLabel, { marginTop: 8 }]}>Preferred meal time</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {MEAL_SLOTS.map(s => (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.slotPill, mealSlot === s.id && styles.slotPillActive]}
                  onPress={() => setMealSlot(mealSlot === s.id ? null : s.id)}
                >
                  <Text style={[styles.slotText, mealSlot === s.id && styles.slotTextActive]}>{s.label}</Text>
                  <Text style={[styles.slotTime, mealSlot === s.id && { color: 'rgba(250,246,240,0.7)' }]}>{s.time}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Dietician add-on */}
            <TouchableOpacity
              style={[styles.addOnCard, addDietician && styles.addOnCardActive]}
              onPress={() => setAddDietician(v => !v)}
              activeOpacity={0.8}
            >
              <View style={[styles.addOnIcon, addDietician && { backgroundColor: 'rgba(255,255,255,0.12)' }]}>
                <Ionicons name="medkit-outline" size={20} color={addDietician ? C.canvas : C.healthFg} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.addOnLabel, addDietician && styles.addOnLabelActive]}>Add a dietician/nutritionist</Text>
                <Text style={[styles.addOnDesc, addDietician && styles.addOnDescActive]}>
                  A certified nutritionist will design every meal for the recipient's specific health goals, allergies, and restrictions. +{fmtCurrency(dieticianFee)}
                </Text>
              </View>
              <View style={[styles.addOnCheck, addDietician && styles.addOnCheckActive]}>
                {addDietician && <Ionicons name="checkmark" size={14} color={C.canvas} />}
              </View>
            </TouchableOpacity>

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalPrice}>{plan ? fmtCurrency(totalPrice) : '—'}</Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
              <TouchableOpacity style={styles.backBtn} onPress={goBack}>
                <Ionicons name="arrow-back" size={16} color={C.body} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryBtn, { flex: 1 }, !plan && { opacity: 0.4 }]}
                onPress={() => plan && setStep('details')}
                disabled={!plan}
              >
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
            <Text style={styles.stepSub}>
              {addDietician
                ? 'Our nutritionist will contact the recipient before meals begin.'
                : 'We\'ll coordinate delivery directly with the recipient.'}
            </Text>

            <Text style={styles.sectionLabel}>Recipient details</Text>
            <TextInput style={styles.input} placeholder="Full name *" placeholderTextColor={C.caps}
              value={recipientName} onChangeText={setRecipientName} />
            <TextInput style={styles.input} placeholder="Phone number * (e.g. 2348012345678)"
              placeholderTextColor={C.caps} keyboardType="phone-pad"
              value={recipientPhone} onChangeText={setRecipientPhone} />
            <TextInput style={[styles.input, { minHeight: 72, textAlignVertical: 'top' }]}
              placeholder="Delivery address *" placeholderTextColor={C.caps}
              multiline value={recipientAddress} onChangeText={setRecipientAddress} />

            <Text style={[styles.sectionLabel, { marginTop: 4 }]}>Meal preferences & notes</Text>
            <TextInput style={[styles.input, styles.messageInput]}
              placeholder="e.g. no pork, prefers Yoruba cuisine, diabetic-friendly, low sodium…"
              placeholderTextColor={C.caps} multiline numberOfLines={4}
              value={preferences} onChangeText={setPreferences} />

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
              <SummaryRow label="Type" value={selectedType?.label ?? '—'} />
              <SummaryRow label="Plan" value={`${selectedPlan?.label} (${selectedPlan?.duration})`} />
              {mealSlot && <SummaryRow label="Meal time" value={MEAL_SLOTS.find(s => s.id === mealSlot)?.label ?? mealSlot} />}
              <SummaryRow label="Recipient" value={recipientName} />
              <SummaryRow label="Phone" value={recipientPhone} />
              {addDietician && <SummaryRow label="Add-on" value="Dietician / nutritionist" highlight />}
              <View style={[styles.summaryDivider, { marginVertical: 10 }]} />
              <SummaryRow label="Total" value={fmtCurrency(totalPrice)} bold />
            </View>

            <View style={[styles.infoChip, { backgroundColor: C.honey, borderColor: C.borderWarm }]}>
              <Ionicons name="information-circle-outline" size={14} color={C.body} />
              <Text style={styles.infoChipText}>
                Payment is collected at the next step. You can pause or cancel at any time from your account.
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={styles.backBtn} onPress={goBack}>
                <Ionicons name="arrow-back" size={16} color={C.body} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryBtn, { flex: 1 }]}
                onPress={handleSubmit}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading
                  ? <ActivityIndicator color={C.canvas} />
                  : <>
                      <Ionicons name="heart-outline" size={18} color={C.canvas} />
                      <Text style={styles.primaryBtnText}>Start subscription</Text>
                    </>
                }
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
          <Text style={styles.successSub}>{fmtCurrency(redeemed.amount)} added to your account</Text>
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
        <TextInput style={[styles.input, styles.codeInput]} placeholder="e.g. GC-XXXX-XXXX-XXXX"
          placeholderTextColor={C.caps} value={code} onChangeText={t => setCode(t.toUpperCase())}
          autoCapitalize="characters" autoCorrect={false} />
        <TouchableOpacity style={[styles.primaryBtn, !code.trim() && { opacity: 0.45 }]}
          onPress={handleRedeem} disabled={loading || !code.trim()} activeOpacity={0.85}>
          {loading ? <ActivityIndicator color={C.canvas} /> : (
            <>
              <Ionicons name="checkmark-circle-outline" size={18} color={C.canvas} />
              <Text style={styles.primaryBtnText}>Redeem code</Text>
            </>
          )}
        </TouchableOpacity>
        <Text style={styles.note}>Credits are added instantly and applied to your next order.</Text>
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
  tabText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.body },
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

  // Type cards
  typeCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: C.borderWarm, backgroundColor: C.bg },
  typeCardActive: { backgroundColor: C.ink, borderColor: C.ink },
  typeIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.bgCook, alignItems: 'center', justifyContent: 'center' },
  typeLabel: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.textInk },
  typeLabelActive: { color: C.canvas },
  typeDesc: { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft, marginTop: 2, lineHeight: 17 },
  typeDescActive: { color: 'rgba(250,246,240,0.65)' },

  // Plan cards
  planCard: { padding: 16, borderRadius: Radius.lg, borderWidth: 1, borderColor: C.borderWarm, backgroundColor: C.bgCard, gap: 6 },
  planCardActive: { backgroundColor: C.spice, borderColor: C.spice },
  planCardHighlight: { borderColor: C.spice },
  planBadge: { alignSelf: 'flex-start', backgroundColor: C.honey, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, marginBottom: 4 },
  planBadgeText: { fontFamily: Fonts.sansMedium, fontSize: 10, color: C.spice },
  planLabel: { fontFamily: Fonts.serif, fontSize: 18, color: C.textInk },
  planLabelActive: { color: C.canvas },
  planDuration: { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft, marginTop: 2 },
  planDurationActive: { color: 'rgba(250,246,240,0.7)' },
  planPrice: { fontFamily: Fonts.serif, fontSize: 20, color: C.spice },
  planPriceActive: { color: C.canvas },
  planPerDay: { fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft },
  planCheckRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },

  // Meal slots
  slotPill: { flex: 1, padding: 10, borderRadius: Radius.md, borderWidth: 1, borderColor: C.borderWarm, backgroundColor: C.bgCard, alignItems: 'center' },
  slotPillActive: { backgroundColor: C.ink, borderColor: C.ink },
  slotText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.textInk },
  slotTextActive: { color: C.canvas },
  slotTime: { fontFamily: Fonts.sans, fontSize: 10, color: C.bodySoft, marginTop: 2 },

  // Add-on
  addOnCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14, borderRadius: Radius.lg,
    borderWidth: 1.5, borderColor: C.borderWarm, backgroundColor: C.bg, borderStyle: 'dashed' },
  addOnCardActive: { backgroundColor: C.ink, borderColor: C.ink, borderStyle: 'solid' },
  addOnIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.healthBg, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  addOnLabel: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.textInk },
  addOnLabelActive: { color: C.canvas },
  addOnDesc: { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft, marginTop: 2, lineHeight: 17 },
  addOnDescActive: { color: 'rgba(250,246,240,0.65)' },
  addOnCheck: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: C.borderWarm, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  addOnCheckActive: { backgroundColor: C.successFg, borderColor: C.successFg },

  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10,
    borderTopWidth: 0.5, borderTopColor: C.borderWarm, marginTop: 4 },
  totalLabel: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.bodySoft },
  totalPrice: { fontFamily: Fonts.serif, fontSize: 22, color: C.spice },

  // Summary
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
}); }
