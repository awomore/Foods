import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAuth } from '../../src/context/AuthContext';
import { useCart } from '../../src/context/CartContext';
import { cooksApi, type CookCard as CookCardType } from '../../src/api/cooks';
import { coursesApi, type Course } from '../../src/api/courses';
import { weeklyMenusApi, type WeeklyMenu } from '../../src/api/weeklyMenus';
import { postsApi, type MyPost } from '../../src/api/posts';
import { followsApi } from '../../src/api/follows';
import { ordersApi, type Order } from '../../src/api/orders';
import { cravingsApi } from '../../src/api/cravings';
import { homeFeedApi } from '../../src/api/feed';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { Fonts, Spacing, Radius, Shadow, FontSize } from '../../src/constants/theme';
import Wordmark from '../../src/components/ui/Wordmark';
import Avatar from '../../src/components/ui/Avatar';
import StatusDot from '../../src/components/ui/StatusDot';
import DishPhoto from '../../src/components/ui/DishPhoto';
import { SkeletonCookCard } from '../../src/components/ui/Skeleton';
import { fmtCurrency } from '../../src/utils/format';
import StoriesBar from '../../src/components/stories/StoriesBar';
import { useTranslation } from 'react-i18next';
import { CREATOR_TYPE_LABELS, type CreatorType } from '../../src/types';

const NOTIF_ASKED_KEY = '@notif_rationale_shown_v1';

// Discovery sections
type DiscoverySection =
  | 'for_you'
  | 'trending'
  | 'health'
  | 'cravings'
  | 'live'
  | 'subscriptions'
  | 'following'
  | 'most_craved'
  | 'new_this_week'
  | 'foods_picks'
  | 'weekly_menus'
  | 'courses'
  | 'services';

