import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ordersApi, type Order, type OrderStatus } from '../../src/api/orders';
import { Fonts, Spacing, Radius, Shadow } from '../../src/constants/theme';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { fmtCurrency } from '../../src/utils/format';

const ADVANCE_MAP: Record<string, OrderStatus> = {
  accepted:         'preparing',
  preparing:        'ready',
  ready:            'out_for_delivery',
  out_for_delivery: 'in_transit',
  in_transit:       'delivered',
};

const ACTIVE_STATUSES = ['payment_confirmed', 'accepted', 'preparing', 'ready', 'out_for_delivery', 'in_transit'];

const TABS = ['Active', 'Done', 'Requests'];

export default function CookOrders() {
  const router = useRouter();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);

  const STATUS_CONFIG = useMemo(() => ({
    pending_payment:  { label: 'Awaiting payment', color: C.bodySoft,  bg: C.bgCook },
    payment_confirmed:{ label: 'Payment confirmed', color: C.infoFg,   bg: C.infoBg },
    accepted:         { label: 'Accepted',          color: C.ember,     bg: C.warnBg },
    preparing:        { label: 'Preparing',         color: C.spice,     bg: C.cream },
    ready:            { label: 'Ready',             color: C.successFg, bg: C.successBg },
    out_for_delivery: { label: 'Out for delivery',  color: C.spice,     bg: C.cream },
    in_transit:       { label: 'In transit',        color: C.spice,     bg: C.cream },
    delivered:        { label: 'Delivered',         color: C.bodySoft,  bg: C.bgCook },
    completed:        { label: 'Completed',         color: C.bodySoft,  bg: C.bgCook },
    cancelled:        { label: 'Cancelled',         color: C.errorFg,   bg: C.errorBg },
    refunded:         { label: 'Refunded',          color: C.errorFg,   bg: C.errorBg },
  }), [C]);

  const [tab, setTab] = useState('Active');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [advancingId, setAdvancingId] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const result = await ordersApi.list({ limit: 50 });
      setOrders((result as any).orders ?? []);
    } catch (e) {
      console.error('cook orders load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleAdvance(order: Order) {
    const nextStatus = ADVANCE_MAP[order.status];
    if (!nextStatus) return;
    const nextLabel = (STATUS_CONFIG as any)[nextStatus]?.label ?? nextStatus;
    Alert.alert(
      'Advance order',
      `Mark this order as "${nextLabel}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm', onPress: async () => {
            setAdvancingId(order.id);
            try {
              const { order: updated } = await ordersApi.updateStatus(order.id, { status: nextStatus });
              setOrders(prev => prev.map(o => o.id === updated.id ? updated : o));
            } catch (e: any) {
              Alert.alert('Error', e.message ?? 'Could not update order');
            } finally {
              setAdvancingId(null);
            }
          },
        },
      ]
    );
  }

  const activeOrders = orders.filter(o => ACTIVE_STATUSES.includes(o.status));
  const doneOrders = orders.filter(o => !ACTIVE_STATUSES.includes(o.status));
  const shown = tab === 'Active' ? activeOrders : doneOrders;
  const isRequestsTab = tab === 'Requests';

  if (loading) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={C.spice} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <SafeAreaView>
        <View style={styles.topBar}>
          <Text style={styles.pageTitle}>Orders</Text>
          {activeOrders.length > 0 && (
            <View style={styles.countPill}>
              <Text style={styles.countText}>{activeOrders.length} active</Text>
            </View>
          )}
        </View>
        <View style={styles.tabRow}>
          {TABS.map(t => (
            <TouchableOpacity key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabActive]}>
              <Text style={[styles.tabLabel, tab === t && styles.tabLabelActive]}>
                {t === 'Active' && activeOrders.length > 0 ? `Active (${activeOrders.length})` : t}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </SafeAreaView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: Spacing.lg, gap: 12, paddingTop: 12 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={C.spice} />
        }
      >
        {isRequestsTab ? (
          <View style={styles.requestsCta}>
            <Ionicons name="mail-outline" size={36} color={C.spice} />
            <Text style={styles.requestsCtaTitle}>View all enquiries in Inbox</Text>
            <Text style={styles.requestsCtaSub}>Private chef bookings, custom requests and bulk orders are managed in your Inbox tab.</Text>
            <TouchableOpacity style={styles.requestsCtaBtn} onPress={() => router.push('/(cook)/enquiries' as any)}>
              <Text style={styles.requestsCtaBtnText}>Go to Inbox</Text>
              <Ionicons name="arrow-forward" size={14} color={C.canvas} />
            </TouchableOpacity>
          </View>
        ) : shown.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={40} color={C.stone} />
            <Text style={styles.emptyText}>No {tab === 'Active' ? 'active' : 'completed'} orders</Text>
          </View>
        ) : (
          shown.map(order => {
            const s = (STATUS_CONFIG as any)[order.status] ?? { label: order.status, color: C.bodySoft, bg: C.bgCook };
            const nextStatus = ADVANCE_MAP[order.status];
            const nextLabel = nextStatus ? (STATUS_CONFIG as any)[nextStatus]?.label : null;
            const isAdvancing = advancingId === order.id;

            return (
              <View key={order.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.orderId}>{order.id}</Text>
                  <View style={[styles.statusPill, { backgroundColor: s.bg }]}>
                    <Text style={[styles.statusText, { color: s.color }]}>{s.label}</Text>
                  </View>
                </View>

                <Text style={styles.customerName}>{order.customer_name ?? 'Customer'}</Text>
                <Text style={styles.dishName} numberOfLines={2}>{order.item_title ?? 'Order'}</Text>

                {order.customer_note ? (
                  <View style={styles.notePill}>
                    <Ionicons name="chatbubble-outline" size={12} color={C.bodySoft} />
                    <Text style={styles.noteText}>{order.customer_note}</Text>
                  </View>
                ) : null}

                <View style={styles.metaRow}>
                  <View style={styles.metaPill}>
                    <Ionicons name="layers-outline" size={12} color={C.bodySoft} />
                    <Text style={styles.metaText}>× {order.quantity}</Text>
                  </View>
                  <Text style={styles.price}>{fmtCurrency(order.total_amount, order.currency_code)}</Text>
                </View>

                {nextLabel && (
                  <TouchableOpacity
                    style={[styles.advanceBtn, isAdvancing && { opacity: 0.6 }]}
                    onPress={() => handleAdvance(order)}
                    disabled={isAdvancing}
                  >
                    {isAdvancing ? (
                      <ActivityIndicator size="small" color={C.canvas} />
                    ) : (
                      <>
                        <Text style={styles.advanceBtnText}>Mark as {nextLabel}</Text>
                        <Ionicons name="arrow-forward" size={14} color={C.canvas} />
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

function makeStyles(C: AppColors) { return StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: Spacing.lg, paddingTop: 16, paddingBottom: 12 },
  pageTitle: { fontFamily: Fonts.serif, fontSize: 26, color: C.textInk, flex: 1 },
  countPill: { backgroundColor: C.spice, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 40 },
  countText: { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.canvas },

  tabRow: { flexDirection: 'row', paddingHorizontal: Spacing.lg, gap: 4, paddingBottom: 4, borderBottomWidth: 0.5, borderBottomColor: C.borderWarm },
  tab: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 40 },
  tabActive: { backgroundColor: C.bgCard, borderWidth: 0.5, borderColor: C.borderWarm },
  tabLabel: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.bodySoft },
  tabLabelActive: { color: C.textInk },

  card: { backgroundColor: C.bgCard, borderRadius: Radius.lg, padding: 16, borderWidth: 0.5, borderColor: C.borderWarm, ...Shadow.card, gap: 6 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  orderId: { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 40 },
  statusText: { fontFamily: Fonts.sansMedium, fontSize: 12 },
  customerName: { fontFamily: Fonts.sansMedium, fontSize: 15, color: C.textInk },
  dishName: { fontFamily: Fonts.sans, fontSize: 13, color: C.body, lineHeight: 18 },

  notePill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.honey, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  noteText: { fontFamily: Fonts.sans, fontSize: 12, color: C.warnFg, flex: 1 },

  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  metaPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.cream, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 40 },
  metaText: { fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft },
  price: { fontFamily: Fonts.serif, fontSize: 16, color: C.spice },

  advanceBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.ink, borderRadius: Radius.md, paddingVertical: 12, marginTop: 4 },
  advanceBtnText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.canvas },

  emptyState: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyText: { fontFamily: Fonts.sans, fontSize: 15, color: C.bodySoft },
  requestsCta: { alignItems: 'center', paddingTop: 60, paddingHorizontal: Spacing.lg, gap: 12 },
  requestsCtaTitle: { fontFamily: Fonts.sansMedium, fontSize: 16, color: C.textInk, textAlign: 'center' },
  requestsCtaSub: { fontFamily: Fonts.sans, fontSize: 13, color: C.bodySoft, textAlign: 'center', lineHeight: 20 },
  requestsCtaBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.ink, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 40, marginTop: 4 },
  requestsCtaBtnText: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.canvas },
}); }
