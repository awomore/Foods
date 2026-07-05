import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { discoverApi } from '../../src/api/discover';
import type { CookCard, MenuItem } from '../../src/api/cooks';
import { Fonts, Spacing, Radius, Shadow } from '../../src/constants/theme';
import { useTranslation } from 'react-i18next';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { fmtCurrency } from '../../src/utils/format';
import Avatar from '../../src/components/ui/Avatar';
import StatusDot from '../../src/components/ui/StatusDot';
import DishPhoto from '../../src/components/ui/DishPhoto';
import { SkeletonDiscoverCard } from '../../src/components/ui/Skeleton';

type Filter = { key: string; label: string; params: Record<string, string> };

type DishResult = MenuItem & {
  cook_name: string;
  cook_username: string;
  cook_rating: number;
  cook_location: string | null;
  distance_km: number;
};

export default function DiscoverScreen() {
  const router = useRouter();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');

  const FILTERS: Filter[] = [
    { key: 'all',    label: t('discover.all'),          params: {} },
    { key: 'open',   label: t('discover.open_now'),     params: { available_now: 'true' } },
    { key: 'new',    label: `✨ ${t('discover.new_creators')}`, params: { new_creators: 'true' } },
    { key: 'health', label: t('discover.health_kitchen'), params: { health: 'true' } },
    { key: 'budget', label: t('discover.budget'),       params: { max_price: '4000' } },
    { key: 'rated',  label: t('discover.high_rated'),   params: { sort: 'rating' } },
  ];
  const [cooks, setCooks] = useState<CookCard[]>([]);
  const [dishes, setDishes] = useState<DishResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(async (q: string, filterKey: string) => {
    const filter = FILTERS.find(f => f.key === filterKey)!;
    const rawParams: Record<string, unknown> = { q: q.trim() || undefined };
    for (const [k, v] of Object.entries(filter.params)) {
      if (k === 'available_now' || k === 'health' || k === 'new_creators') rawParams[k] = v === 'true';
      else if (k === 'max_price') rawParams[k] = Number(v);
      else rawParams[k] = v;
    }
    setLoading(true);
    setSearched(true);
    try {
      const data = await discoverApi.search(rawParams as Parameters<typeof discoverApi.search>[0]);
      setCooks(data.cooks ?? []);
      setDishes((data.dishes ?? []) as DishResult[]);
    } catch (e) {
      setCooks([]);
      setDishes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleQueryChange(text: string) {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(text, activeFilter), 400);
  }

  function handleFilterPress(key: string) {
    setActiveFilter(key);
    doSearch(query, key);
  }

  const hasResults = cooks.length > 0 || dishes.length > 0;

  return (
    <View style={styles.root}>
      <SafeAreaView>
        <View style={styles.topBar}>
          <Text style={styles.pageTitle}>{t('discover.title')}</Text>
        </View>

        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={16} color={C.bodySoft} />
            <TextInput
              style={styles.searchInput}
              placeholder={t('discover.search')}
              placeholderTextColor={C.bodySoft}
              value={query}
              onChangeText={handleQueryChange}
              returnKeyType="search"
              onSubmitEditing={() => doSearch(query, activeFilter)}
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => { setQuery(''); setCooks([]); setDishes([]); setSearched(false); }}>
                <Ionicons name="close-circle" size={16} color={C.bodySoft} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {FILTERS.map(f => (
            <TouchableOpacity
              key={f.key}
              onPress={() => handleFilterPress(f.key)}
              style={[styles.filterPill, activeFilter === f.key && styles.filterPillActive]}
            >
              <Text style={[styles.filterLabel, activeFilter === f.key && styles.filterLabelActive]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: Spacing.lg, gap: 12, paddingTop: 8 }}>
        {loading ? (
          <>
            {[1, 2, 3, 4].map(k => <SkeletonDiscoverCard key={k} />)}
          </>
        ) : !searched ? (
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={36} color={C.stone} />
            <Text style={styles.emptyText}>{t('discover.hint')}</Text>
            <Text style={styles.emptySub}>{t('discover.hint_sub')}</Text>
          </View>
        ) : !hasResults ? (
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={36} color={C.stone} />
            <Text style={styles.emptyText}>{t('discover.no_results')}</Text>
            <Text style={styles.emptySub}>{t('discover.try_different')}</Text>
          </View>
        ) : (
          <>
            {cooks.length > 0 && (
              <>
                <Text style={styles.groupLabel}>{t('discover.cooks')}</Text>
                {cooks.map(cook => {
                  const todayItem = cook.today_items?.[0];
                  return (
                    <TouchableOpacity
                      key={cook.id}
                      onPress={() => router.push(`/cook/${cook.id}`)}
                      style={styles.card}
                      activeOpacity={0.85}
                    >
                      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                        <DishPhoto
                          uri={todayItem?.photos?.[0] ?? cook.kitchen_photos?.[0] ?? null}
                          tint={todayItem ? C.ember : '#8C8579'}
                          label={todayItem?.title ?? cook.display_name}
                          height={80} width={80} radius={10}
                          recyclingKey={cook.id}
                        />
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <Avatar name={cook.display_name.charAt(0)} avatarBg={C.ember} size={20} />
                            <Text style={styles.cookName}>{cook.display_name}</Text>
                            <StatusDot status={cook.is_live ? 'cooking-now' : 'done'} />
                          </View>
                          {todayItem && (
                            <Text style={styles.dishTitle} numberOfLines={2}>{todayItem.title}</Text>
                          )}
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
                            {todayItem && (
                              <Text style={styles.price}>{fmtCurrency(todayItem.unit_price, todayItem.currency_code)}</Text>
                            )}
                            {cook.location && (
                              <>
                                <Text style={styles.dot}>·</Text>
                                <Text style={styles.meta}>{cook.location}</Text>
                              </>
                            )}
                            {cook.average_rating > 0 && (
                              <>
                                <Text style={styles.dot}>·</Text>
                                <Text style={styles.meta}>★ {cook.average_rating.toFixed(1)}</Text>
                              </>
                            )}
                          </View>
                        </View>
                      </View>
                      <View style={styles.credRow}>
                        {cook.food_safety_verified && (
                          <View style={[styles.credPill, { backgroundColor: C.infoBg }]}>
                            <Text style={[styles.credText, { color: C.infoFg }]}>{t('discover.certified')}</Text>
                          </View>
                        )}
                        {cook.is_health_kitchen && (
                          <View style={[styles.credPill, { backgroundColor: C.healthBg }]}>
                            <Text style={[styles.credText, { color: C.healthFg }]}>{t('discover.health_kitchen')}</Text>
                          </View>
                        )}
                        {cook.joined_at && (Date.now() - new Date(cook.joined_at).getTime()) < 30 * 86400000 && (
                          <View style={[styles.credPill, { backgroundColor: C.cream }]}>
                            <Text style={[styles.credText, { color: C.spice }]}>{t('home.new_creator')}</Text>
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </>
            )}

            {dishes.length > 0 && (
              <>
                {cooks.length > 0 && <Text style={styles.groupLabel}>{t('discover.dishes')}</Text>}
                {dishes.map(dish => (
                  <TouchableOpacity
                    key={dish.id}
                    onPress={() => router.push(`/item/${dish.id}?cookId=${dish.cook_id}`)}
                    style={styles.card}
                    activeOpacity={0.85}
                  >
                    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                      <DishPhoto
                        uri={dish.photos?.[0] ?? null}
                        label={dish.title}
                        height={80} width={80} radius={10}
                        recyclingKey={dish.id}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.dishTitle} numberOfLines={2}>{dish.title}</Text>
                        <Text style={styles.cookMeta}>{dish.cook_name}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                          <Text style={styles.price}>{fmtCurrency(dish.unit_price, dish.currency_code)}</Text>
                          <Text style={styles.dot}>·</Text>
                          <Text style={styles.meta}>{dish.total_slots - dish.slots_claimed} left</Text>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function makeStyles(C: AppColors) { return StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  topBar: { paddingHorizontal: Spacing.lg, paddingTop: 16, paddingBottom: 8 },
  pageTitle: { fontFamily: Fonts.serif, fontSize: 26, color: C.textInk },

  searchRow: { paddingHorizontal: Spacing.lg, paddingBottom: 12 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.bgCard, borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 0.5, borderColor: C.borderWarm, ...Shadow.card },
  searchInput: { flex: 1, fontFamily: Fonts.sans, fontSize: 14, color: C.textInk, paddingVertical: 0 },

  filterRow: { paddingHorizontal: Spacing.lg, paddingBottom: 8, gap: 8 },
  filterPill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 40, backgroundColor: C.bgCard, borderWidth: 0.5, borderColor: C.borderWarm },
  filterPillActive: { backgroundColor: C.ink, borderColor: 'transparent' },
  filterLabel: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.body },
  filterLabelActive: { color: C.canvas },

  groupLabel: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.caps, textTransform: 'uppercase', letterSpacing: 0.5 },
  card: { backgroundColor: C.bgCard, borderRadius: Radius.lg, padding: 14, borderWidth: 0.5, borderColor: C.borderWarm, ...Shadow.card, gap: 10 },
  cookName: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.textInk, flex: 1 },
  cookMeta: { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft, marginTop: 2 },
  dishTitle: { fontFamily: Fonts.sans, fontSize: 13, color: C.body, lineHeight: 18 },
  price: { fontFamily: Fonts.serif, fontSize: 15, color: C.spice },
  dot: { color: C.bodySoft },
  meta: { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft },

  credRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  credPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 40, backgroundColor: C.infoBg },
  credText: { fontFamily: Fonts.sans, fontSize: 10, color: C.infoFg },

  emptyState: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyText: { fontFamily: Fonts.sansMedium, fontSize: 15, color: C.textInk },
  emptySub: { fontFamily: Fonts.sans, fontSize: 13, color: C.bodySoft },
}); }
