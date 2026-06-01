import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, FlatList, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  searchApi, type SearchResult, type SearchResults,
  type SearchSuggestion, type SearchEntityType, type SearchTrending, type SearchHistoryItem,
} from '../src/api/search';
import { useAuth } from '../src/context/AuthContext';
import { useColors, type AppColors } from '../src/context/ThemeContext';
import { Fonts, Spacing, Radius, Shadow, FontSize } from '../src/constants/theme';
import { fmtCurrency, relativeTime } from '../src/utils/format';
import Avatar from '../src/components/ui/Avatar';
import DishPhoto from '../src/components/ui/DishPhoto';
import { type CreatorType, CREATOR_TYPE_LABELS } from '../src/types';

const FILTER_TABS: { key: SearchEntityType | 'all'; label: string; icon: string }[] = [
  { key: 'all',            label: 'All',       icon: 'apps-outline' },
  { key: 'cook',           label: 'Creators',  icon: 'person-outline' },
  { key: 'dish',           label: 'Dishes',    icon: 'restaurant-outline' },
  { key: 'course',         label: 'Courses',   icon: 'school-outline' },
  { key: 'digital_product',label: 'Store',     icon: 'bag-outline' },
  { key: 'post',           label: 'Posts',     icon: 'images-outline' },
  { key: 'story',          label: 'Stories',   icon: 'play-circle-outline' },
  { key: 'service',        label: 'Services',  icon: 'calendar-number-outline' },
  { key: 'weekly_menu',    label: 'Menus',     icon: 'calendar-outline' },
];

const CREATOR_TYPE_FILTERS: { key: CreatorType | 'all'; label: string }[] = [
  { key: 'all',                label: 'All types' },
  { key: 'home_cook',          label: 'Home Cook' },
  { key: 'chef',               label: 'Chef' },
  { key: 'pastry_chef',        label: 'Pastry Chef' },
  { key: 'baker',              label: 'Baker' },
  { key: 'mixologist',         label: 'Mixologist' },
  { key: 'caterer',            label: 'Caterer' },
  { key: 'culinary_instructor',label: 'Instructor' },
  { key: 'food_brand',         label: 'Food Brand' },
];

