import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
  RefreshControl, Modal, TextInput, Linking, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const APP_STORE_URL = 'https://apps.apple.com/app/foodsbyme/id6742742898';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.foodsbyme.app';

function promptAppReview(feedback: FeedbackAPI) {
  feedback.confirm({
    title: 'Enjoying FOODS?',
    message: 'Your review helps more people discover amazing home cooks near them.',
    confirmLabel: 'Rate the app',
    cancelLabel: 'Not now',
    onConfirm: () => Linking.openURL(Platform.OS === 'ios' ? APP_STORE_URL : PLAY_STORE_URL),
  });
}
import { ordersApi, type Order, type OrderStatus } from '../../src/api/orders';
import { reviewsApi } from '../../src/api/reviews';
import { connectionsApi } from '../../src/api/connections';
import { useAuth } from '../../src/context/AuthContext';
import { useColors } from '../../src/context/ThemeContext';
import { useFeedback, type FeedbackAPI } from '../../src/components/feedback';
import { Fonts, Spacing, Radius, Shadow } from '../../src/constants/theme';
import { fmtCurrency, fmtDate, shortOrderRef } from '../../src/utils/format';
import { SkeletonOrderCard } from '../../src/components/ui/Skeleton';
import GuestWall from '../../src/components/ui/GuestWall';

const TIP_PRESETS = [200, 500, 1000, 2000];

// ─── Tip modal ────────────────────────────────────────────────────────────────

