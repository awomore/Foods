import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { healthKitchenApi, type Subscriber, type FeedingHistory, type DailySummary, SPECIALISATION_LABELS } from '../../src/api/healthKitchen';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { useAuth } from '../../src/context/AuthContext';
import { Fonts, Spacing, Radius, Shadow } from '../../src/constants/theme';
import { fmtCurrency, relativeTime } from '../../src/utils/format';
import { Bone } from '../../src/components/ui/Skeleton';
import Avatar from '../../src/components/ui/Avatar';
import { useTranslation } from 'react-i18next';

type View_ = 'list' | 'history';

export default function HealthSubscribersScreen() {
  const router   = useRouter();
  const C        = useColors();
  const styles   = useMemo(() => makeStyles(C), [C]);
  const { user } = useAuth();
  const { t }    = useTranslation();

  const [view, setView]               = useState<View_>('list');
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [activeUser, setActiveUser]   = useState<Subscriber | null>(null);
  const [history, setHistory]         = useState<FeedingHistory | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { subscribers: s } = await healthKitchenApi.mySubscribers();
      setSubscribers(s);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function openHistory(sub: Subscriber) {
    setActiveUser(sub);
    setView('history');
    setHistoryLoading(true);
    try {
      const h = await healthKitchenApi.getFeedingHistory(sub.user_id);
      setHistory(h);
    } catch {
      setHistory(null);
    } finally {
      setHistoryLoading(false);
    }
  }

  // ── Subscriber list ──────────────────────────────────────────────────────────
  if (view === 'list') {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={C.ink} />
          </TouchableOpacity>
          <Text style={styles.title}>{t('cook_health_subscribers.title')}</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={C.spice} />}
          contentContainerStyle={{ padding: Spacing.lg, gap: 10, paddingBottom: 40 }}
        >
          {loading ? (
            <View style={{ gap: 10, marginTop: 4 }}>
              <Bone width="100%" height={80} radius={12} />
              <Bone width="100%" height={80} radius={12} />
              <Bone width="100%" height={80} radius={12} />
            </View>
          ) : subscribers.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={40} color={C.stone} />
              <Text style={styles.emptyTitle}>{t('cook_health_subscribers.no_subscribers')}</Text>
              <Text style={styles.emptyBody}>{t('cook_health_subscribers.no_subscribers_hint')}</Text>
              <TouchableOpacity
                onPress={() => Share.share({ message: t('cook_health_subscribers.share_message', { name: user?.full_name ?? t('cook_health_subscribers.me_fallback'), username: user?.username ?? '' }) }).catch(() => {})}
                style={styles.emptyBtn}
              >
                <Ionicons name="share-outline" size={16} color={C.canvas} />
                <Text style={styles.emptyBtnText}>{t('cook_health_subscribers.share_health_kitchen')}</Text>
              </TouchableOpacity>
            </View>
          ) : subscribers.map(sub => (
            <TouchableOpacity key={sub.user_id} style={styles.subCard} onPress={() => openHistory(sub)} activeOpacity={0.85}>
              <Avatar name={sub.full_name} avatarUrl={sub.avatar_url} size={44} />
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={styles.subName}>{sub.full_name}</Text>
                {sub.active_plan_title && (
                  <Text style={styles.subPlan} numberOfLines={1}>{sub.active_plan_title}</Text>
                )}
                {sub.conditions?.length > 0 && (
                  <Text style={styles.subConditions} numberOfLines={1}>
                    {sub.conditions.map(c => SPECIALISATION_LABELS[c] ?? c).join(' · ')}
                  </Text>
                )}
              </View>
              <View style={styles.subMeta}>
                <Text style={styles.subMetaText}>{relativeTime(sub.granted_at)}</Text>
                <Ionicons name="chevron-forward" size={14} color={C.bodySoft} />
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Feeding history ──────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => { setView('list'); setHistory(null); }} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{activeUser?.full_name}</Text>
        <View style={{ width: 40 }} />
      </View>

      {historyLoading ? (
        <View style={{ flex: 1, padding: Spacing.lg, gap: 12 }}>
          <Bone width="100%" height={80} radius={12} />
          <Bone width="100%" height={80} radius={12} />
          <Bone width="100%" height={80} radius={12} />
        </View>
      ) : !history ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>{t('cook_health_subscribers.load_error')}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: Spacing.lg, gap: 16, paddingBottom: 50 }}>

          {/* Health profile context */}
          {history.health_profile && (
            <View style={styles.healthCard}>
              <Text style={styles.cardLabel}>{t('cook_health_subscribers.health_profile')}</Text>
              {history.health_profile.conditions?.length > 0 && (
                <Row label={t('cook_health_subscribers.conditions')} value={history.health_profile.conditions.map(c => SPECIALISATION_LABELS[c] ?? c).join(', ')} C={C} />
              )}
              {history.health_profile.allergens?.length > 0 && (
                <Row label={t('cook_health_subscribers.allergens')} value={history.health_profile.allergens.join(', ')} C={C} />
              )}
              {history.health_profile.dietary_preferences?.length > 0 && (
                <Row label={t('cook_health_subscribers.dietary_prefs')} value={history.health_profile.dietary_preferences.join(', ')} C={C} />
              )}
              {history.health_profile.health_goals?.length > 0 && (
                <Row label={t('cook_health_subscribers.goals')} value={history.health_profile.health_goals.join(', ')} C={C} />
              )}
              {history.health_profile.health_notes && (
                <Row label={t('cook_health_subscribers.notes')} value={history.health_profile.health_notes} C={C} />
              )}
            </View>
          )}

          {/* 30-day daily summary */}
          {history.daily_summary.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardLabel}>{t('cook_health_subscribers.summary_30day')}</Text>
              <View style={styles.summaryStats}>
                <StatBox label={t('cook_health_subscribers.total_orders')} value={String(history.daily_summary.reduce((s, d) => s + d.order_count, 0))} C={C} styles={styles} />
                <StatBox label={t('cook_health_subscribers.total_spend')} value={fmtCurrency(history.daily_summary.reduce((s, d) => s + Number(d.total_spend), 0), 'NGN')} C={C} styles={styles} />
                <StatBox label={t('cook_health_subscribers.avg_daily_kcal')} value={
                  history.daily_summary.filter(d => d.total_calories > 0).length > 0
                    ? String(Math.round(history.daily_summary.reduce((s, d) => s + d.total_calories, 0) / Math.max(1, history.daily_summary.filter(d => d.total_calories > 0).length)))
                    : '–'
                } C={C} styles={styles} />
              </View>

              {/* Simple bar chart — calories per day */}
              {history.daily_summary.some(d => d.total_calories > 0) && (
                <View style={{ marginTop: 12 }}>
                  <Text style={styles.miniLabel}>{t('cook_health_subscribers.daily_calories_30d')}</Text>
                  <CalorieBar data={history.daily_summary} C={C} />
                </View>
              )}
            </View>
          )}

          {/* Recent orders */}
          {history.orders.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardLabel}>{t('cook_health_subscribers.order_history_90d')}</Text>
              {history.orders.slice(0, 30).map((order, i) => (
                <View key={order.id}>
                  {i > 0 && <View style={{ height: 0.5, backgroundColor: C.borderWarm }} />}
                  <View style={styles.orderRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.orderTitle} numberOfLines={1}>{order.item_title}</Text>
                      <Text style={styles.orderMeta}>{relativeTime(order.created_at)}{order.calories ? ` · ${t('cook_health_subscribers.kcal', { count: order.calories })}` : ''}</Text>
                    </View>
                    <Text style={styles.orderPrice}>{fmtCurrency(order.total_price, 'NGN')}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Row({ label, value, C }: { label: string; value: string; C: AppColors }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 }}>
      <Text style={{ fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft }}>{label}</Text>
      <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 12, color: C.textInk, flex: 1, textAlign: 'right', marginLeft: 8 }}>{value}</Text>
    </View>
  );
}

