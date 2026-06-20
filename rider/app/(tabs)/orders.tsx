import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  RefreshControl, Switch, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { riderApi, type RiderOrder } from '../../src/api/rider';
import { useAuth } from '../../src/context/AuthContext';
import { C, Sp, R, Fs, F } from '../../src/theme';

const STATUS_LABEL: Record<string, string> = {
  ready:            'Ready for pickup',
  out_for_delivery: 'Out for delivery',
  in_transit:       'In transit',
  delivered:        'Delivered',
};

export default function OrdersScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [tab, setTab] = useState<'available' | 'active'>('active');
  const [available, setAvailable] = useState<RiderOrder[]>([]);
  const [active, setActive] = useState<RiderOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [availabilityToggling, setAvailabilityToggling] = useState(false);
  const [claiming, setClaimingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const [avail, mine, profile] = await Promise.all([
        riderApi.getAvailableOrders(),
        riderApi.getMyOrders(),
        riderApi.getMyProfile(),
      ]);
      setAvailable(avail.orders ?? []);
      setActive(mine.orders ?? []);
      setIsAvailable(profile.rider?.is_available ?? false);
    } catch (e: any) {
      setError(e?.error ?? 'Could not load orders');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleAvailability = async () => {
    setAvailabilityToggling(true);
    try {
      const res = await riderApi.setAvailability(!isAvailable);
      setIsAvailable(res.is_available);
    } catch { /* ignore */ } finally {
      setAvailabilityToggling(false);
    }
  };

  const claimOrder = async (order: RiderOrder) => {
    setClaimingId(order.id);
    try {
      await riderApi.claimOrder(order.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await load(true);
      setTab('active');
      router.push(`/delivery/${order.id}` as any);
    } catch (e: any) {
      setError(e?.error ?? 'Could not claim order');
    } finally {
      setClaimingId(null);
    }
  };

  const shown = tab === 'active' ? active : available;

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.greeting}>Hello, {user?.full_name?.split(' ')[0] ?? 'Rider'}</Text>
          <Text style={s.headerSub}>
            {active.length > 0 ? `${active.length} active delivery` : 'No active deliveries'}
          </Text>
        </View>
        <View style={s.availWrap}>
          <Text style={s.availLabel}>{isAvailable ? 'Available' : 'Off duty'}</Text>
          {availabilityToggling
            ? <ActivityIndicator size="small" color={C.spice} />
            : <Switch
                value={isAvailable}
                onValueChange={toggleAvailability}
                trackColor={{ false: C.borderWarm, true: C.spice }}
                thumbColor="#fff"
              />
          }
        </View>
      </View>

      {/* Tabs */}
      <View style={s.tabRow}>
        <TouchableOpacity style={[s.tab, tab === 'active' && s.tabActive]} onPress={() => setTab('active')}>
          <Text style={[s.tabText, tab === 'active' && s.tabTextActive]}>
            {active.length > 0 ? `Active (${active.length})` : 'Active'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tab, tab === 'available' && s.tabActive]} onPress={() => setTab('available')}>
          <Text style={[s.tabText, tab === 'available' && s.tabTextActive]}>
            {available.length > 0 ? `Available (${available.length})` : 'Available'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Error banner */}
      {!!error && (
        <View style={s.errorBanner}>
          <Ionicons name="alert-circle" size={16} color={C.errorFg} />
          <Text style={s.errorText}>{error}</Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={C.spice} />}
      >
        {loading
          ? <ActivityIndicator color={C.spice} style={{ marginTop: 48 }} />
          : shown.length === 0
          ? <EmptyState tab={tab} isAvailable={isAvailable} />
          : shown.map(order => (
              <OrderCard
                key={order.id}
                order={order}
                tab={tab}
                claiming={claiming === order.id}
                onClaim={() => claimOrder(order)}
                onOpen={() => router.push(`/delivery/${order.id}` as any)}
              />
            ))
        }
      </ScrollView>
    </SafeAreaView>
  );
}

