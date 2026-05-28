import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Modal, Alert, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ordersApi, type Order, type OrderStatus } from '../../src/api/orders';
import { reviewsApi } from '../../src/api/reviews';
import { connectionsApi } from '../../src/api/connections';
import { useColors } from '../../src/context/ThemeContext';
import { Fonts, Spacing, Radius, Shadow } from '../../src/constants/theme';

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

function ReviewModal({ order, onClose, onSubmitted }: { order: Order; onClose: () => void; onSubmitted: () => void }) {
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (rating === 0) { Alert.alert('Please select a rating'); return; }
    setSubmitting(true);
    try {
      await reviewsApi.submit({ order_id: order.id, rating, body: body.trim() || undefined, photos: [] });
      Alert.alert('Thanks!', 'Your review has been submitted.');
      onSubmitted();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Could not submit review');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Rate your order</Text>
          <Text style={styles.modalSub}>{(order as any).item_title ?? 'Your order'}</Text>

          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map(s => (
              <TouchableOpacity key={s} onPress={() => setRating(s)} style={styles.starBtn}>
                <Ionicons
                  name={s <= rating ? 'star' : 'star-outline'}
                  size={32}
                  color={s <= rating ? C.spice : C.stone}
                />
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.reviewInput}>
            <Text style={styles.inputLabel}>Tell the cook what you thought (optional)</Text>
          </View>

          <TextInput
            style={styles.reviewTextInput}
            multiline
            placeholder="The food was…"
            placeholderTextColor={C.stone}
            value={body}
            onChangeText={setBody}
          />

          <TouchableOpacity style={[styles.submitBtn, submitting && { opacity: 0.6 }]} onPress={submit} disabled={submitting}>
            {submitting ? <ActivityIndicator color={C.canvas} /> : <Text style={styles.submitBtnText}>Submit review</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelBtnText}>Not now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function OrdersScreen() {
  const router = useRouter();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);

  const [tab, setTab] = useState('Active');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reviewOrder, setReviewOrder] = useState<Order | null>(null);
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set());
  const [befriendingId, setBefriendingId] = useState<string | null>(null);
  const [connectedOrderIds, setConnectedOrderIds] = useState<Set<string>>(new Set());

  const statusConfig = useMemo(() => ({
    pending_payment:   { label: 'Awaiting payment',  color: C.bodySoft },
    payment_confirmed: { label: 'Payment confirmed', color: C.ember },
    accepted:          { label: 'Accepted',           color: C.ember },
    preparing:         { label: 'Being prepared',     color: C.honey },
    ready:             { label: 'Ready',              color: C.honey },
    out_for_delivery:  { label: 'Out for delivery',   color: C.spice },
    in_transit:        { label: 'On its way',         color: C.spice },
    delivered:         { label: 'Delivered',          color: C.successFg },
    completed:         { label: 'Completed',          color: C.successFg },
    cancelled:         { label: 'Cancelled',          color: C.errorFg },
    refunded:          { label: 'Refunded',           color: C.errorFg },
  } as Record<string, { label: string; color: string }>), [C]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await ordersApi.list();
      setOrders(data.orders ?? []);
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

  async function handleBefriend(order: Order) {
    const cookUserId = (order as any).cook_user_id;
    if (!cookUserId) {
      Alert.alert('Not available', 'Cook information not found for this order.');
      return;
    }
    const cookName = (order as any).items?.[0]?.cook_name ?? (order as any).cook_name ?? 'this cook';
    Alert.alert(
      'Connect with cook',
      `Send a connection request to ${cookName}? They can accept to become a contact.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Connect',
          onPress: async () => {
            setBefriendingId(order.id);
            try {
              await connectionsApi.request(cookUserId, order.id);
              setConnectedOrderIds(prev => new Set([...prev, order.id]));
              Alert.alert('Request sent', `Your connection request has been sent to ${cookName}.`);
            } catch (e: any) {
              const msg = e.error ?? e.message ?? 'Could not send request';
              if (msg.includes('already')) {
                setConnectedOrderIds(prev => new Set([...prev, order.id]));
                Alert.alert('Already connected', msg);
              } else {
                Alert.alert('Error', msg);
              }
            } finally {
              setBefriendingId(null);
            }
          },
        },
      ]
    );
  }

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
            tintColor={C.spice}
          />
        }
      >
        {shown.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="bag-outline" size={40} color={C.stone} />
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
            const cfg = statusConfig[order.status] ?? { label: order.status, color: C.bodySoft };
            const traceable = isTraceable(order.status);
            const items = (order as any).items ?? [];
            const dishSummary = items.map((i: any) => i.dish_title ?? i.menu_item_title ?? '').filter(Boolean).join(', ');
            const cookName = items[0]?.cook_name ?? (order as any).cook_name ?? 'Your cook';
            const isCompleted = order.status === 'delivered' || order.status === 'completed';
            const hasCookUser = !!(order as any).cook_user_id;
            const alreadyConnected = connectedOrderIds.has(order.id);

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
                      <Ionicons name="time-outline" size={12} color={C.bodySoft} />
                      <Text style={styles.windowText}>{(order as any).delivery_window}</Text>
                    </View>
                  ) : <View />}
                  <Text style={styles.totalText}>
                    {fmtCurrency(order.total_amount, (order as any).currency_code ?? 'NGN')}
                  </Text>
                </View>

                {traceable && (
                  <View style={styles.trackCta}>
                    <Ionicons name="map-outline" size={14} color={C.spice} />
                    <Text style={styles.trackCtaText}>Track order</Text>
                    <Ionicons name="chevron-forward" size={14} color={C.spice} />
                  </View>
                )}

                {isCompleted ? (
                  <View style={styles.pastActions}>
                    <TouchableOpacity style={styles.reorderBtn} onPress={() => router.push('/(customer)')}>
                      <Text style={styles.reorderText}>Order again</Text>
                    </TouchableOpacity>
                    <View style={styles.pastActionsRight}>
                      {hasCookUser && !alreadyConnected && (
                        <TouchableOpacity
                          style={[styles.befriendBtn, befriendingId === order.id && { opacity: 0.5 }]}
                          onPress={() => handleBefriend(order)}
                          disabled={befriendingId === order.id}
                        >
                          {befriendingId === order.id
                            ? <ActivityIndicator size={12} color={C.spice} />
                            : <Ionicons name="person-add-outline" size={13} color={C.spice} />}
                          <Text style={styles.befriendBtnText}>Connect</Text>
                        </TouchableOpacity>
                      )}
                      {alreadyConnected && (
                        <View style={styles.connectedBadge}>
                          <Ionicons name="checkmark-circle" size={13} color={C.successFg} />
                          <Text style={styles.connectedText}>Connected</Text>
                        </View>
                      )}
                      {!reviewedIds.has(order.id) && (
                        <TouchableOpacity style={styles.reviewBtn} onPress={() => setReviewOrder(order)}>
                          <Ionicons name="star-outline" size={14} color={C.spice} />
                          <Text style={styles.reviewBtnText}>Rate</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {reviewOrder && (
        <ReviewModal
          order={reviewOrder}
          onClose={() => setReviewOrder(null)}
          onSubmitted={() => {
            setReviewedIds(prev => new Set([...prev, reviewOrder.id]));
            setReviewOrder(null);
          }}
        />
      )}
    </View>
  );
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    topBar: { paddingHorizontal: Spacing.lg, paddingTop: 16, paddingBottom: 12 },
    pageTitle: { fontFamily: Fonts.serif, fontSize: 26, color: C.textInk },

    tabRow: {
      flexDirection: 'row', paddingHorizontal: Spacing.lg, gap: 4, paddingBottom: 4,
      borderBottomWidth: 0.5, borderBottomColor: C.borderWarm,
    },
    tab: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 40 },
    tabActive: { backgroundColor: C.bgCard, borderWidth: 0.5, borderColor: C.borderWarm },
    tabLabel: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.bodySoft },
    tabLabelActive: { color: C.textInk },

    card: {
      backgroundColor: C.bgCard, borderRadius: Radius.lg, padding: 16,
      borderWidth: 0.5, borderColor: C.borderWarm, ...Shadow.card, gap: 6,
    },
    cardTop: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
    statusLabel: { fontFamily: Fonts.sansMedium, fontSize: 12, flex: 1 },
    dateText: { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft },
    cookName: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.textInk },
    dishName: { fontFamily: Fonts.sans, fontSize: 13, color: C.body, lineHeight: 18 },
    cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
    windowPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.cream, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 40 },
    windowText: { fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft },
    totalText: { fontFamily: Fonts.serif, fontSize: 16, color: C.spice },

    trackCta: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      paddingTop: 12, borderTopWidth: 0.5, borderTopColor: C.borderWarm, marginTop: 6,
    },
    trackCtaText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.spice, flex: 1 },

    pastActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTopWidth: 0.5, borderTopColor: C.borderWarm, marginTop: 4 },
    pastActionsRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    reorderBtn: {},
    reorderText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.spice },
    reviewBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 40, borderWidth: 1, borderColor: C.spice + '50' },
    reviewBtnText: { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.spice },
    befriendBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 40, backgroundColor: C.bgCook, borderWidth: 1, borderColor: C.borderWarm },
    befriendBtnText: { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.spice },
    connectedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    connectedText: { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.successFg },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    modalSheet: { backgroundColor: C.bgCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.lg, gap: 14, paddingBottom: 36 },
    modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: C.borderWarm, alignSelf: 'center', marginBottom: 4 },
    modalTitle: { fontFamily: Fonts.serif, fontSize: 22, color: C.textInk },
    modalSub: { fontFamily: Fonts.sans, fontSize: 13, color: C.bodySoft, marginTop: -6 },
    starsRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingVertical: 8 },
    starBtn: { padding: 4 },
    reviewInput: { gap: 6 },
    inputLabel: { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.caps, textTransform: 'uppercase', letterSpacing: 0.5 },
    reviewTextInput: { backgroundColor: C.bg, borderRadius: Radius.md, borderWidth: 0.5, borderColor: C.borderWarm, padding: 12, fontFamily: Fonts.sans, fontSize: 14, color: C.textInk, minHeight: 80, textAlignVertical: 'top' },
    submitBtn: { backgroundColor: C.spice, borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center' },
    submitBtnText: { fontFamily: Fonts.sansMedium, fontSize: 15, color: C.canvas },
    cancelBtn: { alignItems: 'center', paddingVertical: 8 },
    cancelBtnText: { fontFamily: Fonts.sans, fontSize: 14, color: C.bodySoft },

    emptyState: { alignItems: 'center', paddingTop: 60, gap: 10 },
    emptyText: { fontFamily: Fonts.sansMedium, fontSize: 15, color: C.textInk },
    emptySub: { fontFamily: Fonts.sans, fontSize: 13, color: C.bodySoft, textAlign: 'center', lineHeight: 20, paddingHorizontal: Spacing.lg },
    browseBtn: { marginTop: 10, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 40, borderWidth: 1, borderColor: C.spice },
    browseBtnText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.spice },
  });
}
