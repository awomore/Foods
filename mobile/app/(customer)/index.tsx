import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  SafeAreaView, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useAuth } from '../../src/context/AuthContext';
import { useCart } from '../../src/context/CartContext';
import { cooksApi, type CookCard as CookCardType } from '../../src/api/cooks';
import { Colors, Fonts, Spacing, Radius, Shadow } from '../../src/constants/theme';
import Wordmark from '../../src/components/ui/Wordmark';
import Avatar from '../../src/components/ui/Avatar';
import StatusDot from '../../src/components/ui/StatusDot';
import DishPhoto from '../../src/components/ui/DishPhoto';

type Mode = 'eating' | 'planning';

const FOODS_PICKS = [
  { category: 'Cook of the week', headline: 'The woman who smokes jollof over firewood every morning', tint: Colors.ember },
  { category: 'Dish of the week', headline: "The 18-hour zobo that customers reorder every week", tint: '#8E2C2C' },
  { category: 'Health Kitchen', headline: 'Three cooks the nutritionists co-sign', tint: '#3B6647' },
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
  const [mode, setMode] = useState<Mode>('eating');
  const [cooks, setCooks] = useState<CookCardType[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  const firstName = user?.full_name?.split(' ')[0] ?? 'there';

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

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

  const currencyCode = (cooks[0]?.currency_code) ?? 'NGN';

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Wordmark size="compact" on="light" />
            <Text style={styles.area}>{coords ? 'Near you' : 'All kitchens'}</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/(customer)/discover')}>
              <Ionicons name="search-outline" size={20} color={Colors.body} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/(customer)/notifications' as any)}>
              <Ionicons name="notifications-outline" size={20} color={Colors.body} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.spice} />}
        >
          {/* Greeting */}
          <View style={styles.greeting}>
            <Text style={styles.greetTitle}>
              {greeting},{' '}
              <Text style={{ color: Colors.spice }}>{firstName}</Text>.
            </Text>
            <Text style={styles.greetSub}>
              {mode === 'planning' ? 'Browse ahead. Reserve what you want.' : 'Real kitchens, cooking near you now.'}
            </Text>
          </View>

          {/* Mode toggle */}
          <View style={styles.modeToggle}>
            {(['eating', 'planning'] as Mode[]).map(m => (
              <TouchableOpacity
                key={m}
                onPress={() => setMode(m)}
                style={[styles.modeBtn, mode === m && styles.modeBtnActive]}
              >
                <Text style={[styles.modeBtnText, mode === m && styles.modeBtnTextActive]}>
                  {m === 'eating' ? 'Eating today' : 'Planning ahead'}
                </Text>
              </TouchableOpacity>
            ))}
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
                <Ionicons name="dice" size={24} color={Colors.ember} />
                <Ionicons name="arrow-forward" size={16} color={Colors.ember} />
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
                <Ionicons name="leaf" size={18} color={Colors.healthFg} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.healthTitle}>Health Kitchen</Text>
                <Text style={styles.healthSub}>Cooks co-signed by nutritionists</Text>
              </View>
              <Ionicons name="arrow-forward" size={16} color={Colors.healthFg} />
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
                <ActivityIndicator color={Colors.spice} />
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
                <Ionicons name="bag" size={16} color={Colors.ember} />
              </View>
              <Text style={styles.trayLabel}>{count} {count === 1 ? 'item' : 'items'} in tray</Text>
            </View>
            <View style={styles.trayRight}>
              <Text style={styles.trayTotal}>{fmtCurrency(total, currencyCode)}</Text>
              <Ionicons name="arrow-forward" size={14} color={Colors.ember} />
            </View>
          </TouchableOpacity>
        )}
      </SafeAreaView>
    </View>
  );
}

function cookStatus(cook: CookCardType): { status: 'cooking-now' | 'prepping' | 'done'; label: string } {
  if (cook.is_live) return { status: 'cooking-now', label: 'Cooking now' };
  if (cook.today_items.length > 0) return { status: 'prepping', label: 'Has menu today' };
  return { status: 'done', label: 'No menu today' };
}

