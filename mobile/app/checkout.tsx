import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal, ActivityIndicator, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import GooglePlacesInput from '../src/components/ui/GooglePlacesInput';
import { useCart } from '../src/context/CartContext';
import { paymentsApi } from '../src/api/payments';
import { ordersApi } from '../src/api/orders';
import { coursesApi } from '../src/api/courses';
import { digitalProductsApi } from '../src/api/digitalProducts';
import { useAuth } from '../src/context/AuthContext';
import { api } from '../src/api/client';
import { walletApi } from '../src/api/wallet';
import { trackEvent } from '../src/utils/analytics';
import { useColors, type AppColors } from '../src/context/ThemeContext';
import { useFeedback } from '../src/components/feedback';
import { Fonts, Spacing, Radius, Shadow } from '../src/constants/theme';
import { SUPPORT_WHATSAPP } from '../src/constants/contact';
import { fmtCurrency, shortOrderRef } from '../src/utils/format';

const FLUTTERWAVE_PK = process.env.EXPO_PUBLIC_FLUTTERWAVE_PK ?? 'FLWPUBK_TEST-XXXX';



const TIP_PRESETS = [
  { label: 'Skip', value: 0 },
  { label: '5%',  pct: 0.05 },
  { label: '10%', pct: 0.10 },
  { label: '15%', pct: 0.15 },
];

// ── Direct-purchase flow (courses, digital products) ─────────────────────────
function DirectPurchase() {
  const router = useRouter();
  const { mode, course_id, product_id, amount, title, currency } = useLocalSearchParams<{
    mode: string; course_id?: string; product_id?: string;
    amount: string; title: string; currency?: string;
  }>();
  const { user } = useAuth();
  const C = useColors();
  const { t } = useTranslation();
  const feedback = useFeedback();

  const itemId = (course_id ?? product_id) as string;
  const orderTotal = Number(amount ?? 0);
  const curr = currency ?? 'NGN';
  const platformFee = mode === 'product' ? Math.round(orderTotal * 0.05) : 0;
  const chargeAmount = orderTotal + platformFee;

  const [txRef, setTxRef] = useState<string | null>(null);
  const [showFW, setShowFW] = useState(false);
  const [paying, setPaying] = useState(false);

  async function handleSuccess(ref: string, transactionId?: string, devMode = false) {
    try {
      if (!devMode) {
        await paymentsApi.verify({ tx_ref: ref, transaction_id: transactionId, expected_amount: chargeAmount });
      }
      if (mode === 'course') {
        await coursesApi.enroll(itemId, { tx_ref: ref, amount_paid: orderTotal });
        feedback.success('Enrolled!', 'You can now access all course lessons.');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.back();
      } else {
        await digitalProductsApi.purchase(itemId, { tx_ref: ref, amount_paid: orderTotal });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        feedback.success('Purchase complete!', 'Your download is ready.');
        router.replace(`/product/${itemId}` as any);
      }
    } catch (e: any) {
      feedback.error('Payment error', e.error ?? 'Payment succeeded but fulfilment failed. Contact support.');
    }
  }

  async function initPay() {
    setPaying(true);
    try {
      const res = await paymentsApi.initiate({
        amount: chargeAmount,
        currency: curr,
        redirect_url: 'foodsbyme://payment-complete',
        meta: { mode, item_id: itemId, user_id: user?.id, platform_fee: platformFee },
      });
      setTxRef(res.tx_ref);
      if (res.dev_mode) { await handleSuccess(res.tx_ref, undefined, true); return; }
      setShowFW(true);
    } catch (e: any) {
      feedback.error('Payment failed', e.message ?? 'Could not start payment. Try again.');
    } finally {
      setPaying(false);
    }
  }

  function handleFWMessage(event: any) {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.status === 'successful' || data.event === 'payment.completed') {
        setShowFW(false);
        if (txRef) handleSuccess(txRef, data.transaction_id);
      } else if (data.status === 'cancelled' || data.event === 'modal.closed') {
        setShowFW(false);
      }
    } catch {}
  }

  const safeCustomer = JSON.stringify({
    email: user?.email ?? 'customer@foodsbyme.com',
    name: user?.full_name ?? 'Customer',
    phone_number: user?.phone ?? '',
  });
  const safeCustomizations = JSON.stringify({ title: 'FOODS', description: title ?? 'Purchase', logo: 'https://foodsbyme.com/icon.png' });

  const fwHtml = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#FFFFFF;display:flex;align-items:center;justify-content:center;height:100vh;">
