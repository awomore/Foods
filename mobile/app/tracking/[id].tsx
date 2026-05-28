import React, { useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ordersApi, type Order, type OrderStatus } from '../../src/api/orders';
import { Colors, Fonts, Spacing, Radius, Shadow } from '../../src/constants/theme';
import Avatar from '../../src/components/ui/Avatar';
import DishPhoto from '../../src/components/ui/DishPhoto';

const ORDER_STEPS: { key: OrderStatus; label: string }[] = [
  { key: 'pending_payment',   label: 'Order placed' },
  { key: 'payment_confirmed', label: 'Payment confirmed' },
  { key: 'accepted',          label: 'Cook accepted' },
  { key: 'preparing',         label: 'Being prepared' },
  { key: 'ready',             label: 'Ready for pickup' },
  { key: 'out_for_delivery',  label: 'Out for delivery' },
  { key: 'in_transit',        label: 'On its way to you' },
  { key: 'delivered',         label: 'Delivered' },
];

const STEP_ORDER = ORDER_STEPS.map(s => s.key);

function fmtCurrency(amount: number, currency = 'NGN'): string {
  const symbols: Record<string, string> = { NGN: '₦', KES: 'KSh ', GHS: 'GH₵', ZAR: 'R', EGP: 'E£' };
  return (symbols[currency] ?? currency + ' ') + Number(amount).toLocaleString('en-NG', { maximumFractionDigits: 0 });
}

function fmtTime(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
}