function CookCardItem({ cook, currencyCode, onPress }: { cook: CookCardType; currencyCode: string; onPress: () => void }) {
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
      {/* Cook identity */}
      <View style={styles.cookHead}>
        <Avatar name={initials} avatarBg={Colors.ember} size={42} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
            <Text style={styles.cookName}>{cook.display_name}</Text>
            <Text style={styles.cookFollowers}>· {followers} followers</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <StatusDot status={status} />
            <Text style={[styles.cookStatus, status === 'cooking-now' && { color: Colors.leaf }]}>
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
            <Ionicons name="leaf" size={10} color={Colors.healthFg} />
            <Text style={styles.healthBadgeText}>Health</Text>
          </View>
        )}
      </View>

      {/* Stats */}
      <View style={styles.cookStats}>
        <Text style={styles.statNum}>{cook.repeat_order_rate}%</Text>
        <Text style={styles.statLabel}>come back</Text>
        <Text style={styles.dot}>·</Text>
        <Ionicons name="star" size={11} color={Colors.spice} />
        <Text style={styles.statLabel}>{cook.average_rating.toFixed(1)}</Text>
        <Text style={styles.dot}>·</Text>
        <Text style={styles.statLabel}>{cook.total_orders} orders</Text>
      </View>

      {/* Dish */}
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
              <Ionicons name="arrow-forward" size={13} color={Colors.canvas} />
            </View>
          </View>
        </>
      ) : (
        <View style={styles.noDishFooter}>
          <Text style={styles.noDishText}>No menu for today</Text>
          <View style={styles.joinBtn}>
            <Text style={styles.joinText}>View profile</Text>
            <Ionicons name="arrow-forward" size={13} color={Colors.canvas} />
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  safe: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingTop: 12, paddingBottom: 8 },
  area:   { fontFamily: Fonts.sans, fontSize: 12, color: Colors.bodySoft, marginTop: 2 },
  headerRight: { flexDirection: 'row', gap: 8 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.bgCook, borderWidth: 0.5, borderColor: Colors.borderWarm, alignItems: 'center', justifyContent: 'center' },

  scroll: { paddingBottom: 100 },

  greeting: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.md },
  greetTitle: { fontFamily: Fonts.serif, fontSize: 24, color: Colors.textInk, lineHeight: 30 },
  greetSub:   { fontFamily: Fonts.sans,  fontSize: 14, color: Colors.bodySoft, marginTop: 4, lineHeight: 20 },

  modeToggle: { flexDirection: 'row', marginHorizontal: Spacing.lg, backgroundColor: Colors.bgCook, borderRadius: Radius.full, borderWidth: 0.5, borderColor: Colors.borderWarm, padding: 4, marginBottom: Spacing.lg },
  modeBtn:    { flex: 1, paddingVertical: 10, borderRadius: Radius.full, alignItems: 'center' },
  modeBtnActive: { backgroundColor: Colors.ink },
  modeBtnText:   { fontFamily: Fonts.sansMedium, fontSize: 13, color: Colors.bodySoft },
  modeBtnTextActive: { color: Colors.canvas },

  section: { marginTop: 4 },
  sectionHeader: { paddingHorizontal: Spacing.lg, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  caps: { fontFamily: Fonts.sansMedium, fontSize: 10, color: Colors.spice, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4 },
  sectionTitle: { fontFamily: Fonts.serif, fontSize: 22, color: Colors.textInk },

  pickCard: { width: 248, borderRadius: 18, padding: 20, minHeight: 130, justifyContent: 'flex-end', overflow: 'hidden' },
  pickShine: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,236,200,0.1)' },
  pickCaps: { fontFamily: Fonts.sansMedium, fontSize: 9, color: 'rgba(255,247,232,0.65)', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8 },
  pickHeadline: { fontFamily: Fonts.serif, fontSize: 16, color: 'rgba(255,247,232,0.96)', lineHeight: 22 },

  spinCard: { backgroundColor: Colors.ink, borderRadius: Radius.lg, padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  spinTitle: { fontFamily: Fonts.sansMedium, fontSize: 15, color: Colors.canvas },
  spinSub:   { fontFamily: Fonts.sans, fontSize: 12, color: 'rgba(250,246,240,0.6)', marginTop: 3 },
  spinRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  healthCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.healthBg, borderRadius: Radius.lg, padding: 14, borderWidth: 0.5, borderColor: 'rgba(46,139,63,0.2)' },
  healthIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(46,139,63,0.12)', alignItems: 'center', justifyContent: 'center' },
  healthTitle: { fontFamily: Fonts.sansMedium, fontSize: 13, color: Colors.healthFg },
  healthSub:   { fontFamily: Fonts.sans, fontSize: 11, color: 'rgba(42,102,64,0.7)', marginTop: 2 },

  loadingWrap: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  loadingText: { fontFamily: Fonts.sans, fontSize: 14, color: Colors.bodySoft },
  emptyWrap: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: Spacing.lg },
  emptyTitle: { fontFamily: Fonts.serif, fontSize: 20, color: Colors.textInk, textAlign: 'center', marginBottom: 8 },
  emptySub: { fontFamily: Fonts.sans, fontSize: 14, color: Colors.bodySoft, textAlign: 'center', lineHeight: 20 },
  retryBtn: { marginTop: 16, backgroundColor: Colors.ink, borderRadius: Radius.full, paddingHorizontal: 24, paddingVertical: 12 },
  retryText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: Colors.canvas },

  cookCard: { backgroundColor: Colors.bgCard, borderRadius: Radius.xl, borderWidth: 0.5, borderColor: Colors.borderWarm, overflow: 'hidden', ...Shadow.card },
  cookHead:  { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, paddingBottom: 10 },
  cookName:  { fontFamily: Fonts.serif, fontSize: 16, color: Colors.textInk },
  cookFollowers: { fontFamily: Fonts.sans, fontSize: 11, color: Colors.bodySoft },
  cookStatus: { fontFamily: Fonts.sans, fontSize: 11, color: Colors.bodySoft },
  cookArea:  { fontFamily: Fonts.sans, fontSize: 11, color: Colors.bodySoft, flex: 1 },
  dot: { color: Colors.caps },
  cookStats: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingBottom: 10 },
  statNum: { fontFamily: Fonts.serif, fontSize: 18, color: Colors.spice },
  statLabel: { fontFamily: Fonts.sans, fontSize: 12, color: Colors.body },
  healthBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.healthBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  healthBadgeText: { fontFamily: Fonts.sansMedium, fontSize: 10, color: Colors.healthFg },
  dishInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, padding: 14, paddingBottom: 6 },
  dishTitle: { fontFamily: Fonts.serif, fontSize: 16, color: Colors.textInk, lineHeight: 21 },
  dishDesc:  { fontFamily: Fonts.sans,  fontSize: 12, color: Colors.bodySoft, marginTop: 4, lineHeight: 17 },
  dishPrice: { fontFamily: Fonts.serif, fontSize: 19, color: Colors.spice, flexShrink: 0 },
  cookFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, paddingTop: 10, flexWrap: 'wrap', gap: 8 },
  noDishFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 },
  noDishText: { fontFamily: Fonts.sans, fontSize: 13, color: Colors.bodySoft },
  discountPill: { backgroundColor: '#FAECE7', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 40 },
  discountText: { fontFamily: Fonts.sansMedium, fontSize: 11, color: Colors.spice },
  slotPill: { backgroundColor: Colors.honey, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 40 },
  slotPillLow: { backgroundColor: Colors.errorBg },
  slotText: { fontFamily: Fonts.sansMedium, fontSize: 11, color: '#5C3B16' },
  slotTextLow: { color: Colors.errorFg },
  joinBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.ink, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 40 },
  joinText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: Colors.canvas },

  tray: { position: 'absolute', bottom: 84, left: 16, right: 16, backgroundColor: Colors.ink, borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', ...Shadow.lift },
  trayLeft:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  trayBag:   { width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(232,146,74,0.2)', alignItems: 'center', justifyContent: 'center' },
  trayLabel: { fontFamily: Fonts.sansMedium, fontSize: 13, color: Colors.canvas },
  trayRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  trayTotal: { fontFamily: Fonts.serif, fontSize: 18, color: Colors.ember },
});
