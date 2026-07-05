import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { coursesApi, type Course } from '../../src/api/courses';
import { Fonts, Spacing, Radius, Shadow } from '../../src/constants/theme';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { fmtCurrency } from '../../src/utils/format';
import DishPhoto from '../../src/components/ui/DishPhoto';
import Avatar from '../../src/components/ui/Avatar';
import { useTranslation } from 'react-i18next';

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: '#2E8B3F', intermediate: '#FF6B35', advanced: '#DC2626',
};

function useDifficultyLabels(): Record<string, string> {
  const { t } = useTranslation();
  return useMemo(() => ({
    beginner: t('course.create.level_beginner'),
    intermediate: t('course.create.level_intermediate'),
    advanced: t('course.create.level_advanced'),
  }), [t]);
}

function useSortOptions(): { key: string; label: string }[] {
  const { t } = useTranslation();
  return useMemo(() => [
    { key: 'popular', label: t('course.marketplace.sort_popular') },
    { key: 'newest',  label: t('course.marketplace.sort_newest') },
    { key: 'price',   label: t('course.marketplace.sort_price') },
  ], [t]);
}

function useDifficultyOptions(): { key: string; label: string }[] {
  const { t } = useTranslation();
  return useMemo(() => [
    { key: '',             label: t('course.marketplace.all_levels') },
    { key: 'beginner',     label: t('course.create.level_beginner') },
    { key: 'intermediate', label: t('course.create.level_intermediate') },
    { key: 'advanced',     label: t('course.create.level_advanced') },
  ], [t]);
}