function StatBox({ label, value, C, styles }: any) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function CalorieBar({ data, C }: { data: DailySummary[]; C: AppColors }) {
  const maxCal = Math.max(...data.map(d => d.total_calories), 1);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 50, marginTop: 6 }}>
      {data.map((d, i) => (
        <View
          key={i}
          style={{
            flex: 1, borderRadius: 2,
            height: Math.max(2, (d.total_calories / maxCal) * 50),
            backgroundColor: d.total_calories > 0 ? C.spice : C.borderWarm,
          }}
        />
      ))}
    </View>
  );
}

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    root:        { flex: 1, backgroundColor: C.bg },
    header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingTop: 16, paddingBottom: 12, gap: 8 },
    backBtn:     { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    title:       { flex: 1, fontFamily: Fonts.serif, fontSize: 22, color: C.textInk, textAlign: 'center' },
    empty:       { alignItems: 'center', paddingVertical: 60, gap: 10 },
    emptyTitle:  { fontFamily: Fonts.sansMedium, fontSize: 16, color: C.textInk },
    emptyBody:   { fontFamily: Fonts.sans, fontSize: 13, color: C.bodySoft, textAlign: 'center', lineHeight: 19, paddingHorizontal: Spacing.lg },
    emptyBtn:    { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.spice, borderRadius: Radius.full, paddingHorizontal: 20, paddingVertical: 10, marginTop: 4 },
    emptyBtnText:{ fontFamily: Fonts.sansMedium, fontSize: 14, color: C.canvas },
    subCard:     { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.bgCard, borderRadius: Radius.lg, padding: 14, borderWidth: 0.5, borderColor: C.borderWarm, ...Shadow.card },
    subName:     { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.textInk },
    subPlan:     { fontFamily: Fonts.sans, fontSize: 12, color: C.spice },
    subConditions:{ fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft },
    subMeta:     { alignItems: 'flex-end', gap: 4 },
    subMetaText: { fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft },
    card:        { backgroundColor: C.bgCard, borderRadius: Radius.lg, padding: 14, borderWidth: 0.5, borderColor: C.borderWarm, ...Shadow.card, gap: 8 },
    healthCard:  { backgroundColor: C.successBg, borderRadius: Radius.lg, padding: 14, borderWidth: 0.5, borderColor: C.leaf + '40', gap: 4 },
    cardLabel:   { fontFamily: Fonts.sansMedium, fontSize: 11, color: C.bodySoft, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 },
    miniLabel:   { fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft },
    summaryStats:{ flexDirection: 'row', gap: 8 },
    statBox:     { flex: 1, backgroundColor: C.bg, borderRadius: Radius.md, padding: 10, alignItems: 'center', gap: 2 },
    statValue:   { fontFamily: Fonts.serif, fontSize: 16, color: C.textInk },
    statLabel:   { fontFamily: Fonts.sans, fontSize: 10, color: C.bodySoft, textAlign: 'center' },
    orderRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
    orderTitle:  { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.textInk },
    orderMeta:   { fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft, marginTop: 2 },
    orderPrice:  { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.spice },
  });
}