<script src="https://checkout.flutterwave.com/v3.js"></script>
<script>
var customer=${safeCustomer};var customizations=${safeCustomizations};
window.onload=function(){FlutterwaveCheckout({
  public_key:${JSON.stringify(FLUTTERWAVE_PK)},tx_ref:${JSON.stringify(txRef??'')},
  amount:${chargeAmount},currency:${JSON.stringify(curr)},customer:customer,customizations:customizations,
  callback:function(d){window.ReactNativeWebView.postMessage(JSON.stringify({status:d.status,event:"payment.completed",transaction_id:d.transaction_id}))},
  onclose:function(){window.ReactNativeWebView.postMessage(JSON.stringify({event:"modal.closed",status:"cancelled"}))}
})};
</script></body></html>`;

  const icon = mode === 'course' ? 'school-outline' : 'document-outline';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.borderWarm }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={{ width: 44, alignItems: 'flex-start' }}>
          <Ionicons name="chevron-back" size={22} color={C.textInk} />
        </TouchableOpacity>
        <Text style={{ flex: 1, textAlign: 'center', fontFamily: Fonts.sansMedium, fontSize: 16, color: C.textInk }}>
          {mode === 'course' ? t('checkout.enrol_course') : t('checkout.buy_product')}
        </Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: Spacing.lg, gap: 16 }}>
        <View style={{ backgroundColor: C.bgCard, borderRadius: Radius.lg, padding: 20, borderWidth: 0.5, borderColor: C.borderWarm, alignItems: 'center', gap: 12 }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: C.ember, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={icon as any} size={30} color={C.spice} />
          </View>
          <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 17, color: C.textInk, textAlign: 'center' }} numberOfLines={3}>{title}</Text>
          <Text style={{ fontFamily: Fonts.serif, fontSize: 26, color: C.spice }}>{fmtCurrency(orderTotal, curr)}</Text>
        </View>

        <View style={{ backgroundColor: C.bgCard, borderRadius: Radius.lg, padding: 16, borderWidth: 0.5, borderColor: C.borderWarm }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ fontFamily: Fonts.sans, fontSize: 14, color: C.bodySoft }}>{mode === 'course' ? t('checkout.enrolment_fee') : t('checkout.product_price')}</Text>
            <Text style={{ fontFamily: Fonts.sans, fontSize: 14, color: C.textInk }}>{fmtCurrency(orderTotal, curr)}</Text>
          </View>
          {platformFee > 0 && (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ fontFamily: Fonts.sans, fontSize: 14, color: C.bodySoft }}>{t('checkout.platform_fee')}</Text>
              <Text style={{ fontFamily: Fonts.sans, fontSize: 14, color: C.textInk }}>{fmtCurrency(platformFee, curr)}</Text>
            </View>
          )}
          <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: C.borderWarm, marginVertical: 8 }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 15, color: C.textInk }}>{t('checkout.total')}</Text>
            <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 15, color: C.spice }}>{fmtCurrency(chargeAmount, curr)}</Text>
          </View>
        </View>
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={{ paddingHorizontal: Spacing.lg, paddingTop: 12, paddingBottom: 8, backgroundColor: C.bg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.borderWarm }}>
        <TouchableOpacity
          onPress={initPay}
          disabled={paying}
          style={{ backgroundColor: C.spice, borderRadius: Radius.full, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, opacity: paying ? 0.6 : 1 }}
        >
          {paying ? <ActivityIndicator color="#fff" /> : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="lock-closed-outline" size={15} color="rgba(255,255,255,0.7)" />
              <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 15, color: '#fff' }}>{t('checkout.pay_secure')}</Text>
            </View>
          )}
          <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 16, color: '#fff' }}>{fmtCurrency(chargeAmount, curr)}</Text>
        </TouchableOpacity>
        <Text style={{ fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft, textAlign: 'center', marginTop: 6 }}>Secured by Flutterwave</Text>
      </SafeAreaView>

      <Modal visible={showFW} animationType="slide" onRequestClose={() => setShowFW(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.borderWarm }}>
            <TouchableOpacity onPress={() => setShowFW(false)}><Ionicons name="close" size={22} color={C.textInk} /></TouchableOpacity>
            <Text style={{ flex: 1, textAlign: 'center', fontFamily: Fonts.sansMedium, fontSize: 16, color: C.textInk }}>{t('checkout.secure_payment')}</Text>
            <View style={{ width: 22 }} />
          </View>
          <WebView source={{ html: fwHtml }} onMessage={handleFWMessage} javaScriptEnabled domStorageEnabled startInLoadingState
            renderLoading={() => <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator size="large" color={C.spice} /></View>}
            style={{ flex: 1 }} />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// ── Deposit flow (catering / private-chef booking) ───────────────────────────
function DepositPurchase() {
  const router = useRouter();
  const { mode, ref: eventRef, booking_id, amount, title, currency } = useLocalSearchParams<{
    mode: string; ref?: string; booking_id?: string; amount: string; title?: string; currency?: string;
  }>();
  const resolvedRef = (eventRef ?? booking_id) as string;
  const { user } = useAuth();
  const C = useColors();
  const { t } = useTranslation();
  const feedback = useFeedback();

  const depositAmount = Number(amount ?? 0);
  const curr = currency ?? 'NGN';
  const platformFee = Math.round(depositAmount * 0.05);
  const chargeAmount = depositAmount + platformFee;
  const isCatering = mode === 'catering_deposit';

  const [txRef, setTxRef] = useState<string | null>(null);
  const [showFW, setShowFW] = useState(false);
  const [paying, setPaying] = useState(false);

  async function handleSuccess(ref: string, transactionId?: string) {
    try {
      const endpoint = isCatering
        ? `/catering/${resolvedRef}/deposit-paid`
        : `/private-chef/${resolvedRef}/deposit-paid`;
      await api.patch(endpoint, { tx_ref: ref, transaction_id: transactionId, platform_fee: platformFee });
      feedback.success('Deposit paid!', 'Your deposit has been recorded. The team will be in touch shortly.');
      router.back();
    } catch (e: any) {
      feedback.error('Payment error', e.error ?? 'Payment succeeded but could not be confirmed. Contact support.');
    }
  }

  async function initPay() {
    setPaying(true);
    try {
      const res = await paymentsApi.initiate({
        amount: chargeAmount,
        currency: curr,
        redirect_url: 'foodsbyme://payment-complete',
        meta: { mode, event_id: resolvedRef, user_id: user?.id, platform_fee: platformFee },
      });
      setTxRef(res.tx_ref);
      if (res.dev_mode) { await handleSuccess(res.tx_ref); return; }
      setShowFW(true);
    } catch (e: any) {
      feedback.error('Payment failed', e.message ?? 'Could not start payment. Try again.');
    } finally {
      setPaying(false);
    }
  }

  function handleFWMessage(event: any) {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.status === 'successful' || data.event === 'payment.completed') {
        setShowFW(false);
        if (txRef) handleSuccess(txRef, data.transaction_id);
      } else if (data.status === 'cancelled' || data.event === 'modal.closed') {
        setShowFW(false);
      }
    } catch {}
  }

  const safeCustomer = JSON.stringify({
    email: user?.email ?? 'customer@foodsbyme.com',
    name: user?.full_name ?? 'Customer',
    phone_number: user?.phone ?? '',
  });
  const safeCustomizations = JSON.stringify({ title: 'FOODS', description: title ?? (isCatering ? 'Catering deposit' : 'Booking deposit'), logo: 'https://foodsbyme.com/icon.png' });

  const fwHtml = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#FFFFFF;display:flex;align-items:center;justify-content:center;height:100vh;">
<script src="https://checkout.flutterwave.com/v3.js"></script>
<script>
var customer=${safeCustomer};var customizations=${safeCustomizations};
window.onload=function(){FlutterwaveCheckout({
  public_key:${JSON.stringify(FLUTTERWAVE_PK)},tx_ref:${JSON.stringify(txRef??'')},
  amount:${chargeAmount},currency:${JSON.stringify(curr)},customer:customer,customizations:customizations,
  callback:function(d){window.ReactNativeWebView.postMessage(JSON.stringify({status:d.status,event:"payment.completed",transaction_id:d.transaction_id}))},
  onclose:function(){window.ReactNativeWebView.postMessage(JSON.stringify({event:"modal.closed",status:"cancelled"}))}
})};
</script></body></html>`;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.borderWarm }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={{ width: 44, alignItems: 'flex-start' }}>
          <Ionicons name="chevron-back" size={22} color={C.textInk} />
        </TouchableOpacity>
        <Text style={{ flex: 1, textAlign: 'center', fontFamily: Fonts.sansMedium, fontSize: 16, color: C.textInk }}>
          {isCatering ? t('checkout.pay_catering_deposit') : t('checkout.pay_booking_deposit')}
        </Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: Spacing.lg, gap: 16 }}>
        <View style={{ backgroundColor: C.bgCard, borderRadius: Radius.lg, padding: 20, borderWidth: 0.5, borderColor: C.borderWarm, alignItems: 'center', gap: 12 }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: C.honey, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={isCatering ? 'restaurant-outline' : 'person-outline'} size={30} color={C.spice} />
          </View>
          {title ? <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 17, color: C.textInk, textAlign: 'center' }} numberOfLines={2}>{title}</Text> : null}
          <Text style={{ fontFamily: Fonts.serif, fontSize: 26, color: C.spice }}>{fmtCurrency(depositAmount, curr)}</Text>
          <Text style={{ fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft, textAlign: 'center' }}>
            {isCatering ? t('checkout.catering_deposit_note') : t('checkout.booking_deposit_note')}
          </Text>
        </View>

        <View style={{ backgroundColor: C.bgCard, borderRadius: Radius.lg, padding: 16, borderWidth: 0.5, borderColor: C.borderWarm, gap: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: Fonts.sans, fontSize: 14, color: C.bodySoft }}>{t('checkout.deposit_amount')}</Text>
            <Text style={{ fontFamily: Fonts.sans, fontSize: 14, color: C.textInk }}>{fmtCurrency(depositAmount, curr)}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: Fonts.sans, fontSize: 14, color: C.bodySoft }}>{t('checkout.platform_fee')}</Text>
            <Text style={{ fontFamily: Fonts.sans, fontSize: 14, color: C.textInk }}>{fmtCurrency(platformFee, curr)}</Text>
          </View>
          <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: C.borderWarm }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 15, color: C.textInk }}>{t('checkout.total_now')}</Text>
            <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 15, color: C.spice }}>{fmtCurrency(chargeAmount, curr)}</Text>
          </View>
        </View>

        <View style={{ backgroundColor: C.bgCook, borderRadius: Radius.md, padding: 14, flexDirection: 'row', gap: 10 }}>
          <Ionicons name="information-circle-outline" size={18} color={C.bodySoft} style={{ marginTop: 1 }} />
          <Text style={{ fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft, lineHeight: 18, flex: 1 }}>
            {t('checkout.deposit_info')}
          </Text>
        </View>
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={{ paddingHorizontal: Spacing.lg, paddingTop: 12, paddingBottom: 8, backgroundColor: C.bg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.borderWarm }}>
        <TouchableOpacity
          onPress={initPay}
          disabled={paying}
          style={{ backgroundColor: C.spice, borderRadius: Radius.full, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, opacity: paying ? 0.6 : 1 }}
        >
          {paying ? <ActivityIndicator color="#fff" /> : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="lock-closed-outline" size={15} color="rgba(255,255,255,0.7)" />
              <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 15, color: '#fff' }}>{t('checkout.pay_deposit_secure')}</Text>
            </View>
          )}
          <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 16, color: '#fff' }}>{fmtCurrency(chargeAmount, curr)}</Text>
        </TouchableOpacity>
        <Text style={{ fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft, textAlign: 'center', marginTop: 6 }}>Secured by Flutterwave</Text>
      </SafeAreaView>

      <Modal visible={showFW} animationType="slide" onRequestClose={() => setShowFW(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.borderWarm }}>
            <TouchableOpacity onPress={() => setShowFW(false)}><Ionicons name="close" size={22} color={C.textInk} /></TouchableOpacity>
            <Text style={{ flex: 1, textAlign: 'center', fontFamily: Fonts.sansMedium, fontSize: 16, color: C.textInk }}>{t('checkout.secure_payment')}</Text>
            <View style={{ width: 22 }} />
          </View>
          <WebView source={{ html: fwHtml }} onMessage={handleFWMessage} javaScriptEnabled domStorageEnabled startInLoadingState
            renderLoading={() => <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator size="large" color={C.spice} /></View>}
            style={{ flex: 1 }} />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

