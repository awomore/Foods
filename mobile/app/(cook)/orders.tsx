import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl,
  Modal, TextInput, KeyboardAvoidingView, Platform, Pressable, Switch, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ordersApi, type Order, type OrderStatus } from '../../src/api/orders';
import { cooksApi } from '../../src/api/cooks';
import { useAuth } from '../../src/context/AuthContext';
import { Fonts, Spacing, Radius, Shadow } from '../../src/constants/theme';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { useFeedback } from '../../src/components/feedback';
import { useTranslation } from 'react-i18next';
import { fmtCurrency } from '../../src/utils/format';
import { SkeletonOrderCard } from '../../src/components/ui/Skeleton';

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
  const { user } = useAuth();
  const { t: tl } = useTranslation();

  const STATUS_CONFIG = useMemo(() => ({
    pending_payment:  { label: tl('cook_orders.status_awaiting'),  color: C.bodySoft,  bg: C.bgCook },
    payment_confirmed:{ label: tl('cook_orders.status_confirmed'), color: C.infoFg,   bg: C.infoBg },
    accepted:         { label: tl('cook_orders.status_accepted'),  color: C.ember,     bg: C.warnBg },
    preparing:        { label: tl('cook_orders.status_preparing'), color: C.spice,     bg: C.cream },
    ready:            { label: tl('cook_orders.status_ready'),     color: C.successFg, bg: C.successBg },
    out_for_delivery: { label: tl('cook_orders.status_out'),       color: C.spice,     bg: C.cream },
    in_transit:       { label: tl('cook_orders.status_transit'),   color: C.spice,     bg: C.cream },
    delivered:        { label: tl('cook_orders.status_delivered'), color: C.bodySoft,  bg: C.bgCook },
    completed:        { label: tl('cook_orders.status_completed'), color: C.bodySoft,  bg: C.bgCook },
    cancelled:        { label: tl('cook_orders.status_cancelled'), color: C.errorFg,   bg: C.errorBg },
    refunded:         { label: tl('cook_orders.status_refunded'),  color: C.errorFg,   bg: C.errorBg },
  }), [C, tl]);
  const [tab, setTab] = useState('Active');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const feedback = useFeedback();
  const [advancingId, setAdvancingId] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [liveToggling, setLiveToggling] = useState(false);
  const [otpRequired, setOtpRequired] = useState(false);
  const [otpToggling, setOtpToggling] = useState(false);

  // Accept modal — shown when cook accepts to capture prep time + logistics choice
  const [acceptModal, setAcceptModal] = useState<{
    visible: boolean; order: Order | null; prepTime: string; logisticsType: 'relay' | 'off_platform';
  }>({ visible: false, order: null, prepTime: '30', logisticsType: 'relay' });

  // Off-platform dispatch modal — shown when cook dispatches own rider
  const [dispatchModal, setDispatchModal] = useState<{
    visible: boolean; order: Order | null; riderName: string; riderPhone: string; etaMinutes: string;
  }>({ visible: false, order: null, riderName: '', riderPhone: '', etaMinutes: '30' });

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const result = await ordersApi.list({ limit: 50 });
      setOrders((result as any).orders ?? []);
      // Load current live status
      if (user?.cook_id) {
        const { cook } = await cooksApi.get(user.cook_id);
        setIsLive(cook.is_live);
        setOtpRequired(!!(cook as any).otp_required);
      }
    } catch (e) {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.cook_id]);

  async function toggleLive() {
    if (!user?.cook_id) return;
    const next = !isLive;
    setLiveToggling(true);
    try {
      await cooksApi.setLive(user.cook_id, next);
      setIsLive(next);
      if (next) {
        feedback.success('You\'re live!', 'Followers have been notified');
      }
    } catch {
      feedback.error('Error', 'Could not update live status');
    } finally {
      setLiveToggling(false);
    }
  }

  async function toggleOtp() {
    if (!user?.cook_id) return;
    const next = !otpRequired;
    setOtpToggling(true);
    try {
      await cooksApi.update(user.cook_id, { otp_required: next } as any);
      setOtpRequired(next);
    } catch {
      feedback.error('Error', 'Could not update OTP setting');
    } finally {
      setOtpToggling(false);
    }
  }

  useEffect(() => { load(); }, [load]);

  async function advanceOrder(order: Order, nextStatus: OrderStatus, extra?: Record<string, any>) {
    setAdvancingId(order.id);
    try {
      const { order: updated } = await ordersApi.updateStatus(order.id, { status: nextStatus, ...extra });
      setOrders(prev => prev.map(o => o.id === updated.id ? updated : o));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      feedback.error('Error', e.message ?? 'Could not update order');
    } finally {
      setAdvancingId(null);
    }
  }

  function handleAdvance(order: Order) {
    const nextStatus = ADVANCE_MAP[order.status];
    if (!nextStatus) return;

    // Accept: show prep time + logistics modal
    if (order.status === 'payment_confirmed') {
      setAcceptModal({ visible: true, order, prepTime: '30', logisticsType: 'foods_network' });
      return;
    }

    // Out for delivery: if off-platform, show rider details modal
    if (order.status === 'ready' && order.logistics_type === 'off_platform') {
      setDispatchModal({ visible: true, order, riderName: '', riderPhone: '', etaMinutes: '30' });
      return;
    }

    const nextLabel = (STATUS_CONFIG as any)[nextStatus]?.label ?? nextStatus;
    feedback.confirm({
      title: 'Advance order',
      message: `Mark this order as "${nextLabel}"?`,
      confirmLabel: 'Confirm',
      onConfirm: () => advanceOrder(order, nextStatus),
    });
  }

  async function handleAcceptConfirm() {
    const { order, prepTime, logisticsType } = acceptModal;
    if (!order) return;
    setAcceptModal(m => ({ ...m, visible: false }));
    await advanceOrder(order, 'accepted', {
      prep_time_minutes: parseInt(prepTime) || 30,
      logistics_type: logisticsType,
    });
  }

  async function handleDispatchConfirm() {
    const { order, riderName, riderPhone, etaMinutes } = dispatchModal;
    if (!order || !riderName.trim() || !riderPhone.trim()) {
      feedback.error('Missing details', 'Please enter rider name and phone number.');
      return;
    }
    const eta = new Date(Date.now() + (parseInt(etaMinutes) || 30) * 60000).toISOString();
    setDispatchModal(m => ({ ...m, visible: false }));
    await advanceOrder(order, 'out_for_delivery', {
      off_platform_rider_name:  riderName.trim(),
      off_platform_rider_phone: riderPhone.trim(),
      off_platform_eta:         eta,
    });
  }

  const activeOrders = orders.filter(o => ACTIVE_STATUSES.includes(o.status));
  const doneOrders = orders.filter(o => !ACTIVE_STATUSES.includes(o.status));
  const shown = tab === 'Active' ? activeOrders : doneOrders;
  const isRequestsTab = tab === 'Requests';

  // loading handled inline via skeleton cards below

  return (
    <View style={styles.root}>
      {/* ── Accept order modal ─────────────────────────────────────────── */}
      <Modal visible={acceptModal.visible} transparent animationType="slide" onRequestClose={() => setAcceptModal(m => ({ ...m, visible: false }))}>
        <Pressable style={styles.modalOverlay} onPress={() => setAcceptModal(m => ({ ...m, visible: false }))}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%' }}>
            <Pressable>
              <View style={[styles.modalSheet, { backgroundColor: C.bgCard }]}>
                <Text style={[styles.modalTitle, { color: C.textInk }]}>{tl('cook_orders.accept')}</Text>

                <Text style={[styles.modalLabel, { color: C.bodySoft }]}>{tl('cook_orders.prep_time')}</Text>
                <TextInput
                  style={[styles.modalInput, { color: C.textInk, borderColor: C.borderWarm, backgroundColor: C.bg }]}
                  keyboardType="numeric"
                  value={acceptModal.prepTime}
                  onChangeText={v => setAcceptModal(m => ({ ...m, prepTime: v.replace(/[^0-9]/g, '') }))}
                  placeholder="30"
                  placeholderTextColor={C.stone}
                />

                <Text style={[styles.modalLabel, { color: C.bodySoft }]}>{tl('cook_orders.logistics')}</Text>
                <View style={{ gap: 8 }}>
                  {([
                    { type: 'relay',       icon: 'flash-outline',  title: 'Relay by Chowdeck',          sub: 'Auto-dispatch to a Chowdeck rider' },
                    { type: 'off_platform', icon: 'person-outline', title: tl('cook_orders.own_arrangement'), sub: tl('cook_orders.own') },
                  ] as const).map(({ type, icon, title, sub }) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.logisticsOption,
                        { borderColor: acceptModal.logisticsType === type ? C.spice : C.borderWarm, backgroundColor: acceptModal.logisticsType === type ? C.bgCook : C.bg },
                      ]}
                      onPress={() => setAcceptModal(m => ({ ...m, logisticsType: type }))}
                    >
                      <Ionicons
                        name={icon}
                        size={18}
                        color={acceptModal.logisticsType === type ? C.spice : C.bodySoft}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.logisticsTitle, { color: acceptModal.logisticsType === type ? C.textInk : C.bodySoft }]}>
                          {title}
                        </Text>
                        <Text style={[styles.logisticsSub, { color: C.stone }]}>{sub}</Text>
                      </View>
                      {acceptModal.logisticsType === type && <Ionicons name="checkmark-circle" size={18} color={C.spice} />}
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity style={[styles.modalBtn, { backgroundColor: C.ink }]} onPress={handleAcceptConfirm}>
                  <Text style={[styles.modalBtnText, { color: C.canvas }]}>{tl('cook_orders.accept')}</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      {/* ── Off-platform dispatch modal ────────────────────────────────── */}
      <Modal visible={dispatchModal.visible} transparent animationType="slide" onRequestClose={() => setDispatchModal(m => ({ ...m, visible: false }))}>
        <Pressable style={styles.modalOverlay} onPress={() => setDispatchModal(m => ({ ...m, visible: false }))}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%' }}>
            <Pressable>
              <View style={[styles.modalSheet, { backgroundColor: C.bgCard }]}>
                <Text style={[styles.modalTitle, { color: C.textInk }]}>{tl('cook_orders.rider_details')}</Text>
                <Text style={[styles.modalLabel, { color: C.bodySoft }]}>{tl('cook_orders.rider_name')}</Text>
                <TextInput
                  style={[styles.modalInput, { color: C.textInk, borderColor: C.borderWarm, backgroundColor: C.bg }]}
                  value={dispatchModal.riderName}
                  onChangeText={v => setDispatchModal(m => ({ ...m, riderName: v }))}
                  placeholder="e.g. Emeka"
                  placeholderTextColor={C.stone}
                />
                <Text style={[styles.modalLabel, { color: C.bodySoft }]}>{tl('cook_orders.rider_phone')}</Text>
                <TextInput
                  style={[styles.modalInput, { color: C.textInk, borderColor: C.borderWarm, backgroundColor: C.bg }]}
                  value={dispatchModal.riderPhone}
                  onChangeText={v => setDispatchModal(m => ({ ...m, riderPhone: v }))}
                  placeholder="+234..."
                  placeholderTextColor={C.stone}
                  keyboardType="phone-pad"
                />
                <Text style={[styles.modalLabel, { color: C.bodySoft }]}>{tl('cook_orders.eta')}</Text>
                <TextInput
                  style={[styles.modalInput, { color: C.textInk, borderColor: C.borderWarm, backgroundColor: C.bg }]}
                  value={dispatchModal.etaMinutes}
                  onChangeText={v => setDispatchModal(m => ({ ...m, etaMinutes: v.replace(/[^0-9]/g, '') }))}
                  placeholder="30"
                  placeholderTextColor={C.stone}
                  keyboardType="numeric"
                />
                <TouchableOpacity style={[styles.modalBtn, { backgroundColor: C.ink }]} onPress={handleDispatchConfirm}>
                  <Text style={[styles.modalBtnText, { color: C.canvas }]}>{tl('cook_orders.dispatch')}</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      <SafeAreaView>
        <View style={styles.topBar}>
          <Text style={styles.pageTitle}>{tl('cook_orders.title')}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {activeOrders.length > 0 && (
              <View style={styles.countPill}>
                <Text style={styles.countText}>{activeOrders.length} {tl('cook_orders.active_count')}</Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.statsBtn}
              onPress={() => router.push('/(cook)/delivery-stats')}
              activeOpacity={0.7}
            >
              <Ionicons name="bar-chart-outline" size={18} color={C.spice} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.liveBtn, isLive && styles.liveBtnActive]}
              onPress={toggleLive}
              disabled={liveToggling}
              activeOpacity={0.8}
            >
              {liveToggling ? (
                <ActivityIndicator size="small" color={isLive ? '#fff' : C.spice} />
              ) : (
                <>
                  <View style={[styles.liveDot, { backgroundColor: isLive ? '#fff' : C.errorFg }]} />
                  <Text style={[styles.liveBtnText, isLive && { color: '#fff' }]}>
                    {isLive ? tl('cook_orders.live') : tl('cook_orders.go_live')}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
        {/* OTP delivery setting row */}
        <View style={[styles.otpSettingRow, { borderBottomColor: C.borderWarm }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.otpSettingLabel, { color: C.textInk }]}>{tl('cook_orders.otp_title')}</Text>
            <Text style={[styles.otpSettingSub, { color: C.bodySoft }]}>{tl('cook_orders.otp_sub')}</Text>
          </View>
          {otpToggling
            ? <ActivityIndicator size="small" color={C.spice} />
            : <Switch
                value={otpRequired}
                onValueChange={toggleOtp}
                trackColor={{ false: C.borderWarm, true: C.spice }}
                thumbColor="#fff"
              />
          }
        </View>
        <View style={styles.tabRow}>
          {TABS.map(tKey => {
            const tabLabel = tKey === 'Active' ? tl('cook_orders.active')
                           : tKey === 'Done'   ? tl('cook_orders.done')
                           : tl('cook_orders.requests');
            return (
              <TouchableOpacity key={tKey} onPress={() => setTab(tKey)} style={[styles.tab, tab === tKey && styles.tabActive]}>
                <Text style={[styles.tabLabel, tab === tKey && styles.tabLabelActive]}>
                  {tKey === 'Active' && activeOrders.length > 0 ? `${tabLabel} (${activeOrders.length})` : tabLabel}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </SafeAreaView>

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
        ) : isRequestsTab ? (
          <View style={styles.requestsCta}>
            <Ionicons name="mail-outline" size={36} color={C.spice} />
            <Text style={styles.requestsCtaTitle}>{tl('cook_orders.inbox_title')}</Text>
            <Text style={styles.requestsCtaSub}>{tl('cook_orders.inbox_hint')}</Text>
            <TouchableOpacity style={styles.requestsCtaBtn} onPress={() => router.push('/(cook)/enquiries' as any)}>
              <Text style={styles.requestsCtaBtnText}>{tl('cook_orders.go_inbox')}</Text>
              <Ionicons name="arrow-forward" size={14} color={C.canvas} />
            </TouchableOpacity>
          </View>
        ) : shown.length === 0 ? (
          tab === 'Active' ? (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={40} color={C.stone} />
              <Text style={styles.emptyText}>{tl('cook_orders.no_active')}</Text>
              <Text style={styles.emptySub}>
                {isLive ? tl('cook_orders.live_hint') : tl('cook_orders.offline_hint')}
              </Text>
              {!isLive && (
                <TouchableOpacity
                  style={styles.emptyCtaBtn}
                  onPress={toggleLive}
                  disabled={liveToggling}
                >
                  {liveToggling
                    ? <ActivityIndicator size="small" color={C.canvas} />
                    : <Text style={styles.emptyCtaBtnText}>{tl('cook_orders.go_live_now')}</Text>}
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="checkmark-circle-outline" size={40} color={C.stone} />
              <Text style={styles.emptyText}>{tl('cook_orders.no_completed')}</Text>
              <Text style={styles.emptySub}>{tl('cook_orders.completed_hint')}</Text>
            </View>
          )
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
                  <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                    {order.meal_subscription_id && (
                      <View style={[styles.statusPill, { backgroundColor: '#E8F5E9' }]}>
                        <Text style={[styles.statusText, { color: '#2E7D32' }]}>🔄 Sub</Text>
                      </View>
                    )}
                    {order.is_gift && (
                      <View style={[styles.statusPill, { backgroundColor: '#FFF3E0' }]}>
                        <Text style={[styles.statusText, { color: '#E65100' }]}>🎁 Gift</Text>
                      </View>
                    )}
                    <View style={[styles.statusPill, { backgroundColor: s.bg }]}>
                      <Text style={[styles.statusText, { color: s.color }]}>{s.label}</Text>
                    </View>
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

                {order.delivery_address && (
                  <View style={styles.addressRow}>
                    <Ionicons name="location-outline" size={13} color={C.bodySoft} />
                    <Text style={styles.addressText} numberOfLines={2}>{order.delivery_address}</Text>
                  </View>
                )}

                {/* Logistics badge */}
                {order.logistics_type && order.logistics_type !== 'fez' && (
                  <View style={[styles.logisticsBadge, { backgroundColor: order.logistics_type === 'foods_network' ? C.infoBg : C.cream }]}>
                    <Ionicons
                      name={order.logistics_type === 'foods_network' ? 'bicycle-outline' : 'person-outline'}
                      size={12}
                      color={order.logistics_type === 'foods_network' ? C.infoFg : C.bodySoft}
                    />
                    <Text style={[styles.logisticsBadgeText, { color: order.logistics_type === 'foods_network' ? C.infoFg : C.bodySoft }]}>
                      {order.logistics_type === 'foods_network' ? tl('cook_orders.foods_network') : tl('cook_orders.own_rider')}
                    </Text>
                    {order.prep_time_minutes && (
                      <Text style={[styles.logisticsBadgeText, { color: C.stone }]}>
                        · {order.prep_time_minutes} {tl('cook_orders.prep_min')}
                      </Text>
                    )}
                  </View>
                )}

                {/* FOODS Network rider card — shown once a rider has claimed the order */}
                {order.logistics_type === 'foods_network' && !!order.rider_name && (
                  <View style={[styles.otpRow, { backgroundColor: C.infoBg, borderColor: C.infoFg + '50' }]}>
                    <Ionicons name="bicycle-outline" size={14} color={C.infoFg} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.otpLabel, { color: C.bodySoft }]}>{tl('cook_orders.rider_assigned')}</Text>
                      <Text style={[styles.otpCode, { color: C.textInk, fontSize: 14, letterSpacing: 0 }]}>
                        {order.rider_name}
                      </Text>
                    </View>
                    {!!order.rider_phone && (
                      <TouchableOpacity onPress={() => Linking.openURL(`tel:${order.rider_phone}`)}>
                        <Ionicons name="call-outline" size={18} color={C.infoFg} />
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {/* Collection OTP — cook shows this to rider at pickup */}
                {order.otp_enabled && order.collection_otp && !order.collection_otp_verified_at && (
                  <View style={[styles.otpRow, { backgroundColor: C.warnBg ?? C.bgCook, borderColor: C.ember }]}>
                    <Ionicons name="shield-checkmark-outline" size={14} color={C.ember} />
                    <Text style={[styles.otpLabel, { color: C.bodySoft }]}>{tl('cook_orders.collection_code')}</Text>
                    <Text style={[styles.otpCode, { color: C.ember }]}>{order.collection_otp}</Text>
                  </View>
                )}

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
                        <Text style={styles.advanceBtnText}>{tl('cook_orders.mark_as')} {nextLabel}</Text>
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
  statsBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bgCook, borderWidth: 1, borderColor: C.borderWarm },
  liveBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 40, borderWidth: 1.5, borderColor: C.errorFg, minWidth: 72, justifyContent: 'center' },
  liveBtnActive: { backgroundColor: C.errorFg, borderColor: C.errorFg },
  liveBtnText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.errorFg },
  liveDot: { width: 6, height: 6, borderRadius: 3 },

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

  addressRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 6, paddingHorizontal: 2 },
  addressText: { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft, flex: 1, lineHeight: 17 },
  advanceBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.ink, borderRadius: Radius.md, paddingVertical: 12, marginTop: 4 },
  advanceBtnText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.canvas },

  emptyState: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyText: { fontFamily: Fonts.sansMedium, fontSize: 15, color: C.textInk },
  emptySub: { fontFamily: Fonts.sans, fontSize: 13, color: C.bodySoft, textAlign: 'center', lineHeight: 20, paddingHorizontal: Spacing.lg },
  emptyCtaBtn: { marginTop: 6, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 40, backgroundColor: C.spice, minWidth: 140, alignItems: 'center' },
  emptyCtaBtnText: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.canvas },
  requestsCta: { alignItems: 'center', paddingTop: 60, paddingHorizontal: Spacing.lg, gap: 12 },
  requestsCtaTitle: { fontFamily: Fonts.sansMedium, fontSize: 16, color: C.textInk, textAlign: 'center' },
  requestsCtaSub: { fontFamily: Fonts.sans, fontSize: 13, color: C.bodySoft, textAlign: 'center', lineHeight: 20 },
  requestsCtaBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.ink, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 40, marginTop: 4 },
  requestsCtaBtnText: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.canvas },

  // Logistics & OTP
  logisticsBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 40, alignSelf: 'flex-start' as const },
  logisticsBadgeText: { fontFamily: Fonts.sans, fontSize: 11 },
  otpRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: Radius.md, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  otpLabel: { fontFamily: Fonts.sans, fontSize: 12, flex: 1 },
  otpCode: { fontFamily: Fonts.sansMedium, fontSize: 18, letterSpacing: 4 },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: Radius.xl ?? 24, borderTopRightRadius: Radius.xl ?? 24, padding: 24, gap: 12, paddingBottom: 36 },
  modalTitle: { fontFamily: Fonts.sansMedium, fontSize: 18, marginBottom: 4 },
  modalLabel: { fontFamily: Fonts.sans, fontSize: 13, marginTop: 4 },
  modalInput: { borderWidth: 1, borderRadius: Radius.md, padding: 12, fontFamily: Fonts.sans, fontSize: 15 },
  modalBtn: { borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center' as const, marginTop: 8 },
  modalBtnText: { fontFamily: Fonts.sansMedium, fontSize: 15 },
  logisticsOption: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderRadius: Radius.md, padding: 14 },
  logisticsTitle: { fontFamily: Fonts.sansMedium, fontSize: 14 },
  logisticsSub: { fontFamily: Fonts.sans, fontSize: 12, marginTop: 1 },

  // OTP store toggle
  otpSettingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: Spacing.lg, paddingVertical: 10, borderBottomWidth: 1 },
  otpSettingLabel: { fontFamily: Fonts.sansMedium, fontSize: 13 },
  otpSettingSub: { fontFamily: Fonts.sans, fontSize: 11, marginTop: 1 },
}); }
