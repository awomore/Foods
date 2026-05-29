import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, Modal, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const NOTIF_ASKED_KEY = '@notif_rationale_shown_v1';
const DISMISSED_PICKS_KEY = '@dismissed_editor_picks_v1';
import { useAuth } from '../../src/context/AuthContext';
import { useCart } from '../../src/context/CartContext';
import { cooksApi, type CookCard as CookCardType } from '../../src/api/cooks';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { Fonts, Spacing, Radius, Shadow } from '../../src/constants/theme';
import Wordmark from '../../src/components/ui/Wordmark';
import Avatar from '../../src/components/ui/Avatar';
import StatusDot from '../../src/components/ui/StatusDot';
import DishPhoto from '../../src/components/ui/DishPhoto';
import { SkeletonCookCard } from '../../src/components/ui/Skeleton';
import { fmtCurrency } from '../../src/utils/format';

type Mode = 'eating' | 'planning';
type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'tomorrow';

interface PlanWindow {
  id: MealSlot;
  label: string;
  icon: string;
  desc: string;
  startHour: number; // inclusive
  endHour: number;   // exclusive
}

// Breakfast: 6am–noon  |  Lunch: noon–5pm  |  Dinner: 5pm–close
// Windows are contiguous — no gaps, no overlap
const PLAN_WINDOWS: PlanWindow[] = [
  { id: 'breakfast', label: 'Breakfast', icon: 'cafe-outline',     desc: '6am – 11:59am',   startHour: 6,  endHour: 12 },
  { id: 'lunch',     label: 'Lunch',     icon: 'sunny-outline',    desc: '12pm – 4:59pm',   startHour: 12, endHour: 17 },
  { id: 'dinner',    label: 'Dinner',    icon: 'moon-outline',     desc: '5pm onwards',     startHour: 17, endHour: 24 },
  { id: 'tomorrow',  label: 'Tomorrow',  icon: 'calendar-outline', desc: 'Any time tomorrow', startHour: 0, endHour: 0 },
];

/** Returns which meal slot is active right now, or null if before 6am */
function currentMealSlot(): MealSlot | null {
  const h = new Date().getHours();
  if (h >= 17) return 'dinner';
  if (h >= 12) return 'lunch';
  if (h >= 6)  return 'breakfast';
  return null;
}