function TipModal({ order, onClose, onDone }: { order: Order; onClose: () => void; onDone: () => void }) {
  const C = useColors();
  const S = useMemo(() => makeStyles(C), [C]);
  const feedback = useFeedback();
  const [selected, setSelected] = useState<number | null>(null);
  const [custom, setCustom] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const cookName = (order as any).cook_name ?? 'the cook';
  const currencyCode = order.currency_code ?? 'NGN';
  const tipAmount = custom ? parseInt(custom, 10) : selected;

  async function submit() {
    if (!tipAmount || isNaN(tipAmount) || tipAmount < 50) {
      feedback.warn('Enter a valid amount', 'Minimum tip is ₦50.');
      return;
    }
    setSubmitting(true);
    try {
      await ordersApi.addTip(order.id, tipAmount);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      feedback.success(`₦${tipAmount.toLocaleString()} sent!`, `${cookName} will be notified.`);
      onDone();
    } catch (e: any) {
      feedback.error('Could not send tip', e.message ?? 'Try again later.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={S.modalOverlay}>
        <View style={S.modalSheet}>
          <View style={S.modalHandle} />
          <Text style={S.modalTitle}>Thank your cook</Text>
          <Text style={S.modalSub}>A tip goes directly to {cookName}</Text>

          <View style={S.tipGrid}>
            {TIP_PRESETS.map(amt => (
              <TouchableOpacity
                key={amt}
                style={[S.tipChip, selected === amt && !custom && { backgroundColor: C.spice, borderColor: C.spice }]}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelected(amt); setCustom(''); }}
              >
                <Text style={[S.tipChipText, selected === amt && !custom && { color: C.canvas }]}>
                  {fmtCurrency(amt, currencyCode)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            style={S.tipInput}
            placeholder="Other amount (e.g. 1500)"
            placeholderTextColor={C.stone}
            keyboardType="numeric"
            value={custom}
            onChangeText={t => { setCustom(t.replace(/[^0-9]/g, '')); setSelected(null); }}
          />

          <TouchableOpacity
            style={[S.primaryBtn, (!tipAmount || submitting) && { opacity: 0.5 }]}
            onPress={submit}
            disabled={!tipAmount || submitting}
          >
            {submitting
              ? <ActivityIndicator color={C.white} />
              : <Text style={S.primaryBtnText}>Send tip{tipAmount ? ` · ${fmtCurrency(tipAmount, currencyCode)}` : ''}</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={S.ghostBtn} onPress={onDone}>
            <Text style={S.ghostBtnText}>Skip — just leave a review</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const ACTIVE_STATUSES: OrderStatus[] = [
  'pending_payment', 'payment_confirmed', 'payment_failed', 'accepted', 'preparing', 'ready',
  'out_for_delivery', 'in_transit',
];

const CANCELLABLE_STATUSES: OrderStatus[] = ['pending_payment', 'payment_confirmed', 'accepted', 'preparing', 'ready'];

const CANCEL_REASONS = [
  'Changed my mind',
  'Ordered by mistake',
  'Wait time too long',
  'Found a better option',
  'Other',
];

const REPORT_REASONS = [
  'Wrong item received',
  'Missing item(s)',
  'Food quality issue',
  'Delivery issue',
  'Order never arrived',
  'Other',
];

const TABS = ['Active', 'Past'];

// ─── Review modal ─────────────────────────────────────────────────────────────

function ReviewModal({ order, onClose, onSubmitted }: { order: Order; onClose: () => void; onSubmitted: () => void }) {
  const C = useColors();
  const S = useMemo(() => makeStyles(C), [C]);
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState('');
  const feedback = useFeedback();
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (rating === 0) { feedback.warn('Please select a rating'); return; }
    setSubmitting(true);
    try {
      await reviewsApi.submit({ order_id: order.id, rating, body: body.trim() || undefined, photos: [] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSubmitted();
      if (rating >= 4) {
        setTimeout(() => promptAppReview(feedback), 1200);
      } else {
        feedback.success('Thanks!', 'Your feedback helps us improve.');
      }
    } catch (e: any) {
      feedback.error('Error', e.message ?? 'Could not submit review');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={S.modalOverlay}>
        <View style={S.modalSheet}>
          <View style={S.modalHandle} />
          <Text style={S.modalTitle}>Rate your order</Text>
          <Text style={S.modalSub}>{(order as any).item_title ?? 'Your order'}</Text>

          <View style={S.starsRow}>
            {[1, 2, 3, 4, 5].map(s => (
              <TouchableOpacity
                key={s}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setRating(s); }}
                style={S.starBtn}
                accessibilityLabel={`Rate ${s} star${s !== 1 ? 's' : ''}`}
                accessibilityRole="button"
              >
                <Ionicons name={s <= rating ? 'star' : 'star-outline'} size={32} color={s <= rating ? C.spice : C.stone} />
              </TouchableOpacity>
            ))}
          </View>

          <Text style={S.inputLabel}>Tell the cook what you thought (optional)</Text>
          <TextInput
            style={S.reviewTextInput}
            multiline
            placeholder="The food was…"
            placeholderTextColor={C.stone}
            value={body}
            onChangeText={setBody}
          />

          <TouchableOpacity style={[S.primaryBtn, submitting && { opacity: 0.6 }]} onPress={submit} disabled={submitting}>
            {submitting ? <ActivityIndicator color={C.white} /> : <Text style={S.primaryBtnText}>Submit review</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={S.ghostBtn} onPress={onClose}>
            <Text style={S.ghostBtnText}>Not now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Cancel modal ─────────────────────────────────────────────────────────────

function CancelModal({ order, onClose, onCancelled }: { order: Order; onClose: () => void; onCancelled: () => void }) {
  const C = useColors();
  const S = useMemo(() => makeStyles(C), [C]);
  const [reason, setReason] = useState('');
  const feedback = useFeedback();
  const [loading, setLoading] = useState(false);

  async function confirm() {
    setLoading(true);
    try {
      await ordersApi.cancel(order.id, reason || undefined);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      onCancelled();
    } catch (e: any) {
      feedback.error('Could not cancel', e.message ?? 'Please try again or contact support.');
    } finally {
      setLoading(false);
    }
  }

  const isPaid = order.status === 'payment_confirmed';
  const isLateCancellation = ['accepted', 'preparing', 'ready'].includes(order.status);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={S.modalOverlay}>
        <View style={S.modalSheet}>
          <View style={S.modalHandle} />
          <Text style={S.modalTitle}>Cancel this order?</Text>
          <Text style={S.modalSub}>{(order as any).item_title ?? 'Your order'} · {shortOrderRef(order.id)}</Text>

          {isLateCancellation && (
            <View style={[S.infoBanner, { backgroundColor: C.errorBg }]}>
              <Ionicons name="warning-outline" size={16} color={C.errorFg} />
              <Text style={[S.infoBannerText, { color: C.errorFg }]}>
                The cook has already started your order. Late cancellations may affect your reliability score and a partial refund may apply.
              </Text>
            </View>
          )}

          {isPaid && !isLateCancellation && (
            <View style={[S.infoBanner, { backgroundColor: C.warnBg }]}>
              <Ionicons name="information-circle-outline" size={16} color={C.warnFg} />
              <Text style={[S.infoBannerText, { color: C.warnFg }]}>
                A refund will be initiated within 3–5 business days to your original payment method.
              </Text>
            </View>
          )}

          <Text style={[S.inputLabel, { marginTop: 8 }]}>Reason (optional)</Text>
          <View style={S.reasonList}>
            {CANCEL_REASONS.map(r => (
              <TouchableOpacity
                key={r}
                style={[S.reasonChip, reason === r && { backgroundColor: C.bgCook, borderColor: C.spice }]}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setReason(r); }}
              >
                <Text style={[S.reasonChipText, reason === r && { color: C.spice }]}>{r}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[S.destructiveBtn, loading && { opacity: 0.6 }]}
            onPress={confirm}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color={C.white} /> : <Text style={S.primaryBtnText}>Yes, cancel order</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={S.ghostBtn} onPress={onClose}>
            <Text style={S.ghostBtnText}>Keep my order</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Report issue modal ───────────────────────────────────────────────────────

function ReportIssueModal({ order, onClose, onSubmitted }: { order: Order; onClose: () => void; onSubmitted: () => void }) {
  const C = useColors();
  const S = useMemo(() => makeStyles(C), [C]);
  const [reason, setReason] = useState('');
  const [detail, setDetail] = useState('');
  const feedback = useFeedback();
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!reason) { feedback.warn('Please select a reason'); return; }
    setLoading(true);
    try {
      await ordersApi.reportIssue(order.id, { reason, detail: detail.trim() || undefined });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      feedback.success('Report submitted', 'Our team will review your issue and reach out within 24 hours.');
      onSubmitted();
    } catch (e: any) {
      feedback.error('Error', e.message ?? 'Could not submit report. Please email help@foodsbyme.com');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={S.modalOverlay}>
        <View style={S.modalSheet}>
          <View style={S.modalHandle} />
          <Text style={S.modalTitle}>Report an issue</Text>
          <Text style={S.modalSub}>{shortOrderRef(order.id)}</Text>

          <Text style={S.inputLabel}>What went wrong?</Text>
          <View style={S.reasonList}>
            {REPORT_REASONS.map(r => (
              <TouchableOpacity
                key={r}
                style={[S.reasonChip, reason === r && { backgroundColor: C.bgCook, borderColor: C.spice }]}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setReason(r); }}
              >
                <Text style={[S.reasonChipText, reason === r && { color: C.spice }]}>{r}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[S.inputLabel, { marginTop: 8 }]}>Additional details (optional)</Text>
          <TextInput
            style={S.reviewTextInput}
            multiline
            placeholder="Describe the issue…"
            placeholderTextColor={C.stone}
            value={detail}
            onChangeText={setDetail}
          />

          <TouchableOpacity
            style={[S.primaryBtn, (!reason || loading) && { opacity: 0.5 }]}
            onPress={submit}
            disabled={!reason || loading}
          >
            {loading ? <ActivityIndicator color={C.white} /> : <Text style={S.primaryBtnText}>Submit report</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={S.ghostBtn} onPress={onClose}>
            <Text style={S.ghostBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Dispute window countdown ─────────────────────────────────────────────────

function DisputeWindowBanner({ closesAt, onDispute }: { closesAt: string; onDispute: () => void }) {
  const C = useColors();
  const S = useMemo(() => makeStyles(C), [C]);

  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.round((new Date(closesAt).getTime() - Date.now()) / 1000))
  );

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setInterval(() =>
      setSecondsLeft(s => Math.max(0, s - 1)), 1000
    );
    return () => clearInterval(timer);
  }, []);

  if (secondsLeft <= 0) return null;

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const isUrgent = secondsLeft < 5 * 60; // last 5 minutes

  return (
    <TouchableOpacity
      style={[S.disputeBanner, { backgroundColor: isUrgent ? C.errorBg : C.warnBg }]}
      onPress={onDispute}
      activeOpacity={0.8}
      accessibilityLabel={`Dispute window closes in ${mins} minutes ${secs} seconds. Tap to report an issue.`}
      accessibilityRole="button"
    >
      <Ionicons name="timer-outline" size={14} color={isUrgent ? C.errorFg : C.warnFg} />
      <Text style={[S.disputeText, { color: isUrgent ? C.errorFg : C.warnFg }]}>
        Dispute window closes in{' '}
        <Text style={{ fontFamily: Fonts.sansMedium }}>
          {mins}:{String(secs).padStart(2, '0')}
        </Text>
      </Text>
      <View style={[S.disputeCta, { backgroundColor: isUrgent ? C.errorFg : C.warnFg }]}>
        <Text style={S.disputeCtaText}>Report</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Active order hero banner ─────────────────────────────────────────────────

function ActiveOrderBanner({ orders, onPress }: { orders: Order[]; onPress: (id: string) => void }) {
  const C = useColors();
  const S = useMemo(() => makeStyles(C), [C]);
  const pulse = React.useRef(new Animated.Value(1)).current;

  const live = orders.find(o => o.status === 'in_transit' || o.status === 'out_for_delivery');
  const top  = live ?? orders[0];
  if (!top) return null;

  const isLive = top.status === 'in_transit' || top.status === 'out_for_delivery';
  const cookName = (top as any).items?.[0]?.cook_name ?? (top as any).cook_name ?? 'Your cook';

  React.useEffect(() => {
    if (!isLive) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.25, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,    duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isLive]);

  const statusLabel: Record<string, string> = {
    pending_payment:   'Awaiting payment',
    payment_confirmed: 'Payment confirmed — waiting for cook',
    accepted:          'Cook accepted your order',
    preparing:         'Being prepared',
    ready:             'Ready — awaiting pickup',
    out_for_delivery:  'Out for delivery',
    in_transit:        'On its way to you',
  };

  return (
    <TouchableOpacity
      style={[S.activeBanner, { backgroundColor: isLive ? C.ink : C.bgCard }]}
      onPress={() => onPress(top.id)}
      activeOpacity={0.85}
    >
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {isLive && (
            <Animated.View style={[S.liveDot, { transform: [{ scale: pulse }] }]} />
          )}
          <Text style={[S.bannerStatus, { color: isLive ? C.canvas : C.spice }]}>
            {statusLabel[top.status] ?? top.status}
          </Text>
        </View>
        <Text style={[S.bannerCook, { color: isLive ? 'rgba(255, 255, 255,0.7)' : C.bodySoft }]}>
          {cookName} · {(top as any).items?.map((i: any) => i.dish_title ?? i.menu_item_title ?? '').filter(Boolean).join(', ') || (top as any).item_title}
        </Text>
        {orders.length > 1 && (
          <Text style={[S.bannerMore, { color: isLive ? 'rgba(255, 255, 255,0.5)' : C.caps }]}>
            +{orders.length - 1} more active order{orders.length - 1 > 1 ? 's' : ''}
          </Text>
        )}
      </View>
      <View style={[S.bannerTrackBtn, { backgroundColor: isLive ? C.spice : C.ink }]}>
        <Ionicons name={isLive ? 'navigate' : 'eye-outline'} size={16} color={C.canvas} />
        <Text style={S.bannerTrackText}>{isLive ? 'Track' : 'View'}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function OrdersScreen() {
  const router = useRouter();
  const C = useColors();
  const S = useMemo(() => makeStyles(C), [C]);
  const { isAuthenticated } = useAuth();

  const [tab, setTab] = useState('Active');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tipOrder, setTipOrder]         = useState<Order | null>(null);
  const [reviewOrder, setReviewOrder]   = useState<Order | null>(null);
  const [cancelOrder, setCancelOrder]   = useState<Order | null>(null);
  const [reportOrder, setReportOrder]   = useState<Order | null>(null);
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set());
  const [reportedIds, setReportedIds] = useState<Set<string>>(new Set());
  const feedback = useFeedback();
  const [befriendingId, setBefriendingId] = useState<string | null>(null);
  const [connectedOrderIds, setConnectedOrderIds] = useState<Set<string>>(new Set());

  const statusConfig = useMemo(() => ({
    pending_payment:   { label: 'Awaiting payment',  color: C.bodySoft },
    payment_failed:    { label: 'Payment failed',    color: C.errorFg },
    payment_confirmed: { label: 'Payment confirmed', color: C.ember },
    accepted:          { label: 'Accepted',           color: C.ember },
    preparing:         { label: 'Being prepared',     color: C.warnFg },
    ready:             { label: 'Ready',              color: C.warnFg },
    out_for_delivery:  { label: 'Out for delivery',   color: C.spice },
    in_transit:        { label: 'On its way',         color: C.spice },
    delivered:         { label: 'Delivered',          color: C.successFg },
    completed:         { label: 'Completed',          color: C.successFg },
    cancelled:         { label: 'Cancelled',          color: C.errorFg },
    refunded:          { label: 'Refunded',           color: C.infoFg },
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
  const pastOrders   = orders.filter(o => !ACTIVE_STATUSES.includes(o.status as OrderStatus));
  const shown = tab === 'Active' ? activeOrders : pastOrders;

  async function handleBefriend(order: Order) {
    const cookUserId = (order as any).cook_user_id;
    if (!cookUserId) { feedback.warn('Not available', 'Cook information not found.'); return; }
    const cookName = (order as any).cook_name ?? 'this cook';
    feedback.confirm({
      title: 'Connect with cook',
      message: `Send a connection request to ${cookName}?`,
      confirmLabel: 'Connect',
      onConfirm: async () => {
        setBefriendingId(order.id);
        try {
          await connectionsApi.request(cookUserId, order.id);
          setConnectedOrderIds(prev => new Set([...prev, order.id]));
          feedback.success('Request sent', `Connection request sent to ${cookName}.`);
        } catch (e: any) {
          const msg = e.error ?? e.message ?? 'Could not send request';
          if (msg.includes('already')) {
            setConnectedOrderIds(prev => new Set([...prev, order.id]));
            feedback.info('Already connected', msg);
          } else {
            feedback.error('Error', msg);
          }
        } finally {
          setBefriendingId(null);
        }
      },
    });
  }

  if (!isAuthenticated) {
    return (
      <GuestWall
        icon="bag-outline"
        title="Your orders live here"
        subtitle="Sign in to see your order history, track deliveries, and reorder your favourites."
      />
    );
  }

  return (
    <View style={S.root}>
      <SafeAreaView>
        <View style={S.topBar}>
          <Text style={S.pageTitle}>Your orders</Text>
        </View>
        <View style={S.tabRow}>
          {TABS.map(t => (
            <TouchableOpacity
              key={t}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setTab(t); }}
              style={[S.tab, tab === t && S.tabActive]}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === t }}
            >
              <Text style={[S.tabLabel, tab === t && S.tabLabelActive]}>
                {t === 'Active' && activeOrders.length > 0 ? `Active (${activeOrders.length})` : t}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </SafeAreaView>

      {!loading && activeOrders.length > 0 && (
        <View style={{ paddingHorizontal: Spacing.lg, paddingTop: 12 }}>
          <ActiveOrderBanner
            orders={activeOrders}
            onPress={id => router.push(`/tracking/${id}` as any)}
          />
        </View>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: Spacing.lg, gap: 12, paddingTop: 12 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={C.spice} />
        }
      >
        {loading ? (
          <>
            <SkeletonOrderCard />
            <SkeletonOrderCard />
            <SkeletonOrderCard />
          </>
        ) : shown.length === 0 ? (
          <View style={S.emptyState}>
            <Ionicons name="bag-outline" size={40} color={C.stone} />
            <Text style={S.emptyText}>{tab === 'Active' ? 'No active orders' : 'No past orders'}</Text>
            <Text style={S.emptySub}>
              {tab === 'Active' ? 'When you claim a portion, it shows up here.' : 'Your order history will appear here.'}
            </Text>
            <TouchableOpacity onPress={() => router.replace('/(customer)')} style={S.browseBtn}>
              <Text style={S.browseBtnText}>Browse cooks</Text>
            </TouchableOpacity>
          </View>
        ) : (
          shown.map(order => {
            const cfg         = statusConfig[order.status] ?? { label: order.status, color: C.bodySoft };
            const isTraceable = ACTIVE_STATUSES.includes(order.status as OrderStatus);
            const isCancellable = CANCELLABLE_STATUSES.includes(order.status as OrderStatus);
            const isCompleted = order.status === 'delivered' || order.status === 'completed';
            const isCancelled = order.status === 'cancelled' || order.status === 'refunded';
            const items       = (order as any).items ?? [];
            const dishSummary = items.map((i: any) => i.dish_title ?? i.menu_item_title ?? '').filter(Boolean).join(', ') || order.item_title;
            const cookName    = items[0]?.cook_name ?? (order as any).cook_name ?? 'Your cook';
            const hasCookUser = !!(order as any).cook_user_id;
            const alreadyConnected = connectedOrderIds.has(order.id);

            return (
              <TouchableOpacity
                key={order.id}
                onPress={() => isTraceable && router.push(`/tracking/${order.id}`)}
                activeOpacity={isTraceable ? 0.8 : 1}
                style={S.card}
                accessibilityLabel={`Order from ${cookName}, ${cfg.label}`}
              >
                {/* Card top row */}
                <View style={S.cardTop}>
                  <View style={[S.statusDot, { backgroundColor: cfg.color }]} />
                  <Text style={[S.statusLabel, { color: cfg.color }]}>{cfg.label}</Text>
                  <Text style={S.dateText}>{fmtDate(order.created_at)}</Text>
                </View>

                <Text style={S.cookName}>{cookName}</Text>
                {dishSummary ? <Text style={S.dishName} numberOfLines={2}>{dishSummary}</Text> : null}

                {/* Ref + amount row */}
                <View style={S.cardBottom}>
                  <Text style={S.refText}>{shortOrderRef(order.id)}</Text>
                  <Text style={S.totalText}>{fmtCurrency(order.total_amount, order.currency_code ?? 'NGN')}</Text>
                </View>

                {/* Track CTA */}
                {isTraceable && (
                  <View style={S.trackCta}>
                    <Ionicons name="navigate-outline" size={14} color={C.spice} />
                    <Text style={S.trackCtaText}>
                      {order.status === 'in_transit' || order.status === 'out_for_delivery'
                        ? 'Track live'
                        : 'View order status'}
                    </Text>
                    <Ionicons name="chevron-forward" size={14} color={C.spice} />
                  </View>
                )}

                {/* Cancel CTA — only before cook accepts */}
                {isCancellable && (
                  <View style={S.actionRow}>
                    <TouchableOpacity
                      style={[S.actionBtn, { borderColor: C.errorFg + '60' }]}
                      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setCancelOrder(order); }}
                      accessibilityLabel="Cancel order"
                      accessibilityRole="button"
                    >
                      <Ionicons name="close-circle-outline" size={14} color={C.errorFg} />
                      <Text style={[S.actionBtnText, { color: C.errorFg }]}>Cancel order</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Payment failed — retry CTA */}
                {order.status === 'payment_failed' && (
                  <View style={S.actionRow}>
                    <TouchableOpacity
                      style={[S.actionBtn, { borderColor: C.errorFg + '60' }]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        const cookId = (order as any).cook_id;
                        if (cookId) {
                          router.push(`/cook/${cookId}` as any);
                        } else {
                          router.replace('/(customer)' as any);
                        }
                      }}
                      accessibilityLabel="Retry order"
                      accessibilityRole="button"
                    >
                      <Ionicons name="refresh-circle-outline" size={14} color={C.errorFg} />
                      <Text style={[S.actionBtnText, { color: C.errorFg }]}>Retry order</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Dispute countdown — delivered orders within the 30-min window */}
                {order.status === 'delivered' && !!(order as any).dispute_window_closes_at && (
                  <DisputeWindowBanner
                    closesAt={(order as any).dispute_window_closes_at}
                    onDispute={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      setReportOrder(order);
                    }}
                  />
                )}

                {/* Past order actions */}
                {isCompleted && (
                  <View style={S.actionRow}>
                    {/* Reorder — goes to cook profile */}
                    <TouchableOpacity
                      style={[S.actionBtn, { borderColor: C.spice + '60' }]}
                      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(`/cook/${order.cook_id}` as any); }}
                      accessibilityLabel="Order again from this cook"
                      accessibilityRole="button"
                    >
                      <Ionicons name="repeat-outline" size={14} color={C.spice} />
                      <Text style={[S.actionBtnText, { color: C.spice }]}>Order again</Text>
                    </TouchableOpacity>

                    <View style={S.actionRight}>
                      {/* Connect with cook */}
                      {hasCookUser && !alreadyConnected && (
                        <TouchableOpacity
                          style={[S.iconBtn, befriendingId === order.id && { opacity: 0.5 }]}
                          onPress={() => handleBefriend(order)}
                          disabled={befriendingId === order.id}
                          accessibilityLabel="Connect with cook"
                          accessibilityRole="button"
                        >
                          {befriendingId === order.id
                            ? <ActivityIndicator size={12} color={C.spice} />
                            : <Ionicons name="person-add-outline" size={13} color={C.spice} />}
                          <Text style={S.iconBtnText}>Connect</Text>
                        </TouchableOpacity>
                      )}
                      {alreadyConnected && (
                        <View style={S.connectedBadge}>
                          <Ionicons name="checkmark-circle" size={13} color={C.successFg} />
                          <Text style={[S.iconBtnText, { color: C.successFg }]}>Connected</Text>
                        </View>
                      )}
                      {/* Tip + Rate */}
                      {!reviewedIds.has(order.id) && (
                        <TouchableOpacity
                          style={S.iconBtn}
                          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setTipOrder(order); }}
                          accessibilityLabel="Rate this order"
                          accessibilityRole="button"
                        >
                          <Ionicons name="star-outline" size={13} color={C.spice} />
                          <Text style={S.iconBtnText}>Rate</Text>
                        </TouchableOpacity>
                      )}
                      {/* Report issue */}
                      {!reportedIds.has(order.id) && (
                        <TouchableOpacity
                          style={S.iconBtn}
                          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setReportOrder(order); }}
                          accessibilityLabel="Report an issue with this order"
                          accessibilityRole="button"
                        >
                          <Ionicons name="flag-outline" size={13} color={C.bodySoft} />
                          <Text style={[S.iconBtnText, { color: C.bodySoft }]}>Issue</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                )}

                {/* Support prompt for cancelled/refunded */}
                {isCancelled && (
                  <View style={[S.cancelledNote, { backgroundColor: C.errorBg }]}>
                    <Ionicons name="information-circle-outline" size={14} color={C.errorFg} />
                    <Text style={[S.cancelledNoteText, { color: C.errorFg }]}>
                      {order.status === 'refunded'
                        ? 'Refund initiated — allow 3–5 business days.'
                        : 'This order was cancelled. Contact help@foodsbyme.com for queries.'}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Modals */}
      {tipOrder && (
        <TipModal
          order={tipOrder}
          onClose={() => setTipOrder(null)}
          onDone={() => { const o = tipOrder; setTipOrder(null); setReviewOrder(o); }}
        />
      )}
      {reviewOrder && (
        <ReviewModal
          order={reviewOrder}
          onClose={() => setReviewOrder(null)}
          onSubmitted={() => { setReviewedIds(prev => new Set([...prev, reviewOrder.id])); setReviewOrder(null); }}
        />
      )}
      {cancelOrder && (
        <CancelModal
          order={cancelOrder}
          onClose={() => setCancelOrder(null)}
          onCancelled={() => { setCancelOrder(null); load(true); }}
        />
      )}
      {reportOrder && (
        <ReportIssueModal
          order={reportOrder}
          onClose={() => setReportOrder(null)}
          onSubmitted={() => { setReportedIds(prev => new Set([...prev, reportOrder.id])); setReportOrder(null); }}
        />
      )}
    </View>
  );
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    root:     { flex: 1, backgroundColor: C.bg },
    topBar:   { paddingHorizontal: Spacing.lg, paddingTop: 16, paddingBottom: 12 },
    pageTitle:{ fontFamily: Fonts.serif, fontSize: 26, color: C.textInk },

    activeBanner: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: Radius.lg,
      padding: 16, borderWidth: 0.5, borderColor: C.borderWarm, ...Shadow.card, marginBottom: 4 },
    liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.spice },
    bannerStatus: { fontFamily: Fonts.sansMedium, fontSize: 13 },
    bannerCook: { fontFamily: Fonts.sans, fontSize: 12, lineHeight: 17 },
    bannerMore: { fontFamily: Fonts.sans, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 },
    bannerTrackBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 9, borderRadius: Radius.md },
    bannerTrackText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: '#FFFFFF' },

    tabRow: { flexDirection: 'row', paddingHorizontal: Spacing.lg, gap: 4, paddingBottom: 4, borderBottomWidth: 0.5, borderBottomColor: C.borderWarm },
    tab:    { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 40 },
    tabActive: { backgroundColor: C.bgCard, borderWidth: 0.5, borderColor: C.borderWarm },
    tabLabel:  { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.bodySoft },
    tabLabelActive: { color: C.textInk },

    card: { backgroundColor: C.bgCard, borderRadius: Radius.lg, padding: 16, borderWidth: 0.5, borderColor: C.borderWarm, ...Shadow.card, gap: 6 },
    cardTop: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
    statusLabel: { fontFamily: Fonts.sansMedium, fontSize: 12, flex: 1 },
    dateText: { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft },
    cookName: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.textInk },
    dishName: { fontFamily: Fonts.sans, fontSize: 13, color: C.body, lineHeight: 18 },
    cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
    refText: { fontFamily: Fonts.sans, fontSize: 11, color: C.caps, letterSpacing: 0.3 },
    totalText: { fontFamily: Fonts.serif, fontSize: 16, color: C.spice },

    trackCta: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingTop: 10, borderTopWidth: 0.5, borderTopColor: C.borderWarm, marginTop: 4 },
    trackCtaText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.spice, flex: 1 },

    actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTopWidth: 0.5, borderTopColor: C.borderWarm, marginTop: 4 },
    actionRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 40, borderWidth: 1 },
    actionBtnText: { fontFamily: Fonts.sansMedium, fontSize: 13 },
    iconBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 40, backgroundColor: C.bgCook, borderWidth: 1, borderColor: C.borderWarm },
    iconBtnText: { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.spice },
    connectedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },

    cancelledNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, borderRadius: Radius.md, padding: 10, marginTop: 4 },
    cancelledNoteText: { fontFamily: Fonts.sans, fontSize: 12, flex: 1, lineHeight: 17 },

    disputeBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: Radius.md, padding: 10, marginTop: 4 },
    disputeText: { fontFamily: Fonts.sans, fontSize: 12, flex: 1, lineHeight: 17 },
    disputeCta: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 40 },
    disputeCtaText: { fontFamily: Fonts.sansMedium, fontSize: 11, color: '#fff' },

    emptyState: { alignItems: 'center', paddingTop: 60, gap: 10 },
    emptyText: { fontFamily: Fonts.sansMedium, fontSize: 15, color: C.textInk },
    emptySub: { fontFamily: Fonts.sans, fontSize: 13, color: C.bodySoft, textAlign: 'center', lineHeight: 20, paddingHorizontal: Spacing.lg },
    browseBtn: { marginTop: 10, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 40, borderWidth: 1, borderColor: C.spice },
    browseBtnText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.spice },

    // Shared modal styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalSheet: { backgroundColor: C.bgCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.lg, gap: 14, paddingBottom: 40 },
    modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: C.borderWarm, alignSelf: 'center', marginBottom: 4 },
    modalTitle: { fontFamily: Fonts.serif, fontSize: 22, color: C.textInk },
    modalSub: { fontFamily: Fonts.sans, fontSize: 13, color: C.bodySoft, marginTop: -6 },

    tipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    tipChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 40, borderWidth: 1.5, borderColor: C.borderWarm, backgroundColor: C.bg },
    tipChipText: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.textInk },
    tipInput: { backgroundColor: C.bg, borderRadius: Radius.md, borderWidth: 0.5, borderColor: C.borderWarm, padding: 12, fontFamily: Fonts.sans, fontSize: 14, color: C.textInk },

    starsRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingVertical: 8 },
    starBtn: { padding: 4 },
    inputLabel: { fontFamily: Fonts.sansMedium, fontSize: 11, color: C.caps, textTransform: 'uppercase', letterSpacing: 0.5 },
    reviewTextInput: { backgroundColor: C.bg, borderRadius: Radius.md, borderWidth: 0.5, borderColor: C.borderWarm, padding: 12, fontFamily: Fonts.sans, fontSize: 14, color: C.textInk, minHeight: 80, textAlignVertical: 'top' },

    reasonList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    reasonChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 40, borderWidth: 1, borderColor: C.borderWarm, backgroundColor: C.bg },
    reasonChipText: { fontFamily: Fonts.sans, fontSize: 13, color: C.body },

    infoBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: Radius.md, padding: 12 },
    infoBannerText: { fontFamily: Fonts.sans, fontSize: 13, flex: 1, lineHeight: 18 },

    primaryBtn: { backgroundColor: C.spice, borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center' },
    primaryBtnText: { fontFamily: Fonts.sansMedium, fontSize: 15, color: C.white },
    destructiveBtn: { backgroundColor: C.errorFg, borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center' },
    ghostBtn: { alignItems: 'center', paddingVertical: 10 },
    ghostBtnText: { fontFamily: Fonts.sans, fontSize: 14, color: C.bodySoft },
  });
}
