import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, FlatList, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { searchApi, type SearchResult, type SearchResults, type SearchSuggestion, type SearchEntityType } from '../src/api/search';
import { useColors, type AppColors } from '../src/context/ThemeContext';
import { Fonts, Spacing, Radius, Shadow, FontSize } from '../src/constants/theme';
import { fmtCurrency } from '../src/utils/format';
import Avatar from '../src/components/ui/Avatar';

const FILTER_TABS: { key: SearchEntityType | 'all'; label: string }[] = [
  { key: 'all',            label: 'All' },
  { key: 'cook',           label: 'Cooks' },
  { key: 'dish',           label: 'Dishes' },
  { key: 'course',         label: 'Courses' },
  { key: 'digital_product',label: 'Store' },
  { key: 'post',           label: 'Posts' },
];

export default function SearchScreen() {
  const router = useRouter();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<SearchEntityType | 'all'>('all');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResults | null>(null);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 2) { setSuggestions([]); setShowSuggestions(false); return; }
    try {
      const res = await searchApi.autocomplete(q);
      setSuggestions(res.suggestions ?? []);
      setShowSuggestions(true);
    } catch {}
  }, []);

  const handleChange = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.length < 2) { setSuggestions([]); setShowSuggestions(false); return; }
    debounceRef.current = setTimeout(() => fetchSuggestions(text), 300);
  };

  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) return;
    setShowSuggestions(false);
    setLoading(true);
    try {
      const type = filter === 'all' ? undefined : filter;
      const res = await searchApi.search({ q: q.trim(), type });
      setResults(res.results);
    } catch {
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  const handleSuggestion = (s: SearchSuggestion) => {
    setQuery(s.label);
    setShowSuggestions(false);
    doSearch(s.label);
  };

  const navigate = (item: SearchResult) => {
    switch (item.entity_type) {
      case 'cook':    router.push(`/cook/${item.id}` as any); break;
      case 'dish':    router.push({ pathname: '/item/[id]', params: { id: item.id } } as any); break;
      case 'course':  router.push({ pathname: '/course/[id]', params: { id: item.id } } as any); break;
      case 'digital_product': router.push({ pathname: '/product/[id]', params: { id: item.id } } as any); break;
      case 'post':    router.push(`/cook/${item.cook_id}` as any); break;
    }
  };

  const allResults: SearchResult[] = useMemo(() => {
    if (!results) return [];
    const merged: SearchResult[] = [];
    if (filter === 'all' || filter === 'cook')    (results.cooks ?? []).forEach(r => merged.push(r));
    if (filter === 'all' || filter === 'dish')    (results.dishes ?? []).forEach(r => merged.push(r));
    if (filter === 'all' || filter === 'course')  (results.courses ?? []).forEach(r => merged.push(r));
    if (filter === 'all' || filter === 'digital_product') (results.digital_products ?? []).forEach(r => merged.push(r));
    if (filter === 'all' || filter === 'post')    (results.posts ?? []).forEach(r => merged.push(r));
    return merged;
  }, [results, filter]);

  return (
    <SafeAreaView style={styles.container}>
      {/* Search bar */}
      <View style={styles.searchBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <View style={styles.inputContainer}>
          <Ionicons name="search" size={18} color={C.bodySoft} />
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={handleChange}
            onSubmitEditing={() => doSearch(query)}
            placeholder="Search cooks, dishes, courses..."
            placeholderTextColor={C.stone}
            returnKeyType="search"
            autoFocus
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => { setQuery(''); setResults(null); setSuggestions([]); }}>
              <Ionicons name="close-circle" size={18} color={C.stone} />
            </TouchableOpacity>
          )}
        </View>
        {query.length >= 2 && (
          <TouchableOpacity style={styles.searchBtn} onPress={() => doSearch(query)}>
            <Text style={styles.searchBtnText}>Search</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Autocomplete dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <View style={styles.suggestionsBox}>
          {suggestions.map((s, i) => (
            <TouchableOpacity key={i} style={styles.suggestionItem} onPress={() => handleSuggestion(s)}>
              <Ionicons name="search-outline" size={14} color={C.bodySoft} />
              <Text style={styles.suggestionText}>{s.label}</Text>
              <Text style={styles.suggestionType}>{s.type}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Filter tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterBar} contentContainerStyle={styles.filterContent}>
        {FILTER_TABS.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterTab, filter === f.key && styles.filterTabActive]}
            onPress={() => { setFilter(f.key); if (query.length >= 2) doSearch(query); }}
          >
            <Text style={[styles.filterTabText, filter === f.key && styles.filterTabTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Results */}
      {loading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={C.spice} />
          <Text style={styles.loadingText}>Searching...</Text>
        </View>
      ) : !results && query.length < 2 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🔍</Text>
          <Text style={styles.emptyTitle}>Search FOODSbyme</Text>
          <Text style={styles.emptyBody}>Find cooks, dishes, courses, recipe books and more.</Text>
        </View>
      ) : !allResults.length ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>😔</Text>
          <Text style={styles.emptyTitle}>No results for "{query}"</Text>
          <Text style={styles.emptyBody}>Try a different spelling or filter.</Text>
        </View>
      ) : (
        <FlatList
          data={allResults}
          keyExtractor={item => `${item.entity_type}-${item.id}`}
          contentContainerStyle={styles.resultsList}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => <SearchResultItem item={item} onPress={() => navigate(item)} C={C} styles={styles} />}
        />
      )}
    </SafeAreaView>
  );
}