export default function CheckoutScreen() {
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const { items, total, currencyCode, clear, removeItem, updateQty } = useCart();
  const { user } = useAuth();
  const C = useColors();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(C), [C]);

  const DELIVERY_SLOTS = useMemo(() => [
    { id: 'asap',     label: t('checkout.asap'),    desc: t('checkout.typical') },
    { id: 'lunch',    label: t('checkout.lunch'),   desc: t('checkout.today') },
    { id: 'dinner',   label: t('checkout.dinner'),  desc: t('checkout.today') },
    { id: 'tomorrow', label: t('checkout.tomorrow'), desc: t('checkout.before_noon') },
  ], [t]);

  const [deliveryType, setDeliveryType] = useState<'delivery' | 'pickup'>('delivery');
  const [selectedSlotId, setSelectedSlotId] = useState('asap');
  const [savedAddresses, setSavedAddresses] = useState<string[]>([]);
  const [defaultAddrIdx, setDefaultAddrIdx] = useState(0);
  const [address, setAddress] = useState('');
  const [showAddressPicker, setShowAddressPicker] = useState(false);
  const [showAddressAutoComplete, setShowAddressAutoComplete] = useState(false);
  const [note, setNote] = useState('');
  const [tipPreset, setTipPreset] = useState(0);      // index into TIP_PRESETS
  const [customTipText, setCustomTipText] = useState('');
  const [showFW, setShowFW] = useState(false);
  const [paying, setPaying] = useState(false);
  const [txRef, setTxRef] = useState<string | null>(null);
  const feedback = useFeedback();
  const [error, setError] = useState<string | null>(null);
  const [showAllergenWarning, setShowAllergenWarning] = useState(false);
  const [checkoutAllergenAcked, setCheckoutAllergenAcked] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [payMethod, setPayMethod] = useState<'card' | 'wallet'>('card');
  const [processingWallet, setProcessingWallet] = useState(false);
  const [showTopup, setShowTopup] = useState(false);
  const [topupTxRef, setTopupTxRef] = useState<string | null>(null);
  const [topupAmount, setTopupAmount] = useState(0);
  const [showEscrowBanner, setShowEscrowBanner] = useState(false);
  const [deliveryFeeMethod, setDeliveryFeeMethod] = useState<'wallet' | 'cash' | 'transfer'>('wallet');

  // Compute tip amount
  const tipAmount = useMemo(() => {
    const preset = TIP_PRESETS[tipPreset];
    if (!preset) return 0;
    if (preset.value === 0) return 0;
    if ('pct' in preset) return Math.round(total * (preset as any).pct);
    const n = parseFloat(customTipText);
    return isNaN(n) ? 0 : Math.round(n);
  }, [tipPreset, customTipText, total]);

  const subtotal = total + tipAmount;
  const foodPlatformFee = Math.min(Math.round(subtotal * 0.05), 5000);
  const orderTotal = subtotal + foodPlatformFee;
  const walletShortfall = walletBalance !== null ? Math.max(0, orderTotal - walletBalance) : orderTotal;
  const walletCoversOrder = walletBalance !== null && walletBalance >= orderTotal;

  const byCook = useMemo(() =>
    items.reduce<Record<string, typeof items>>((acc, item) => {
      (acc[item.cookId] = acc[item.cookId] ?? []).push(item);
      return acc;
    }, {}),
    [items]
  );

  const allergenItems = useMemo(
    () => items.filter(i => i.matchedAllergens.length > 0),
    [items]
  );

  // Delegate direct-purchase flows (course / digital product) to the dedicated component
  if (mode === 'course' || mode === 'product') return <DirectPurchase />;
  // Catering / private chef booking deposits
  if (mode === 'catering_deposit' || mode === 'booking_deposit') return <DepositPurchase />;

  // Track checkout_started once when items are present
  useEffect(() => {
    if (items.length > 0) {
      const cookId = items[0]?.cookId;
      trackEvent('checkout_started', { item_count: items.length, total }, { cook_id: cookId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recover a failed order where payment already went through. We keep the tx_ref
  // so support can recover — but we NEVER re-open FW automatically (the payment
  // already completed; doing so risks creating a duplicate order).
  useEffect(() => {
    AsyncStorage.getItem('@pending_tx_ref').then(saved => {
      if (saved && !txRef) {
        // Clear the pending ref so it doesn't block future checkouts, then surface
        // a support message to the user.
        AsyncStorage.removeItem('@pending_tx_ref').catch(() => {});
        setError(
          `Your previous payment was received but your order wasn't confirmed. ` +
          `WhatsApp us on ${SUPPORT_WHATSAPP} with reference: ${saved}`
        );
      }
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load wallet balance
  useEffect(() => {
    if (!user?.id) return;
    walletApi.get().then(r => setWalletBalance(r.balance_ngn)).catch(() => {});
  }, [user?.id]);

  // Show escrow guarantee banner once per user lifetime
  useEffect(() => {
    AsyncStorage.getItem('@escrow_banner_shown_v1').then(val => {
      if (!val) setShowEscrowBanner(true);
    }).catch(() => {});
  }, []);

  // Load saved addresses
  useEffect(() => {
    if (!user?.id) return;
    const addrKey = `@addresses_v2_${user.id}`;
    const defKey = `@default_addr_idx_${user.id}`;
    Promise.all([AsyncStorage.getItem(addrKey), AsyncStorage.getItem(defKey)]).then(([raw, idx]) => {
      const list: string[] = raw ? JSON.parse(raw) : [];
      const defIdx = idx ? parseInt(idx, 10) : 0;
      setSavedAddresses(list);
      setDefaultAddrIdx(defIdx);
      if (list.length > 0) setAddress(list[defIdx] ?? list[0]);
    });
  }, [user?.id]);

  // Persist a new address to the saved list
  const saveNewAddress = useCallback(async (addr: string) => {
    if (!user?.id || !addr.trim()) return;
    const addrKey = `@addresses_v2_${user.id}`;
    const updated = [addr, ...savedAddresses.filter(a => a !== addr)].slice(0, 10);
    setSavedAddresses(updated);
    await AsyncStorage.setItem(addrKey, JSON.stringify(updated));
  }, [user?.id, savedAddresses]);

  function confirmDeleteItem(itemId: string, title: string) {
    feedback.confirm({
      title: 'Remove item',
      message: `Remove "${title}" from your order?`,
      confirmLabel: 'Remove',
      cancelLabel: 'Keep',
      danger: true,
      onConfirm: () => { removeItem(itemId); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); },
    });
  }

  function handleQtyChange(id: string, next: number, maxQty: number) {
    if (next > maxQty) return; // respect slot cap
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateQty(id, next);
  }

  async function initiatePayment() {
    setError(null);
    setPaying(true);
    trackEvent('payment_initiated', { amount: orderTotal, method: 'flutterwave', currency: currencyCode },
      { cook_id: items[0]?.cookId });
    try {
      const result = await paymentsApi.initiate({
        amount: orderTotal,
        currency: currencyCode,
        redirect_url: 'foodsbyme://payment-complete',
        cart_items: items.map(i => ({ menuItemId: i.menuItemId, qty: i.qty })),
        meta: { customer_id: user?.id, platform_fee: foodPlatformFee },
      });
      setTxRef(result.tx_ref);
      await AsyncStorage.setItem('@pending_tx_ref', result.tx_ref).catch(() => {});

      if (result.dev_mode) {
        await AsyncStorage.removeItem('@pending_tx_ref').catch(() => {});
        await placeOrders(result.tx_ref, undefined, true);
        return;
      }
      setShowFW(true);
    } catch (e: any) {
      setError(e.message ?? 'Payment could not be started. Try again.');
    } finally {
      setPaying(false);
    }
  }

  async function handlePayPress() {
    if (deliveryType === 'delivery' && !address.trim()) {
      setError('Please enter or select a delivery address.');
      return;
    }
    setError(null);

    if (allergenItems.length > 0 && !checkoutAllergenAcked) {
      setShowAllergenWarning(true);
      return;
    }

    if (payMethod === 'wallet') {
      await handleWalletPay();
      return;
    }

    await initiatePayment();
  }

  async function handleAllergenAck() {
    setCheckoutAllergenAcked(true);
    setShowAllergenWarning(false);
    if (payMethod === 'wallet') {
      await handleWalletPay();
    } else {
      await initiatePayment();
    }
  }

  async function placeOrders(ref: string, transactionId?: string, devMode = false, method: 'flutterwave' | 'wallet' | 'dev_mode' = 'flutterwave') {
    try {
      if (!devMode && method !== 'wallet') {
        await paymentsApi.verify({ tx_ref: ref, transaction_id: transactionId, expected_amount: orderTotal });
      }
      const selectedSlot = DELIVERY_SLOTS.find(s => s.id === selectedSlotId)?.label ?? selectedSlotId;
      const { orders: placed } = await ordersApi.place({
        items: items.map(i => ({
          menu_item_id: i.menuItemId,
          quantity: i.qty,
          selected_sides: i.selectedSides,
          removed_sides: i.removedSides,
        })),
        delivery_address: deliveryType === 'delivery' ? (address || undefined) : 'PICKUP',
        delivery_fee_payment_method: deliveryType === 'delivery' ? deliveryFeeMethod : undefined,
        customer_note: note || undefined,
        allergen_acknowledged: items.some(i => i.allergenAcknowledged),
        payment_tx_ref: ref,
        payment_method: devMode ? 'dev_mode' : method,
        delivery_window_start: selectedSlot,
        tip_amount: tipAmount > 0 ? tipAmount : undefined,
      });
      clear();
      await AsyncStorage.removeItem('@pending_tx_ref').catch(() => {});
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const firstId = placed?.[0]?.id;
      router.replace(firstId ? `/confirmation?orderId=${firstId}` : '/confirmation');
    } catch (e: any) {
      // Payment was verified but order creation failed — keep tx_ref so support can recover
      await AsyncStorage.setItem('@pending_tx_ref', ref).catch(() => {});
      setError(
        `Your payment was received but your order wasn't confirmed. ` +
        `WhatsApp us on ${SUPPORT_WHATSAPP} with reference: ${ref}`
      );
    }
  }

  function handleFWMessage(event: any) {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.status === 'successful' || data.event === 'payment.completed') {
        setShowFW(false);
        if (txRef) placeOrders(txRef, data.transaction_id);
      } else if (data.status === 'cancelled' || data.event === 'modal.closed') {
        setShowFW(false);
      }
    } catch {}
  }

  async function handleWalletPay() {
    if (!walletCoversOrder) return;
    setError(null);
    setProcessingWallet(true);
    try {
      const { wallet_tx_ref, balance_ngn } = await walletApi.pay({ amount: orderTotal });
      setWalletBalance(balance_ngn);
      await placeOrders(wallet_tx_ref, undefined, false, 'wallet');
    } catch (e: any) {
      setError(e.error ?? 'Wallet payment failed. Try again.');
    } finally {
      setProcessingWallet(false);
    }
  }

  async function initiateTopup(amount: number) {
    setError(null);
    setPaying(true);
    try {
      const res = await paymentsApi.initiate({
        amount,
        currency: 'NGN',
        redirect_url: 'foodsbyme://payment-complete',
        meta: { purpose: 'wallet_topup', user_id: user?.id },
      });
      setTopupTxRef(res.tx_ref);
      setTopupAmount(amount);
      if (res.dev_mode) {
        const r = await walletApi.topup({ amount, tx_ref: res.tx_ref });
        setWalletBalance(r.balance_ngn);
        feedback.success('Wallet topped up!', `${fmtCurrency(amount, 'NGN')} added to your wallet`);
        return;
      }
      setShowTopup(true);
    } catch {
      setError('Could not start top-up. Try again.');
    } finally {
      setPaying(false);
    }
  }

  function handleTopupFWMessage(event: any) {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.status === 'successful' || data.event === 'payment.completed') {
        setShowTopup(false);
        if (topupTxRef) {
          walletApi.topup({ amount: topupAmount, tx_ref: topupTxRef })
            .then(r => {
              setWalletBalance(r.balance_ngn);
              feedback.success('Wallet topped up!', `${fmtCurrency(topupAmount, 'NGN')} added to your wallet`);
            })
            .catch(() => feedback.error('Top-up issue', 'Payment received but wallet not credited. Contact support.'));
        }
      } else if (data.status === 'cancelled' || data.event === 'modal.closed') {
        setShowTopup(false);
      }
    } catch {}
  }

  // All user data is JSON-serialized to prevent injection
  const safeCustomer = JSON.stringify({
    email: user?.email ?? 'customer@foodsbyme.com',
    name: user?.full_name ?? 'Customer',
    phone_number: user?.phone ?? '',
  });
  const safeCustomizations = JSON.stringify({
    title: 'FOODS',
    description: 'Your meal order',
    logo: 'https://foodsbyme.com/icon.png',
  });

  const fwHtml = `<!DOCTYPE html>
<html>
<head><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;background:#FFFFFF;display:flex;align-items:center;justify-content:center;height:100vh;">
<script src="https://checkout.flutterwave.com/v3.js"></script>
<script>
  var customer = ${safeCustomer};
  var customizations = ${safeCustomizations};
  window.onload = function() {
    FlutterwaveCheckout({
      public_key: ${JSON.stringify(FLUTTERWAVE_PK)},
      tx_ref: ${JSON.stringify(txRef ?? '')},
      amount: ${Number(orderTotal)},
      currency: ${JSON.stringify(currencyCode)},
      customer: customer,
      customizations: customizations,
      callback: function(data) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ status: data.status, event: "payment.completed", transaction_id: data.transaction_id }));
      },
      onclose: function() {
        window.ReactNativeWebView.postMessage(JSON.stringify({ event: "modal.closed", status: "cancelled" }));
      }
    });
  };
</script>
</body>
</html>`;

  const topupFwHtml = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#FFFFFF;display:flex;align-items:center;justify-content:center;height:100vh;">
<script src="https://checkout.flutterwave.com/v3.js"></script>
<script>
var customer=${safeCustomer};
window.onload=function(){FlutterwaveCheckout({
  public_key:${JSON.stringify(FLUTTERWAVE_PK)},tx_ref:${JSON.stringify(topupTxRef??'')},
  amount:${Number(topupAmount)},currency:"NGN",customer:customer,
  customizations:{title:"FOODS Wallet",description:"Wallet top-up",logo:"https://foodsbyme.com/icon.png"},
  callback:function(d){window.ReactNativeWebView.postMessage(JSON.stringify({status:d.status,event:"payment.completed",transaction_id:d.transaction_id}))},
  onclose:function(){window.ReactNativeWebView.postMessage(JSON.stringify({event:"modal.closed",status:"cancelled"}))}
})};
</script></body></html>`;

  if (items.length === 0) {
    return (
      <SafeAreaView style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <Ionicons name="bag-outline" size={48} color={C.stone} style={{ marginBottom: 16 }} />
        <Text style={styles.emptyText}>{t('checkout.empty')}</Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backLink}
          accessibilityLabel={t('checkout.browse')}
          accessibilityRole="button"
        >
          <Text style={styles.backLinkText}>{t('checkout.browse')}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: C.bg }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Go back" hitSlop={8}>
            <Ionicons name="chevron-back" size={22} color={C.textInk} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('checkout.title')}</Text>
          <View style={{ width: 44 }} />
        </View>
      </SafeAreaView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: Spacing.lg, gap: 16, paddingBottom: 180 }}
        keyboardShouldPersistTaps="handled"
      >

        {/* One-time escrow guarantee banner */}
        {showEscrowBanner && (
          <View style={styles.escrowBanner}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, flex: 1 }}>
              <Ionicons name="shield-checkmark" size={20} color={C.leaf} style={{ marginTop: 1 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.escrowTitle}>{t('checkout.protected')}</Text>
                <Text style={styles.escrowBody}>{t('checkout.protected_text')}</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={async () => {
                setShowEscrowBanner(false);
                await AsyncStorage.setItem('@escrow_banner_shown_v1', '1').catch(() => {});
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{ alignSelf: 'flex-start' }}
            >
              <Ionicons name="close" size={16} color={C.bodySoft} />
            </TouchableOpacity>
          </View>
        )}

        {/* Order items grouped by cook */}
        {Object.entries(byCook).map(([cookId, cookItems]) => (
          <View key={cookId} style={styles.card}>
            <View style={styles.cookLabel}>
              <Ionicons name="restaurant-outline" size={14} color={C.spice} />
              <Text style={styles.cookLabelText}>{cookItems[0].cookName}</Text>
            </View>
            {cookItems.map(item => {
              const maxQty = (item as any).slotsLeft ?? 99;
              return (
                <View key={item.id} style={styles.itemRow}>
                  <View style={[styles.itemThumb, { backgroundColor: C.ember }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle} numberOfLines={2}>{item.dishTitle}</Text>
                    {item.selectedSides.length > 0 && (
                      <Text style={styles.itemMeta} numberOfLines={1}>with {item.selectedSides.join(', ')}</Text>
                    )}
                  </View>
                  {/* Qty stepper */}
                  <View style={styles.qtyStepper}>
                    <TouchableOpacity
                      onPress={() => handleQtyChange(item.id, item.qty - 1, maxQty)}
                      style={styles.qtyBtn}
                      accessibilityLabel={item.qty === 1 ? 'Remove item' : 'Decrease quantity'}
                    >
                      <Ionicons
                        name={item.qty === 1 ? 'trash-outline' : 'remove'}
                        size={14}
                        color={item.qty === 1 ? C.errorFg : C.textInk}
                      />
                    </TouchableOpacity>
                    <Text style={styles.qtyNum}>{item.qty}</Text>
                    <TouchableOpacity
                      onPress={() => handleQtyChange(item.id, item.qty + 1, maxQty)}
                      style={[styles.qtyBtn, item.qty >= maxQty && styles.qtyBtnDisabled]}
                      disabled={item.qty >= maxQty}
                      accessibilityLabel="Increase quantity"
                    >
                      <Ionicons name="add" size={14} color={item.qty >= maxQty ? C.stone : C.textInk} />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.itemPrice}>{fmtCurrency(item.price * item.qty, currencyCode)}</Text>
                  <TouchableOpacity
                    onPress={() => confirmDeleteItem(item.id, item.dishTitle)}
                    style={styles.deleteBtn}
                    accessibilityLabel={`Remove ${item.dishTitle}`}
                  >
                    <Ionicons name="close-circle" size={18} color={C.bodySoft} />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        ))}

        {/* Delivery type toggle */}
        <View>
          <Text style={styles.sectionLabel}>{t('checkout.fulfilment')}</Text>
          <View style={styles.toggleRow}>
            {(['delivery', 'pickup'] as const).map(type => (
              <TouchableOpacity
                key={type}
                style={[styles.toggleBtn, deliveryType === type && styles.toggleBtnActive]}
                onPress={() => { setDeliveryType(type); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                accessibilityLabel={type === 'delivery' ? t('checkout.delivery') : t('checkout.pickup')}
                accessibilityRole="button"
                accessibilityState={{ selected: deliveryType === type }}
              >
                <Ionicons
                  name={type === 'delivery' ? 'bicycle-outline' : 'storefront-outline'}
                  size={16}
                  color={deliveryType === type ? C.canvas : C.body}
                />
                <Text style={[styles.toggleBtnText, deliveryType === type && styles.toggleBtnTextActive]}>
                  {type === 'delivery' ? t('checkout.delivery') : t('checkout.pickup')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Delivery fee payment method */}
        {deliveryType === 'delivery' && (
          <View>
            <Text style={styles.sectionLabel}>{t('checkout.delivery_fee')}</Text>
            <View style={[styles.card, { gap: 0, padding: 0, overflow: 'hidden' }]}>
              {([
                { id: 'wallet',   icon: 'wallet-outline',        label: t('checkout.wallet_pay'),  sub: t('checkout.wallet_deduct') },
                { id: 'cash',     icon: 'cash-outline',          label: t('checkout.cash'),        sub: t('checkout.cash_desc') },
                { id: 'transfer', icon: 'phone-portrait-outline', label: t('checkout.transfer'),    sub: t('checkout.transfer_desc') },
              ] as const).map((opt, idx) => (
                <React.Fragment key={opt.id}>
                  {idx > 0 && <View style={{ height: 0.5, backgroundColor: C.borderWarm, marginLeft: 46 }} />}
                  <TouchableOpacity
                    style={styles.slotRow}
                    onPress={() => { setDeliveryFeeMethod(opt.id); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: deliveryFeeMethod === opt.id }}
                  >
                    <View style={[styles.slotRadio, deliveryFeeMethod === opt.id && styles.slotRadioActive]}>
                      {deliveryFeeMethod === opt.id && <View style={styles.slotRadioDot} />}
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                      <Ionicons name={opt.icon} size={16} color={deliveryFeeMethod === opt.id ? C.spice : C.bodySoft} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.slotLabel, deliveryFeeMethod === opt.id && { color: C.spice }]}>{opt.label}</Text>
                        <Text style={styles.slotDesc}>{opt.sub}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                </React.Fragment>
              ))}
            </View>
          </View>
        )}

        {/* Delivery address */}
        {deliveryType === 'delivery' && (
          <View>
            <Text style={styles.sectionLabel}>{t('checkout.address')}</Text>
            {savedAddresses.length > 0 ? (
              <TouchableOpacity
                style={[styles.card, styles.addrPickerRow]}
                onPress={() => setShowAddressPicker(true)}
                activeOpacity={0.8}
                accessibilityLabel={t('checkout.select_address')}
                accessibilityRole="button"
              >
                <View style={styles.locationIcon}>
                  <Ionicons name="location-outline" size={18} color={C.spice} />
                </View>
                <Text style={[styles.addrPickerText, !address && { color: C.bodySoft }]} numberOfLines={2}>
                  {address || t('checkout.select_address')}
                </Text>
                <Ionicons name="chevron-down" size={16} color={C.bodySoft} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.card, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}
                onPress={() => setShowAddressAutoComplete(true)}
                activeOpacity={0.8}
                accessibilityLabel={t('checkout.enter_address')}
                accessibilityRole="button"
              >
                <View style={styles.locationIcon}>
                  <Ionicons name="location-outline" size={18} color={C.spice} />
                </View>
                <Text style={[styles.addrInput, { flex: 1, color: address ? C.textInk : C.bodySoft }]} numberOfLines={2}>
                  {address || t('checkout.enter_address')}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={C.bodySoft} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Delivery slot */}
        <View>
          <Text style={styles.sectionLabel}>{t('checkout.when')}</Text>
          <View style={styles.card}>
            {DELIVERY_SLOTS.map((slot, idx) => (
              <React.Fragment key={slot.id}>
                {idx > 0 && <View style={{ height: 0.5, backgroundColor: C.borderWarm, marginLeft: 46 }} />}
                <TouchableOpacity
                  style={styles.slotRow}
                  onPress={() => { setSelectedSlotId(slot.id); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                  activeOpacity={0.7}
                  accessibilityLabel={`${slot.label}, ${slot.desc}`}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selectedSlotId === slot.id }}
                >
                  <View style={[styles.slotRadio, selectedSlotId === slot.id && styles.slotRadioActive]}>
                    {selectedSlotId === slot.id && <View style={styles.slotRadioDot} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.slotLabel}>{slot.label}</Text>
                    <Text style={styles.slotDesc}>{slot.desc}</Text>
                  </View>
                </TouchableOpacity>
              </React.Fragment>
            ))}
          </View>
        </View>

        {/* Tip */}
        <View>
          <Text style={styles.sectionLabel}>{t('checkout.tip')}</Text>
          <Text style={styles.tipNote}>{t('checkout.tip_note')}</Text>
          <View style={styles.tipRow}>
            {TIP_PRESETS.map((preset, idx) => (
              <TouchableOpacity
                key={idx}
                style={[styles.tipBtn, tipPreset === idx && styles.tipBtnActive]}
                onPress={() => { setTipPreset(idx); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                accessibilityLabel={preset.label}
                accessibilityRole="button"
                accessibilityState={{ selected: tipPreset === idx }}
              >
                <Text style={[styles.tipBtnText, tipPreset === idx && styles.tipBtnTextActive]}>
                  {preset.label}
                </Text>
                {idx > 0 && tipPreset === idx && (
                  <Text style={styles.tipBtnAmt}>{fmtCurrency(tipAmount, currencyCode)}</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Note to cook */}
        <View>
          <Text style={styles.sectionLabel}>{t('checkout.note')} <Text style={styles.optLabel}>{t('common.optional')}</Text></Text>
          <View style={styles.card}>
            <TextInput
              style={styles.noteInput}
              placeholder={t('checkout.note_placeholder')}
              placeholderTextColor={C.bodySoft}
              value={note}
              onChangeText={setNote}
              multiline
              numberOfLines={3}
              accessibilityLabel="Note to cook"
            />
          </View>
        </View>

        {/* Order summary */}
        <View style={styles.card}>
          <Text style={[styles.sectionLabel, { marginBottom: 12 }]}>{t('checkout.summary')}</Text>
          {items.map(item => (
            <View key={item.id} style={styles.summaryRow}>
              <Text style={styles.summaryKey} numberOfLines={1}>{item.dishTitle} × {item.qty}</Text>
              <Text style={styles.summaryVal}>{fmtCurrency(item.price * item.qty, currencyCode)}</Text>
            </View>
          ))}
          {tipAmount > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryKey}>{t('checkout.tip_line')}</Text>
              <Text style={[styles.summaryVal, { color: C.leaf }]}>{fmtCurrency(tipAmount, currencyCode)}</Text>
            </View>
          )}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryKey}>{t('checkout.platform_fee')}</Text>
            <Text style={styles.summaryVal}>{fmtCurrency(foodPlatformFee, currencyCode)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{t('checkout.total')}</Text>
            <Text style={styles.totalVal}>{fmtCurrency(orderTotal, currencyCode)}</Text>
          </View>
        </View>

        {/* Payment method */}
        <View style={{ gap: 12 }}>
          <Text style={styles.sectionLabel}>{t('checkout.payment')}</Text>
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggleBtn, payMethod === 'card' && styles.toggleBtnActive]}
              onPress={() => setPayMethod('card')}
            >
              <Ionicons name="card-outline" size={16} color={payMethod === 'card' ? C.canvas : C.body} />
              <Text style={[styles.toggleBtnText, payMethod === 'card' && styles.toggleBtnTextActive]}>{t('checkout.card')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, payMethod === 'wallet' && styles.toggleBtnActive]}
              onPress={() => setPayMethod('wallet')}
            >
              <Ionicons name="wallet-outline" size={16} color={payMethod === 'wallet' ? C.canvas : C.body} />
              <Text style={[styles.toggleBtnText, payMethod === 'wallet' && styles.toggleBtnTextActive]}>{t('checkout.wallet')}</Text>
            </TouchableOpacity>
          </View>

          {payMethod === 'wallet' && (
            walletBalance === null ? (
              <View style={styles.walletLoadingRow}>
                <ActivityIndicator size="small" color={C.spice} />
                <Text style={styles.walletLoadingText}>{t('checkout.loading')}</Text>
              </View>
            ) : (
              <View style={styles.walletCard}>
                {/* Balance header */}
                <View style={styles.walletCardHeader}>
                  <View style={styles.walletIconWrap}>
                    <Ionicons name="wallet" size={20} color={C.canvas} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.walletCardLabel}>{t('checkout.foods_wallet')}</Text>
                    <Text style={styles.walletCardBalance}>{fmtCurrency(walletBalance, 'NGN')}</Text>
                  </View>
                  {walletCoversOrder && (
                    <View style={styles.walletSufficientBadge}>
                      <Ionicons name="checkmark-circle" size={14} color={C.leaf} />
                      <Text style={styles.walletSufficientText}>{t('checkout.sufficient')}</Text>
                    </View>
                  )}
                </View>

                {/* Shortfall / top-up CTA */}
                {!walletCoversOrder && (
                  <View style={styles.walletShortfallBox}>
                    <View style={styles.walletShortfallRow}>
                      <Ionicons name="alert-circle-outline" size={16} color={C.warnFg} />
                      <Text style={styles.walletShortfallText}>
                        {t('checkout.need')}{' '}
                        <Text style={{ fontFamily: Fonts.sansMedium }}>{fmtCurrency(walletShortfall, 'NGN')}</Text>
                        {' '}{t('checkout.more')}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.topupBtn, paying && { opacity: 0.6 }]}
                      onPress={() => initiateTopup(walletShortfall)}
                      disabled={paying}
                    >
                      {paying
                        ? <ActivityIndicator size="small" color={C.canvas} />
                        : <>
                            <Ionicons name="add-circle-outline" size={16} color={C.canvas} />
                            <Text style={styles.topupBtnText}>{t('checkout.top_up')} {fmtCurrency(walletShortfall, 'NGN')}</Text>
                          </>
                      }
                    </TouchableOpacity>
                  </View>
                )}

                {walletCoversOrder && (
                  <View style={styles.walletAfterRow}>
                    <Text style={styles.walletAfterLabel}>{t('checkout.balance_after')}</Text>
                    <Text style={styles.walletAfterVal}>{fmtCurrency(walletBalance - orderTotal, 'NGN')}</Text>
                  </View>
                )}
              </View>
            )
          )}
        </View>

        {error && (
          <View style={styles.errorBox}>
            <Ionicons name="warning-outline" size={16} color={C.errorFg} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </ScrollView>

      {/* Pay CTA bar */}
      <SafeAreaView edges={['bottom']} style={styles.payBar}>
        <TouchableOpacity
          onPress={handlePayPress}
          style={[
            styles.payBtn,
            (paying || processingWallet || (payMethod === 'wallet' && !walletCoversOrder)) && { opacity: 0.5 },
          ]}
          activeOpacity={0.85}
          disabled={paying || processingWallet || (payMethod === 'wallet' && !walletCoversOrder)}
          accessibilityRole="button"
        >
          {(paying || processingWallet) ? (
            <ActivityIndicator color={C.canvas} />
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons
                name={payMethod === 'wallet' ? 'wallet-outline' : 'lock-closed-outline'}
                size={15}
                color="rgba(255,255,255,0.7)"
              />
              <Text style={styles.payLabel}>
                {payMethod === 'wallet'
                  ? (walletCoversOrder ? t('checkout.pay_wallet') : t('checkout.top_up_btn'))
                  : t('checkout.pay_secure')}
              </Text>
            </View>
          )}
          <Text style={styles.payAmount}>{fmtCurrency(orderTotal, currencyCode)}</Text>
        </TouchableOpacity>
        <Text style={styles.holdNote}>
          {payMethod === 'wallet' && walletCoversOrder
            ? t('checkout.balance_after_val', { amount: fmtCurrency((walletBalance ?? 0) - orderTotal, 'NGN') })
            : deliveryType === 'delivery'
              ? t('checkout.cash_rider')
              : t('checkout.pickup_kitchen')}
        </Text>
      </SafeAreaView>

      {/* Address picker modal */}
      <Modal visible={showAddressPicker} transparent animationType="slide" onRequestClose={() => setShowAddressPicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{t('checkout.select_addr_title')}</Text>
            {savedAddresses.map((addr, idx) => (
              <TouchableOpacity
                key={idx}
                style={[styles.addrOption, address === addr && styles.addrOptionActive]}
                onPress={() => { setAddress(addr); setShowAddressPicker(false); }}
                accessibilityLabel={addr}
                accessibilityRole="button"
              >
                <Ionicons name="location-outline" size={16} color={C.spice} />
                <Text style={styles.addrOptionText} numberOfLines={2}>{addr}</Text>
                {address === addr && <Ionicons name="checkmark" size={16} color={C.spice} />}
              </TouchableOpacity>
            ))}
            <View style={{ height: 0.5, backgroundColor: C.borderWarm }} />
            <TouchableOpacity
              style={styles.newAddrRow}
              onPress={() => {
                setShowAddressPicker(false);
                setShowAddressAutoComplete(true);
              }}
              accessibilityLabel="Add a new address"
              accessibilityRole="button"
            >
              <Ionicons name="add-circle-outline" size={18} color={C.spice} />
              <Text style={[styles.newAddrInput, { color: C.bodySoft }]}>{t('checkout.add_new_address')}</Text>
              <Ionicons name="chevron-forward" size={16} color={C.bodySoft} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelModalBtn} onPress={() => setShowAddressPicker(false)}>
              <Text style={styles.cancelModalText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>


      {/* Address autocomplete modal */}
      <Modal visible={showAddressAutoComplete} animationType="slide" onRequestClose={() => setShowAddressAutoComplete(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.borderWarm }}>
            <TouchableOpacity onPress={() => setShowAddressAutoComplete(false)} hitSlop={8}>
              <Ionicons name="chevron-back" size={22} color={C.textInk} />
            </TouchableOpacity>
            <Text style={{ flex: 1, textAlign: 'center', fontFamily: Fonts.sansMedium, fontSize: 16, color: C.textInk }}>
              {t('checkout.address')}
            </Text>
            <View style={{ width: 22 }} />
          </View>
          <View style={{ flex: 1, padding: 16 }}>
            <GooglePlacesInput
              placeholder="Search your delivery address"
              initialValue={address}
              onSelect={(addr) => {
                setAddress(addr);
                saveNewAddress(addr);
                setShowAddressAutoComplete(false);
              }}
              onCancel={() => setShowAddressAutoComplete(false)}
            />
          </View>
        </SafeAreaView>
      </Modal>

      {/* Allergen warning modal */}
      <Modal visible={showAllergenWarning} transparent animationType="fade" onRequestClose={() => setShowAllergenWarning(false)}>
        <View style={styles.tooltipOverlay}>
          <View style={[styles.tooltipBox, { maxWidth: 380 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Ionicons name="warning" size={20} color={C.errorFg} />
              <Text style={[styles.tooltipTitle, { color: C.errorFg }]}>{t('checkout.allergen_title')}</Text>
            </View>
            <Text style={[styles.tooltipBody, { marginBottom: 12 }]}>
              {t('checkout.allergen_text')}
            </Text>
            {allergenItems.map(item => (
              <View key={item.id} style={{ marginBottom: 8 }}>
                <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 13, color: C.textInk }}>
                  {item.dishTitle}
                </Text>
                <Text style={{ fontFamily: Fonts.sans, fontSize: 12, color: C.errorFg, marginTop: 2 }}>
                  {item.matchedIngredients.length > 0
                    ? item.matchedIngredients.join(', ')
                    : item.matchedAllergens.join(', ')}
                  {' '}({item.matchedAllergens.join(', ')})
                </Text>
              </View>
            ))}
            <TouchableOpacity
              style={[styles.tooltipBtn, { backgroundColor: C.errorFg, marginTop: 16 }]}
              onPress={handleAllergenAck}
            >
              <Text style={styles.tooltipBtnText}>{t('checkout.allergen_confirm')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ alignItems: 'center', marginTop: 12 }} onPress={() => setShowAllergenWarning(false)}>
              <Text style={{ fontFamily: Fonts.sans, fontSize: 13, color: C.bodySoft }}>{t('common.back')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Wallet top-up modal */}
      <Modal visible={showTopup} animationType="slide" onRequestClose={() => setShowTopup(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
          <View style={styles.fwHeader}>
            <TouchableOpacity onPress={() => setShowTopup(false)} accessibilityLabel="Close top-up">
              <Ionicons name="close" size={22} color={C.textInk} />
            </TouchableOpacity>
            <Text style={styles.fwTitle}>{t('checkout.topup_wallet')}</Text>
            <View style={{ width: 22 }} />
          </View>
          <WebView
            source={{ html: topupFwHtml }}
            onMessage={handleTopupFWMessage}
            javaScriptEnabled
            domStorageEnabled
            startInLoadingState
            renderLoading={() => (
              <View style={styles.fwLoading}>
                <ActivityIndicator size="large" color={C.spice} />
                <Text style={styles.fwLoadText}>{t('checkout.loading_payment')}</Text>
              </View>
            )}
            style={{ flex: 1 }}
          />
        </SafeAreaView>
      </Modal>

      {/* Flutterwave payment modal */}
      <Modal visible={showFW} animationType="slide" onRequestClose={() => setShowFW(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
          <View style={styles.fwHeader}>
            <TouchableOpacity onPress={() => setShowFW(false)} accessibilityLabel="Close payment">
              <Ionicons name="close" size={22} color={C.textInk} />
            </TouchableOpacity>
            <Text style={styles.fwTitle}>{t('checkout.secure_payment')}</Text>
            <View style={{ width: 22 }} />
          </View>
          <WebView
            source={{ html: fwHtml }}
            onMessage={handleFWMessage}
            javaScriptEnabled
            domStorageEnabled
            startInLoadingState
            renderLoading={() => (
              <View style={styles.fwLoading}>
                <ActivityIndicator size="large" color={C.spice} />
                <Text style={styles.fwLoadText}>{t('checkout.loading_payment')}</Text>
              </View>
            )}
            style={{ flex: 1 }}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 },
    backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { flex: 1, textAlign: 'center', fontFamily: Fonts.sansMedium, fontSize: 16, color: C.textInk },

    sectionLabel: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.textInk, marginBottom: 10 },
    optLabel: { fontFamily: Fonts.sans, fontSize: 13, color: C.bodySoft },

    card: { backgroundColor: C.bgCard, borderRadius: Radius.lg, padding: 16, borderWidth: 0.5, borderColor: C.borderWarm, ...Shadow.card },
    cookLabel: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
    cookLabelText: { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.spice },

    itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
    itemThumb: { width: 40, height: 40, borderRadius: 8, flexShrink: 0 },
    itemTitle: { fontFamily: Fonts.sans, fontSize: 13, color: C.textInk, lineHeight: 18 },
    itemMeta: { fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft, marginTop: 2 },
    itemPrice: { fontFamily: Fonts.serif, fontSize: 14, color: C.spice, flexShrink: 0 },
    deleteBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },

    qtyStepper: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.bgCook, borderRadius: 20, paddingHorizontal: 4, paddingVertical: 3 },
    qtyBtn: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center', borderRadius: 13 },
    qtyBtnDisabled: { opacity: 0.35 },
    qtyNum: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.textInk, minWidth: 16, textAlign: 'center' },

    toggleRow: { flexDirection: 'row', gap: 10 },
    toggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: Radius.md, borderWidth: 1, borderColor: C.borderWarm, backgroundColor: C.bgCard },
    toggleBtnActive: { backgroundColor: C.ink, borderColor: C.ink },
    toggleBtnText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.body },
    toggleBtnTextActive: { color: C.canvas },

    locationIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.bgCook, alignItems: 'center', justifyContent: 'center' },
    addrPickerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    addrPickerText: { flex: 1, fontFamily: Fonts.sans, fontSize: 14, color: C.textInk, lineHeight: 20 },
    addrInput: { fontFamily: Fonts.sans, fontSize: 14, color: C.textInk, paddingVertical: 0 },

    slotRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 13 },
    slotRadio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: C.borderWarm, alignItems: 'center', justifyContent: 'center' },
    slotRadioActive: { borderColor: C.spice },
    slotRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.spice },
    slotLabel: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.textInk },
    slotDesc: { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft, marginTop: 2 },

    tipNote: { fontFamily: Fonts.sans, fontSize: 12, color: C.leaf, marginTop: -6, marginBottom: 10 },
    tipRow: { flexDirection: 'row', gap: 8 },
    tipBtn: { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: Radius.md, borderWidth: 1, borderColor: C.borderWarm, backgroundColor: C.bgCard },
    tipBtnActive: { backgroundColor: C.ink, borderColor: C.ink },
    tipBtnText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.body },
    tipBtnTextActive: { color: C.canvas },
    tipBtnAmt: { fontFamily: Fonts.sans, fontSize: 10, color: 'rgba(255, 255, 255,0.6)', marginTop: 2 },

    noteInput: { fontFamily: Fonts.sans, fontSize: 13, color: C.textInk, minHeight: 72, textAlignVertical: 'top' },

    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    summaryKey: { fontFamily: Fonts.sans, fontSize: 13, color: C.body, flex: 1, marginRight: 8 },
    summaryVal: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.textInk },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 12, borderTopWidth: 0.5, borderTopColor: C.borderWarm },
    totalLabel: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.textInk },
    totalVal: { fontFamily: Fonts.serif, fontSize: 22, color: C.spice },

    errorBox: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: C.errorBg, borderRadius: Radius.md, padding: 12 },
    errorText: { fontFamily: Fonts.sans, fontSize: 13, color: C.errorFg, flex: 1, lineHeight: 18 },

    payBar: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, borderTopWidth: 0.5, borderTopColor: C.borderWarm, backgroundColor: C.bg },
    payBtn: { backgroundColor: C.ink, borderRadius: Radius.lg, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    payLabel: { fontFamily: Fonts.sansMedium, fontSize: 15, color: C.canvas },
    payAmount: { fontFamily: Fonts.serif, fontSize: 18, color: C.ember },
    holdNote: { fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft, textAlign: 'center', marginTop: 8 },

    deliveryNotice: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 8,
      backgroundColor: C.infoBg, borderRadius: Radius.md,
      padding: 12, borderWidth: 0.5, borderColor: C.infoFg + '40',
    },
    deliveryNoticeText: { fontFamily: Fonts.sans, fontSize: 13, color: C.infoFg, flex: 1, lineHeight: 18 },

    walletLoadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
    walletLoadingText: { fontFamily: Fonts.sans, fontSize: 13, color: C.bodySoft },
    walletCard: {
      backgroundColor: C.bgCard, borderRadius: Radius.lg,
      borderWidth: 0.5, borderColor: C.borderWarm,
      overflow: 'hidden', ...Shadow.card,
    },
    walletCardHeader: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      padding: 16,
    },
    walletIconWrap: {
      width: 44, height: 44, borderRadius: 22,
      backgroundColor: C.spice, alignItems: 'center', justifyContent: 'center',
    },
    walletCardLabel: { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft, marginBottom: 2 },
    walletCardBalance: { fontFamily: Fonts.serif, fontSize: 26, color: C.ink },
    walletSufficientBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      backgroundColor: C.healthBg, borderRadius: Radius.full,
      paddingHorizontal: 10, paddingVertical: 5,
    },
    walletSufficientText: { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.leaf },
    walletAfterRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingHorizontal: 16, paddingBottom: 14,
    },
    walletAfterLabel: { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft },
    walletAfterVal: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.bodySoft },
    walletShortfallBox: {
      borderTopWidth: 0.5, borderTopColor: C.borderWarm,
      padding: 16, gap: 12,
      backgroundColor: C.warnBg,
    },
    walletShortfallRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    walletShortfallText: { fontFamily: Fonts.sans, fontSize: 13, color: C.warnFg, flex: 1, lineHeight: 19 },
    topupBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      backgroundColor: C.spice, borderRadius: Radius.full, paddingVertical: 13,
    },
    topupBtnText: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.canvas },

    escrowBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: C.healthBg, borderRadius: Radius.lg, padding: 14, borderWidth: 0.5, borderColor: C.leaf + '40' },
    escrowTitle: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.leaf, marginBottom: 3 },
    escrowBody: { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft, lineHeight: 17 },

    emptyText: { fontFamily: Fonts.sans, fontSize: 15, color: C.bodySoft },
    backLink: { marginTop: 16 },
    backLinkText: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.spice },

    fwHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 0.5, borderBottomColor: C.borderWarm },
    fwTitle: { fontFamily: Fonts.sansMedium, fontSize: 16, color: C.textInk },
    fwLoading: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg } as any,
    fwLoadText: { fontFamily: Fonts.sans, fontSize: 14, color: C.bodySoft, marginTop: 12 },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    modalSheet: { backgroundColor: C.bgCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.lg, gap: 12, paddingBottom: 36 },
    modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: C.borderWarm, alignSelf: 'center', marginBottom: 4 },
    modalTitle: { fontFamily: Fonts.serif, fontSize: 20, color: C.textInk, marginBottom: 4 },
    addrOption: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: Radius.md, backgroundColor: C.bg },
    addrOptionActive: { backgroundColor: C.bgCook, borderWidth: 1, borderColor: C.spice + '50' },
    addrOptionText: { flex: 1, fontFamily: Fonts.sans, fontSize: 13, color: C.textInk, lineHeight: 18 },
    newAddrRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: Radius.md, borderWidth: 0.5, borderColor: C.borderWarm, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: C.bg },
    newAddrInput: { flex: 1, fontFamily: Fonts.sans, fontSize: 13, color: C.textInk },
    cancelModalBtn: { alignItems: 'center', paddingVertical: 8 },
    cancelModalText: { fontFamily: Fonts.sans, fontSize: 14, color: C.bodySoft },

    tooltipOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 32 },
    tooltipBox: { backgroundColor: C.bgCard, borderRadius: Radius.xl, padding: 24, width: '100%', maxWidth: 340 },
    tooltipTitle: { fontFamily: Fonts.serif, fontSize: 18, color: C.textInk, marginBottom: 10 },
    tooltipBody: { fontFamily: Fonts.sans, fontSize: 14, color: C.body, lineHeight: 22, marginBottom: 20 },
    tooltipBtn: { backgroundColor: C.ink, borderRadius: Radius.full, paddingVertical: 12, alignItems: 'center' },
    tooltipBtnText: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.canvas },
  });
}
