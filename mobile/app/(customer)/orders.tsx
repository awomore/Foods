import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ordersApi, type Order, type OrderStatus } from '../../src/api/orders';
import { Colors, Fonts, Spacing, Radius, Shadow } from '../../src/constants/theme';

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string }> = {
  pending_payment:   { label: 'Awaiting payment',  color: Colors.bodySoft },
  payment_confirmed: { label: 'Payment confirmed', color: Colors.ember },
  accepted:          { label: 'Accepted',           color: Colors.ember },
  preparing:         { label: 'Being prepared',     color: Colors.honey },
  ready:             { label: 'Ready',              color: Colors.honey },
  out_for_delivery:  { label: 'Out for delivery',   color: Colors.spice },
  in_transit:        { label: 'On its way',         color: Colors.spice },
  delivered:         { label: 'Delivered',          color: Colors.successFg },
  completed:         { label: 'Completed',          color: Colors.successFg },
  cancelled:         { label: 'Cancelled',          color: Colors.errorFg },
  refunded:          { label: 'Refunded',           color: Colors.errorFg },
};

const ACTIVE_STATUSES: OrderStatus[] = [
  'pending_payment', 'payment_confirmed', 'accepted', 'preparing', 'ready',
  'out_for_delivery', 'in_transit',
];

function fmtCurrency(amount: number, currency = 'NGN'): string {
  const symbols: Record<string, string> = { NGN: '₦', KES: 'KSh ', GHS: 'GH₵', ZAR: 'R', EGP: 'E£' };
  return (symbols[currency] ?? currency + ' ') + Number(amount).toLocaleString('en-NG', { maximumFractionDigits: 0 });
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86400000 && d.getDate() === now.getDate()) return 'Today';
  if (diff < 172800000) return 'Yesterday';
  return d.toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short' });
}

const TABS = ['Active', 'Past'];