const SECTION_LABELS: Record<DiscoverySection, { caps: string; title: string; icon: string }> = {
  for_you:       { caps: 'Personalised',  title: 'For You',              icon: 'sparkles-outline' },
  trending:      { caps: 'Popular today', title: 'Trending Near You',    icon: 'flame-outline' },
  health:        { caps: 'Wellness',      title: 'Health Kitchen',       icon: 'leaf-outline' },
  cravings:      { caps: 'Your wishlist', title: 'Cravings',             icon: 'bookmark-outline' },
  live:          { caps: 'Happening now', title: 'Live Right Now',       icon: 'radio-outline' },
  subscriptions: { caps: 'Recurring',     title: 'Subscriptions',        icon: 'repeat-outline' },
  following:     { caps: 'Your network',  title: 'Creators You Follow',  icon: 'heart-outline' },
  most_craved:   { caps: 'All-time',      title: 'Most Craved',          icon: 'star-outline' },
  new_this_week: { caps: 'Fresh picks',   title: 'New This Week',        icon: 'sparkles-outline' },
  foods_picks:   { caps: 'Curated',       title: 'FOODS Picks',          icon: 'ribbon-outline' },
  weekly_menus:  { caps: 'Plan ahead',    title: 'Weekly Menus',         icon: 'calendar-outline' },
  courses:       { caps: 'Learn',         title: 'Courses',              icon: 'school-outline' },
  services:      { caps: 'Book',          title: 'Services',             icon: 'calendar-number-outline' },
};

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { count, total } = useCart();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);

  // Server-feed sections
  const [forYouCooks, setForYouCooks] = useState<CookCardType[]>([]);
  const [liveCooksServer, setLiveCooksServer] = useState<CookCardType[]>([]);
  const [trendingCooksServer, setTrendingCooksServer] = useState<CookCardType[]>([]);
  const [newThisWeekServer, setNewThisWeekServer] = useState<CookCardType[]>([]);
  const [orderAgainServer, setOrderAgainServer] = useState<CookCardType[]>([]);
  // Kept for sections not yet on the server feed
  const [allCooks, setAllCooks] = useState<CookCardType[]>([]);
  const [followingCooks, setFollowingCooks] = useState<CookCardType[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [weeklyMenus, setWeeklyMenus] = useState<WeeklyMenu[]>([]);
  const [feedPosts, setFeedPosts] = useState<MyPost[]>([]);
  const [trendingCravings, setTrendingCravings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [showNotifRationale, setShowNotifRationale] = useState(false);
  const [activeSection, setActiveSection] = useState<DiscoverySection>('for_you');
  const [showAllSections, setShowAllSections] = useState(false);
  const [recentOrderItems, setRecentOrderItems] = useState<Order[]>([]);

  const { t } = useTranslation();
  const firstName = user?.full_name?.split(' ')[0] ?? 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? t('greeting.morning') : hour < 17 ? t('greeting.afternoon') : t('greeting.evening');

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

      // Primary: server-ranked home feed replaces client-side scoring
      const feedRes = await homeFeedApi.get({ lat: geo?.lat, lng: geo?.lng, limit: 40 });
      setForYouCooks(feedRes.for_you ?? []);
      setLiveCooksServer(feedRes.live ?? []);
      setTrendingCooksServer(feedRes.trending ?? []);
      setNewThisWeekServer(feedRes.new_this_week ?? []);
      setOrderAgainServer(feedRes.order_again ?? []);
      setWeeklyMenus(feedRes.weekly_menus ?? []);
      setCourses(feedRes.courses ?? []);
      // Keep allCooks for sections still driven by the old /api/cooks endpoint
      setAllCooks(feedRes.for_you ?? []);

      // Load parallel content (following, cravings, feed posts)
      postsApi.list({ limit: 20 }).then(r => setFeedPosts((r.posts ?? []).filter(p => p.photo_url || p.photo_urls?.length > 0))).catch(() => {});
      followsApi.list().then(r => setFollowingCooks((r.follows ?? []) as any)).catch(() => {});
      cravingsApi.trending({ limit: 12 }).then(r => setTrendingCravings(r.trending ?? [])).catch(() => {});
    } catch (e: any) {
      setError(e.error ?? 'Could not load kitchens');
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

  useEffect(() => {
    ordersApi.list({ limit: 10 }).then(r => {
      const done = (r.orders ?? []).filter(o => o.status === 'delivered' || o.status === 'completed');
      const seen = new Set<string>();
      const unique = done.filter(o => {
        if (!o.menu_item_id || seen.has(o.menu_item_id)) return false;
        seen.add(o.menu_item_id);
        return true;
      }).slice(0, 3);
      setRecentOrderItems(unique);
    }).catch(() => {});
  }, [user?.id]);

  useEffect(() => {
    if (loading) return;
    AsyncStorage.getItem(NOTIF_ASKED_KEY).then(val => {
      if (val) return;
      Notifications.getPermissionsAsync().then(({ status }) => {
        if (status === 'undetermined') {
          setTimeout(() => setShowNotifRationale(true), 2500);
        }
      });
    });
  }, [loading]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load(coords);
  }, [coords, load]);

  // ── Behavioral signal emission ───────────────────────────────────────────────
  const tappedCookIds = useRef<Set<string>>(new Set());

  const onViewableItemsChanged = useCallback(({ changed }: { changed: Array<{ item: any; isViewable: boolean }> }) => {
    if (!user) return;
    changed.forEach(({ item: li, isViewable }) => {
      // When a cook card leaves the viewport without being tapped → card_skip
      if (!isViewable && li.type === 'cook' && !tappedCookIds.current.has(li.cook.id)) {
        homeFeedApi.emitSignal('cook', li.cook.id, 'card_skip').catch(() => {});
      }
    });
  }, [user]);

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 });

  // Derived fallback lists (used for sections not yet served by /feed/home)
  const liveCooksFallback     = useMemo(() => allCooks.filter(c => c.is_live), [allCooks]);
  const trendingCooksFallback = useMemo(() => allCooks.filter(c => c.today_items?.length > 0).slice(0, 8), [allCooks]);
  const newCooksFallback      = useMemo(() => [...allCooks].sort((a, b) => new Date(b.joined_at ?? 0).getTime() - new Date(a.joined_at ?? 0).getTime()).slice(0, 8), [allCooks]);
  const topRated              = useMemo(() => [...allCooks].sort((a, b) => b.average_rating - a.average_rating).slice(0, 8), [allCooks]);
  const serviceCreators       = useMemo(() => allCooks.filter(c => c.accepts_private_chef || c.accepts_catering).slice(0, 6), [allCooks]);
  const healthCooks           = useMemo(() => allCooks.filter(c => c.is_health_kitchen).slice(0, 6), [allCooks]);

  // Server sections take priority over client-computed fallbacks
  const liveCooks    = liveCooksServer.length     > 0 ? liveCooksServer     : liveCooksFallback;
  const trendingCooks = trendingCooksServer.length > 0 ? trendingCooksServer : trendingCooksFallback;
  const newCooks     = newThisWeekServer.length   > 0 ? newThisWeekServer   : newCooksFallback;

  const currencyCode = (forYouCooks[0] ?? allCooks[0])?.currency_code ?? 'NGN';

  const DISCOVERY_SECTIONS: DiscoverySection[] = [
    'for_you', 'trending', 'health', 'cravings', 'live', 'subscriptions',
    'following', 'most_craved', 'new_this_week', 'weekly_menus', 'courses', 'services',
  ];

  type ListItem =
    | { type: 'topbar' }
    | { type: 'stories' }
    | { type: 'greeting' }
    | { type: 'order-again'; orders: Order[] }
    | { type: 'food-feed'; posts: MyPost[] }
    | { type: 'section-nav' }
    | { type: 'section-header'; section: DiscoverySection }
    | { type: 'horizontal-cooks'; cooks: CookCardType[] }
    | { type: 'horizontal-courses'; courses: Course[] }
    | { type: 'trending-cravings'; items: any[] }
    | { type: 'horizontal-menus'; menus: WeeklyMenu[] }
    | { type: 'cook'; cook: CookCardType }
    | { type: 'loading' }
    | { type: 'empty'; section: DiscoverySection }
    | { type: 'error' }
    | { type: 'cravings-prompt' }
    | { type: 'subscriptions-prompt' };

  const listData = useMemo((): ListItem[] => {
    const items: ListItem[] = [{ type: 'greeting' }];
    if (recentOrderItems.length > 0) items.push({ type: 'order-again', orders: recentOrderItems });
    if (feedPosts.length > 0) items.push({ type: 'food-feed', posts: feedPosts });
    items.push({ type: 'section-nav' });

    if (loading) { items.push({ type: 'loading' }); return items; }
    if (error) { items.push({ type: 'error' }); return items; }

    const section = activeSection;
    items.push({ type: 'section-header', section });

    switch (section) {
      case 'for_you':
        if (!forYouCooks.length) { items.push({ type: 'empty', section }); break; }
        forYouCooks.forEach(cook => items.push({ type: 'cook', cook }));
        break;
      case 'trending':
        if (!trendingCooks.length) { items.push({ type: 'empty', section }); break; }
        trendingCooks.forEach(cook => items.push({ type: 'cook', cook }));
        break;
      case 'live':
        if (!liveCooks.length) { items.push({ type: 'empty', section }); break; }
        items.push({ type: 'horizontal-cooks', cooks: liveCooks });
        break;
      case 'following':
        if (!followingCooks.length) { items.push({ type: 'empty', section }); break; }
        followingCooks.forEach(cook => items.push({ type: 'cook', cook }));
        break;
      case 'most_craved':
        if (!trendingCravings.length) { items.push({ type: 'empty', section }); break; }
        items.push({ type: 'trending-cravings', items: trendingCravings });
        break;
      case 'new_this_week':
        if (!newCooks.length) { items.push({ type: 'empty', section }); break; }
        items.push({ type: 'horizontal-cooks', cooks: newCooks });
        break;
      case 'weekly_menus':
        if (!weeklyMenus.length) { items.push({ type: 'empty', section }); break; }
        items.push({ type: 'horizontal-menus', menus: weeklyMenus });
        break;
      case 'courses':
        if (!courses.length) { items.push({ type: 'empty', section }); break; }
        items.push({ type: 'horizontal-courses', courses });
        break;
      case 'services':
        if (!serviceCreators.length) { items.push({ type: 'empty', section }); break; }
        serviceCreators.forEach(cook => items.push({ type: 'cook', cook }));
        break;
      case 'health':
        if (!healthCooks.length) { items.push({ type: 'empty', section }); break; }
        healthCooks.forEach(cook => items.push({ type: 'cook', cook }));
        break;
      case 'cravings':
        items.push({ type: 'cravings-prompt' });
        if (!topRated.length) { items.push({ type: 'empty', section }); break; }
        topRated.forEach(cook => items.push({ type: 'cook', cook }));
        break;
      case 'subscriptions':
        items.push({ type: 'subscriptions-prompt' });
        break;
    }
    return items;
  }, [activeSection, loading, error, forYouCooks, allCooks, trendingCooks, liveCooks, topRated, newCooks, trendingCravings, courses, weeklyMenus, serviceCreators, healthCooks, feedPosts, followingCooks, recentOrderItems]);

  const visibleSections = useMemo(() => {
    if (showAllSections || DISCOVERY_SECTIONS.indexOf(activeSection) >= 5) {
      return DISCOVERY_SECTIONS;
    }
    return DISCOVERY_SECTIONS.slice(0, 5);
  }, [showAllSections, activeSection]);

  function renderItem({ item }: { item: ListItem }) {
    switch (item.type) {
      case 'greeting':
        return (
          <View>
            <View style={styles.greeting}>
              <Text style={styles.greetTitle}>
                {greeting}, <Text style={{ color: C.spice }}>{firstName}</Text>.
              </Text>
              <Text style={styles.greetSub}>{t('home.tagline')}</Text>
            </View>
            <TouchableOpacity
              style={styles.searchPrompt}
              onPress={() => router.push('/search' as any)}
              activeOpacity={0.7}
            >
              <Ionicons name="search-outline" size={16} color={C.bodySoft} />
              <Text style={styles.searchPromptText}>{t('home.search')}</Text>
            </TouchableOpacity>
            {showNotifRationale && (
              <View style={[styles.notifCard, { backgroundColor: C.bgCard, borderColor: C.borderWarm }]}>
                <View style={[styles.notifIconWrap, { backgroundColor: C.cream }]}>
                  <Ionicons name="notifications" size={22} color={C.spice} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.notifCardTitle, { color: C.textInk }]}>{t('home.never_miss')}</Text>
                  <Text style={[styles.notifCardSub, { color: C.bodySoft }]}>
                    {t('home.notif_rationale')}
                  </Text>
                  <View style={styles.notifCardBtns}>
                    <TouchableOpacity
                      style={[styles.notifEnableBtn, { backgroundColor: C.spice }]}
                      onPress={async () => {
                        setShowNotifRationale(false);
                        await AsyncStorage.setItem(NOTIF_ASKED_KEY, '1');
                        await Notifications.requestPermissionsAsync();
                      }}
                    >
                      <Text style={[styles.notifEnableBtnText, { color: C.canvas }]}>{t('home.turn_on')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={async () => {
                        setShowNotifRationale(false);
                        await AsyncStorage.setItem(NOTIF_ASKED_KEY, '1');
                      }}
                    >
                      <Text style={[styles.notifSkipText, { color: C.bodySoft }]}>{t('home.not_now')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}
          </View>
        );

      case 'order-again':
        return (
          <View style={{ marginTop: 4, marginBottom: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="refresh-outline" size={15} color={C.spice} />
                <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 12, color: C.caps, textTransform: 'uppercase', letterSpacing: 0.6 }}>{t('home.order_again')}</Text>
              </View>
              <TouchableOpacity onPress={() => router.push('/(customer)/orders' as any)}>
                <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 12, color: C.spice }}>{t('common.viewAll')}</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              horizontal
              data={item.orders}
              keyExtractor={o => o.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: Spacing.lg, gap: 10 }}
              renderItem={({ item: order }) => {
                const photo = order.item_photos?.[0] ?? null;
                return (
                  <TouchableOpacity
                    activeOpacity={0.88}
                    onPress={() => router.push(`/item/${order.menu_item_id}` as any)}
                    style={{ width: 140, backgroundColor: C.bgCard, borderRadius: Radius.lg, overflow: 'hidden', borderWidth: 0.5, borderColor: C.borderWarm, ...Shadow.card }}
                  >
                    {photo ? (
                      <DishPhoto uri={photo} style={{ width: 140, height: 90 }} />
                    ) : (
                      <View style={{ width: 140, height: 90, backgroundColor: C.ember, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="restaurant-outline" size={28} color={C.spice} />
                      </View>
                    )}
                    <View style={{ padding: 8 }}>
                      <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 12, color: C.textInk, lineHeight: 16 }} numberOfLines={2}>{order.item_title ?? 'Dish'}</Text>
                      <Text style={{ fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft, marginTop: 2 }} numberOfLines={1}>{order.cook_name}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
                        <Ionicons name="refresh" size={11} color={C.spice} />
                        <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 11, color: C.spice }}>{t('home.order_again')}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        );

      case 'food-feed':
        return (
          <View style={{ marginTop: 4, marginBottom: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="images-outline" size={15} color={C.spice} />
                <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 12, color: C.caps, textTransform: 'uppercase', letterSpacing: 0.6 }}>{t('home.whats_cooking')}</Text>
              </View>
              <TouchableOpacity onPress={() => router.push('/(customer)/feed' as any)}>
                <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 12, color: C.spice }}>{t('common.seeAll')}</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              horizontal
              data={item.posts}
              keyExtractor={p => p.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: Spacing.lg, gap: 8 }}
              renderItem={({ item: post }) => {
                const photo = post.photo_url ?? post.photo_urls?.[0] ?? null;
                if (!photo) return null;
                return (
                  <TouchableOpacity
                    activeOpacity={0.88}
                    style={{ width: 120, height: 120, borderRadius: Radius.md, overflow: 'hidden', borderWidth: 0.5, borderColor: C.borderWarm }}
                  >
                    <DishPhoto uri={photo} style={{ width: 120, height: 120 }} />
                    {post.like_count > 0 && (
                      <View style={{ position: 'absolute', bottom: 6, left: 6, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 20, paddingHorizontal: 7, paddingVertical: 3 }}>
                        <Ionicons name="heart" size={11} color="#FF6B6B" />
                        <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 10, color: '#fff' }}>{post.like_count}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        );

      case 'section-nav':
        return (
          <FlatList
            horizontal
            data={visibleSections}
            keyExtractor={s => s}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingVertical: 10, gap: 8 }}
            extraData={activeSection}
            renderItem={({ item: sec }) => {
              const info = SECTION_LABELS[sec];
              const isActive = sec === activeSection;
              return (
                <TouchableOpacity
                  style={[styles.navChip, isActive && styles.navChipActive]}
                  onPress={() => { setActiveSection(sec); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                  accessibilityLabel={info.title}
                >
                  <Ionicons name={info.icon as any} size={14} color={isActive ? C.canvas : C.bodySoft} />
                  <Text style={[styles.navChipText, isActive && styles.navChipTextActive]}>
                    {info.title}
                  </Text>
                </TouchableOpacity>
              );
            }}
            ListFooterComponent={
              visibleSections.length < DISCOVERY_SECTIONS.length ? (
                <TouchableOpacity
                  style={[styles.navChip, { gap: 4 }]}
                  onPress={() => { setShowAllSections(true); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                  accessibilityLabel="More sections"
                >
                  <Ionicons name="grid-outline" size={14} color={C.bodySoft} />
                  <Text style={styles.navChipText}>More</Text>
                </TouchableOpacity>
              ) : showAllSections ? (
                <TouchableOpacity
                  style={[styles.navChip, { gap: 4 }]}
                  onPress={() => { setShowAllSections(false); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                  accessibilityLabel="Show fewer sections"
                >
                  <Ionicons name="chevron-back-outline" size={14} color={C.bodySoft} />
                  <Text style={styles.navChipText}>Less</Text>
                </TouchableOpacity>
              ) : null
            }
          />
        );

      case 'section-header': {
        const info = SECTION_LABELS[item.section];
        return (
          <View style={styles.sectionHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.caps}>{info.caps}</Text>
              <Text style={styles.sectionTitle}>{info.title}</Text>
            </View>
            {item.section === 'courses' && (
              <TouchableOpacity onPress={() => router.push('/course/marketplace' as any)}>
                <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 13, color: C.spice }}>{t('home.browse_all')}</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      }

      case 'trending-cravings':
        return (
          <FlatList
            horizontal
            data={item.items}
            keyExtractor={(c, i) => `${c.cook_profile_id}-${i}`}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: Spacing.lg, gap: 12 }}
            renderItem={({ item: craving }) => (
              <TouchableOpacity
                style={[styles.miniCookCard, { width: 130 }]}
                onPress={() => router.push(`/cook/${craving.cook_profile_id}` as any)}
              >
                <DishPhoto
                  uri={craving.dish_photo ?? null}
                  label={craving.dish_title}
                  height={80} width={110} radius={10}
                  recyclingKey={`craving-${craving.cook_profile_id}`}
                />
                <Text style={styles.miniCookName} numberOfLines={2}>{craving.dish_title}</Text>
                <Text style={styles.miniCookFollowers}>{craving.craving_count} craving this</Text>
                <Text style={[styles.miniCookFollowers, { color: C.spice }]} numberOfLines={1}>by {craving.cook_name}</Text>
              </TouchableOpacity>
            )}
          />
        );

      case 'horizontal-cooks':
        return (
          <FlatList
            horizontal
            data={item.cooks}
            keyExtractor={c => c.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: Spacing.lg, gap: 12 }}
            renderItem={({ item: cook }) => (
              <TouchableOpacity
                style={styles.miniCookCard}
                onPress={() => router.push(`/cook/${cook.id}` as any)}
              >
                <Avatar name={cook.display_name} avatarUrl={cook.avatar_url} size={56} hasStory={cook.has_story} isLive={cook.is_live} />
                <Text style={styles.miniCookName} numberOfLines={2}>{cook.display_name}</Text>
                {cook.is_live && (
                  <View style={styles.livePill}>
                    <View style={styles.liveDot} />
                    <Text style={styles.livePillText}>LIVE</Text>
                  </View>
                )}
                <Text style={styles.miniCookFollowers}>{cook.platform_follower_count ?? 0} followers</Text>
              </TouchableOpacity>
            )}
          />
        );

      case 'horizontal-menus':
        return (
          <FlatList
            horizontal
            data={item.menus}
            keyExtractor={m => m.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: Spacing.lg, gap: 12 }}
            renderItem={({ item: menu }) => (
              <TouchableOpacity
                style={styles.menuCard}
                onPress={() => router.push(`/cook/${menu.cook_id}` as any)}
              >
                <View style={styles.menuCardHeader}>
                  <Ionicons name="calendar-outline" size={20} color={C.spice} />
                  <Text style={styles.menuWeek}>{menu.week_start}</Text>
                </View>
                <Text style={styles.menuTitle} numberOfLines={1}>{menu.title ?? 'Weekly Menu'}</Text>
                <Text style={styles.menuCook}>{menu.cook_name}</Text>
                <Text style={styles.menuItems}>{(menu.items ?? []).length} items this week</Text>
              </TouchableOpacity>
            )}
          />
        );

      case 'horizontal-courses':
        return (
          <FlatList
            horizontal
            data={item.courses}
            keyExtractor={c => c.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: Spacing.lg, gap: 12 }}
            renderItem={({ item: course }) => (
              <TouchableOpacity
                style={styles.courseCard}
                onPress={() => router.push({ pathname: '/course/[id]', params: { id: course.id } } as any)}
              >
                {course.cover_image && (
                  <DishPhoto uri={course.cover_image} style={styles.courseThumb} />
                )}
                <View style={styles.courseCardBody}>
                  {course.is_free && (
                    <View style={styles.freePill}><Text style={styles.freePillText}>Free</Text></View>
                  )}
                  <Text style={styles.courseCardTitle} numberOfLines={2}>{course.title}</Text>
                  <Text style={styles.courseCardCook}>{course.cook_name}</Text>
                  <Text style={styles.courseCardPrice}>
                    {course.is_free ? 'Free' : fmtCurrency(course.price, 'NGN')}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          />
        );

      case 'cook':
        return (
          <View style={{ paddingHorizontal: Spacing.lg, marginBottom: 12 }}>
            <CookCardItem
              cook={item.cook}
              currencyCode={currencyCode}
              onPress={() => {
                tappedCookIds.current.add(item.cook.id);
                if (user) homeFeedApi.emitSignal('cook', item.cook.id, 'profile_view').catch(() => {});
                router.push(`/cook/${item.cook.id}` as any);
              }}
            />
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
            <Text style={styles.emptyTitle}>{t('common.error')}</Text>
            <TouchableOpacity onPress={() => load(coords)} style={styles.retryBtn}>
              <Text style={styles.retryText}>{t('common.retry')}</Text>
            </TouchableOpacity>
          </View>
        );

      case 'empty':
        return (
          <View style={styles.emptyWrap}>
            <Ionicons name={SECTION_LABELS[item.section].icon as any} size={40} color={C.stone} style={{ marginBottom: 12 }} />
            <Text style={styles.emptyTitle}>{t('home.nothing_yet')}</Text>
            <Text style={styles.emptySub}>{t('home.check_back')}</Text>
          </View>
        );

      case 'cravings-prompt':
        return (
          <TouchableOpacity
            style={styles.sectionCallout}
            onPress={() => router.push(`/profile/${user?.id}` as any)}
            activeOpacity={0.8}
          >
            <Ionicons name="bookmark-outline" size={18} color={C.spice} />
            <View style={{ flex: 1 }}>
              <Text style={styles.calloutTitle}>{t('home.your_cravings')}</Text>
              <Text style={styles.calloutSub}>{t('home.your_cravings_sub')}</Text>
            </View>
            <Ionicons name="arrow-forward" size={16} color={C.spice} />
          </TouchableOpacity>
        );

      case 'subscriptions-prompt':
        return (
          <TouchableOpacity
            style={styles.sectionCallout}
            onPress={() => router.push('/(customer)/gifting' as any)}
            activeOpacity={0.8}
          >
            <Ionicons name="repeat-outline" size={18} color={C.spice} />
            <View style={{ flex: 1 }}>
              <Text style={styles.calloutTitle}>{t('home.manage_subscriptions')}</Text>
              <Text style={styles.calloutSub}>{t('home.manage_subscriptions_sub')}</Text>
            </View>
            <Ionicons name="arrow-forward" size={16} color={C.spice} />
          </TouchableOpacity>
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
            <Wordmark size="compact" on="light" />
            <Text style={styles.area}>{coords ? 'Near you' : 'All creators'}</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => router.push('/search' as any)}
              accessibilityLabel="Search"
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.spice} />}
        ListHeaderComponent={<StoriesBar />}
        removeClippedSubviews={Platform.OS === 'android'}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig.current}
      />

      {/* Cart tray is rendered globally in (customer)/_layout.tsx */}
    </View>
  );
}

