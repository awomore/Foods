import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { cravingsApi, type Craving } from '../../src/api/cravings';
import { Fonts, Spacing, Radius, Shadow } from '../../src/constants/theme';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { Bone } from '../../src/components/ui/Skeleton';
import { useFeedback } from '../../src/components/feedback';
import { trackEvent } from '../../src/utils/analytics';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DishGroup {
  title: string;
  count: number;
  cravings: Craving[];
  menuItemId: string | null;
}

interface TrendDay {
  label: string;
  count: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function groupByDish(cravings: Craving[]): DishGroup[] {
  const map = new Map<string, DishGroup>();
  for (const c of cravings) {
    const key = c.dish_title.trim().toLowerCase();
    if (!map.has(key)) {
      map.set(key, { title: c.dish_title, count: 0, cravings: [], menuItemId: c.menu_item_id });
    }
    const g = map.get(key)!;
    g.count++;
    g.cravings.push(c);
    if (!g.menuItemId && c.menu_item_id) g.menuItemId = c.menu_item_id;
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

function buildTrend(cravings: Craving[]): TrendDay[] {
  const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const days: (TrendDay & { iso: string })[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({ label: DAY_LABELS[d.getDay()], iso: d.toDateString(), count: 0 });
  }
  for (const c of cravings) {
    const key = new Date(c.created_at).toDateString();
    const slot = days.find(d => d.iso === key);
    if (slot) slot.count++;
  }
  return days;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function CravingIntelligence() {
  const router = useRouter();
  const { user } = useAuth();
  const C = useColors();
  const fb = useFeedback();
  const styles = useMemo(() => makeStyles(C), [C]);

  const [cravings, setCravings] = useState<Craving[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notifyingDish, setNotifyingDish] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { cravings: data } = await cravingsApi.forCook();
      setCravings(data);
    } catch {
      if (!silent) fb.error('Load failed', 'Could not fetch craving data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fb]);

  useEffect(() => { load(); }, [load]);

  // ── Derived data ──────────────────────────────────────────────────────────

  const weekAgo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d;
  }, []);

  const allByDish = useMemo(() => groupByDish(cravings), [cravings]);

  const weeklyByDish = useMemo(() => {
    const weekly = cravings.filter(c => new Date(c.created_at) >= weekAgo);
    return groupByDish(weekly);
  }, [cravings, weekAgo]);

  const customersWaiting = useMemo(
    () => cravings.filter(c => !c.is_fulfilled && c.user_name),
    [cravings],
  );

  const returnDishes = useMemo(
    () => allByDish.filter(d => d.menuItemId === null),
    [allByDish],
  );

  const trendData = useMemo(() => buildTrend(cravings), [cravings]);
  const trendMax = useMemo(() => Math.max(1, ...trendData.map(d => d.count)), [trendData]);

  // ── Action handlers ───────────────────────────────────────────────────────

  function handleCookNow(dish: DishGroup) {
    trackEvent('craving_to_publish_conversion', {
      dish_title: dish.title,
      craving_count: dish.count,
      cook_id: user?.cook_id,
    });
    router.push('/cook/dish-form' as any);
  }

  function handleSchedule(dish: DishGroup) {
    function offsetDate(days: number): string {
      const d = new Date();
      d.setDate(d.getDate() + days);
      return d.toISOString().split('T')[0];
    }
    function nextWeekend(): string {
      const d = new Date();
      const daysUntilSat = ((6 - d.getDay()) + 7) % 7 || 7;
      d.setDate(d.getDate() + daysUntilSat);
      return d.toISOString().split('T')[0];
    }
    function goSchedule(date: string) {
      router.push(
        `/cook/dish-form?scheduled_date=${date}&prefill_title=${encodeURIComponent(dish.title)}` as any
      );
    }
    fb.actionSheet({
      title: `Schedule "${dish.title}"`,
      message: `${dish.count} customer${dish.count > 1 ? 's' : ''} waiting`,
      actions: [
        { label: 'Tomorrow', onPress: () => goSchedule(offsetDate(1)) },
        { label: 'This weekend', onPress: () => goSchedule(nextWeekend()) },
        { label: 'Next week', onPress: () => goSchedule(offsetDate(7)) },
        { label: 'Pick a date', onPress: () => fb.info('Coming soon', 'Date picker is coming soon') },
      ],
      cancelLabel: 'Cancel',
    });
  }

  async function handleNotify(dish: DishGroup) {
    const unnotified = dish.cravings.filter(c => !c.cook_notify);
    if (unnotified.length === 0) {
      fb.info('Already notified', 'All customers for this dish have been notified');
      return;
    }
    setNotifyingDish(dish.title);
    try {
      await Promise.all(unnotified.map(c => cravingsApi.setCookNotify(c.id, true)));
      const n = unnotified.length;
      fb.success('Customers notified', `${n} customer${n > 1 ? 's' : ''} will be alerted when you cook ${dish.title}`);
      // Optimistically update local state
      setCravings(prev =>
        prev.map(c =>
          unnotified.some(u => u.id === c.id) ? { ...c, cook_notify: true } : c,
        ),
      );
    } catch {
      fb.error('Failed', 'Could not notify customers. Please try again.');
    } finally {
      setNotifyingDish(null);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const total = loading ? 0 : cravings.length;

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: C.bg }}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Craving Intelligence</Text>
            <Text style={styles.headerSub}>
              {total > 0 ? `${total} active craving${total > 1 ? 's' : ''} across your dishes` : 'No active cravings yet'}
            </Text>
          </View>
          <View style={styles.flameBadge}>
            <Ionicons name="flame" size={15} color={C.canvas} />
            <Text style={styles.flameBadgeText}>{total}</Text>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: Spacing.md, paddingBottom: 56 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(true); }}
            tintColor={C.spice}
          />
        }
      >
        {loading ? (
          <View style={{ padding: Spacing.lg, gap: 12 }}>
            <Bone width="100%" height={80} radius={12} />
            <Bone width="100%" height={80} radius={12} />
            <Bone width="100%" height={80} radius={12} />
          </View>
        ) : total === 0 ? (
          <View style={[styles.emptyCard, { margin: Spacing.lg }]}>
            <Text style={{ fontSize: 36 }}>🔥</Text>
            <Text style={styles.emptyTitle}>No cravings yet</Text>
            <Text style={styles.emptyBody}>
              When customers mark your dishes as a craving, they'll show up here. Share your profile to get started.
            </Text>
            <TouchableOpacity
              style={[styles.shareProfileBtn, { backgroundColor: C.spice }]}
              onPress={async () => {
                const handle = user?.username ?? user?.cook_id ?? '';
                try {
                  await Share.share({
                    message: `Check out my kitchen on FOODS! Order home-cooked meals from me 🍽️\nhttps://foodsbyme.com/c/${handle}`,
                    title: 'Share your profile',
                  });
                } catch {}
              }}
            >
              <Ionicons name="share-social-outline" size={15} color={C.canvas} />
              <Text style={[styles.shareProfileBtnText, { color: C.canvas }]}>Share your profile</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* ── MOST CRAVED DISHES ── */}
            <SectionWrapper title="Most Craved Dishes">
              {allByDish.slice(0, 5).map(dish => (
                <DishCard
                  key={dish.title}
                  dish={dish}
                  total={total}
                  isNotifying={notifyingDish === dish.title}
                  onCookNow={() => handleCookNow(dish)}
                  onSchedule={() => handleSchedule(dish)}
                  onNotify={() => handleNotify(dish)}
                />
              ))}
            </SectionWrapper>

            {/* ── TOP DEMAND THIS WEEK ── */}
            {weeklyByDish.length > 0 && (
              <SectionWrapper title="Top Demand This Week">
                <View style={styles.card}>
                  {weeklyByDish.slice(0, 5).map((dish, i) => {
                    const barPct = weeklyByDish[0].count > 0 ? dish.count / weeklyByDish[0].count : 0;
                    return (
                      <View key={dish.title}>
                        {i > 0 && <View style={styles.divider} />}
                        <View style={styles.demandRow}>
                          <View style={styles.demandRank}>
                            <Text style={styles.demandRankText}>{i + 1}</Text>
                          </View>
                          <View style={{ flex: 1, gap: 5 }}>
                            <Text style={styles.demandTitle} numberOfLines={1}>{dish.title}</Text>
                            <View style={styles.demandBarTrack}>
                              <View style={[styles.demandBarFill, { width: Math.round(barPct * 180) }]} />
                            </View>
                          </View>
                          <View style={{ alignItems: 'flex-end', gap: 2 }}>
                            <Text style={styles.demandCount}>{dish.count}</Text>
                            <Text style={styles.demandUnit}>cravings</Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
                <Text style={styles.weekNote}>
                  {weeklyByDish.reduce((s, d) => s + d.count, 0)} total cravings in the last 7 days
                </Text>
              </SectionWrapper>
            )}

            {/* ── CUSTOMERS WAITING ── */}
            {customersWaiting.length > 0 && (
              <SectionWrapper title={`Customers Waiting  ·  ${customersWaiting.length}`}>
                <View style={styles.card}>
                  {customersWaiting.slice(0, 6).map((c, i) => (
                    <View key={c.id}>
                      {i > 0 && <View style={styles.divider} />}
                      <View style={styles.customerRow}>
                        <View style={styles.customerAvatar}>
                          <Text style={styles.customerAvatarText}>
                            {(c.user_name ?? 'A')[0].toUpperCase()}
                          </Text>
                        </View>
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text style={styles.customerName}>{c.user_name ?? 'Anonymous'}</Text>
                          <Text style={styles.customerDish} numberOfLines={1}>{c.dish_title}</Text>
                          {!!c.notes && (
                            <Text style={styles.customerNote} numberOfLines={1}>"{c.notes}"</Text>
                          )}
                        </View>
                        <Text style={styles.customerTime}>{timeAgo(c.created_at)}</Text>
                      </View>
                    </View>
                  ))}
                </View>
                {customersWaiting.length > 6 && (
                  <Text style={styles.moreNote}>
                    +{customersWaiting.length - 6} more customers waiting
                  </Text>
                )}
              </SectionWrapper>
            )}

            {/* ── REQUESTED RETURN DISHES ── */}
            {returnDishes.length > 0 && (
              <SectionWrapper title="Requested Return Dishes">
                <Text style={styles.returnNote}>
                  Customers are asking for dishes not currently on your menu
                </Text>
                {returnDishes.slice(0, 4).map(dish => (
                  <ReturnDishRow
                    key={dish.title}
                    dish={dish}
                    onCookNow={() => handleCookNow(dish)}
                  />
                ))}
              </SectionWrapper>
            )}

            {/* ── DEMAND TRENDS ── */}
            <SectionWrapper title="Demand Trends">
              <View style={[styles.card, { padding: 16 }]}>
                <View style={styles.trendChart}>
                  {trendData.map(day => (
                    <View key={day.label} style={styles.trendBarCol}>
                      <Text style={styles.trendCount}>{day.count > 0 ? day.count : ''}</Text>
                      <View style={styles.trendTrack}>
                        <View
                          style={[
                            styles.trendFill,
                            {
                              height: Math.max(4, Math.round((day.count / trendMax) * 72)),
                              backgroundColor: day.count > 0 ? C.ember : C.borderWarm,
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.trendLabel}>{day.label}</Text>
                    </View>
                  ))}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 }}>
                  <Ionicons name="trending-up-outline" size={13} color={C.successFg} />
                  <Text style={{ fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft }}>
                    Craving activity over the last 7 days
                  </Text>
                </View>
              </View>
            </SectionWrapper>
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionWrapper({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 32 }}>
      <Text style={{
        fontFamily: Fonts.sansMedium, fontSize: 11, color: '#9A8F86',
        textTransform: 'uppercase', letterSpacing: 0.8,
        marginBottom: 12, paddingHorizontal: Spacing.lg,
      }}>
        {title}
      </Text>
      <View style={{ paddingHorizontal: Spacing.lg, gap: 10 }}>
        {children}
      </View>
    </View>
  );
}

function DishCard({ dish, total, isNotifying, onCookNow, onSchedule, onNotify }: {
  dish: DishGroup;
  total: number;
  isNotifying: boolean;
  onCookNow: () => void;
  onSchedule: () => void;
  onNotify: () => void;
}) {
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const barPx = Math.round((dish.count / Math.max(1, total)) * 200);
  const allNotified = dish.cravings.every(c => c.cook_notify);

  return (
    <View style={styles.dishCard}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={styles.dishTitle} numberOfLines={1}>{dish.title}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Ionicons name="people-outline" size={12} color={C.bodySoft} />
            <Text style={styles.dishMeta}>
              {dish.count} {dish.count === 1 ? 'person wants' : 'people want'} this
            </Text>
          </View>
        </View>
        <View style={styles.dishBadge}>
          <Ionicons name="flame" size={12} color={C.canvas} />
          <Text style={styles.dishBadgeText}>{dish.count}</Text>
        </View>
      </View>

      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: barPx }]} />
      </View>

      <View style={styles.dishActions}>
        <TouchableOpacity style={[styles.dishAction, styles.actionPrimary]} onPress={onCookNow}>
          <Ionicons name="restaurant-outline" size={13} color={C.canvas} />
          <Text style={styles.actionPrimaryText}>Cook Now</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.dishAction, styles.actionGhost]} onPress={onSchedule}>
          <Ionicons name="calendar-outline" size={13} color={C.spice} />
          <Text style={styles.actionGhostText}>Schedule</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.dishAction, styles.actionGhost, allNotified && styles.actionDimmed]}
          onPress={onNotify}
          disabled={isNotifying || allNotified}
        >
          {isNotifying ? (
            <ActivityIndicator size="small" color={C.spice} />
          ) : (
            <>
              <Ionicons
                name={allNotified ? 'notifications' : 'notifications-outline'}
                size={13}
                color={allNotified ? C.bodySoft : C.spice}
              />
              <Text style={[styles.actionGhostText, allNotified && { color: C.bodySoft }]}>
                {allNotified ? 'Notified' : 'Notify'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function ReturnDishRow({ dish, onCookNow }: { dish: DishGroup; onCookNow: () => void }) {
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  return (
    <View style={[styles.card, { padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
      <View style={styles.returnIcon}>
        <Ionicons name="repeat" size={18} color={C.spice} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.dishTitle}>{dish.title}</Text>
        <Text style={{ fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft }}>
          {dish.count} customer{dish.count > 1 ? 's' : ''} requesting this
        </Text>
      </View>
      <TouchableOpacity style={styles.cookNowBtn} onPress={onCookNow}>
        <Text style={styles.cookNowBtnText}>Cook Now</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },

    header: {
      flexDirection: 'row', alignItems: 'flex-end',
      paddingHorizontal: Spacing.lg, paddingTop: 16, paddingBottom: 14, gap: 12,
    },
    headerTitle: { fontFamily: Fonts.serif, fontSize: 26, color: C.textInk },
    headerSub: { fontFamily: Fonts.sans, fontSize: 13, color: C.bodySoft, marginTop: 2 },
    flameBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      backgroundColor: C.ember, borderRadius: 40,
      paddingHorizontal: 12, paddingVertical: 7,
    },
    flameBadgeText: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.canvas },

    card: {
      backgroundColor: C.bgCard, borderRadius: Radius.lg,
      borderWidth: 0.5, borderColor: C.borderWarm, ...Shadow.card, overflow: 'hidden',
    },
    divider: { height: 0.5, backgroundColor: C.borderWarm },

    // Dish card
    dishCard: {
      backgroundColor: C.bgCard, borderRadius: Radius.lg, padding: 16,
      borderWidth: 0.5, borderColor: C.borderWarm, ...Shadow.card, gap: 12,
    },
    dishTitle: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.textInk },
    dishMeta: { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft },
    dishBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      backgroundColor: C.ember, borderRadius: 40, paddingHorizontal: 9, paddingVertical: 5,
    },
    dishBadgeText: { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.canvas },
    barTrack: { height: 5, borderRadius: 3, backgroundColor: C.borderWarm, overflow: 'hidden' },
    barFill: { height: '100%', borderRadius: 3, backgroundColor: C.ember },
    dishActions: { flexDirection: 'row', gap: 8 },
    dishAction: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 5, paddingVertical: 9, borderRadius: Radius.sm,
    },
    actionPrimary: { backgroundColor: C.ink },
    actionPrimaryText: { fontFamily: Fonts.sansMedium, fontSize: 11, color: C.canvas },
    actionGhost: { borderWidth: 0.5, borderColor: C.borderWarm },
    actionGhostText: { fontFamily: Fonts.sansMedium, fontSize: 11, color: C.spice },
    actionDimmed: { borderColor: C.borderWarm + '60', opacity: 0.6 },

    // Demand this week
    demandRow: {
      flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
    },
    demandRank: {
      width: 28, height: 28, borderRadius: 14,
      backgroundColor: C.warnBg, alignItems: 'center', justifyContent: 'center',
    },
    demandRankText: { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.ember },
    demandTitle: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.textInk },
    demandBarTrack: { height: 4, borderRadius: 2, backgroundColor: C.borderWarm, overflow: 'hidden', width: '100%' },
    demandBarFill: { height: '100%', borderRadius: 2, backgroundColor: C.ember },
    demandCount: { fontFamily: Fonts.serif, fontSize: 18, color: C.ember },
    demandUnit: { fontFamily: Fonts.sans, fontSize: 10, color: C.bodySoft },
    weekNote: { fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft, textAlign: 'center', marginTop: 2 },

    // Customers
    customerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14 },
    customerAvatar: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: C.ember + '22', alignItems: 'center', justifyContent: 'center',
    },
    customerAvatarText: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.ember },
    customerName: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.textInk },
    customerDish: { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft },
    customerNote: { fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft, fontStyle: 'italic' },
    customerTime: { fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft },
    moreNote: { fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft, textAlign: 'center', marginTop: 4 },

    // Return dishes
    returnNote: {
      fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft, marginBottom: 2,
    },
    returnIcon: {
      width: 40, height: 40, borderRadius: 10,
      backgroundColor: C.warnBg, alignItems: 'center', justifyContent: 'center',
    },
    cookNowBtn: {
      backgroundColor: C.ink, borderRadius: 40,
      paddingHorizontal: 13, paddingVertical: 7,
    },
    cookNowBtnText: { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.canvas },

    // Trend chart
    trendChart: {
      flexDirection: 'row', alignItems: 'flex-end',
      justifyContent: 'space-around', height: 104,
    },
    trendBarCol: { flex: 1, alignItems: 'center', gap: 4 },
    trendCount: { fontFamily: Fonts.sans, fontSize: 10, color: C.bodySoft, height: 14, textAlign: 'center' },
    trendTrack: {
      width: 28, height: 72, borderRadius: 6,
      backgroundColor: C.borderWarm + '40',
      overflow: 'hidden', justifyContent: 'flex-end',
    },
    trendFill: { width: '100%', borderRadius: 6 },
    trendLabel: { fontFamily: Fonts.sans, fontSize: 10, color: C.bodySoft },

    // Empty state
    emptyCard: {
      backgroundColor: C.bgCard, borderRadius: Radius.lg, padding: 36,
      alignItems: 'center', gap: 10,
      borderWidth: 0.5, borderColor: C.borderWarm, ...Shadow.card,
    },
    emptyTitle: { fontFamily: Fonts.sansMedium, fontSize: 16, color: C.textInk },
    emptyBody: {
      fontFamily: Fonts.sans, fontSize: 13, color: C.bodySoft,
      textAlign: 'center', lineHeight: 20,
    },
    shareProfileBtn: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 20, paddingVertical: 11, borderRadius: 40, marginTop: 4 },
    shareProfileBtnText: { fontFamily: Fonts.sansMedium, fontSize: 14 },
  });
}