function SearchResultItem({ item, onPress, C, styles }: { item: SearchResult; onPress: () => void; C: AppColors; styles: any }) {
  return (
    <TouchableOpacity style={styles.resultItem} onPress={onPress} activeOpacity={0.7}>
      {/* Image */}
      <View style={styles.resultImageWrap}>
        {item.image ? (
          <Image source={{ uri: item.image }} style={styles.resultImage} />
        ) : item.entity_type === 'cook' ? (
          <Avatar name={item.name} size={52} />
        ) : (
          <View style={[styles.resultImage, styles.resultImagePlaceholder]}>
            <Ionicons name={entityIcon(item.entity_type)} size={22} color={C.bodySoft} />
          </View>
        )}
      </View>

      {/* Info */}
      <View style={styles.resultInfo}>
        <View style={styles.resultTopRow}>
          <Text style={styles.resultName} numberOfLines={1}>{item.name}</Text>
          <View style={[styles.entityBadge, { backgroundColor: entityBgColor(item.entity_type, C) }]}>
            <Text style={[styles.entityBadgeText, { color: entityFgColor(item.entity_type, C) }]}>
              {item.entity_type.replace('_', ' ')}
            </Text>
          </View>
        </View>
        {item.description && (
          <Text style={styles.resultDesc} numberOfLines={2}>{item.description}</Text>
        )}
        <View style={styles.resultMeta}>
          {item.price != null && (
            <Text style={styles.resultPrice}>{fmtCurrency(item.price, 'NGN')}</Text>
          )}
          {item.rating != null && item.rating > 0 && (
            <Text style={styles.resultRating}>★ {item.rating.toFixed(1)}</Text>
          )}
          {item.cook_name && item.entity_type !== 'cook' && (
            <Text style={styles.resultCook}>by {item.cook_name}</Text>
          )}
          {item.food_safety_verified && (
            <View style={styles.verifiedBadge}>
              <Ionicons name="shield-checkmark" size={11} color={C.leaf} />
              <Text style={styles.verifiedText}>Verified</Text>
            </View>
          )}
        </View>
      </View>

      <Ionicons name="chevron-forward" size={16} color={C.stone} />
    </TouchableOpacity>
  );
}

function entityIcon(type: SearchEntityType): any {
  switch (type) {
    case 'cook': return 'person-outline';
    case 'dish': return 'restaurant-outline';
    case 'course': return 'school-outline';
    case 'digital_product': return 'book-outline';
    case 'post': return 'newspaper-outline';
    default: return 'search-outline';
  }
}

function entityBgColor(type: SearchEntityType, C: AppColors) {
  switch (type) {
    case 'cook': return C.honey;
    case 'dish': return C.successBg;
    case 'course': return C.infoBg;
    case 'digital_product': return C.warnBg;
    default: return C.bgCook;
  }
}