export default function OrdersScreen() {
  const router = useRouter();
  const [tab, setTab] = useState('Active');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await ordersApi.list();
      setOrders(data);
    } catch (e) {
      console.error('orders load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const activeOrders = orders.filter(o => ACTIVE_STATUSES.includes(o.status as OrderStatus));
  const pastOrders = orders.filter(o => !ACTIVE_STATUSES.includes(o.status as OrderStatus));
  const shown = tab === 'Active' ? activeOrders : pastOrders;

  const isTraceable = (s: string) => s === 'in_transit' || s === 'out_for_delivery';

  if (loading) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={Colors.spice} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <SafeAreaView>
        <View style={styles.topBar}>
          <Text style={styles.pageTitle}>Your orders</Text>
        </View>
        <View style={styles.tabRow}>
          {TABS.map(t => (
            <TouchableOpacity
              key={t}
              onPress={() => setTab(t)}
              style={[styles.tab, tab === t && styles.tabActive]}
            >
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
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(true); }}
            tintColor={Colors.spice}
          />
        }
      >
        {shown.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="bag-outline" size={40} color={Colors.stone} />
            <Text style={styles.emptyText}>
              {tab === 'Active' ? 'No active orders' : 'No past orders'}
            </Text>
            <Text style={styles.emptySub}>
              {tab === 'Active'
                ? 'When you claim a portion, it shows up here.'
                : 'Your order history will appear here.'}
            </Text>
            <TouchableOpacity onPress={() => router.replace('/(customer)')} style={styles.browseBtn}>
              <Text style={styles.browseBtnText}>Browse cooks</Text>
            </TouchableOpacity>
          </View>
        ) : (
          shown.map(order => {
            const cfg = STATUS_CONFIG[order.status as OrderStatus] ?? { label: order.status, color: Colors.bodySoft };
            const traceable = isTraceable(order.status);
            const items = (order as any).items ?? [];
            const dishSummary = items.map((i: any) => i.dish_title ?? i.menu_item_title ?? '').filter(Boolean).join(', ');
            const cookName = items[0]?.cook_name ?? (order as any).cook_name ?? 'Your cook';

            return (
              <TouchableOpacity
                key={order.id}
                onPress={() => traceable && router.push(`/tracking/${order.id}`)}
                activeOpacity={traceable ? 0.8 : 1}
                style={styles.card}
              >
                <View style={styles.cardTop}>
                  <View style={[styles.statusDot, { backgroundColor: cfg.color }]} />
                  <Text style={[styles.statusLabel, { color: cfg.color }]}>{cfg.label}</Text>
                  <Text style={styles.dateText}>{fmtDate(order.created_at)}</Text>
                </View>

                <Text style={styles.cookName}>{cookName}</Text>
                {dishSummary ? (
                  <Text style={styles.dishName} numberOfLines={2}>{dishSummary}</Text>
                ) : null}

                <View style={styles.cardBottom}>
                  {(order as any).delivery_window ? (
                    <View style={styles.windowPill}>
                      <Ionicons name="time-outline" size={12} color={Colors.bodySoft} />
                      <Text style={styles.windowText}>{(order as any).delivery_window}</Text>
                    </View>
                  ) : <View />}
                  <Text style={styles.totalText}>
                    {fmtCurrency(order.total_amount, (order as any).currency_code ?? 'NGN')}
                  </Text>
                </View>

                {traceable && (
                  <View style={styles.trackCta}>
                    <Ionicons name="map-outline" size={14} color={Colors.spice} />
                    <Text style={styles.trackCtaText}>Track order</Text>
                    <Ionicons name="chevron-forward" size={14} color={Colors.spice} />
                  </View>
                )}

                {order.status === 'delivered' || order.status === 'completed' ? (
                  <TouchableOpacity style={styles.reorderBtn} onPress={() => router.push('/(customer)')}>
                    <Text style={styles.reorderText}>Order again</Text>
                  </TouchableOpacity>
                ) : null}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  topBar: { paddingHorizontal: Spacing.lg, paddingTop: 16, paddingBottom: 12 },
  pageTitle: { fontFamily: Fonts.serif, fontSize: 26, color: Colors.textInk },

  tabRow: {
    flexDirection: 'row', paddingHorizontal: Spacing.lg, gap: 4, paddingBottom: 4,
    borderBottomWidth: 0.5, borderBottomColor: Colors.borderWarm,
  },
  tab: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 40 },
  tabActive: { backgroundColor: Colors.bgCard, borderWidth: 0.5, borderColor: Colors.borderWarm },
  tabLabel: { fontFamily: Fonts.sansMedium, fontSize: 14, color: Colors.bodySoft },
  tabLabelActive: { color: Colors.textInk },

  card: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: 16,
    borderWidth: 0.5, borderColor: Colors.borderWarm, ...Shadow.card, gap: 6,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusLabel: { fontFamily: Fonts.sansMedium, fontSize: 12, fontWeight: '600', flex: 1 },
  dateText: { fontFamily: Fonts.sans, fontSize: 12, color: Colors.bodySoft },
  cookName: { fontFamily: Fonts.sansMedium, fontSize: 14, color: Colors.textInk, fontWeight: '600' },
  dishName: { fontFamily: Fonts.sans, fontSize: 13, color: Colors.body, lineHeight: 18 },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  windowPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.cream, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 40 },
  windowText: { fontFamily: Fonts.sans, fontSize: 11, color: Colors.bodySoft },
  totalText: { fontFamily: Fonts.serif, fontSize: 16, color: Colors.spice },

  trackCta: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingTop: 12, borderTopWidth: 0.5, borderTopColor: Colors.borderWarm, marginTop: 6,
  },
  trackCtaText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: Colors.spice, flex: 1, fontWeight: '600' },

  reorderBtn: { paddingTop: 10, borderTopWidth: 0.5, borderTopColor: Colors.borderWarm, marginTop: 4 },
  reorderText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: Colors.spice },

  emptyState: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyText: { fontFamily: Fonts.sansMedium, fontSize: 15, color: Colors.textInk },
  emptySub: { fontFamily: Fonts.sans, fontSize: 13, color: Colors.bodySoft, textAlign: 'center', lineHeight: 20, paddingHorizontal: Spacing.lg },
  browseBtn: { marginTop: 10, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 40, borderWidth: 1, borderColor: Colors.spice },
  browseBtnText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: Colors.spice },
});
