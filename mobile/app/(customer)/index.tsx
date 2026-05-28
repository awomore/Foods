import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useAuth } from '../../src/context/AuthContext';
import { useCart } from '../../src/context/CartContext';
import { cooksApi, type CookCard as CookCardType } from '../../src/api/cooks';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { Fonts, Spacing, Radius, Shadow } from '../../src/constants/theme';
import Wordmark from '../../src/components/ui/Wordmark';
import Avatar from '../../src/components/ui/Avatar';
import StatusDot from '../../src/components/ui/StatusDot';
import DishPhoto from '../../src/components/ui/DishPhoto';

type Mode = 'eating' | 'planning';

interface PlanWindow {
  id: string;
  label: string;
  icon: string;
  desc: string;
}

const PLAN_WINDOWS: PlanWindow[] = [
  { id: 'breakfast', label: 'Breakfast', icon: 'cafe-outline',     desc: 'Today 7am – 10am' },
  { id: 'lunch',     label: 'Lunch',     icon: 'sunny-outline',    desc: 'Today 12pm – 2pm' },
  { id: 'dinner',    label: 'Dinner',    icon: 'moon-outline',     desc: 'Today 6pm – 9pm' },
  { id: 'tomorrow',  label: 'Tomorrow',  icon: 'calendar-outline', desc: 'Any time tomorrow' },
];

