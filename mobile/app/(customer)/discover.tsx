import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView, TextInput,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { discoverApi } from '../../src/api/discover';
import type { CookCard, MenuItem } from '../../src/api/cooks';
import { Colors, Fonts, Spacing, Radius, Shadow } from '../../src/constants/theme';
import Avatar from '../../src/components/ui/Avatar';
import StatusDot from '../../src/components/ui/StatusDot';
import DishPhoto from '../../src/components/ui/DishPhoto';

type Filter = { key: string; label: string; params: Record<string, string> };

const FILTERS: Filter[] = [
  { key: 'all',    label: 'All',            params: {} },
  { key: 'open',   label: 'Open now',       params: { available_now: 'true' } },
  { key: 'health', label: 'Health Kitchen', params: { health: 'true' } },
  { key: 'budget', label: 'Budget friendly', params: { max_price: '4000' } },
  { key: 'rated',  label: 'High-rated',     params: { sort: 'rating' } },
];

type DishResult = MenuItem & {
  cook_name: string;
  cook_username: string;
  cook_rating: number;
  cook_location: string | null;
  distance_km: number;
};

function fmtCurrency(amount: number, currency = 'NGN'): string {
  const symbols: Record<string, string> = { NGN: '₦', KES: 'KSh ', GHS: 'GH₵', ZAR: 'R', EGP: 'E£' };
  return (symbols[currency] ?? currency + ' ') + Number(amount).toLocaleString('en-NG', { maximumFractionDigits: 0 });
}

export default function DiscoverScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [cooks, setCooks] = useState<CookCard[]>([]);
  const [dishes, setDishes] = useState<DishResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(async (q: string, filterKey: string) => {
    const filter = FILTERS.find(f => f.key === filterKey)!;
    const rawParams: Record<string, unknown> = { q: q.trim() || undefined };
    for (const [k, v] of Object.entries(filter.params)) {
      rawParams[k] = k === 'available_now' || k === 'health' ? v === 'true' : k === 'max_price' ? Number(v) : v;
    }
    setLoading(true);
    setSearched(true);
    try {
      const data = await discoverApi.search(rawParams as Parameters<typeof discoverApi.search>[0]);
      setCooks(data.cooks ?? []);
      setDishes((data.dishes ?? []) as DishResult[]);
    } catch (e) {
      console.error('discover search error:', e);
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
          <Text style={styles.pageTitle}>Discover</Text>
        </View>

        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={16} color={Colors.bodySoft} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search cooks, dishes, areas…"
              placeholderTextColor={Colors.bodySoft}
              value={query}
              onChangeText={handleQueryChange}
              returnKeyType="search"
              onSubmitEditing={() => doSearch(query, activeFilter)}
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => { setQuery(''); setCooks([]); setDishes([]); setSearched(false); }}>
                <Ionicons name="close-circle" size={16} color={Colors.bodySoft} />
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
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <ActivityIndicator color={Colors.spice} />
          </View>
        ) : !searched ? (
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={36} color={Colors.stone} />
            <Text style={styles.emptyText}>Search for cooks or dishes</Text>
            <Text style={styles.emptySub}>Try "jollof", "Lagos", or tap a filter above</Text>
          </View>
        ) : !hasResults ? (
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={36} color={Colors.stone} />
            <Text style={styles.emptyText}>No results found</Text>
            <Text style={styles.emptySub}>Try a different search or filter</Text>
          </View>
        ) : (
          <>
            {cooks.length > 0 && (
              <>
                <Text style={styles.groupLabel}>Cooks</Text>
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
                          tint={todayItem ? Colors.ember : '#8C8579'}
                          label={todayItem?.title ?? cook.display_name}
                          height={80} width={80} radius={10}
                        />
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <Avatar name={cook.display_name.charAt(0)} avatarBg={Colors.ember} size={20} />
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
                          <View style={[styles.credPill, { backgroundColor: Colors.infoBg }]}>
                            <Text style={[styles.credText, { color: Colors.infoFg }]}>Food safety certified</Text>
                          </View>
                        )}
                        {cook.is_health_kitchen && (
                          <View style={[styles.credPill, { backgroundColor: Colors.healthBg }]}>
                            <Text style={[styles.credText, { color: Colors.healthFg }]}>Health Kitchen</Text>
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
                {cooks.length > 0 && <Text style={styles.groupLabel}>Dishes</Text>}
                {dishes.map(dish => (
                  <TouchableOpacity
                    key={dish.id}
                    onPress={() => router.push(`/item/${dish.id}?cookId=${dish.cook_id}`)}
                    style={styles.card}
                    activeOpacity={0.85}
                  >
                    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                      <DishPhoto label={dish.title} height={80} width={80} radius={10} />
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  topBar: { paddingHorizontal: Spacing.lg, paddingTop: 16, paddingBottom: 8 },
  pageTitle: { fontFamily: Fonts.serif, fontSize: 26, color: Colors.textInk },

  searchRow: { paddingHorizontal: Spacing.lg, paddingBottom: 12 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.bgCard, borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 0.5, borderColor: Colors.borderWarm, ...Shadow.card },
  searchInput: { flex: 1, fontFamily: Fonts.sans, fontSize: 14, color: Colors.textInk, paddingVertical: 0 },

  filterRow: { paddingHorizontal: Spacing.lg, paddingBottom: 8, gap: 8 },
  filterPill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 40, backgroundColor: Colors.bgCard, borderWidth: 0.5, borderColor: Colors.borderWarm },
  filterPillActive: { backgroundColor: Colors.ink, borderColor: 'transparent' },
  filterLabel: { fontFamily: Fonts.sansMedium, fontSize: 13, color: Colors.body },
  filterLabelActive: { color: Colors.canvas },

  groupLabel: { fontFamily: Fonts.sansMedium, fontSize: 13, color: Colors.caps, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  card: { backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: 14, borderWidth: 0.5, borderColor: Colors.borderWarm, ...Shadow.card, gap: 10 },
  cookName: { fontFamily: Fonts.sansMedium, fontSize: 13, color: Colors.textInk, fontWeight: '600', flex: 1 },
  cookMeta: { fontFamily: Fonts.sans, fontSize: 12, color: Colors.bodySoft, marginTop: 2 },
  dishTitle: { fontFamily: Fonts.sans, fontSize: 13, color: Colors.body, lineHeight: 18 },
  price: { fontFamily: Fonts.serif, fontSize: 15, color: Colors.spice },
  dot: { color: Colors.bodySoft },
  meta: { fontFamily: Fonts.sans, fontSize: 12, color: Colors.bodySoft },

  credRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  credPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 40, backgroundColor: Colors.infoBg },
  credText: { fontFamily: Fonts.sans, fontSize: 10, color: Colors.infoFg },

  emptyState: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyText: { fontFamily: Fonts.sansMedium, fontSize: 15, color: Colors.textInk },
  emptySub: { fontFamily: Fonts.sans, fontSize: 13, color: Colors.bodySoft },
});