// Calendar date picker modal with day grid
function DatePickerModal({
  visible, onClose, onSelect,
}: { visible: boolean; onClose: () => void; onSelect: (date: Date) => void }) {
  const C = useColors();
  const today = new Date();
  const [displayMonth, setDisplayMonth] = useState(today);

  const year = displayMonth.getFullYear();
  const month = displayMonth.getMonth();
  const monthLabel = displayMonth.toLocaleString('en-NG', { month: 'long', year: 'numeric' });

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const isPast = (d: number) => {
    const date = new Date(year, month, d);
    date.setHours(0, 0, 0, 0);
    const t = new Date(); t.setHours(0, 0, 0, 0);
    return date < t;
  };

  const isToday = (d: number) =>
    d === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  const canGoBack = month > today.getMonth() || year > today.getFullYear();

  function prevMonth() {
    setDisplayMonth(new Date(year, month - 1, 1));
  }
  function nextMonth() {
    setDisplayMonth(new Date(year, month + 1, 1));
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: C.bgCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.borderWarm, alignSelf: 'center', marginBottom: 20 }} />

          {/* Month nav */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <TouchableOpacity
              onPress={prevMonth}
              disabled={!canGoBack}
              style={{ opacity: canGoBack ? 1 : 0.3, padding: 8 }}
            >
              <Ionicons name="chevron-back" size={20} color={C.textInk} />
            </TouchableOpacity>
            <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 15, color: C.textInk }}>{monthLabel}</Text>
            <TouchableOpacity onPress={nextMonth} style={{ padding: 8 }}>
              <Ionicons name="chevron-forward" size={20} color={C.textInk} />
            </TouchableOpacity>
          </View>

          {/* Day-of-week headers */}
          <View style={{ flexDirection: 'row', marginBottom: 8 }}>
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
              <Text key={d} style={{ flex: 1, textAlign: 'center', fontFamily: Fonts.sansMedium, fontSize: 11, color: C.bodySoft }}>
                {d}
              </Text>
            ))}
          </View>

          {/* Day grid */}
          {Array.from({ length: cells.length / 7 }, (_, row) => (
            <View key={row} style={{ flexDirection: 'row', marginBottom: 4 }}>
              {cells.slice(row * 7, (row + 1) * 7).map((day, col) => {
                if (!day) return <View key={col} style={{ flex: 1, height: 40 }} />;
                const past = isPast(day);
                const todayMark = isToday(day);
                return (
                  <TouchableOpacity
                    key={col}
                    style={{
                      flex: 1, height: 40, alignItems: 'center', justifyContent: 'center',
                      borderRadius: 20,
                      backgroundColor: todayMark ? C.spice : 'transparent',
                      opacity: past ? 0.3 : 1,
                    }}
                    disabled={past}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      onSelect(new Date(year, month, day));
                    }}
                  >
                    <Text style={{
                      fontFamily: todayMark ? Fonts.sansMedium : Fonts.sans,
                      fontSize: 14,
                      color: todayMark ? C.canvas : C.textInk,
                    }}>
                      {day}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}

          <TouchableOpacity
            style={{ alignItems: 'center', paddingVertical: 12, marginTop: 8 }}
            onPress={onClose}
          >
            <Text style={{ fontFamily: Fonts.sans, fontSize: 14, color: C.bodySoft }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Notification rationale modal ────────────────────────────────────────────

const NOTIF_BENEFITS = [
  { icon: 'bag-check-outline',   text: "Know the moment your order is ready" },
  { icon: 'flame-outline',       text: "Get notified when a cook you follow goes live" },
  { icon: 'bicycle-outline',     text: "Track your delivery in real time" },
];

function NotificationRationaleModal({
  visible, onAllow, onDismiss,
}: { visible: boolean; onAllow: () => void; onDismiss: () => void }) {
  const C = useColors();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: C.bgCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, gap: 20 }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.borderWarm, alignSelf: 'center' }} />

          <View style={{ alignItems: 'center', gap: 8 }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: C.bgCook, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="notifications-outline" size={28} color={C.ember} />
            </View>
            <Text style={{ fontFamily: Fonts.serif, fontSize: 22, color: C.textInk, textAlign: 'center' }}>Stay in the loop</Text>
            <Text style={{ fontFamily: Fonts.sans, fontSize: 14, color: C.bodySoft, textAlign: 'center', lineHeight: 20 }}>
              Enable notifications to get the most out of FOODS.
            </Text>
          </View>

          <View style={{ gap: 12 }}>
            {NOTIF_BENEFITS.map(b => (
              <View key={b.icon} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.bgCook, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={b.icon as any} size={18} color={C.ember} />
                </View>
                <Text style={{ fontFamily: Fonts.sans, fontSize: 14, color: C.body, flex: 1 }}>{b.text}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={{ backgroundColor: C.spice, borderRadius: 14, paddingVertical: 15, alignItems: 'center' }}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onAllow(); }}
            accessibilityLabel="Allow notifications"
            accessibilityRole="button"
          >
            <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 15, color: C.white }}>Allow notifications</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{ alignItems: 'center', paddingVertical: 8 }}
            onPress={onDismiss}
            accessibilityLabel="Not now"
            accessibilityRole="button"
          >
            <Text style={{ fontFamily: Fonts.sans, fontSize: 14, color: C.bodySoft }}>Not now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { count, total } = useCart();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);

  const [mode, setMode] = useState<Mode>('eating');
  const [selectedWindow, setSelectedWindow] = useState<MealSlot | null>(null);
  const activeSlotNow = currentMealSlot();
  const [customDate, setCustomDate] = useState<Date | null>(null);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [cooks, setCooks] = useState<CookCardType[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [showNotifRationale, setShowNotifRationale] = useState(false);
  const [dismissedPicks, setDismissedPicks] = useState<Set<number>>(new Set());
  const [showRestorePicks, setShowRestorePicks] = useState(false);
  const [spinIntroDismissed, setSpinIntroDismissed] = useState(false);

  const firstName = user?.full_name?.split(' ')[0] ?? 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  // Health Kitchen is NOT in picks — it has its own permanent card below
  const FOODS_PICKS = useMemo(() => [
    { category: 'Cook of the week', headline: 'The woman who smokes jollof over firewood every morning', tint: C.ember },
    { category: 'Dish of the week', headline: 'The 18-hour zobo that customers reorder every week', tint: '#8E2C2C' },
  ], [C]);

  async function fetchLocation() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const geo = { lat: loc.coords.latitude, lng: loc.coords.longitude };
        setCoords(geo);
        return geo;
      }
    } catch {}
    return null;
  }

  const load = useCallback(async (geo?: { lat: number; lng: number } | null) => {
    try {
      setError(null);
      const params: Record<string, any> = { lat: geo?.lat, lng: geo?.lng, radius: 25, limit: 30 };
      if (mode === 'planning' && selectedWindow) params.slot = selectedWindow;
      if (mode === 'planning' && customDate) params.date = customDate.toISOString().split('T')[0];
      const { cooks: data } = await cooksApi.list(params);
      // Sort: live → has menu → sold-out/no menu
      const sorted = [...data].sort((a, b) => {
        const scoreA = a.is_live ? 2 : (a.today_items.length > 0 ? 1 : 0);
        const scoreB = b.is_live ? 2 : (b.today_items.length > 0 ? 1 : 0);
        return scoreB - scoreA;
      });
      setCooks(sorted);
    } catch (e: any) {
      setError(e.error ?? 'Could not load kitchens');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [mode, selectedWindow, customDate]);

  useEffect(() => {
    (async () => {
      const geo = await fetchLocation();
      await load(geo);
    })();
  }, []);

  // Re-fetch when planning mode or window changes
  useEffect(() => {
    if (mode === 'planning') load(coords);
  }, [mode, selectedWindow, customDate]);

  // Load dismissed editor picks + spin intro state
  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(DISMISSED_PICKS_KEY),
      AsyncStorage.getItem('@spin_intro_seen_v1'),
    ]).then(([picksVal, spinVal]) => {
      if (picksVal) setDismissedPicks(new Set(JSON.parse(picksVal)));
      if (spinVal) setSpinIntroDismissed(true);
    });
  }, []);

  async function dismissPick(idx: number) {
    const next = new Set([...dismissedPicks, idx]);
    setDismissedPicks(next);
    await AsyncStorage.setItem(DISMISSED_PICKS_KEY, JSON.stringify([...next]));
  }

  async function dismissSpinIntro() {
    setSpinIntroDismissed(true);
    await AsyncStorage.setItem('@spin_intro_seen_v1', '1');
  }

  async function restoreAllPicks() {
    setDismissedPicks(new Set());
    setShowRestorePicks(false);
    await AsyncStorage.removeItem(DISMISSED_PICKS_KEY);
  }

  // Show notification rationale once after first load completes
  useEffect(() => {
    if (loading) return;
    AsyncStorage.getItem(NOTIF_ASKED_KEY).then(val => {
      if (val) return;
      Notifications.getPermissionsAsync().then(({ status }) => {
        if (status === 'undetermined') {
          const t = setTimeout(() => setShowNotifRationale(true), 2000);
          return () => clearTimeout(t);
        }
      });
    });
  }, [loading]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load(coords);
  }, [coords, load]);

  function selectPlanWindow(id: MealSlot) {
    setSelectedWindow(id);
    setCustomDate(null);
    setMode('planning');
    setShowPlanModal(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Trigger a fresh fetch immediately with the new slot filter
    load(coords);
  }

  function handleCustomDate(date: Date) {
    setCustomDate(date);
    setSelectedWindow(null);
    setMode('planning');
    setShowCalendar(false);
  }

  const windowLabel = customDate
    ? customDate.toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short' })
    : PLAN_WINDOWS.find(w => w.id === selectedWindow)?.label;

  const currencyCode = (cooks[0]?.currency_code) ?? 'NGN';

  // FlatList item types
  type ListItem =
    | { type: 'header' }
    | { type: 'picks' }
    | { type: 'spin' }
    | { type: 'health' }
    | { type: 'section-label' }
    | { type: 'loading' }
    | { type: 'error' }
    | { type: 'empty' }
    | { type: 'cook'; cook: CookCardType };

  const listData = useMemo((): ListItem[] => {
    const items: ListItem[] = [{ type: 'header' }];

    // Only include picks section if at least one pick is visible
    if (FOODS_PICKS.some((_, i) => !dismissedPicks.has(i))) {
      items.push({ type: 'picks' });
    }

    // Spin intro: show once until dismissed
    if (!spinIntroDismissed) items.push({ type: 'spin' });

    items.push({ type: 'health' });    // permanent
    items.push({ type: 'section-label' });
    if (loading) {
      items.push({ type: 'loading' });
    } else if (error) {
      items.push({ type: 'error' });
    } else if (cooks.length === 0) {
      items.push({ type: 'empty' });
    } else {
      cooks.forEach(cook => items.push({ type: 'cook', cook }));
    }
    return items;
  }, [loading, error, cooks, dismissedPicks, spinIntroDismissed, FOODS_PICKS]);

  function renderItem({ item }: { item: ListItem }) {
    switch (item.type) {
      case 'header':
        return (
          <View>
            <View style={styles.greeting}>
              <Text style={styles.greetTitle}>
                {greeting},{' '}
                <Text style={{ color: C.spice }}>{firstName}</Text>.
              </Text>
              <Text style={styles.greetSub}>
                {mode === 'planning'
                  ? `Planning ahead${windowLabel ? ` · ${windowLabel}` : ''}.`
                  : 'Real kitchens, cooking near you now.'}
              </Text>
            </View>
            {/* Find a cook search prompt */}
            <TouchableOpacity
              style={styles.searchPrompt}
              onPress={() => router.push('/(customer)/discover')}
              activeOpacity={0.7}
            >
              <Ionicons name="search-outline" size={16} color={C.bodySoft} />
              <Text style={styles.searchPromptText}>Search for a dish or cook…</Text>
            </TouchableOpacity>

            {/* Mode toggle */}
            <View style={styles.modeToggle}>
              <TouchableOpacity
                onPress={() => { setMode('eating'); setSelectedWindow(null); setCustomDate(null); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                style={[styles.modeBtn, mode === 'eating' && styles.modeBtnActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: mode === 'eating' }}
              >
                <Text style={[styles.modeBtnText, mode === 'eating' && styles.modeBtnTextActive]}>
                  Eating today
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowPlanModal(true)}
                style={[styles.modeBtn, mode === 'planning' && styles.modeBtnActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: mode === 'planning' }}
              >
                <Text style={[styles.modeBtnText, mode === 'planning' && styles.modeBtnTextActive]}>
                  {mode === 'planning' && windowLabel ? `Planning · ${windowLabel}` : 'Planning ahead'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        );

      case 'picks': {
        const visiblePicks = FOODS_PICKS.filter((_, i) => !dismissedPicks.has(i));
        if (visiblePicks.length === 0) return null;
        return (
          <View style={styles.section}>
            <View style={[styles.sectionHeader, { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }]}>
              <View>
                <Text style={styles.caps}>Editors' pick</Text>
                <Text style={styles.sectionTitle}>FOODS picks</Text>
              </View>
              {dismissedPicks.size > 0 && (
                <TouchableOpacity
                  onPress={() => setShowRestorePicks(v => !v)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingBottom: 4 }}
                >
                  <Text style={{ fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft }}>
                    {dismissedPicks.size} hidden
                  </Text>
                  <Ionicons name={showRestorePicks ? 'chevron-up' : 'chevron-down'} size={14} color={C.bodySoft} />
                </TouchableOpacity>
              )}
            </View>
            {showRestorePicks && (
              <TouchableOpacity
                onPress={restoreAllPicks}
                style={{ marginHorizontal: Spacing.lg, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 8,
                  backgroundColor: C.bgCard, borderRadius: Radius.md, padding: 12, borderWidth: 0.5, borderColor: C.borderWarm }}
              >
                <Ionicons name="refresh-outline" size={16} color={C.spice} />
                <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 13, color: C.spice }}>Restore all hidden cards</Text>
              </TouchableOpacity>
            )}
            <FlatList
              horizontal
              data={FOODS_PICKS}
              keyExtractor={(_, i) => String(i)}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: Spacing.lg, gap: 12 }}
              renderItem={({ item: pick, index }) => {
                if (dismissedPicks.has(index)) return null;
                const isHealthKitchen = index === 2;
                return (
                  <View style={{ position: 'relative' }}>
                    <TouchableOpacity
                      style={[styles.pickCard, { backgroundColor: pick.tint }]}
                      activeOpacity={0.85}
                      accessibilityLabel={`${pick.category}: ${pick.headline}`}
                    >
                      <View style={styles.pickShine} />
                      <Text style={styles.pickCaps}>{pick.category}</Text>
                      <Text style={styles.pickHeadline}>{pick.headline}</Text>
                    </TouchableOpacity>
                    {!isHealthKitchen && (
                      <TouchableOpacity
                        onPress={() => dismissPick(index)}
                        style={{ position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: 12,
                          backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' }}
                        hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                        accessibilityLabel="Dismiss this card"
                      >
                        <Ionicons name="close" size={13} color="#fff" />
                      </TouchableOpacity>
                    )}
                  </View>
                );
              }}
            />
          </View>
        );
      }

      case 'spin':
        return (
          <View style={{ paddingHorizontal: Spacing.lg, marginBottom: 12, position: 'relative' }}>
            <TouchableOpacity
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/(customer)/spin'); }}
              style={styles.spinCard}
              accessibilityLabel="Spin — let a cook decide for you"
              accessibilityRole="button"
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.spinTitle}>Not sure what to eat?</Text>
                <Text style={styles.spinSub}>
                  See that <Ionicons name="dice" size={12} color={C.ember} /> dice icon in the nav? Tap Spin and let a cook decide for you — one random dish, no scrolling.
                </Text>
              </View>
              <View style={styles.spinRight}>
                <Ionicons name="dice" size={24} color={C.ember} />
                <Ionicons name="arrow-forward" size={16} color={C.ember} />
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={dismissSpinIntro}
              style={{ position: 'absolute', top: 8, right: 24, width: 24, height: 24, borderRadius: 12,
                backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' }}
              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
              accessibilityLabel="Dismiss"
            >
              <Ionicons name="close" size={13} color="#fff" />
            </TouchableOpacity>
          </View>
        );

      case 'health':
        return (
          <View style={{ paddingHorizontal: Spacing.lg, marginBottom: 16 }}>
            <TouchableOpacity
              onPress={() => router.push({ pathname: '/(customer)/discover', params: { health: 'true' } })}
              style={styles.healthCard}
              accessibilityLabel="Health Kitchen — cooks co-signed by nutritionists"
              accessibilityRole="button"
            >
              <View style={styles.healthIcon}>
                <Ionicons name="leaf" size={18} color={C.healthFg} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.healthTitle}>Health Kitchen</Text>
                <Text style={styles.healthSub}>Cooks co-signed by nutritionists</Text>
              </View>
              <Ionicons name="arrow-forward" size={16} color={C.healthFg} />
            </TouchableOpacity>
          </View>
        );

      case 'section-label':
        return (
          <View style={styles.sectionHeader}>
            <Text style={styles.caps}>{mode === 'planning' ? 'Planning ahead' : 'Cooking near you'}</Text>
            <Text style={styles.sectionTitle}>{mode === 'planning' ? 'Reserve a table' : 'Cooks open now'}</Text>
          </View>
        );

      case 'loading':
        return (
          <View style={{ paddingHorizontal: Spacing.lg, gap: 12 }}>
            {[1, 2, 3].map(k => <SkeletonCookCard key={k} />)}
          </View>
        );

      case 'error':
        return (
          <View style={styles.emptyWrap}>
            <Ionicons name="wifi-outline" size={40} color={C.stone} style={{ marginBottom: 12 }} />
            <Text style={styles.emptyTitle}>Couldn't load kitchens</Text>
            <Text style={styles.emptySub}>{error}</Text>
            <TouchableOpacity onPress={() => load(coords)} style={styles.retryBtn}>
              <Text style={styles.retryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        );

      case 'empty':
        return (
          <View style={styles.emptyWrap}>
            <Ionicons name="restaurant-outline" size={40} color={C.stone} style={{ marginBottom: 12 }} />
            <Text style={styles.emptyTitle}>
              {mode === 'planning' ? 'No kitchens accepting advance orders' : 'No one\'s cooking near you right now'}
            </Text>
            <Text style={styles.emptySub}>
              {mode === 'planning'
                ? 'Try a different time slot, or switch to Eating today.'
                : 'Follow a cook to be notified when she goes live.'}
            </Text>
            {mode === 'planning' && (
              <TouchableOpacity
                onPress={() => { setMode('eating'); setSelectedWindow(null); setCustomDate(null); }}
                style={styles.retryBtn}
              >
                <Text style={styles.retryText}>Show all cooks</Text>
              </TouchableOpacity>
            )}
          </View>
        );

      case 'cook':
        return (
          <View style={{ paddingHorizontal: Spacing.lg, marginBottom: 12 }}>
            <CookCardItem
              cook={item.cook}
              currencyCode={currencyCode}
              onPress={() => router.push(`/cook/${item.cook.id}`)}
            />
          </View>
        );

      default:
        return null;
    }
  }

  return (
    <View style={styles.root}>
      {/* Sticky top bar */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: C.bg }}>
        <View style={styles.topBar}>
          <View>
            <Wordmark size="compact" on={C.bg === '#1A1208' ? 'dark' : 'light'} />
            <Text style={styles.area}>{coords ? 'Near you' : 'All kitchens'}</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => router.push('/(customer)/discover')}
              accessibilityLabel="Search cooks and dishes"
            >
              <Ionicons name="search-outline" size={20} color={C.body} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => router.push('/(customer)/notifications' as any)}
              accessibilityLabel="Notifications"
            >
              <Ionicons name="notifications-outline" size={20} color={C.body} />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      <FlatList
        data={listData}
        keyExtractor={(item, i) => item.type === 'cook' ? item.cook.id : `${item.type}-${i}`}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.spice} />
        }
        getItemLayout={undefined}
        removeClippedSubviews={Platform.OS === 'android'}
      />

      {/* Cart tray */}
      {count > 0 && (
        <TouchableOpacity
          style={styles.tray}
          onPress={() => router.push('/checkout')}
          activeOpacity={0.9}
          accessibilityLabel={`${count} items in tray, total ${fmtCurrency(total, currencyCode)}`}
          accessibilityRole="button"
        >
          <View style={styles.trayLeft}>
            <View style={styles.trayBag}>
              <Ionicons name="bag" size={16} color={C.ember} />
            </View>
            <Text style={styles.trayLabel}>{count} {count === 1 ? 'item' : 'items'} in tray</Text>
          </View>
          <View style={styles.trayRight}>
            <Text style={styles.trayTotal}>{fmtCurrency(total, currencyCode)}</Text>
            <Ionicons name="arrow-forward" size={14} color={C.ember} />
          </View>
        </TouchableOpacity>
      )}

      {/* Planning Ahead Modal */}
      <Modal visible={showPlanModal} transparent animationType="slide" onRequestClose={() => setShowPlanModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>When are you ordering for?</Text>
            <Text style={styles.modalSub}>We'll show you kitchens accepting orders for that time.</Text>
            <View style={styles.planOptions}>
              {PLAN_WINDOWS.map(w => {
                const isSelected = selectedWindow === w.id && !customDate;
                const isNow = w.id === activeSlotNow && w.id !== 'tomorrow';
                return (
                  <TouchableOpacity
                    key={w.id}
                    style={[styles.planOption, isSelected && styles.planOptionActive]}
                    onPress={() => selectPlanWindow(w.id)}
                    activeOpacity={0.8}
                    accessibilityLabel={`${w.label}, ${w.desc}${isNow ? ', happening now' : ''}`}
                  >
                    <View style={[styles.planIconWrap, isSelected && { backgroundColor: 'rgba(255,255,255,0.12)' }]}>
                      <Ionicons name={w.icon as any} size={20} color={isSelected ? C.canvas : C.spice} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[styles.planLabel, isSelected && styles.planLabelActive]}>{w.label}</Text>
                        {isNow && (
                          <View style={{ backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : C.successBg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 20 }}>
                            <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 9, color: isSelected ? C.canvas : C.successFg, letterSpacing: 0.5 }}>NOW</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.planDesc, isSelected && styles.planDescActive]}>{w.desc}</Text>
                    </View>
                    {isSelected && <Ionicons name="checkmark-circle" size={20} color={C.canvas} />}
                  </TouchableOpacity>
                );
              })}

              <TouchableOpacity
                style={[styles.planCalendarBtn, !!customDate && styles.planOptionActive]}
                onPress={() => { setShowPlanModal(false); setShowCalendar(true); }}
                activeOpacity={0.8}
                accessibilityLabel="Pick a specific date"
              >
                <Ionicons name="calendar" size={18} color={customDate ? C.canvas : C.spice} />
                <Text style={[styles.planCalendarText, customDate && { color: C.canvas }]}>
                  {customDate ? windowLabel : 'Pick a specific date'}
                </Text>
                <Ionicons name="chevron-forward" size={14} color={customDate ? 'rgba(250,246,240,0.6)' : C.bodySoft} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.planCancelBtn} onPress={() => setShowPlanModal(false)}>
              <Text style={styles.planCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Calendar date picker */}
      <DatePickerModal
        visible={showCalendar}
        onClose={() => setShowCalendar(false)}
        onSelect={handleCustomDate}
      />

      {/* Notification rationale — shows once before requesting OS permission */}
      <NotificationRationaleModal
        visible={showNotifRationale}
        onAllow={async () => {
          setShowNotifRationale(false);
          await AsyncStorage.setItem(NOTIF_ASKED_KEY, '1');
          await Notifications.requestPermissionsAsync();
        }}
        onDismiss={async () => {
          setShowNotifRationale(false);
          await AsyncStorage.setItem(NOTIF_ASKED_KEY, '1');
        }}
      />
    </View>
  );
}