export default function SearchScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const inputRef = useRef<TextInput>(null);

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<SearchEntityType | 'all'>('all');
  const [creatorTypeFilter, setCreatorTypeFilter] = useState<CreatorType | 'all'>('all');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [trending, setTrending] = useState<SearchTrending[]>([]);
  const [recent, setRecent] = useState<SearchHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'searching' | 'results'>('idle');
  const [showCreatorTypeFilter, setShowCreatorTypeFilter] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load trending + recent on mount
  useEffect(() => {
    inputRef.current?.focus();
    searchApi.trending().then(r => setTrending(r.data?.trending ?? [])).catch(() => {});
    if (user?.id) {
      searchApi.recent(user.id).then(r => setRecent(r.data?.recent ?? [])).catch(() => {});
    }
  }, []);

  const handleQueryChange = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (text.trim().length < 1) {
      setSuggestions([]);
      setShowSuggestions(false);
      if (phase !== 'idle') setPhase('idle');
      return;
    }

    setShowSuggestions(true);
    setPhase('searching');

    // Autocomplete after 300ms
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await searchApi.autocomplete(text.trim());
        setSuggestions(res.data?.suggestions ?? []);
      } catch {}
    }, 300);
  };

  const doSearch = useCallback(async (q: string = query) => {
    if (q.trim().length < 2) return;
    setLoading(true);
    setShowSuggestions(false);
    setPhase('results');
    try {
      const params: any = { q: q.trim(), limit: 20 };
      if (filter !== 'all') params.type = filter;
      if (filter === 'cook' && creatorTypeFilter !== 'all') params.creator_type = creatorTypeFilter;
      const res = await searchApi.search(params);
      setResults(res.data?.results ?? null);
      // Save to recent
      if (user?.id) searchApi.saveRecent(user.id, q.trim());
    } catch {
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, [query, filter, creatorTypeFilter, user?.id]);

  const handleSubmit = () => {
    inputRef.current?.blur();
    doSearch();
  };

  const handleSuggestionPress = (s: SearchSuggestion) => {
    setQuery(s.label);
    setShowSuggestions(false);
    doSearch(s.label);
  };

  const handleTrendingPress = (q: string) => {
    setQuery(q);
    doSearch(q);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleClearRecent = async () => {
    if (!user?.id) return;
    await searchApi.clearRecent(user.id);
    setRecent([]);
  };

  // Flatten all results for display
  const flatResults = useMemo(() => {
    if (!results) return [];
    const all: SearchResult[] = [];
    if (filter === 'all') {
      (['cooks','dishes','courses','digital_products','posts','stories','services','weekly_menus','customer_posts'] as const).forEach(key => {
        const arr = (results as any)[key];
        if (Array.isArray(arr)) all.push(...arr);
      });
    } else {
      const keyMap: Record<string, string> = {
        cook: 'cooks', dish: 'dishes', course: 'courses',
        digital_product: 'digital_products', post: 'posts',
        story: 'stories', service: 'services', weekly_menu: 'weekly_menus',
      };
      const key = keyMap[filter] ?? filter;
      const arr = (results as any)[key];
      if (Array.isArray(arr)) all.push(...arr);
    }
    return all;
  }, [results, filter]);

  function navigateToResult(item: SearchResult) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    switch (item.entity_type) {
      case 'cook':
        router.push(`/cook/${item.id}` as any);
        break;
      case 'dish':
        router.push({ pathname: '/item/[id]', params: { id: item.id } } as any);
        break;
      case 'course':
        router.push({ pathname: '/course/[id]', params: { id: item.id } } as any);
        break;
      case 'digital_product':
        router.push({ pathname: '/product/[id]', params: { id: item.id } } as any);
        break;
      case 'service':
        if (item.id) router.push(`/cook/${item.id}` as any);
        break;
      default:
        if (item.cook_id) router.push(`/cook/${item.cook_id}` as any);
        break;
    }
  }

  function renderResult(item: SearchResult) {
    switch (item.entity_type) {
      case 'cook':
        return <CookResult key={item.id} item={item} onPress={() => navigateToResult(item)} C={C} styles={styles} />;
      case 'dish':
        return <DishResult key={item.id} item={item} onPress={() => navigateToResult(item)} C={C} styles={styles} />;
      case 'course':
        return <CourseResult key={item.id} item={item} onPress={() => navigateToResult(item)} C={C} styles={styles} />;
      case 'digital_product':
        return <ProductResult key={item.id} item={item} onPress={() => navigateToResult(item)} C={C} styles={styles} />;
      case 'service':
        return <ServiceResult key={item.id} item={item} onPress={() => navigateToResult(item)} C={C} styles={styles} />;
      default:
        return <PostResult key={item.id} item={item} onPress={() => navigateToResult(item)} C={C} styles={styles} />;
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Search bar */}
      <View style={styles.searchBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <View style={styles.inputWrap}>
          <Ionicons name="search-outline" size={16} color={C.bodySoft} style={{ marginLeft: 12 }} />
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={query}
            onChangeText={handleQueryChange}
            onSubmitEditing={handleSubmit}
            placeholder="Search creators, dishes, courses…"
            placeholderTextColor={C.stone}
            returnKeyType="search"
            autoFocus
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => { setQuery(''); setResults(null); setPhase('idle'); setSuggestions([]); }} style={{ padding: 8 }}>
              <Ionicons name="close-circle" size={18} color={C.bodySoft} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterBar} contentContainerStyle={{ paddingHorizontal: Spacing.md, paddingVertical: 8, gap: 6 }}>
        {FILTER_TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.filterTab, filter === t.key && styles.filterTabActive]}
            onPress={() => {
              setFilter(t.key);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              if (phase === 'results') doSearch();
            }}
          >
            <Ionicons name={t.icon as any} size={13} color={filter === t.key ? C.canvas : C.bodySoft} />
            <Text style={[styles.filterTabText, filter === t.key && styles.filterTabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}

        {filter === 'cook' && (
          <TouchableOpacity
            style={[styles.filterTab, styles.filterTabCreatorType]}
            onPress={() => setShowCreatorTypeFilter(v => !v)}
          >
            <Ionicons name="funnel-outline" size={13} color={C.spice} />
            <Text style={[styles.filterTabText, { color: C.spice }]}>
              {creatorTypeFilter === 'all' ? 'Type' : CREATOR_TYPE_LABELS[creatorTypeFilter as CreatorType]}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Creator type filter dropdown */}
      {showCreatorTypeFilter && filter === 'cook' && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.creatorTypeBar} contentContainerStyle={{ paddingHorizontal: Spacing.md, gap: 6, paddingVertical: 6 }}>
          {CREATOR_TYPE_FILTERS.map(ct => (
            <TouchableOpacity
              key={ct.key}
              style={[styles.creatorTypeChip, creatorTypeFilter === ct.key && styles.creatorTypeChipActive]}
              onPress={() => {
                setCreatorTypeFilter(ct.key);
                setShowCreatorTypeFilter(false);
                if (phase === 'results') doSearch();
              }}
            >
              <Text style={[styles.creatorTypeChipText, creatorTypeFilter === ct.key && styles.creatorTypeChipTextActive]}>
                {ct.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Autocomplete suggestions */}
        {showSuggestions && suggestions.length > 0 && (
          <View style={styles.suggestionsBox}>
            {suggestions.map((s, i) => (
              <TouchableOpacity key={i} style={styles.suggestionRow} onPress={() => handleSuggestionPress(s)}>
                <Ionicons name="search-outline" size={14} color={C.bodySoft} />
                <Text style={styles.suggestionLabel}>{s.label}</Text>
                <Text style={styles.suggestionType}>{s.type}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Idle state: recent + trending */}
        {phase === 'idle' && (
          <View style={{ gap: 0 }}>
            {/* Recent searches */}
            {recent.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Recent</Text>
                  <TouchableOpacity onPress={handleClearRecent}>
                    <Text style={styles.clearBtn}>Clear</Text>
                  </TouchableOpacity>
                </View>
                {recent.slice(0, 6).map((r, i) => (
                  <TouchableOpacity key={i} style={styles.recentRow} onPress={() => handleTrendingPress(r.query)}>
                    <Ionicons name="time-outline" size={16} color={C.bodySoft} />
                    <Text style={styles.recentText}>{r.query}</Text>
                    <TouchableOpacity
                      onPress={() => setRecent(prev => prev.filter((_, j) => j !== i))}
                      hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
                    >
                      <Ionicons name="close" size={14} color={C.bodySoft} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Trending searches */}
            {trending.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Trending</Text>
                  <Ionicons name="flame-outline" size={14} color={C.spice} />
                </View>
                <View style={styles.trendingGrid}>
                  {trending.slice(0, 8).map((t, i) => (
                    <TouchableOpacity
                      key={i}
                      style={styles.trendingChip}
                      onPress={() => handleTrendingPress(t.query)}
                    >
                      <Text style={styles.trendingChipText}>{t.query}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Search hint */}
            <View style={styles.hintBox}>
              <Ionicons name="compass-outline" size={40} color={C.bodySoft} />
              <Text style={styles.hintTitle}>Find anything on FOODS</Text>
              <Text style={styles.hintSub}>Search creators, dishes, courses, products, services, weekly menus, stories and posts</Text>
            </View>
          </View>
        )}

        {/* Loading */}
        {phase === 'results' && loading && (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={C.spice} />
          </View>
        )}

        {/* Results */}
        {phase === 'results' && !loading && (
          <View style={{ padding: Spacing.lg, gap: Spacing.md }}>
            {flatResults.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="search-outline" size={40} color={C.stone} />
                <Text style={styles.emptyTitle}>No results for "{query}"</Text>
                <Text style={styles.emptySub}>Try a different spelling, or search for something else.</Text>
              </View>
            ) : (
              <>
                <Text style={styles.resultCount}>{flatResults.length} result{flatResults.length !== 1 ? 's' : ''}</Text>
                {flatResults.map(item => renderResult(item))}
              </>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Result card components ────────────────────────────────────────────────────

function CookResult({ item, onPress, C, styles }: any) {
  return (
    <TouchableOpacity style={styles.resultCard} onPress={onPress} activeOpacity={0.85}>
      <Avatar uri={item.image} name={item.name} size={48} />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={styles.resultName}>{item.name}</Text>
          {item.food_safety_verified && <Ionicons name="shield-checkmark" size={14} color={C.leaf} />}
        </View>
        {item.creator_types?.length > 0 && (
          <Text style={styles.resultMeta}>
            {item.creator_types.map((t: CreatorType) => CREATOR_TYPE_LABELS[t]).join(' · ')}
          </Text>
        )}
        {item.description && (
          <Text style={styles.resultDesc} numberOfLines={1}>{item.description}</Text>
        )}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 3 }}>
          {item.rating > 0 && <Text style={styles.resultTag}>★ {Number(item.rating).toFixed(1)}</Text>}
          {item.platform_follower_count > 0 && <Text style={styles.resultTag}>{item.platform_follower_count} followers</Text>}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={16} color={C.bodySoft} />
    </TouchableOpacity>
  );
}

function DishResult({ item, onPress, C, styles }: any) {
  return (
    <TouchableOpacity style={styles.resultCard} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.resultThumb}>
        <DishPhoto uri={item.image} style={{ width: '100%', height: '100%' }} />
        {item.video_url && (
          <View style={styles.videoTag}>
            <Ionicons name="play" size={8} color="#fff" />
          </View>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.resultName}>{item.name}</Text>
        {item.cook_name && <Text style={styles.resultMeta}>by {item.cook_name}</Text>}
        {item.price > 0 && <Text style={styles.resultPrice}>{fmtCurrency(item.price, 'NGN')}</Text>}
        {item.dietary_labels?.length > 0 && (
          <View style={{ flexDirection: 'row', gap: 4, marginTop: 3, flexWrap: 'wrap' }}>
            {item.dietary_labels.slice(0, 3).map((l: string) => (
              <View key={l} style={styles.dietTag}><Text style={styles.dietTagText}>{l}</Text></View>
            ))}
          </View>
        )}
      </View>
      <Ionicons name="chevron-forward" size={16} color={C.bodySoft} />
    </TouchableOpacity>
  );
}

function CourseResult({ item, onPress, C, styles }: any) {
  return (
    <TouchableOpacity style={styles.resultCard} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.resultThumb}>
        {item.image
          ? <Image source={{ uri: item.image }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          : <View style={{ flex: 1, backgroundColor: C.bgCook, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="school-outline" size={20} color={C.bodySoft} />
            </View>
        }
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.resultName}>{item.name}</Text>
        {item.cook_name && <Text style={styles.resultMeta}>by {item.cook_name}</Text>}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 3 }}>
          {item.is_free
            ? <View style={styles.freePill}><Text style={styles.freePillText}>Free</Text></View>
            : <Text style={styles.resultPrice}>{fmtCurrency(item.price, 'NGN')}</Text>
          }
          {item.enrollment_count > 0 && <Text style={styles.resultTag}>{item.enrollment_count} enrolled</Text>}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={16} color={C.bodySoft} />
    </TouchableOpacity>
  );
}

function ProductResult({ item, onPress, C, styles }: any) {
  return (
    <TouchableOpacity style={styles.resultCard} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.resultThumb}>
        {item.image
          ? <Image source={{ uri: item.image }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          : <View style={{ flex: 1, backgroundColor: C.bgCook, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="book-outline" size={20} color={C.bodySoft} />
            </View>
        }
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.resultName}>{item.name}</Text>
        {item.type && <Text style={styles.resultMeta}>{item.type.replace('_', ' ')}</Text>}
        <Text style={styles.resultPrice}>{fmtCurrency(item.price, 'NGN')}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={C.bodySoft} />
    </TouchableOpacity>
  );
}

function ServiceResult({ item, onPress, C, styles }: any) {
  return (
    <TouchableOpacity style={styles.resultCard} onPress={onPress} activeOpacity={0.85}>
      <View style={[styles.resultThumb, { backgroundColor: C.honey, alignItems: 'center', justifyContent: 'center' }]}>
        <Ionicons name="calendar-number-outline" size={24} color={C.spice} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.resultName}>{item.name}</Text>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 3 }}>
          {item.accepts_private_chef && <View style={styles.servicePill}><Text style={styles.servicePillText}>Private Chef</Text></View>}
          {item.accepts_catering && <View style={styles.servicePill}><Text style={styles.servicePillText}>Catering</Text></View>}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={16} color={C.bodySoft} />
    </TouchableOpacity>
  );
}

function PostResult({ item, onPress, C, styles }: any) {
  return (
    <TouchableOpacity style={styles.resultCard} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.resultThumb}>
        {item.image || item.video_thumbnail
          ? <Image source={{ uri: item.image ?? item.video_thumbnail }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          : <View style={{ flex: 1, backgroundColor: C.bgCook, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="text-outline" size={20} color={C.bodySoft} />
            </View>
        }
        {item.video_url && (
          <View style={styles.videoTag}><Ionicons name="play" size={8} color="#fff" /></View>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.resultDesc} numberOfLines={2}>{item.description}</Text>
        {item.cook_name && <Text style={styles.resultMeta}>by {item.cook_name}</Text>}
        {item.author_name && <Text style={styles.resultMeta}>by {item.author_name}</Text>}
        {item.like_count > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
            <Ionicons name="heart-outline" size={12} color={C.bodySoft} />
            <Text style={styles.resultTag}>{item.like_count}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    searchBar: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingHorizontal: Spacing.md, paddingVertical: 10,
      borderBottomWidth: 0.5, borderBottomColor: C.borderWarm,
    },
    backBtn: { padding: 4 },
    inputWrap: {
      flex: 1, flexDirection: 'row', alignItems: 'center',
      backgroundColor: C.bgCard, borderRadius: Radius.full,
      borderWidth: 0.5, borderColor: C.borderWarm,
    },
    input: {
      flex: 1, fontFamily: Fonts.sans, fontSize: FontSize.body, color: C.ink,
      paddingHorizontal: 10, paddingVertical: 10,
    },
    filterBar: { borderBottomWidth: 0.5, borderBottomColor: C.borderWarm },
    filterTab: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      paddingHorizontal: 12, paddingVertical: 7,
      borderRadius: Radius.full, borderWidth: 1, borderColor: C.borderWarm,
      backgroundColor: C.bgCard,
    },
    filterTabActive: { backgroundColor: C.ink, borderColor: C.ink },
    filterTabText: { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.bodySoft },
    filterTabTextActive: { color: C.canvas },
    filterTabCreatorType: { borderColor: C.spice },
    creatorTypeBar: { backgroundColor: C.bgCook, borderBottomWidth: 0.5, borderBottomColor: C.borderWarm },
    creatorTypeChip: {
      paddingHorizontal: 12, paddingVertical: 6,
      borderRadius: Radius.full, borderWidth: 1, borderColor: C.borderWarm,
      backgroundColor: C.bgCard,
    },
    creatorTypeChipActive: { backgroundColor: C.spice, borderColor: C.spice },
    creatorTypeChipText: { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.bodySoft },
    creatorTypeChipTextActive: { color: C.canvas },
    // Suggestions
    suggestionsBox: { backgroundColor: C.bgCard, borderBottomWidth: 0.5, borderBottomColor: C.borderWarm },
    suggestionRow: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingHorizontal: Spacing.lg, paddingVertical: 13,
      borderBottomWidth: 0.5, borderBottomColor: C.borderWarm,
    },
    suggestionLabel: { fontFamily: Fonts.sans, fontSize: FontSize.body, color: C.ink, flex: 1 },
    suggestionType: { fontFamily: Fonts.sans, fontSize: FontSize.xs, color: C.bodySoft },
    // Idle state
    section: { paddingHorizontal: Spacing.lg, paddingTop: 20 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    sectionTitle: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.ink },
    clearBtn: { fontFamily: Fonts.sans, fontSize: 13, color: C.spice },
    recentRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderBottomWidth: 0.5, borderBottomColor: C.borderWarm },
    recentText: { fontFamily: Fonts.sans, fontSize: FontSize.body, color: C.body, flex: 1 },
    trendingGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    trendingChip: {
      backgroundColor: C.bgCard, borderRadius: Radius.full,
      paddingHorizontal: 14, paddingVertical: 8,
      borderWidth: 0.5, borderColor: C.borderWarm,
    },
    trendingChipText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.ink },
    hintBox: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: Spacing.xl, gap: 8 },
    hintTitle: { fontFamily: Fonts.sansMedium, fontSize: 16, color: C.ink, textAlign: 'center' },
    hintSub: { fontFamily: Fonts.sans, fontSize: 13, color: C.bodySoft, textAlign: 'center', lineHeight: 19 },
    // Results
    loadingWrap: { alignItems: 'center', paddingVertical: 48 },
    emptyState: { alignItems: 'center', paddingVertical: 48, gap: 8 },
    emptyTitle: { fontFamily: Fonts.sansMedium, fontSize: 17, color: C.ink },
    emptySub: { fontFamily: Fonts.sans, fontSize: 13, color: C.bodySoft, textAlign: 'center', lineHeight: 19 },
    resultCount: { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft },
    resultCard: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: C.bgCard, borderRadius: Radius.lg,
      padding: Spacing.md, ...Shadow.card,
    },
    resultThumb: { width: 60, height: 60, borderRadius: Radius.md, overflow: 'hidden', position: 'relative', backgroundColor: C.bgCook },
    videoTag: {
      position: 'absolute', top: 4, right: 4,
      backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 3,
      width: 16, height: 16, alignItems: 'center', justifyContent: 'center',
    },
    resultName: { fontFamily: Fonts.sansMedium, fontSize: FontSize.body, color: C.ink },
    resultMeta: { fontFamily: Fonts.sans, fontSize: FontSize.sm, color: C.bodySoft, marginTop: 2 },
    resultDesc: { fontFamily: Fonts.sans, fontSize: FontSize.sm, color: C.body, lineHeight: 18 },
    resultPrice: { fontFamily: Fonts.sansMedium, fontSize: FontSize.md, color: C.spice, marginTop: 3 },
    resultTag: { fontFamily: Fonts.sans, fontSize: FontSize.xs, color: C.bodySoft },
    dietTag: { backgroundColor: C.healthBg, borderRadius: Radius.full, paddingHorizontal: 7, paddingVertical: 2 },
    dietTagText: { fontFamily: Fonts.sans, fontSize: FontSize.xs, color: C.healthFg },
    freePill: { backgroundColor: C.successBg, borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2 },
    freePillText: { fontFamily: Fonts.sansMedium, fontSize: FontSize.xs, color: C.successFg },
    servicePill: { backgroundColor: C.honey, borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2 },
    servicePillText: { fontFamily: Fonts.sansMedium, fontSize: FontSize.xs, color: C.spice },
  });
}