// ─── Cook card ────────────────────────────────────────────────────────────────

function cookStatus(cook: CookCardType): { status: 'cooking-now' | 'prepping' | 'done'; label: string } {
  if (cook.is_live) return { status: 'cooking-now', label: 'Cooking now' };
  if (cook.today_items?.length > 0) return { status: 'prepping', label: 'Has menu today' };
  return { status: 'done', label: 'No menu today' };
}

// Derive a "closing soon" label when the cook has a cutoff within 2 hours
function closingSoonLabel(cook: CookCardType): string | null {
  if (!cook.order_cutoff_time) return null;
  const now = new Date();
  const cutoff = new Date(cook.order_cutoff_time);
  const diffMin = (cutoff.getTime() - now.getTime()) / 60000;
  if (diffMin <= 0) return 'Orders closed';
  if (diffMin <= 120) {
    const h = Math.floor(diffMin / 60);
    const m = Math.round(diffMin % 60);
    return h > 0 ? `Orders close in ${h}h ${m}m` : `Orders close in ${m}m`;
  }
  return null;
}

function CookCardItem({ cook, currencyCode, onPress }: { cook: CookCardType; currencyCode: string; onPress: () => void }) {
  const { t } = useTranslation();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const dish = cook.today_items?.[0];
  const { status, label } = cookStatus(cook);
  const slotsLeft = dish ? (dish.total_slots - dish.slots_claimed) : 0;
  const slotsLow = slotsLeft > 0 && slotsLeft <= 2;
  const soldOut = dish && slotsLeft === 0;
  const followers = (cook.platform_follower_count ?? 0) >= 1000
    ? ((cook.platform_follower_count ?? 0) / 1000).toFixed(1) + 'k'
    : String(cook.platform_follower_count ?? 0);

  const creatorTypeLabel = cook.creator_types?.length
    ? CREATOR_TYPE_LABELS[cook.creator_types[0] as CreatorType] ?? ''
    : '';

  // Momentum signals — prefer dynamic counts over static totals
  const recentOrderCount  = (cook as any).orders_last_hour ?? 0;
  const newFollowerCount  = (cook as any).new_followers_this_week ?? 0;
  const closingLabel      = closingSoonLabel(cook);

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.cookCard, soldOut && { opacity: 0.65 }]}
      activeOpacity={0.9}
    >
      <View style={styles.cookHead}>
        <Avatar name={cook.display_name} avatarUrl={cook.avatar_url} avatarBg={C.ember} size={42} hasStory={cook.has_story} isLive={cook.is_live} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Text style={styles.cookName}>{cook.display_name}</Text>
            {cook.id_verified && (
              <Ionicons name="checkmark-circle" size={15} color={C.spice} />
            )}
            {creatorTypeLabel ? <Text style={styles.cookType}>{creatorTypeLabel}</Text> : null}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <StatusDot status={status} />
            <Text style={[styles.cookStatus, status === 'cooking-now' && { color: C.leaf }]}>{label}</Text>
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
            <Text style={styles.healthBadgeText}>{t('home.health_badge')}</Text>
          </View>
        )}
      </View>

      <View style={styles.cookStats}>
        {recentOrderCount > 0 ? (
          <>
            <Ionicons name="flash" size={11} color={C.spice} />
            <Text style={[styles.statLabel, { color: C.spice }]}>{t('home.orders_this_hour', { count: recentOrderCount })}</Text>
            <Text style={styles.dot}>·</Text>
          </>
        ) : newFollowerCount > 0 ? (
          <>
            <Ionicons name="trending-up-outline" size={11} color={C.leaf} />
            <Text style={[styles.statLabel, { color: C.leaf }]}>{t('home.new_followers_week', { count: newFollowerCount })}</Text>
            <Text style={styles.dot}>·</Text>
          </>
        ) : (
          <>
            <Text style={styles.statNum}>{cook.repeat_order_rate}%</Text>
            <Text style={styles.statLabel}>{t('home.come_back')}</Text>
            <Text style={styles.dot}>·</Text>
          </>
        )}
        <Ionicons name="star" size={11} color={C.spice} />
        <Text style={styles.statLabel}>{cook.average_rating?.toFixed(1)}</Text>
        <Text style={styles.dot}>·</Text>
        <Text style={styles.statLabel}>{t('home.followers_count', { count: followers })}</Text>
      </View>
      {closingLabel && (
        <View style={styles.closingPill}>
          <Ionicons name="time-outline" size={12} color={C.warnFg} />
          <Text style={styles.closingText}>{closingLabel}</Text>
        </View>
      )}

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
              {cook.active_discounts?.length > 0 && (
                <View style={styles.discountPill}>
                  <Text style={styles.discountText}>{cook.active_discounts[0].discount_value}% off</Text>
                </View>
              )}
              <View style={[styles.slotPill, slotsLow && styles.slotPillLow, soldOut && styles.slotPillSoldOut]}>
                <Text style={[styles.slotText, slotsLow && styles.slotTextLow, soldOut && styles.slotTextSoldOut]}>
                  {soldOut ? t('home.sold_out_today') : slotsLow ? t('home.only_left', { count: slotsLeft }) : t('home.slots_left', { left: slotsLeft, total: dish.total_slots })}
                </Text>
              </View>
            </View>
            {soldOut ? (
              <TouchableOpacity
                style={styles.followBtn}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onPress();
                }}
                activeOpacity={0.85}
              >
                <Ionicons name="add" size={14} color={C.spice} />
                <Text style={styles.followText}>{t('home.follow_next')}</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.joinBtn}>
                <Text style={styles.joinText}>{t('home.join_table')}</Text>
                <Ionicons name="arrow-forward" size={13} color={C.canvas} />
              </View>
            )}
          </View>
        </>
      ) : (
        <View style={styles.noDishFooter}>
          <Text style={styles.noDishText}>{t('home.no_menu')}</Text>
          <View style={styles.joinBtn}>
            <Text style={styles.joinText}>{t('home.view_profile')}</Text>
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
    topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingTop: 12, paddingBottom: 8 },
    area: { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft, marginTop: 2 },
    headerRight: { flexDirection: 'row', gap: 8 },
    iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.bgCook, borderWidth: 0.5, borderColor: C.borderWarm, alignItems: 'center', justifyContent: 'center' },
    greeting: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.sm },
    greetTitle: { fontFamily: Fonts.serif, fontSize: 24, color: C.textInk, lineHeight: 30 },
    greetSub: { fontFamily: Fonts.sans, fontSize: 14, color: C.bodySoft, marginTop: 4, lineHeight: 20 },
    searchPrompt: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: Spacing.lg, marginBottom: Spacing.sm, backgroundColor: C.bgCook, borderRadius: Radius.full, paddingHorizontal: 16, paddingVertical: 11, borderWidth: 0.5, borderColor: C.borderWarm },
    searchPromptText: { fontFamily: Fonts.sans, fontSize: 14, color: C.bodySoft, flex: 1 },
    // Section nav
    navChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: Radius.full, borderWidth: 1, borderColor: C.borderWarm, backgroundColor: C.bgCard },
    navChipActive: { backgroundColor: C.ink, borderColor: C.ink },
    navChipText: { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.bodySoft },
    navChipTextActive: { color: C.canvas },
    // Section header
    sectionHeader: { paddingHorizontal: Spacing.lg, marginBottom: 12, marginTop: 8, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
    caps: { fontFamily: Fonts.sansMedium, fontSize: 10, color: C.spice, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4 },
    sectionTitle: { fontFamily: Fonts.serif, fontSize: 22, color: C.textInk },
    // Mini cook card (horizontal)
    miniCookCard: { alignItems: 'center', width: 80, gap: 6 },
    miniCookName: { fontFamily: Fonts.sansMedium, fontSize: 11, color: C.ink, textAlign: 'center' },
    miniCookFollowers: { fontFamily: Fonts.sans, fontSize: 10, color: C.bodySoft, textAlign: 'center' },
    livePill: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: C.errorBg, borderRadius: Radius.full, paddingHorizontal: 6, paddingVertical: 2 },
    liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.errorFg },
    livePillText: { fontFamily: Fonts.sansMedium, fontSize: 9, color: C.errorFg, letterSpacing: 0.5 },
    // Menu card
    menuCard: { width: 200, backgroundColor: C.bgCard, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 0.5, borderColor: C.borderWarm, ...Shadow.card },
    menuCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
    menuWeek: { fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft },
    menuTitle: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.ink, marginBottom: 2 },
    menuCook: { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft },
    menuItems: { fontFamily: Fonts.sans, fontSize: 11, color: C.spice, marginTop: 4 },
    // Course card
    courseCard: { width: 180, backgroundColor: C.bgCard, borderRadius: Radius.lg, overflow: 'hidden', borderWidth: 0.5, borderColor: C.borderWarm, ...Shadow.card },
    courseThumb: { width: '100%', height: 110 },
    courseCardBody: { padding: Spacing.sm },
    freePill: { backgroundColor: C.successBg, borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start', marginBottom: 4 },
    freePillText: { fontFamily: Fonts.sansMedium, fontSize: 10, color: C.successFg },
    courseCardTitle: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.ink, lineHeight: 18 },
    courseCardCook: { fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft, marginTop: 2 },
    courseCardPrice: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.spice, marginTop: 4 },
    // Cook card
    cookCard: { backgroundColor: C.bgCard, borderRadius: Radius.xl, borderWidth: 0.5, borderColor: C.borderWarm, overflow: 'hidden', ...Shadow.card },
    cookHead: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, paddingBottom: 10 },
    cookName: { fontFamily: Fonts.serif, fontSize: 16, color: C.textInk },
    cookType: { fontFamily: Fonts.sans, fontSize: 10, color: C.spice, letterSpacing: 0.3 },
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
    followBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: C.spice + '60', backgroundColor: C.warnBg, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 40 },
    followText: { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.spice },
    closingPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingBottom: 10 },
    closingText: { fontFamily: Fonts.sansMedium, fontSize: 11, color: C.warnFg },
    // Section callout cards
    sectionCallout: { flexDirection: 'row', alignItems: 'center', gap: 14, marginHorizontal: Spacing.lg, marginBottom: 16, backgroundColor: C.bgCard, borderRadius: Radius.lg, padding: 16, borderWidth: 0.5, borderColor: C.borderWarm, ...Shadow.card },
    calloutTitle: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.textInk, marginBottom: 2 },
    calloutSub: { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft, lineHeight: 17 },
    // Empty / error
    emptyWrap: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: Spacing.lg },
    emptyTitle: { fontFamily: Fonts.serif, fontSize: 20, color: C.textInk, textAlign: 'center', marginBottom: 8 },
    emptySub: { fontFamily: Fonts.sans, fontSize: 14, color: C.bodySoft, textAlign: 'center', lineHeight: 20 },
    retryBtn: { marginTop: 16, backgroundColor: C.ink, borderRadius: Radius.full, paddingHorizontal: 24, paddingVertical: 12 },
    retryText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.canvas },

    // Notification rationale card
    notifCard: { flexDirection: 'row', gap: 12, borderRadius: Radius.lg, borderWidth: 0.5, padding: 14, marginHorizontal: Spacing.lg, marginTop: 12, ...Shadow.card },
    notifIconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    notifCardTitle: { fontFamily: Fonts.sansMedium, fontSize: 14, marginBottom: 3 },
    notifCardSub: { fontFamily: Fonts.sans, fontSize: 12, lineHeight: 17 },
    notifCardBtns: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 },
    notifEnableBtn: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 40 },
    notifEnableBtnText: { fontFamily: Fonts.sansMedium, fontSize: 13 },
    notifSkipText: { fontFamily: Fonts.sans, fontSize: 13 },
  });
}