export default function CourseMarketplace() {
  const router = useRouter();
  const { t } = useTranslation();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const SORT_OPTIONS = useSortOptions();
  const DIFFICULTY_OPTIONS = useDifficultyOptions();
  const DIFFICULTY_LABELS = useDifficultyLabels();

  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('popular');
  const [difficulty, setDifficulty] = useState('');
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (q = query, s = sort, d = difficulty, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { courses: data } = await coursesApi.list({ q: q.trim() || undefined, sort: s, difficulty: d || undefined, limit: 30 });
      setCourses(data ?? []);
    } catch (e) {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, []);

  function handleQuery(text: string) {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(text, sort, difficulty, true), 400);
  }

  function handleSort(s: string) {
    setSort(s);
    load(query, s, difficulty, true);
  }

  function handleDifficulty(d: string) {
    setDifficulty(d);
    load(query, sort, d, true);
  }

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: C.bg }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={C.textInk} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('course.marketplace.header_title')}</Text>
        </View>

        {/* Search */}
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={16} color={C.bodySoft} />
            <TextInput
              style={styles.searchInput}
              placeholder={t('course.marketplace.search_placeholder')}
              placeholderTextColor={C.bodySoft}
              value={query}
              onChangeText={handleQuery}
              returnKeyType="search"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => { setQuery(''); load('', sort, difficulty, true); }}>
                <Ionicons name="close-circle" size={16} color={C.bodySoft} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Difficulty filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {DIFFICULTY_OPTIONS.map(d => (
            <TouchableOpacity
              key={d.key}
              onPress={() => handleDifficulty(d.key)}
              style={[styles.chip, difficulty === d.key && styles.chipActive]}
            >
              <Text style={[styles.chipText, difficulty === d.key && styles.chipTextActive]}>{d.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Sort row */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.filterRow, { paddingTop: 0, paddingBottom: 8 }]}>
          {SORT_OPTIONS.map(s => (
            <TouchableOpacity
              key={s.key}
              onPress={() => handleSort(s.key)}
              style={[styles.sortChip, sort === s.key && styles.sortChipActive]}
            >
              {sort === s.key && <Ionicons name="checkmark" size={12} color={C.spice} />}
              <Text style={[styles.sortText, sort === s.key && { color: C.spice }]}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </SafeAreaView>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(query, sort, difficulty, true); }} />}
        contentContainerStyle={{ padding: Spacing.lg, gap: 14, paddingBottom: 40 }}
      >
        {loading ? (
          <View style={{ alignItems: 'center', paddingTop: 40 }}>
            <ActivityIndicator color={C.spice} />
          </View>
        ) : courses.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="school-outline" size={40} color={C.stone} />
            <Text style={styles.emptyText}>{t('course.marketplace.no_courses_found')}</Text>
            <Text style={styles.emptySub}>{t('course.marketplace.try_different_search')}</Text>
          </View>
        ) : (
          courses.map(course => {
            const diffColor = DIFFICULTY_COLORS[course.difficulty_level ?? ''] ?? C.bodySoft;
            const diffLabel = DIFFICULTY_LABELS[course.difficulty_level ?? ''] ?? 'All levels';
            const isFree = !course.price || course.price === 0;
            return (
              <TouchableOpacity
                key={course.id}
                style={styles.card}
                onPress={() => router.push(`/course/${course.id}` as any)}
                activeOpacity={0.85}
              >
                {course.thumbnail_url && (
                  <DishPhoto
                    uri={course.thumbnail_url}
                    label={course.title}
                    height={160} width="100%" radius={12}
                    recyclingKey={`course-${course.id}`}
                  />
                )}

                <View style={{ gap: 6, padding: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={[styles.diffPill, { borderColor: diffColor }]}>
                      <Text style={[styles.diffText, { color: diffColor }]}>{diffLabel}</Text>
                    </View>
                    {course.lesson_count > 0 && (
                      <Text style={styles.lessonCount}>{course.lesson_count} lessons</Text>
                    )}
                  </View>

                  <Text style={styles.courseTitle} numberOfLines={2}>{course.title}</Text>

                  {course.description && (
                    <Text style={styles.courseDesc} numberOfLines={2}>{course.description}</Text>
                  )}

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Avatar
                      name={(course as any).cook_name ?? 'C'}
                      avatarUrl={(course as any).cook_avatar}
                      size={20}
                    />
                    <Text style={styles.cookName}>{(course as any).cook_name}</Text>
                    {(course as any).cook_rating > 0 && (
                      <>
                        <Text style={styles.dot}>·</Text>
                        <Text style={styles.cookMeta}>★ {Number((course as any).cook_rating).toFixed(1)}</Text>
                      </>
                    )}
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={styles.price}>
                      {isFree ? 'Free' : fmtCurrency(course.price, 'NGN')}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="people-outline" size={13} color={C.bodySoft} />
                      <Text style={styles.cookMeta}>{course.enrollment_count ?? 0} enrolled</Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

function makeStyles(C: AppColors) { return StyleSheet.create({
  root:          { flex: 1, backgroundColor: C.bg },
  header:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingTop: 16, paddingBottom: 8, gap: 12 },
  headerTitle:   { flex: 1, fontFamily: Fonts.serif, fontSize: 22, color: C.textInk },

  searchRow:    { paddingHorizontal: Spacing.lg, paddingBottom: 10 },
  searchBox:    { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.bgCard, borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 0.5, borderColor: C.borderWarm, ...Shadow.card },
  searchInput:  { flex: 1, fontFamily: Fonts.sans, fontSize: 14, color: C.textInk, paddingVertical: 0 },

  filterRow:    { paddingHorizontal: Spacing.lg, paddingBottom: 4, gap: 8 },
  chip:         { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 40, backgroundColor: C.bgCard, borderWidth: 0.5, borderColor: C.borderWarm },
  chipActive:   { backgroundColor: C.ink, borderColor: 'transparent' },
  chipText:     { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.body },
  chipTextActive: { color: C.canvas },
  sortChip:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 40, backgroundColor: C.bgCard, borderWidth: 0.5, borderColor: C.borderWarm },
  sortChipActive: { borderColor: C.spice },
  sortText:     { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft },

  card:         { backgroundColor: C.bgCard, borderRadius: Radius.lg, overflow: 'hidden', borderWidth: 0.5, borderColor: C.borderWarm, ...Shadow.card, padding: 14, gap: 10 },
  diffPill:     { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20, borderWidth: 1 },
  diffText:     { fontFamily: Fonts.sansMedium, fontSize: 10 },
  lessonCount:  { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft },
  courseTitle:  { fontFamily: Fonts.serif, fontSize: 17, color: C.textInk, lineHeight: 23 },
  courseDesc:   { fontFamily: Fonts.sans, fontSize: 13, color: C.body, lineHeight: 19 },
  cookName:     { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.body },
  cookMeta:     { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft },
  dot:          { color: C.bodySoft },
  price:        { fontFamily: Fonts.serif, fontSize: 18, color: C.spice },

  empty:        { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText:    { fontFamily: Fonts.sansMedium, fontSize: 16, color: C.textInk },
  emptySub:     { fontFamily: Fonts.sans, fontSize: 13, color: C.bodySoft },
}); }
