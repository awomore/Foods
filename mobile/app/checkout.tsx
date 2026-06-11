import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal, ActivityIndicator, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useCart } from '../src/context/CartContext';
import { paymentsApi } from '../src/api/payments';
import { ordersApi } from '../src/api/orders';
import { coursesApi } from '../src/api/courses';
import { digitalProductsApi } from '../src/api/digitalProducts';
import { useAuth } from '../src/context/AuthContext';
import { api } from '../src/api/client';
import { trackEvent } from '../src/utils/analytics';
import { useColors, type AppColors } from '../src/context/ThemeContext';
import { useFeedback } from '../src/components/feedback';
import { Fonts, Spacing, Radius, Shadow } from '../src/constants/theme';
import { fmtCurrency, shortOrderRef } from '../src/utils/format';

const FLUTTERWAVE_PK = process.env.EXPO_PUBLIC_FLUTTERWAVE_PK ?? 'FLWPUBK_TEST-XXXX';
const SERVICE_FEE_RATE = 0.0375;

const DELIVERY_SLOTS = [
  { id: 'asap',     label: 'As soon as ready',   desc: 'Typical 30–60 min' },
  { id: 'lunch',    label: 'Lunch (12 – 2 pm)',   desc: 'Today' },
  { id: 'dinner',   label: 'Dinner (6 – 9 pm)',   desc: 'Today' },
  { id: 'tomorrow', label: 'Tomorrow morning',     desc: 'Before noon' },
];

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
  const feedback = useFeedback();

  const itemId = (course_id ?? product_id) as string;
  const orderTotal = Number(amount ?? 0);
  const curr = currency ?? 'NGN';

  const [txRef, setTxRef] = useState<string | null>(null);
  const [showFW, setShowFW] = useState(false);
  const [paying, setPaying] = useState(false);

  async function handleSuccess(ref: string, transactionId?: string, devMode = false) {
    try {
      if (!devMode) {
        await paymentsApi.verify({ tx_ref: ref, transaction_id: transactionId });
      }
      if (mode === 'course') {
        await coursesApi.enroll(itemId, { tx_ref: ref, amount_paid: orderTotal });
        feedback.success('Enrolled!', 'You can now access all course lessons.');
      } else {
        const res = await digitalProductsApi.purchase(itemId, { tx_ref: ref, amount_paid: orderTotal });
        feedback.success('Purchase complete!', 'Your download is ready.');
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e: any) {
      feedback.error('Payment error', e.error ?? 'Payment succeeded but fulfilment failed. Contact support.');
    }
  }

  async function initPay() {
    setPaying(true);
    try {
      const res = await paymentsApi.initiate({
        amount: orderTotal,
        currency: curr,
        redirect_url: 'foodsbyme://payment-complete',
        meta: { mode, item_id: itemId, user_id: user?.id },
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
<body style="margin:0;background:#FAF6F0;display:flex;align-items:center;justify-content:center;height:100vh;">
<script src="https://checkout.flutterwave.com/v3.js"></script>
<script>
var customer=${safeCustomer};var customizations=${safeCustomizations};
window.onload=function(){FlutterwaveCheckout({
  public_key:${JSON.stringify(FLUTTERWAVE_PK)},tx_ref:${JSON.stringify(txRef??'')},
  amount:${orderTotal},currency:${JSON.stringify(curr)},customer:customer,customizations:customizations,
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
          {mode === 'course' ? 'Enrol in Course' : 'Buy Product'}
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
            <Text style={{ fontFamily: Fonts.sans, fontSize: 14, color: C.bodySoft }}>{mode === 'course' ? 'Enrolment fee' : 'Product price'}</Text>
            <Text style={{ fontFamily: Fonts.sans, fontSize: 14, color: C.textInk }}>{fmtCurrency(orderTotal, curr)}</Text>
          </View>
          <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: C.borderWarm, marginVertical: 8 }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 15, color: C.textInk }}>Total</Text>
            <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 15, color: C.spice }}>{fmtCurrency(orderTotal, curr)}</Text>
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
              <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 15, color: '#fff' }}>Pay securely</Text>
            </View>
          )}
          <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 16, color: '#fff' }}>{fmtCurrency(orderTotal, curr)}</Text>
        </TouchableOpacity>
        <Text style={{ fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft, textAlign: 'center', marginTop: 6 }}>Secured by Flutterwave</Text>
      </SafeAreaView>

      <Modal visible={showFW} animationType="slide" onRequestClose={() => setShowFW(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.borderWarm }}>
            <TouchableOpacity onPress={() => setShowFW(false)}><Ionicons name="close" size={22} color={C.textInk} /></TouchableOpacity>
            <Text style={{ flex: 1, textAlign: 'center', fontFamily: Fonts.sansMedium, fontSize: 16, color: C.textInk }}>Secure payment</Text>
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
  const styles = useMemo(() => makeStyles(C), [C]);

  const [deliveryType, setDeliveryType] = useState<'delivery' | 'pickup'>('delivery');
  const [selectedSlotId, setSelectedSlotId] = useState('asap');
  const [savedAddresses, setSavedAddresses] = useState<string[]>([]);
  const [defaultAddrIdx, setDefaultAddrIdx] = useState(0);
  const [address, setAddress] = useState('');
  const [showAddressPicker, setShowAddressPicker] = useState(false);
  const [customAddress, setCustomAddress] = useState('');
  const [note, setNote] = useState('');
  const [tipPreset, setTipPreset] = useState(0);      // index into TIP_PRESETS
  const [customTipText, setCustomTipText] = useState('');
  const [showFeeTooltip, setShowFeeTooltip] = useState(false);
  const [showFW, setShowFW] = useState(false);
  const [paying, setPaying] = useState(false);
  const [txRef, setTxRef] = useState<string | null>(null);
  const feedback = useFeedback();
  const [error, setError] = useState<string | null>(null);
  const [showAllergenWarning, setShowAllergenWarning] = useState(false);
  const [checkoutAllergenAcked, setCheckoutAllergenAcked] = useState(false);

  // Compute tip amount
  const tipAmount = useMemo(() => {
    const preset = TIP_PRESETS[tipPreset];
    if (!preset) return 0;
    if (preset.value === 0) return 0;
    if ('pct' in preset) return Math.round(total * (preset as any).pct);
    const n = parseFloat(customTipText);
    return isNaN(n) ? 0 : Math.round(n);
  }, [tipPreset, customTipText, total]);

  const serviceFee = deliveryType === 'delivery' ? Math.round(total * SERVICE_FEE_RATE) : 0;
  const orderTotal = total + serviceFee + tipAmount;

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

  // Track checkout_started once when items are present
  useEffect(() => {
    if (items.length > 0) {
      const cookId = items[0]?.cookId;
      trackEvent('checkout_started', { item_count: items.length, total }, { cook_id: cookId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recover an interrupted payment — if we have a saved tx_ref, the user may have
  // been mid-payment when the app was backgrounded or crashed. Restore and show FW.
  useEffect(() => {
    AsyncStorage.getItem('@pending_tx_ref').then(saved => {
      if (saved && !txRef) {
        setTxRef(saved);
        setShowFW(true);
      }
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
        meta: { customer_id: user?.id },
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

    await initiatePayment();
  }

  async function handleAllergenAck() {
    setCheckoutAllergenAcked(true);
    setShowAllergenWarning(false);
    await initiatePayment();
  }

  async function placeOrders(ref: string, transactionId?: string, devMode = false) {
    try {
      if (!devMode) {
        await paymentsApi.verify({ tx_ref: ref, transaction_id: transactionId });
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
        customer_note: note || undefined,
        allergen_acknowledged: items.some(i => i.allergenAcknowledged),
        payment_tx_ref: ref,
        payment_method: devMode ? 'dev_mode' : 'flutterwave',
        delivery_window_start: selectedSlot,
        tip_amount: tipAmount > 0 ? tipAmount : undefined,
      });
      clear();
      await AsyncStorage.removeItem('@pending_tx_ref').catch(() => {});
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const firstId = placed?.[0]?.id;
      router.replace(firstId ? `/confirmation?orderId=${firstId}` : '/confirmation');
    } catch (e: any) {
      setError(e.message ?? 'Could not place order. Please contact support.');
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
<body style="margin:0;background:#FAF6F0;display:flex;align-items:center;justify-content:center;height:100vh;">
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

  if (items.length === 0) {
    return (
      <SafeAreaView style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <Ionicons name="bag-outline" size={48} color={C.stone} style={{ marginBottom: 16 }} />
        <Text style={styles.emptyText}>Your tray is empty.</Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backLink}
          accessibilityLabel="Browse cooks"
          accessibilityRole="button"
        >
          <Text style={styles.backLinkText}>Browse cooks</Text>
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
          <Text style={styles.headerTitle}>Your order</Text>
          <View style={{ width: 44 }} />
        </View>
      </SafeAreaView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: Spacing.lg, gap: 16, paddingBottom: 180 }}
        keyboardShouldPersistTaps="handled"
      >

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
          <Text style={styles.sectionLabel}>Fulfilment</Text>
          <View style={styles.toggleRow}>
            {(['delivery', 'pickup'] as const).map(type => (
              <TouchableOpacity
                key={type}
                style={[styles.toggleBtn, deliveryType === type && styles.toggleBtnActive]}
                onPress={() => { setDeliveryType(type); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                accessibilityLabel={type === 'delivery' ? 'Delivery' : 'Pick up'}
                accessibilityRole="button"
                accessibilityState={{ selected: deliveryType === type }}
              >
                <Ionicons
                  name={type === 'delivery' ? 'bicycle-outline' : 'storefront-outline'}
                  size={16}
                  color={deliveryType === type ? C.canvas : C.body}
                />
                <Text style={[styles.toggleBtnText, deliveryType === type && styles.toggleBtnTextActive]}>
                  {type === 'delivery' ? 'Delivery' : 'Pick up'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Delivery address */}
        {deliveryType === 'delivery' && (
          <View>
            <Text style={styles.sectionLabel}>Delivery address</Text>
            {savedAddresses.length > 0 ? (
              <TouchableOpacity
                style={[styles.card, styles.addrPickerRow]}
                onPress={() => setShowAddressPicker(true)}
                activeOpacity={0.8}
                accessibilityLabel="Select delivery address"
                accessibilityRole="button"
              >
                <View style={styles.locationIcon}>
                  <Ionicons name="location-outline" size={18} color={C.spice} />
                </View>
                <Text style={[styles.addrPickerText, !address && { color: C.bodySoft }]} numberOfLines={2}>
                  {address || 'Select a delivery address'}
                </Text>
                <Ionicons name="chevron-down" size={16} color={C.bodySoft} />
              </TouchableOpacity>
            ) : (
              <View style={[styles.card, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
                <View style={styles.locationIcon}>
                  <Ionicons name="location-outline" size={18} color={C.spice} />
                </View>
                <TextInput
                  style={[styles.addrInput, { flex: 1 }]}
                  placeholder="Enter your delivery address"
                  placeholderTextColor={C.bodySoft}
                  value={address}
                  onChangeText={setAddress}
                  onBlur={() => { if (address.trim()) saveNewAddress(address.trim()); }}
                  multiline={false}
                  accessibilityLabel="Delivery address"
                />
              </View>
            )}
          </View>
        )}

        {/* Delivery slot */}
        <View>
          <Text style={styles.sectionLabel}>When do you want it?</Text>
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
          <Text style={styles.sectionLabel}>Leave a tip for your cook</Text>
          <Text style={styles.tipNote}>Tips go 100% to your cook.</Text>
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
          <Text style={styles.sectionLabel}>Note to cook <Text style={styles.optLabel}>(optional)</Text></Text>
          <View style={styles.card}>
            <TextInput
              style={styles.noteInput}
              placeholder="Any special requests or allergies to flag?"
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
          <Text style={[styles.sectionLabel, { marginBottom: 12 }]}>Order summary</Text>
          {items.map(item => (
            <View key={item.id} style={styles.summaryRow}>
              <Text style={styles.summaryKey} numberOfLines={1}>{item.dishTitle} × {item.qty}</Text>
              <Text style={styles.summaryVal}>{fmtCurrency(item.price * item.qty, currencyCode)}</Text>
            </View>
          ))}
          {deliveryType === 'delivery' && (
            <View style={styles.summaryRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 }}>
                <Text style={styles.summaryKey}>Service fee</Text>
                <TouchableOpacity
                  onPress={() => setShowFeeTooltip(true)}
                  accessibilityLabel="What is the service fee?"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="help-circle-outline" size={14} color={C.bodySoft} />
                </TouchableOpacity>
              </View>
              <Text style={styles.summaryVal}>{fmtCurrency(serviceFee, currencyCode)}</Text>
            </View>
          )}
          {tipAmount > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryKey}>Tip to cook</Text>
              <Text style={[styles.summaryVal, { color: C.leaf }]}>{fmtCurrency(tipAmount, currencyCode)}</Text>
            </View>
          )}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalVal}>{fmtCurrency(orderTotal, currencyCode)}</Text>
          </View>
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
          style={[styles.payBtn, paying && { opacity: 0.6 }]}
          activeOpacity={0.85}
          disabled={paying}
          accessibilityLabel={`Pay ${fmtCurrency(orderTotal, currencyCode)} with Flutterwave`}
          accessibilityRole="button"
        >
          {paying ? (
            <ActivityIndicator color={C.canvas} />
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="lock-closed-outline" size={15} color="rgba(250,246,240,0.7)" />
              <Text style={styles.payLabel}>Pay securely</Text>
            </View>
          )}
          <Text style={styles.payAmount}>{fmtCurrency(orderTotal, currencyCode)}</Text>
        </TouchableOpacity>
        <Text style={styles.holdNote}>
          {deliveryType === 'delivery'
            ? 'Secured by Flutterwave · Slot held for 5 minutes'
            : 'Pick up at the cook\'s kitchen'}
        </Text>
      </SafeAreaView>

      {/* Address picker modal */}
      <Modal visible={showAddressPicker} transparent animationType="slide" onRequestClose={() => setShowAddressPicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Select address</Text>
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
            <View style={styles.newAddrRow}>
              <Ionicons name="add-circle-outline" size={18} color={C.spice} />
              <TextInput
                style={styles.newAddrInput}
                placeholder="Add a new address"
                placeholderTextColor={C.bodySoft}
                value={customAddress}
                onChangeText={setCustomAddress}
                returnKeyType="done"
                accessibilityLabel="New delivery address"
                onSubmitEditing={() => {
                  const trimmed = customAddress.trim();
                  if (trimmed) {
                    setAddress(trimmed);
                    saveNewAddress(trimmed);
                    setCustomAddress('');
                    setShowAddressPicker(false);
                  }
                }}
              />
            </View>
            <TouchableOpacity style={styles.cancelModalBtn} onPress={() => setShowAddressPicker(false)}>
              <Text style={styles.cancelModalText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Service fee tooltip */}
      <Modal visible={showFeeTooltip} transparent animationType="fade" onRequestClose={() => setShowFeeTooltip(false)}>
        <TouchableOpacity style={styles.tooltipOverlay} activeOpacity={1} onPress={() => setShowFeeTooltip(false)}>
          <View style={styles.tooltipBox}>
            <Text style={styles.tooltipTitle}>About the service fee</Text>
            <Text style={styles.tooltipBody}>
              A small 3.75% fee that covers secure payment processing, platform support, and keeping the kitchens running. This fee is never charged on pick-up orders.
            </Text>
            <TouchableOpacity style={styles.tooltipBtn} onPress={() => setShowFeeTooltip(false)}>
              <Text style={styles.tooltipBtnText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Allergen warning modal */}
      <Modal visible={showAllergenWarning} transparent animationType="fade" onRequestClose={() => setShowAllergenWarning(false)}>
        <View style={styles.tooltipOverlay}>
          <View style={[styles.tooltipBox, { maxWidth: 380 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Ionicons name="warning" size={20} color={C.errorFg} />
              <Text style={[styles.tooltipTitle, { color: C.errorFg }]}>Allergen Warning</Text>
            </View>
            <Text style={[styles.tooltipBody, { marginBottom: 12 }]}>
              Your order contains ingredients that match your allergen profile:
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
              <Text style={styles.tooltipBtnText}>I understand, continue</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ alignItems: 'center', marginTop: 12 }} onPress={() => setShowAllergenWarning(false)}>
              <Text style={{ fontFamily: Fonts.sans, fontSize: 13, color: C.bodySoft }}>Go back</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Flutterwave payment modal */}
      <Modal visible={showFW} animationType="slide" onRequestClose={() => setShowFW(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
          <View style={styles.fwHeader}>
            <TouchableOpacity onPress={() => setShowFW(false)} accessibilityLabel="Close payment">
              <Ionicons name="close" size={22} color={C.textInk} />
            </TouchableOpacity>
            <Text style={styles.fwTitle}>Secure payment</Text>
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
                <Text style={styles.fwLoadText}>Loading payment…</Text>
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
    tipBtnAmt: { fontFamily: Fonts.sans, fontSize: 10, color: 'rgba(250,246,240,0.6)', marginTop: 2 },

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