function entityFgColor(type: SearchEntityType, C: AppColors) {
  switch (type) {
    case 'cook': return C.spice;
    case 'dish': return C.successFg;
    case 'course': return C.infoFg;
    case 'digital_product': return C.warnFg;
    default: return C.bodySoft;
  }
}

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    searchBar: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
      paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    },
    backBtn: {
      width: 40, height: 40, borderRadius: 20,
      alignItems: 'center', justifyContent: 'center',
    },
    inputContainer: {
      flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
      backgroundColor: C.bgCard, borderRadius: Radius.md,
      paddingHorizontal: Spacing.md, borderWidth: 1, borderColor: C.borderWarm,
    },
    input: {
      flex: 1, fontFamily: Fonts.sans, fontSize: FontSize.body, color: C.ink,
      paddingVertical: 10,
    },
    searchBtn: {
      backgroundColor: C.spice, borderRadius: Radius.md,
      paddingHorizontal: Spacing.md, paddingVertical: 10,
    },
    searchBtnText: { fontFamily: Fonts.sansMedium, fontSize: FontSize.sm, color: C.canvas },
    suggestionsBox: {
      marginHorizontal: Spacing.lg,
      backgroundColor: C.bgCard, borderRadius: Radius.md,
      borderWidth: 1, borderColor: C.borderWarm,
      zIndex: 999, elevation: 8, ...Shadow.card,
    },
    suggestionItem: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
      paddingHorizontal: Spacing.md, paddingVertical: 10,
      borderBottomWidth: 1, borderBottomColor: C.borderWarm,
    },
    suggestionText: { flex: 1, fontFamily: Fonts.sans, fontSize: FontSize.body, color: C.ink },
    suggestionType: { fontFamily: Fonts.sans, fontSize: FontSize.xs, color: C.bodySoft },
    filterBar: { maxHeight: 44 },
    filterContent: { paddingHorizontal: Spacing.lg, gap: 8, alignItems: 'center' },
    filterTab: {
      paddingHorizontal: 14, paddingVertical: 7,
      borderRadius: Radius.full, borderWidth: 1, borderColor: C.borderWarm,
    },
    filterTabActive: { backgroundColor: C.ink, borderColor: C.ink },
    filterTabText: { fontFamily: Fonts.sansMedium, fontSize: FontSize.sm, color: C.body },
    filterTabTextActive: { color: C.canvas },
    loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
    loadingText: { fontFamily: Fonts.sans, fontSize: FontSize.body, color: C.bodySoft },
    emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xxl },
    emptyIcon: { fontSize: 48, marginBottom: Spacing.md },
    emptyTitle: { fontFamily: Fonts.sansMedium, fontSize: FontSize.lg, color: C.ink, textAlign: 'center' },
    emptyBody: { fontFamily: Fonts.sans, fontSize: FontSize.body, color: C.bodySoft, textAlign: 'center', marginTop: 6, lineHeight: 22 },
    resultsList: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
    separator: { height: 1, backgroundColor: C.borderWarm },
    resultItem: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
      paddingVertical: Spacing.md,
    },
    resultImageWrap: { width: 52, height: 52 },
    resultImage: { width: 52, height: 52, borderRadius: Radius.md, overflow: 'hidden' },
    resultImagePlaceholder: { backgroundColor: C.bgCook, alignItems: 'center', justifyContent: 'center' },
    resultInfo: { flex: 1 },
    resultTopRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
    resultName: { flex: 1, fontFamily: Fonts.sansMedium, fontSize: FontSize.body, color: C.ink },
    entityBadge: { borderRadius: Radius.full, paddingHorizontal: 7, paddingVertical: 2 },
    entityBadgeText: { fontFamily: Fonts.sans, fontSize: FontSize.xs },
    resultDesc: { fontFamily: Fonts.sans, fontSize: FontSize.sm, color: C.bodySoft, lineHeight: 18 },
    resultMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: 3 },
    resultPrice: { fontFamily: Fonts.sansMedium, fontSize: FontSize.sm, color: C.spice },
    resultRating: { fontFamily: Fonts.sans, fontSize: FontSize.xs, color: C.ember },
    resultCook: { fontFamily: Fonts.sans, fontSize: FontSize.xs, color: C.bodySoft },
    verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    verifiedText: { fontFamily: Fonts.sans, fontSize: FontSize.xs, color: C.leaf },
  });
}