// ─── Cook card ────────────────────────────────────────────────────────────────

function cookStatus(cook: CookCardType): { status: 'cooking-now' | 'prepping' | 'done'; label: string } {
  if (cook.is_live) return { status: 'cooking-now', label: 'Cooking now' };
  if (cook.today_items.length > 0) return { status: 'prepping', label: 'Has menu today' };
  return { status: 'done', label: 'No menu today' };
}

function CookCardItem({ cook, currencyCode, onPress }: { cook: CookCardType; currencyCode: string; onPress: () => void }) {
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const dish = cook.today_items[0];
  const { status, label } = cookStatus(cook);
  const slotsLeft = dish ? (dish.total_slots - dish.slots_claimed) : 0;
  const slotsLow = slotsLeft > 0 && slotsLeft <= 2;
  const soldOut = dish && slotsLeft === 0;
  const followers = cook.platform_follower_count >= 1000
    ? (cook.platform_follower_count / 1000).toFixed(1) + 'k'
    : String(cook.platform_follower_count);
  const initials = (cook.display_name || cook.full_name || '?').charAt(0).toUpperCase();

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.cookCard, soldOut && { opacity: 0.65 }]}
      activeOpacity={0.9}
      accessibilityLabel={`${cook.display_name} kitchen. ${label}.${dish ? ` ${dish.title}.` : ''}`}
      accessibilityRole="button"
    >
      <View style={styles.cookHead}>
        <Avatar name={initials} avatarUrl={cook.avatar_url} avatarBg={C.ember} size={42} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
            <Text style={styles.cookName}>{cook.display_name}</Text>
            <Text style={styles.cookFollowers}>· {followers} followers</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <StatusDot status={status} />
            <Text style={[styles.cookStatus, status === 'cooking-now' && { color: C.leaf }]}>
              {label}
            </Text>
            {cook.location && <>
              <Text style={styles.dot}>·</Text>
              <Text style={styles.cookArea} numberOfLines={1}>
                {cook.location}{cook.distance_km > 0 ? ` · ${cook.distance_km}km` : ''}
              </Text>
            </>}
          </View>
        </View>
        {cook.is_health_kitchen && (
          <View style={styles.healthBadge} accessibilityLabel="Health Kitchen">
            <Ionicons name="leaf" size={10} color={C.healthFg} />
            <Text style={styles.healthBadgeText}>Health</Text>
          </View>
        )}
      </View>

      <View style={styles.cookStats}>
        <Text style={styles.statNum}>{cook.repeat_order_rate}%</Text>
        <Text style={styles.statLabel}>come back</Text>
        <Text style={styles.dot}>·</Text>
        <Ionicons name="star" size={11} color={C.spice} />
        <Text style={styles.statLabel}>{cook.average_rating.toFixed(1)}</Text>
        <Text style={styles.dot}>·</Text>
        <Text style={styles.statLabel}>{cook.total_orders} orders</Text>
      </View>

      {dish ? (
        <>
          <View style={{ paddingHorizontal: 14 }}>
            <DishPhoto
              uri={dish.photos?.[0] ?? null}
              label={dish.title}
              height={168}
              radius={12}
              tint={C.ember}
              isSoldOut={soldOut as boolean}
              slotsLeft={slotsLeft}
              isLive={cook.is_live}
              isSurpriseDrop={dish.is_surprise_drop}
              isGoldAccess={dish.is_gold_early_access}
              recyclingKey={dish.id}
            />
          </View>
          <View style={styles.dishInfo}>
            <View style={{ flex: 1 }}>
              <Text style={styles.dishTitle} numberOfLines={2}>{dish.title}</Text>
              {dish.description && <Text style={styles.dishDesc} numberOfLines={2}>{dish.description}</Text>}
            </View>
            <Text style={styles.dishPrice}>{fmtCurrency(dish.unit_price, currencyCode)}</Text>
          </View>
          <View style={styles.cookFooter}>
            <View style={{ flexDirection: 'row', gap: 6, flex: 1, flexWrap: 'wrap' }}>
              {cook.active_discounts.length > 0 && (
                <View style={styles.discountPill}>
                  <Text style={styles.discountText}>{cook.active_discounts[0].discount_value}% off</Text>
                </View>
              )}
              <View style={[styles.slotPill, slotsLow && styles.slotPillLow, soldOut && styles.slotPillSoldOut]}>
                <Text style={[styles.slotText, slotsLow && styles.slotTextLow, soldOut && styles.slotTextSoldOut]}>
                  {soldOut ? 'Sold out today' : slotsLow ? `Only ${slotsLeft} left` : `${slotsLeft} of ${dish.total_slots} left`}
                </Text>
              </View>
            </View>
            {soldOut ? (
              <View style={styles.followBtn}>
                <Text style={styles.followText}>Follow for next time</Text>
              </View>
            ) : (
              <View style={styles.joinBtn}>
                <Text style={styles.joinText}>Join the table</Text>
                <Ionicons name="arrow-forward" size={13} color={C.canvas} />
              </View>
            )}
          </View>
        </>
      ) : (
        <View style={styles.noDishFooter}>
          <Text style={styles.noDishText}>No menu for today</Text>
          <View style={styles.joinBtn}>
            <Text style={styles.joinText}>View profile</Text>
            <Ionicons name="arrow-forward" size={13} color={C.canvas} />
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingTop: 12, paddingBottom: 8 },
    area: { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft, marginTop: 2 },
    headerRight: { flexDirection: 'row', gap: 8 },
    iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.bgCook, borderWidth: 0.5, borderColor: C.borderWarm, alignItems: 'center', justifyContent: 'center' },

    greeting: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.sm },
    greetTitle: { fontFamily: Fonts.serif, fontSize: 24, color: C.textInk, lineHeight: 30 },
    greetSub: { fontFamily: Fonts.sans, fontSize: 14, color: C.bodySoft, marginTop: 4, lineHeight: 20 },

    searchPrompt: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: Spacing.lg,
      marginBottom: Spacing.sm, backgroundColor: C.bgCook, borderRadius: Radius.full,
      paddingHorizontal: 16, paddingVertical: 11, borderWidth: 0.5, borderColor: C.borderWarm },
    searchPromptText: { fontFamily: Fonts.sans, fontSize: 14, color: C.bodySoft, flex: 1 },

    modeToggle: { flexDirection: 'row', marginHorizontal: Spacing.lg, backgroundColor: C.bgCook, borderRadius: Radius.full, borderWidth: 0.5, borderColor: C.borderWarm, padding: 4, marginBottom: Spacing.lg },
    modeBtn: { flex: 1, paddingVertical: 10, borderRadius: Radius.full, alignItems: 'center' },
    modeBtnActive: { backgroundColor: C.ink },
    modeBtnText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.bodySoft },
    modeBtnTextActive: { color: C.canvas },

    section: { marginTop: 4, marginBottom: 8 },
    sectionHeader: { paddingHorizontal: Spacing.lg, marginBottom: 12 },
    caps: { fontFamily: Fonts.sansMedium, fontSize: 10, color: C.spice, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4 },
    sectionTitle: { fontFamily: Fonts.serif, fontSize: 22, color: C.textInk },

    pickCard: { width: 248, borderRadius: 18, padding: 20, minHeight: 130, justifyContent: 'flex-end', overflow: 'hidden' },
    pickShine: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,236,200,0.1)' },
    pickCaps: { fontFamily: Fonts.sansMedium, fontSize: 9, color: 'rgba(255,247,232,0.65)', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8 },
    pickHeadline: { fontFamily: Fonts.serif, fontSize: 16, color: 'rgba(255,247,232,0.96)', lineHeight: 22 },

    spinCard: { backgroundColor: C.ink, borderRadius: Radius.lg, padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    spinTitle: { fontFamily: Fonts.sansMedium, fontSize: 15, color: C.canvas },
    spinSub: { fontFamily: Fonts.sans, fontSize: 12, color: 'rgba(250,246,240,0.6)', marginTop: 3 },
    spinRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },

    healthCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.healthBg, borderRadius: Radius.lg, padding: 14, borderWidth: 0.5, borderColor: C.borderWarm },
    healthIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.honey, alignItems: 'center', justifyContent: 'center' },
    healthTitle: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.healthFg },
    healthSub: { fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft, marginTop: 2 },

    emptyWrap: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: Spacing.lg },
    emptyTitle: { fontFamily: Fonts.serif, fontSize: 20, color: C.textInk, textAlign: 'center', marginBottom: 8 },
    emptySub: { fontFamily: Fonts.sans, fontSize: 14, color: C.bodySoft, textAlign: 'center', lineHeight: 20 },
    retryBtn: { marginTop: 16, backgroundColor: C.ink, borderRadius: Radius.full, paddingHorizontal: 24, paddingVertical: 12 },
    retryText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.canvas },

    cookCard: { backgroundColor: C.bgCard, borderRadius: Radius.xl, borderWidth: 0.5, borderColor: C.borderWarm, overflow: 'hidden', ...Shadow.card },
    cookHead: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, paddingBottom: 10 },
    cookName: { fontFamily: Fonts.serif, fontSize: 16, color: C.textInk },
    cookFollowers: { fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft },
    cookStatus: { fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft },
    cookArea: { fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft, flex: 1 },
    dot: { color: C.caps },
    cookStats: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingBottom: 10 },
    statNum: { fontFamily: Fonts.serif, fontSize: 18, color: C.spice },
    statLabel: { fontFamily: Fonts.sans, fontSize: 12, color: C.body },
    healthBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: C.healthBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
    healthBadgeText: { fontFamily: Fonts.sansMedium, fontSize: 10, color: C.healthFg },
    dishInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, padding: 14, paddingBottom: 6 },
    dishTitle: { fontFamily: Fonts.serif, fontSize: 16, color: C.textInk, lineHeight: 21 },
    dishDesc: { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft, marginTop: 4, lineHeight: 17 },
    dishPrice: { fontFamily: Fonts.serif, fontSize: 19, color: C.spice, flexShrink: 0 },
    cookFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, paddingTop: 10, flexWrap: 'wrap', gap: 8 },
    noDishFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 },
    noDishText: { fontFamily: Fonts.sans, fontSize: 13, color: C.bodySoft },
    discountPill: { backgroundColor: C.errorBg, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 40 },
    discountText: { fontFamily: Fonts.sansMedium, fontSize: 11, color: C.spice },
    slotPill: { backgroundColor: C.honey, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 40 },
    slotPillLow: { backgroundColor: C.errorBg },
    slotPillSoldOut: { backgroundColor: C.bgCook },
    slotText: { fontFamily: Fonts.sansMedium, fontSize: 11, color: C.body },
    slotTextLow: { color: C.errorFg },
    slotTextSoldOut: { color: C.bodySoft },
    joinBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.ink, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 40 },
    joinText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.canvas },
    followBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: C.borderWarm, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 40 },
    followText: { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.body },

    tray: { position: 'absolute', bottom: 84, left: 16, right: 16, backgroundColor: C.ink, borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', ...Shadow.lift },
    trayLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    trayBag: { width: 28, height: 28, borderRadius: 8, backgroundColor: C.honey, alignItems: 'center', justifyContent: 'center' },
    trayLabel: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.canvas },
    trayRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    trayTotal: { fontFamily: Fonts.serif, fontSize: 18, color: C.ember },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    modalSheet: { backgroundColor: C.bgCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 14, paddingBottom: 40 },
    modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: C.borderWarm, alignSelf: 'center', marginBottom: 4 },
    modalTitle: { fontFamily: Fonts.serif, fontSize: 22, color: C.textInk },
    modalSub: { fontFamily: Fonts.sans, fontSize: 13, color: C.bodySoft, lineHeight: 18, marginTop: -6 },

    planOptions: { gap: 10 },
    planOption: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: Radius.lg, borderWidth: 1, borderColor: C.borderWarm, backgroundColor: C.bg },
    planOptionActive: { backgroundColor: C.ink, borderColor: C.ink },
    planIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.bgCook, alignItems: 'center', justifyContent: 'center' },
    planLabel: { fontFamily: Fonts.sansMedium, fontSize: 15, color: C.textInk },
    planLabelActive: { color: C.canvas },
    planDesc: { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft, marginTop: 2 },
    planDescActive: { color: 'rgba(250,246,240,0.6)' },
    planCalendarBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: Radius.lg, borderWidth: 1, borderColor: C.borderWarm, borderStyle: 'dashed', backgroundColor: C.bg },
    planCalendarText: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.spice, flex: 1 },
    planCancelBtn: { alignItems: 'center', paddingVertical: 6 },
    planCancelText: { fontFamily: Fonts.sans, fontSize: 14, color: C.bodySoft },
  });
}