export default function TrackingScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = React.useState<Order | null>(null);
  const [loading, setLoading] = React.useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const { order: o } = await ordersApi.get(id!);
      setOrder(o);
      if (o.status === 'delivered' || o.status === 'cancelled' || o.status === 'refunded') {
        if (pollRef.current) clearInterval(pollRef.current);
      }
    } catch (e) {
      console.error('tracking load error:', e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
    pollRef.current = setInterval(load, 20000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [load]);

  if (loading) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={Colors.spice} />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center', padding: 24 }]}>
        <Text style={{ fontFamily: Fonts.sans, fontSize: 15, color: Colors.bodySoft }}>Order not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 14, color: Colors.spice }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const activeIdx = STEP_ORDER.indexOf(order.status as OrderStatus);
  const activeStep = ORDER_STEPS[activeIdx];

  const cookName = order.cook_name ?? 'Your cook';
  const cookInitial = cookName.charAt(0).toUpperCase();
  const dishTitle = order.item_title ?? 'Your meal';
  const isCancelled = order.status === 'cancelled' || order.status === 'refunded';

  return (
    <View style={styles.root}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={Colors.textInk} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Tracking your order</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: Spacing.lg, gap: 16, paddingBottom: 48 }}>

          {/* Status headline */}
          <View style={styles.statusCard}>
            <View style={[styles.statusDotLg, { backgroundColor: isCancelled ? Colors.errorFg : Colors.leaf }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.statusLabel}>{activeStep?.label ?? order.status}</Text>
              {order.estimated_arrival && (
                <Text style={styles.statusEta}>Estimated arrival: {fmtTime(order.estimated_arrival)}</Text>
              )}
            </View>
            {order.estimated_arrival && (
              <View style={styles.etaPill}>
                <Text style={styles.etaText}>ETA {fmtTime(order.estimated_arrival)}</Text>
              </View>
            )}
          </View>

          {/* Map placeholder */}
          <View style={styles.mapBox}>
            <View style={styles.mapInner}>
              <Ionicons name="map-outline" size={40} color={Colors.bodySoft} style={{ opacity: 0.4 }} />
              <Text style={styles.mapLabel}>Live map</Text>
            </View>
            {(order.status === 'in_transit' || order.status === 'out_for_delivery') && (
              <View style={styles.riderPin}>
                <Ionicons name="bicycle" size={16} color={Colors.canvas} />
              </View>
            )}
          </View>

          {/* Order ref */}
          <View style={styles.refRow}>
            <Text style={styles.refKey}>Order</Text>
            <Text style={styles.refVal}>{order.id}</Text>
          </View>

          {/* Timeline */}
          <View>
            <Text style={styles.sectionLabel}>Order timeline</Text>
            {ORDER_STEPS.map((step, i) => {
              const done = activeIdx >= 0 && i <= activeIdx && !isCancelled;
              const active = i === activeIdx && !isCancelled;
              return (
                <View key={step.key} style={styles.stepRow}>
                  <View style={styles.stepLeft}>
                    {i > 0 && <View style={[styles.connectorLine, done && styles.connectorDone]} />}
                    <View style={[styles.stepDot, done && styles.stepDotDone, active && styles.stepDotActive]}>
                      {done && !active && <Ionicons name="checkmark" size={10} color={Colors.canvas} />}
                      {active && <View style={styles.stepDotInner} />}
                    </View>
                  </View>
                  <View style={styles.stepContent}>
                    <Text style={[styles.stepLabel, done && styles.stepLabelDone]}>{step.label}</Text>
                  </View>
                </View>
              );
            })}
          </View>

          {/* Rider info */}
          {order.rider_name && (
            <View style={styles.card}>
              <Text style={[styles.sectionLabel, { marginBottom: 12 }]}>Your rider</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={[styles.riderAvatar]}>
                  <Ionicons name="bicycle" size={22} color={Colors.spice} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cookName}>{order.rider_name}</Text>
                </View>
                {order.rider_phone && (
                  <TouchableOpacity style={styles.callBtn}>
                    <Ionicons name="call-outline" size={16} color={Colors.spice} />
                    <Text style={styles.callText}>Call</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {/* Cook card */}
          <View style={styles.card}>
            <Text style={[styles.sectionLabel, { marginBottom: 12 }]}>Your cook</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Avatar name={cookInitial} avatarBg={Colors.ember} size={44} />
              <View style={{ flex: 1 }}>
                <Text style={styles.cookName}>{cookName}</Text>
              </View>
            </View>
          </View>

          {/* Dish summary */}
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <DishPhoto label={dishTitle} height={60} width={60} radius={10} />
              <View style={{ flex: 1 }}>
                <Text style={styles.dishTitle} numberOfLines={2}>{dishTitle}</Text>
                <Text style={styles.dishPrice}>{fmtCurrency(order.total_amount, order.currency_code)}</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontFamily: Fonts.sansMedium, fontSize: 16, color: Colors.textInk },

  statusCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: 16, borderWidth: 0.5, borderColor: Colors.borderWarm, ...Shadow.card },
  statusDotLg: { width: 12, height: 12, borderRadius: 6 },
  statusLabel: { fontFamily: Fonts.sansMedium, fontSize: 14, color: Colors.textInk },
  statusEta: { fontFamily: Fonts.sans, fontSize: 12, color: Colors.bodySoft, marginTop: 2 },
  etaPill: { backgroundColor: Colors.successBg, borderRadius: 40, paddingHorizontal: 10, paddingVertical: 4 },
  etaText: { fontFamily: Fonts.sansMedium, fontSize: 12, color: Colors.successFg },

  mapBox: { height: 200, borderRadius: Radius.lg, overflow: 'hidden', backgroundColor: Colors.cream, borderWidth: 0.5, borderColor: Colors.borderWarm, position: 'relative' },
  mapInner: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  mapLabel: { fontFamily: Fonts.sans, fontSize: 13, color: Colors.bodySoft, opacity: 0.6 },
  riderPin: { position: 'absolute', bottom: 40, left: '55%', width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.spice, alignItems: 'center', justifyContent: 'center', ...Shadow.card },

  refRow: { flexDirection: 'row', justifyContent: 'space-between' },
  refKey: { fontFamily: Fonts.sans, fontSize: 13, color: Colors.bodySoft },
  refVal: { fontFamily: Fonts.sansMedium, fontSize: 13, color: Colors.textInk },

  sectionLabel: { fontFamily: Fonts.sansMedium, fontSize: 14, color: Colors.textInk, marginBottom: 10 },

  stepRow: { flexDirection: 'row', gap: 14, minHeight: 40 },
  stepLeft: { width: 20, alignItems: 'center' },
  connectorLine: { position: 'absolute', top: -20, bottom: 12, width: 1.5, backgroundColor: Colors.borderWarm, left: 9 },
  connectorDone: { backgroundColor: Colors.spice },
  stepDot: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.borderWarm, backgroundColor: Colors.bgCard, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  stepDotDone: { backgroundColor: Colors.spice, borderColor: Colors.spice },
  stepDotActive: { backgroundColor: Colors.ember, borderColor: Colors.ember },
  stepDotInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.canvas },
  stepContent: { flex: 1, paddingBottom: 20 },
  stepLabel: { fontFamily: Fonts.sans, fontSize: 13, color: Colors.stone, lineHeight: 20 },
  stepLabelDone: { color: Colors.textInk },

  card: { backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: 16, borderWidth: 0.5, borderColor: Colors.borderWarm, ...Shadow.card },
  riderAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.bgCook, alignItems: 'center', justifyContent: 'center' },
  cookName: { fontFamily: Fonts.sansMedium, fontSize: 14, color: Colors.textInk },
  callBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 40, borderWidth: 1, borderColor: Colors.borderWarm },
  callText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: Colors.spice },
  dishTitle: { fontFamily: Fonts.sans, fontSize: 13, color: Colors.textInk, lineHeight: 18 },
  dishPrice: { fontFamily: Fonts.serif, fontSize: 16, color: Colors.spice, marginTop: 4 },
});
