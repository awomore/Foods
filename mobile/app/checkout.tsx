import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  SafeAreaView, Modal, ActivityIndicator, TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { useCart } from '../src/context/CartContext';
import { paymentsApi } from '../src/api/payments';
import { ordersApi } from '../src/api/orders';
import { useAuth } from '../src/context/AuthContext';
import { Colors, Fonts, Spacing, Radius, Shadow } from '../src/constants/theme';

const FLUTTERWAVE_PK = process.env.EXPO_PUBLIC_FLUTTERWAVE_PK ?? 'FLWPUBK_TEST-XXXX';
const PLATFORM_FEE_RATE = 0.0375;

function fmtCurrency(amount: number, currency = 'NGN'): string {
  const symbols: Record<string, string> = { NGN: '₦', KES: 'KSh ', GHS: 'GH₵', ZAR: 'R', EGP: 'E£' };
  return (symbols[currency] ?? currency + ' ') + Number(amount).toLocaleString('en-NG', { maximumFractionDigits: 0 });
}

export default function CheckoutScreen() {
  const router = useRouter();
  const { items, total, currencyCode, clear } = useCart();
  const { user } = useAuth();

  const [address, setAddress] = useState('');
  const [deliveryWindow, setDeliveryWindow] = useState('');
  const [note, setNote] = useState('');
  const [showFW, setShowFW] = useState(false);
  const [paying, setPaying] = useState(false);
  const [txRef, setTxRef] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const platformFee = Math.round(total * PLATFORM_FEE_RATE);
  const orderTotal = total + platformFee;

  const byCook = items.reduce<Record<string, typeof items>>((acc, item) => {
    (acc[item.cookId] = acc[item.cookId] ?? []).push(item);
    return acc;
  }, {});

  async function handlePayPress() {
    setError(null);
    setPaying(true);
    try {
      const result = await paymentsApi.initiate({
        amount: orderTotal,
        currency: currencyCode,
        redirect_url: 'foodsbyme://payment-complete',
        cart_items: items.map(i => ({ menuItemId: i.menuItemId, qty: i.qty })),
        meta: { customer_id: user?.id },
      });
      setTxRef(result.tx_ref);

      if (result.dev_mode) {
        // In dev mode, skip Flutterwave and go straight to order creation
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

  async function placeOrders(ref: string, transactionId?: string, devMode = false) {
    try {
      if (!devMode) {
        await paymentsApi.verify({ tx_ref: ref, transaction_id: transactionId });
      }

      const { orders: placed } = await ordersApi.place({
        items: items.map(i => ({
          menu_item_id: i.menuItemId,
          quantity: i.qty,
          selected_sides: i.selectedSides,
          removed_sides: i.removedSides,
        })),
        delivery_address: address || undefined,
        customer_note: note || undefined,
        allergen_acknowledged: items.some(i => i.allergenAcknowledged),
        payment_tx_ref: ref,
        payment_method: devMode ? 'dev_mode' : 'flutterwave',
      });

      clear();
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

  const fwHtml = `
<!DOCTYPE html>
<html>
<head><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;background:#FAF6F0;display:flex;align-items:center;justify-content:center;height:100vh;">
<script src="https://checkout.flutterwave.com/v3.js"></script>
<script>
  window.onload = function() {
    FlutterwaveCheckout({
      public_key: "${FLUTTERWAVE_PK}",
      tx_ref: "${txRef ?? ''}",
      amount: ${orderTotal},
      currency: "${currencyCode}",
      customer: { email: "${user?.email ?? 'customer@foodsbyme.com'}", name: "${user?.full_name ?? 'Customer'}" },
      customizations: { title: "FOODSbyme", description: "Your meal order", logo: "" },
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
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={styles.emptyText}>Your tray is empty.</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.backLinkText}>Browse cooks</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={Colors.textInk} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Your order</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: Spacing.lg, gap: 16, paddingBottom: 140 }}>

          {/* Order items by cook */}
          {Object.entries(byCook).map(([cookId, cookItems]) => (
            <View key={cookId} style={styles.card}>
              <View style={styles.cookLabel}>
                <Ionicons name="restaurant-outline" size={14} color={Colors.spice} />
                <Text style={styles.cookLabelText}>{cookItems[0].cookName}</Text>
              </View>
              {cookItems.map(item => (
                <View key={item.id} style={styles.itemRow}>
                  <View style={[styles.itemThumb, { backgroundColor: Colors.ember }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle} numberOfLines={2}>{item.dishTitle}</Text>
                    {item.selectedSides.length > 0 && (
                      <Text style={styles.itemMeta} numberOfLines={1}>with {item.selectedSides.join(', ')}</Text>
                    )}
                    <Text style={styles.itemMeta}>× {item.qty}</Text>
                  </View>
                  <Text style={styles.itemPrice}>{fmtCurrency(item.price * item.qty, currencyCode)}</Text>
                </View>
              ))}
            </View>
          ))}

          {/* Delivery address */}
          <View>
            <Text style={styles.sectionLabel}>Delivery address</Text>
            <View style={[styles.card, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
              <View style={styles.locationIcon}>
                <Ionicons name="location-outline" size={18} color={Colors.spice} />
              </View>
              <TextInput
                style={[styles.addrInput, { flex: 1 }]}
                placeholder="Enter your delivery address"
                placeholderTextColor={Colors.bodySoft}
                value={address}
                onChangeText={setAddress}
                multiline={false}
              />
            </View>
          </View>

          {/* Note to cook */}
          <View>
            <Text style={styles.sectionLabel}>Note to cook (optional)</Text>
            <View style={styles.card}>
              <TextInput
                style={styles.noteInput}
                placeholder="Any special requests?"
                placeholderTextColor={Colors.bodySoft}
                value={note}
                onChangeText={setNote}
                multiline
                numberOfLines={3}
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
            <View style={styles.summaryRow}>
              <Text style={styles.summaryKey}>Platform fee (3.75%)</Text>
              <Text style={styles.summaryVal}>{fmtCurrency(platformFee, currencyCode)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalVal}>{fmtCurrency(orderTotal, currencyCode)}</Text>
            </View>
          </View>

          {error && (
            <View style={styles.errorBox}>
              <Ionicons name="warning-outline" size={16} color={Colors.errorFg} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.payBar}>
          <TouchableOpacity
            onPress={handlePayPress}
            style={[styles.payBtn, paying && { opacity: 0.6 }]}
            activeOpacity={0.85}
            disabled={paying}
          >
            {paying ? (
              <ActivityIndicator color={Colors.canvas} />
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="lock-closed-outline" size={15} color="rgba(250,246,240,0.7)" />
                <Text style={styles.payLabel}>Pay with Flutterwave</Text>
              </View>
            )}
            <Text style={styles.payAmount}>{fmtCurrency(orderTotal, currencyCode)}</Text>
          </TouchableOpacity>
          <Text style={styles.holdNote}>Secure payment · Slot held for 5 minutes</Text>
        </View>
      </SafeAreaView>

      <Modal visible={showFW} animationType="slide" onRequestClose={() => setShowFW(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
          <View style={styles.fwHeader}>
            <TouchableOpacity onPress={() => setShowFW(false)}>
              <Ionicons name="close" size={22} color={Colors.textInk} />
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
                <ActivityIndicator size="large" color={Colors.spice} />
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontFamily: Fonts.sansMedium, fontSize: 16, color: Colors.textInk },

  sectionLabel: { fontFamily: Fonts.sansMedium, fontSize: 14, color: Colors.textInk, marginBottom: 10 },

  card: { backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: 16, borderWidth: 0.5, borderColor: Colors.borderWarm, ...Shadow.card },
  cookLabel: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  cookLabelText: { fontFamily: Fonts.sansMedium, fontSize: 12, color: Colors.spice },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  itemThumb: { width: 44, height: 44, borderRadius: 8 },
  itemTitle: { fontFamily: Fonts.sans, fontSize: 13, color: Colors.textInk, lineHeight: 18 },
  itemMeta: { fontFamily: Fonts.sans, fontSize: 12, color: Colors.bodySoft, marginTop: 2 },
  itemPrice: { fontFamily: Fonts.serif, fontSize: 15, color: Colors.spice, flexShrink: 0 },

  locationIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.bgCook, alignItems: 'center', justifyContent: 'center' },
  addrInput: { fontFamily: Fonts.sans, fontSize: 14, color: Colors.textInk, paddingVertical: 0 },
  noteInput: { fontFamily: Fonts.sans, fontSize: 13, color: Colors.textInk, minHeight: 72, textAlignVertical: 'top' },

  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  summaryKey: { fontFamily: Fonts.sans, fontSize: 13, color: Colors.body, flex: 1, marginRight: 8 },
  summaryVal: { fontFamily: Fonts.sansMedium, fontSize: 13, color: Colors.textInk },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 12, borderTopWidth: 0.5, borderTopColor: Colors.borderWarm },
  totalLabel: { fontFamily: Fonts.sansMedium, fontSize: 14, color: Colors.textInk },
  totalVal: { fontFamily: Fonts.serif, fontSize: 22, color: Colors.spice },

  errorBox: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: Colors.errorBg, borderRadius: Radius.md, padding: 12 },
  errorText: { fontFamily: Fonts.sans, fontSize: 13, color: Colors.errorFg, flex: 1, lineHeight: 18 },

  payBar: { padding: 16, paddingBottom: 36, borderTopWidth: 0.5, borderTopColor: Colors.borderWarm, backgroundColor: Colors.bg },
  payBtn: { backgroundColor: Colors.ink, borderRadius: Radius.lg, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  payLabel: { fontFamily: Fonts.sansMedium, fontSize: 15, color: Colors.canvas },
  payAmount: { fontFamily: Fonts.serif, fontSize: 18, color: Colors.ember },
  holdNote: { fontFamily: Fonts.sans, fontSize: 11, color: Colors.bodySoft, textAlign: 'center', marginTop: 10 },

  emptyText: { fontFamily: Fonts.sans, fontSize: 15, color: Colors.bodySoft },
  backLink: { marginTop: 16 },
  backLinkText: { fontFamily: Fonts.sansMedium, fontSize: 14, color: Colors.spice },

  fwHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 0.5, borderBottomColor: Colors.borderWarm },
  fwTitle: { fontFamily: Fonts.sansMedium, fontSize: 16, color: Colors.textInk },
  fwLoading: { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bg } as any,
  fwLoadText: { fontFamily: Fonts.sans, fontSize: 14, color: Colors.bodySoft, marginTop: 12 },
});