function fmtCurrency(amount: number, currency = 'NGN'): string {
  const symbols: Record<string, string> = {
    NGN: '₦', KES: 'KSh ', GHS: 'GH₵', ZAR: 'R', EGP: 'E£', TZS: 'TSh ', UGX: 'USh ', RWF: 'FRw ',
  };
  const sym = symbols[currency] ?? currency + ' ';
  return sym + Number(amount).toLocaleString('en-NG', { maximumFractionDigits: 0 });
}

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { count, total } = useCart();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);

  const [mode, setMode] = useState<Mode>('eating');
  const [selectedWindow, setSelectedWindow] = useState<string | null>(null);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [cooks, setCooks] = useState<CookCardType[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  const firstName = user?.full_name?.split(' ')[0] ?? 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const FOODS_PICKS = useMemo(() => [
    { category: 'Cook of the week', headline: 'The woman who smokes jollof over firewood every morning', tint: C.ember },
    { category: 'Dish of the week', headline: "The 18-hour zobo that customers reorder every week", tint: '#8E2C2C' },
    { category: 'Health Kitchen', headline: 'Three cooks the nutritionists co-sign', tint: C.leaf },
  ], [C]);

  async function fetchLocation() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
        return { lat: loc.coords.latitude, lng: loc.coords.longitude };
      }
    } catch {}
    return null;
  }

  const load = useCallback(async (geo?: { lat: number; lng: number } | null) => {
    try {
      setError(null);
      const { cooks: data } = await cooksApi.list({
        lat: geo?.lat,
        lng: geo?.lng,
        radius: 25,
        limit: 30,
      });
      setCooks(data);
    } catch (e: any) {
      setError(e.error ?? 'Could not load cooks');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const geo = await fetchLocation();
      await load(geo);
    })();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load(coords);
  }, [coords, load]);

  function handlePlanningPress() {
    setShowPlanModal(true);
  }

  function selectPlanWindow(id: string) {
    setSelectedWindow(id);
    setMode('planning');
    setShowPlanModal(false);
  }

  function handleOpenCalendar() {
    setShowPlanModal(false);
    setMode('planning');
    setSelectedWindow('custom');
  }

  const windowLabel = PLAN_WINDOWS.find(w => w.id === selectedWindow)?.label;
  const currencyCode = (cooks[0]?.currency_code) ?? 'NGN';

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: C.bg }}>
        <View style={styles.header}>
          <View>
            <Wordmark size="compact" on="light" />
            <Text style={styles.area}>{coords ? 'Near you' : 'All kitchens'}</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/(customer)/discover')}>
              <Ionicons name="search-outline" size={20} color={C.body} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/(customer)/notifications' as any)}>
              <Ionicons name="notifications-outline" size={20} color={C.body} />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.spice} />}
      >
        {/* Greeting */}
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

        {/* Mode toggle */}
        <View style={styles.modeToggle}>
          <TouchableOpacity
            onPress={() => { setMode('eating'); setSelectedWindow(null); }}
            style={[styles.modeBtn, mode === 'eating' && styles.modeBtnActive]}
          >
            <Text style={[styles.modeBtnText, mode === 'eating' && styles.modeBtnTextActive]}>
              Eating today
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handlePlanningPress}
            style={[styles.modeBtn, mode === 'planning' && styles.modeBtnActive]}
          >
            <Text style={[styles.modeBtnText, mode === 'planning' && styles.modeBtnTextActive]}>
              {mode === 'planning' && windowLabel ? `Planning · ${windowLabel}` : 'Planning ahead'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* FOODS Picks */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.caps}>Editors' pick</Text>
              <Text style={styles.sectionTitle}>FOODS picks</Text>
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: Spacing.lg, gap: 12 }}>
            {FOODS_PICKS.map((pick, i) => (
              <View key={i} style={[styles.pickCard, { backgroundColor: pick.tint }]}>
                <View style={styles.pickShine} />
                <Text style={styles.pickCaps}>{pick.category}</Text>
                <Text style={styles.pickHeadline}>{pick.headline}</Text>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Spin CTA */}
        <View style={{ paddingHorizontal: Spacing.lg }}>
          <TouchableOpacity onPress={() => router.push('/(customer)/spin')} style={styles.spinCard}>
            <View>
              <Text style={styles.spinTitle}>Not sure what to eat?</Text>
              <Text style={styles.spinSub}>Spin and let a cook decide for you</Text>
            </View>
            <View style={styles.spinRight}>
              <Ionicons name="dice" size={24} color={C.ember} />
              <Ionicons name="arrow-forward" size={16} color={C.ember} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Health Kitchen */}
        <View style={{ paddingHorizontal: Spacing.lg, marginTop: 12 }}>
          <TouchableOpacity
            onPress={() => router.push({ pathname: '/(customer)/discover', params: { health: 'true' } })}
            style={styles.healthCard}
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

        {/* Cook list */}
        <View style={[styles.section, { paddingBottom: 16 }]}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.caps}>{mode === 'planning' ? 'Planning ahead' : 'Cooking near you'}</Text>
              <Text style={styles.sectionTitle}>{mode === 'planning' ? 'Reserve a table' : 'Cooks open now'}</Text>
            </View>
          </View>

          {loading && (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={C.spice} />
              <Text style={styles.loadingText}>Finding cooks near you…</Text>
            </View>
          )}

          {!loading && error && (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>Couldn't load kitchens</Text>
              <Text style={styles.emptySub}>{error}</Text>
              <TouchableOpacity onPress={() => load(coords)} style={styles.retryBtn}>
                <Text style={styles.retryText}>Try again</Text>
              </TouchableOpacity>
            </View>
          )}

          {!loading && !error && cooks.length === 0 && (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>No one's cooking near you right now</Text>
              <Text style={styles.emptySub}>Follow a cook to be notified when she goes live.</Text>
            </View>
          )}

          {!loading && !error && (
            <View style={{ paddingHorizontal: Spacing.lg, gap: 12 }}>
              {cooks.map(cook => (
                <CookCardItem
                  key={cook.id}
                  cook={cook}
                  currencyCode={currencyCode}
                  onPress={() => router.push(`/cook/${cook.id}`)}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Cart tray */}
      {count > 0 && (
        <TouchableOpacity style={styles.tray} onPress={() => router.push('/checkout')} activeOpacity={0.9}>
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
            <Text style={styles.modalSub}>Pick a time and we'll show you what's accepting advance orders.</Text>
            <View style={styles.planOptions}>
              {PLAN_WINDOWS.map(w => (
                <TouchableOpacity
                  key={w.id}
                  style={[styles.planOption, selectedWindow === w.id && styles.planOptionActive]}
                  onPress={() => selectPlanWindow(w.id)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.planIconWrap, selectedWindow === w.id && { backgroundColor: 'rgba(255,255,255,0.12)' }]}>
                    <Ionicons name={w.icon as any} size={20} color={selectedWindow === w.id ? C.canvas : C.spice} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.planLabel, selectedWindow === w.id && styles.planLabelActive]}>{w.label}</Text>
                    <Text style={[styles.planDesc, selectedWindow === w.id && styles.planDescActive]}>{w.desc}</Text>
                  </View>
                  {selectedWindow === w.id && <Ionicons name="checkmark-circle" size={20} color={C.canvas} />}
                </TouchableOpacity>
              ))}

              <TouchableOpacity style={styles.planCalendarBtn} onPress={handleOpenCalendar} activeOpacity={0.8}>
                <Ionicons name="calendar" size={18} color={C.spice} />
                <Text style={styles.planCalendarText}>Pick a specific date</Text>
                <Ionicons name="chevron-forward" size={14} color={C.bodySoft} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.planCancelBtn} onPress={() => setShowPlanModal(false)}>
              <Text style={styles.planCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

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
  const slotsLow = slotsLeft <= 2 && slotsLeft > 0;
  const followers = cook.platform_follower_count >= 1000
    ? (cook.platform_follower_count / 1000).toFixed(1) + 'k'
    : String(cook.platform_follower_count);

  const initials = (cook.display_name || cook.full_name || '?').charAt(0).toUpperCase();

  return (
    <TouchableOpacity onPress={onPress} style={styles.cookCard} activeOpacity={0.9}>
      <View style={styles.cookHead}>
        <Avatar name={initials} avatarBg={C.ember} size={42} />
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
          <View style={styles.healthBadge}>
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
            <DishPhoto label={dish.title} height={168} radius={12} />
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
              <View style={[styles.slotPill, slotsLow && styles.slotPillLow]}>
                <Text style={[styles.slotText, slotsLow && styles.slotTextLow]}>
                  {slotsLeft === 0
                    ? "Sold out today"
                    : slotsLow
                      ? `Only ${slotsLeft} left`
                      : `${slotsLeft} of ${dish.total_slots} left`}
                </Text>
              </View>
            </View>
            <View style={styles.joinBtn}>
              <Text style={styles.joinText}>Join the table</Text>
              <Ionicons name="arrow-forward" size={13} color={C.canvas} />
            </View>
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

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingTop: 12, paddingBottom: 8 },
    area: { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft, marginTop: 2 },
    headerRight: { flexDirection: 'row', gap: 8 },
    iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.bgCook, borderWidth: 0.5, borderColor: C.borderWarm, alignItems: 'center', justifyContent: 'center' },

    scroll: { paddingBottom: 100 },

    greeting: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.md },
    greetTitle: { fontFamily: Fonts.serif, fontSize: 24, color: C.textInk, lineHeight: 30 },
    greetSub: { fontFamily: Fonts.sans, fontSize: 14, color: C.bodySoft, marginTop: 4, lineHeight: 20 },

    modeToggle: { flexDirection: 'row', marginHorizontal: Spacing.lg, backgroundColor: C.bgCook, borderRadius: Radius.full, borderWidth: 0.5, borderColor: C.borderWarm, padding: 4, marginBottom: Spacing.lg },
    modeBtn: { flex: 1, paddingVertical: 10, borderRadius: Radius.full, alignItems: 'center' },
    modeBtnActive: { backgroundColor: C.ink },
    modeBtnText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.bodySoft },
    modeBtnTextActive: { color: C.canvas },

    section: { marginTop: 4 },
    sectionHeader: { paddingHorizontal: Spacing.lg, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
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

    loadingWrap: { alignItems: 'center', paddingVertical: 40, gap: 12 },
    loadingText: { fontFamily: Fonts.sans, fontSize: 14, color: C.bodySoft },
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
    slotText: { fontFamily: Fonts.sansMedium, fontSize: 11, color: C.body },
    slotTextLow: { color: C.errorFg },
    joinBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.ink, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 40 },
    joinText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.canvas },

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