function OrderCard({ order, tab, claiming, onClaim, onOpen }: {
  order: RiderOrder; tab: 'active' | 'available';
  claiming: boolean; onClaim: () => void; onOpen: () => void;
}) {
  const statusColor = order.status === 'out_for_delivery' || order.status === 'in_transit'
    ? C.spice : C.infoFg;

  return (
    <TouchableOpacity style={s.card} onPress={tab === 'active' ? onOpen : undefined} activeOpacity={0.85}>
      <View style={s.cardRow}>
        <View style={[s.statusDot, { backgroundColor: statusColor }]} />
        <Text style={s.cardStatus}>{STATUS_LABEL[order.status] ?? order.status}</Text>
        <View style={s.feePill}>
          <Text style={s.feeText}>₦{order.delivery_fee?.toLocaleString()}</Text>
        </View>
      </View>

      <Text style={s.cardCook}>{order.cook_name ?? 'Restaurant'}</Text>
      {order.cook_address && <Text style={s.cardAddr} numberOfLines={1}><Ionicons name="location" size={12} color={C.bodySoft} /> {order.cook_address}</Text>}

      {order.delivery_address && (
        <View style={s.deliveryRow}>
          <Ionicons name="navigate" size={13} color={C.spice} />
          <Text style={s.deliveryAddr} numberOfLines={2}>{order.delivery_address}</Text>
        </View>
      )}

      {order.delivery_fee_payment_method && order.delivery_fee_payment_method !== 'wallet' && (
        <View style={s.cashBadge}>
          <Ionicons name="cash-outline" size={13} color={C.warnFg} />
          <Text style={s.cashText}>Customer pays {order.delivery_fee_payment_method} on delivery</Text>
        </View>
      )}

      {order.otp_enabled && (
        <View style={s.otpBadge}>
          <Ionicons name="shield-checkmark-outline" size={13} color={C.infoFg} />
          <Text style={s.otpBadgeText}>OTP required</Text>
        </View>
      )}

      {tab === 'available' ? (
        <TouchableOpacity style={s.claimBtn} onPress={onClaim} disabled={claiming} activeOpacity={0.85}>
          {claiming ? <ActivityIndicator color="#fff" /> : (
            <>
              <Ionicons name="checkmark-circle" size={18} color="#fff" />
              <Text style={s.claimBtnText}>Accept Order</Text>
            </>
          )}
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={s.openBtn} onPress={onOpen} activeOpacity={0.85}>
          <Text style={s.openBtnText}>View delivery</Text>
          <Ionicons name="arrow-forward" size={15} color={C.spice} />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

function EmptyState({ tab, isAvailable }: { tab: string; isAvailable: boolean }) {
  return (
    <View style={s.empty}>
      <Ionicons name="bicycle-outline" size={52} color={C.stone} />
      <Text style={s.emptyTitle}>
        {tab === 'active' ? 'No active deliveries' : 'No orders nearby'}
      </Text>
      <Text style={s.emptySub}>
        {tab === 'available'
          ? isAvailable ? 'Check back soon — orders will appear here.' : 'Toggle "Available" above to start receiving orders.'
          : 'Accept an order from the Available tab to get started.'}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: C.bg },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Sp.lg, paddingBottom: Sp.md, borderBottomWidth: 1, borderBottomColor: C.borderWarm },
  greeting:     { fontFamily: F.sansMedium, fontSize: Fs.xl, color: C.textInk },
  headerSub:    { fontFamily: F.sans, fontSize: Fs.sm, color: C.bodySoft, marginTop: 2 },
  availWrap:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  availLabel:   { fontFamily: F.sans, fontSize: Fs.sm, color: C.bodySoft },
  tabRow:       { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.borderWarm },
  tab:          { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabActive:    { borderBottomWidth: 2, borderBottomColor: C.spice },
  tabText:      { fontFamily: F.sans, fontSize: Fs.md, color: C.bodySoft },
  tabTextActive:{ fontFamily: F.sansMedium, color: C.spice },
  errorBanner:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.errorBg, margin: Sp.md, padding: 12, borderRadius: R.md },
  errorText:    { fontFamily: F.sans, fontSize: Fs.sm, color: C.errorFg, flex: 1 },
  list:         { padding: Sp.md, gap: 12, paddingBottom: 60 },
  card:         { backgroundColor: C.bg, borderRadius: R.lg, borderWidth: 1, borderColor: C.borderWarm, padding: Sp.md, gap: 6, elevation: 2, shadowColor: '#111827', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
  cardRow:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot:    { width: 8, height: 8, borderRadius: 4 },
  cardStatus:   { fontFamily: F.sansMedium, fontSize: Fs.sm, color: C.textInk, flex: 1 },
  feePill:      { backgroundColor: C.honey, paddingHorizontal: 10, paddingVertical: 3, borderRadius: R.full },
  feeText:      { fontFamily: F.sansMedium, fontSize: Fs.sm, color: C.spice },
  cardCook:     { fontFamily: F.sansMedium, fontSize: Fs.md, color: C.textInk },
  cardAddr:     { fontFamily: F.sans, fontSize: Fs.sm, color: C.bodySoft },
  deliveryRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 5, marginTop: 2 },
  deliveryAddr: { fontFamily: F.sans, fontSize: Fs.sm, color: C.body, flex: 1 },
  cashBadge:    { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.warnBg, paddingHorizontal: 10, paddingVertical: 5, borderRadius: R.sm, alignSelf: 'flex-start' },
  cashText:     { fontFamily: F.sans, fontSize: Fs.xs, color: C.warnFg },
  otpBadge:     { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.infoBg, paddingHorizontal: 10, paddingVertical: 5, borderRadius: R.sm, alignSelf: 'flex-start' },
  otpBadgeText: { fontFamily: F.sans, fontSize: Fs.xs, color: C.infoFg },
  claimBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.spice, borderRadius: R.full, paddingVertical: 12, marginTop: 6 },
  claimBtnText: { fontFamily: F.sansMedium, fontSize: Fs.md, color: '#fff' },
  openBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderColor: C.spice, borderRadius: R.full, paddingVertical: 10, marginTop: 6 },
  openBtnText:  { fontFamily: F.sansMedium, fontSize: Fs.md, color: C.spice },
  empty:        { alignItems: 'center', marginTop: 60, gap: 12, paddingHorizontal: Sp.lg },
  emptyTitle:   { fontFamily: F.sansMedium, fontSize: Fs.lg, color: C.textInk },
  emptySub:     { fontFamily: F.sans, fontSize: Fs.md, color: C.bodySoft, textAlign: 'center', lineHeight: 22 },
});
