import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { analyticsApi, type ContentPost } from '../../src/api/analytics';
import { Fonts, Spacing, Radius, Shadow } from '../../src/constants/theme';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { fmtCurrency } from '../../src/utils/format';

// ── helpers ───────────────────────────────────────────────────────────────────

const fmtK = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
};

function relTime(dateStr: string, t: (key: string, opts?: any) => string): string {
  const ms = Date.now() - new Date(dateStr).getTime();
  const d  = Math.floor(ms / 86400000);
  if (d === 0) return t('content_insights.today');
  if (d === 1) return t('content_insights.yesterday');
  if (d < 7)  return t('content_insights.days_ago', { count: d });
  if (d < 30) return t('content_insights.weeks_ago', { count: Math.floor(d / 7) });
  return t('content_insights.months_ago', { count: Math.floor(d / 30) });
}

type SortKey = 'views' | 'likes' | 'orders' | 'revenue' | 'comments';

const POST_TYPE_COLORS: Record<string, string> = {
  recipe:  '#2A5FBF',
  photo:   '#FF6B35',
  video:   '#DC2626',
  story:   '#8B2E6A',
  update:  '#2E8B3F',
};

const POST_TYPE_ICON: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  recipe:  'book-outline',
  photo:   'image-outline',
  video:   'videocam-outline',
  story:   'sparkles-outline',
  update:  'chatbubble-outline',
};

// ── stat chip ─────────────────────────────────────────────────────────────────

function StatChip({ icon, value, color }: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  value: string;
  color?: string;
}) {
  const C = useColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
      <Ionicons name={icon} size={11} color={color ?? C.bodySoft} />
      <Text style={{ fontFamily: Fonts.sans, fontSize: 11, color: color ?? C.bodySoft }}>{value}</Text>
    </View>
  );
}

// ── Performance score ─────────────────────────────────────────────────────────

function perfScore(p: ContentPost): number {
  return p.view_count * 1 + p.like_count * 3 + p.comment_count * 4 + p.share_count * 5 + p.orders_from_post * 20;
}

// ── Post card ─────────────────────────────────────────────────────────────────

function PostCard({ post, rank, highlight, C, styles }: {
  post: ContentPost;
  rank?: number;
  highlight?: 'best' | 'worst';
  C: AppColors;
  styles: ReturnType<typeof makeStyles>;
}) {
  const { t } = useTranslation();
  const typeColor = POST_TYPE_COLORS[post.post_type] ?? C.bodySoft;
  const typeIcon  = POST_TYPE_ICON[post.post_type] ?? 'document-outline';
  const score     = perfScore(post);

  return (
    <View style={[
      styles.postCard,
      highlight === 'best'  && { borderLeftWidth: 3, borderLeftColor: C.successFg },
      highlight === 'worst' && { borderLeftWidth: 3, borderLeftColor: C.errorFg   },
    ]}>
      {/* Header row */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
        {/* Type icon */}
        <View style={[styles.typeIcon, { backgroundColor: typeColor + '18' }]}>
          <Ionicons name={typeIcon} size={16} color={typeColor} />
        </View>

        <View style={{ flex: 1, gap: 3 }}>
          <Text style={styles.postTitle} numberOfLines={2}>
            {post.title ?? post.body.slice(0, 80)}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={[styles.typePill, { backgroundColor: typeColor + '18' }]}>
              <Text style={[styles.typePillText, { color: typeColor }]}>{post.post_type}</Text>
            </View>
            <Text style={{ fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft }}>{relTime(post.created_at, t)}</Text>
          </View>
        </View>

        {rank !== undefined && (
          <View style={[styles.rankBadge, { backgroundColor: highlight === 'best' ? C.warnBg : C.errorBg }]}>
            <Text style={[styles.rankText, { color: highlight === 'best' ? C.ember : C.errorFg }]}>#{rank}</Text>
          </View>
        )}
      </View>

      {/* Stats grid */}
      <View style={styles.statsGrid}>
        <StatChip icon="eye-outline"      value={fmtK(post.view_count)}    />
        <StatChip icon="people-outline"   value={fmtK(post.unique_viewers)} />
        <StatChip icon="heart-outline"    value={fmtK(post.like_count)}    />
        <StatChip icon="chatbubble-outline" value={String(post.comment_count)} />
        <StatChip icon="share-outline"    value={String(post.share_count)} />
        <StatChip icon="bookmark-outline" value={String(post.bookmark_count)} />
        {post.orders_from_post > 0 && (
          <StatChip
            icon="bag-outline"
            value={t('content_insights.orders_count', { count: post.orders_from_post })}
            color={C.successFg}
          />
        )}
        {post.revenue_from_post > 0 && (
          <StatChip
            icon="cash-outline"
            value={fmtCurrency(post.revenue_from_post, 'NGN')}
            color={C.successFg}
          />
        )}
      </View>

      {/* Engagement quality bar */}
      <View style={{ marginTop: 10, gap: 4 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontFamily: Fonts.sans, fontSize: 10, color: C.bodySoft }}>{t('content_insights.engagement_score')}</Text>
          <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 10, color: C.spice }}>{fmtK(score)}</Text>
        </View>
        <View style={{ height: 3, backgroundColor: C.borderWarm, borderRadius: 2, overflow: 'hidden' }}>
          <View style={{
            height: '100%',
            width: '100%',
            backgroundColor: highlight === 'best' ? C.successFg : highlight === 'worst' ? C.errorFg : C.spice,
            borderRadius: 2,
            opacity: 0.7,
          }} />
        </View>
      </View>
    </View>
  );
}

// ── Post type breakdown ───────────────────────────────────────────────────────

function TypeBreakdown({ posts, C, styles }: {
  posts: ContentPost[]; C: AppColors; styles: ReturnType<typeof makeStyles>;
}) {
  const { t } = useTranslation();
  const byType = useMemo(() => {
    const map = new Map<string, { count: number; views: number; orders: number; revenue: number }>();
    for (const p of posts) {
      const existing = map.get(p.post_type) ?? { count: 0, views: 0, orders: 0, revenue: 0 };
      map.set(p.post_type, {
        count:   existing.count + 1,
        views:   existing.views + p.view_count,
        orders:  existing.orders + p.orders_from_post,
        revenue: existing.revenue + p.revenue_from_post,
      });
    }
    return [...map.entries()]
      .map(([type, data]) => ({ type, ...data }))
      .sort((a, b) => b.views - a.views);
  }, [posts]);

  if (byType.length === 0) return null;

  const maxViews = byType[0]?.views ?? 1;

  return (
    <>
      <Text style={styles.sectionCap}>{t('content_insights.performance_by_type')}</Text>
      <View style={[styles.card, { gap: 12 }]}>
        {byType.map(bt => {
          const color = POST_TYPE_COLORS[bt.type] ?? C.bodySoft;
          const barPct = maxViews > 0 ? bt.views / maxViews : 0;
          return (
            <View key={bt.type} style={{ gap: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name={POST_TYPE_ICON[bt.type] ?? 'document-outline'} size={14} color={color} />
                  <Text style={[styles.typeLabel, { textTransform: 'capitalize' }]}>{bt.type}</Text>
                  <Text style={styles.typeSub}>{t('content_insights.post_count', { count: bt.count })}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                  <StatChip icon="eye-outline" value={fmtK(bt.views)} />
                  {bt.orders > 0 && (
                    <StatChip icon="bag-outline" value={String(bt.orders)} color={C.successFg} />
                  )}
                </View>
              </View>
              <View style={{ height: 3, backgroundColor: C.borderWarm, borderRadius: 2, overflow: 'hidden' }}>
                <View style={{
                  width: `${Math.round(barPct * 100)}%` as any,
                  height: '100%',
                  backgroundColor: color,
                  borderRadius: 2,
                }} />
              </View>
            </View>
          );
        })}
      </View>
    </>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function ContentInsights() {
  const router = useRouter();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const { t } = useTranslation();

  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sortBy, setSortBy]         = useState<SortKey>('views');
  const [posts, setPosts]           = useState<ContentPost[]>([]);
  const [totals, setTotals]         = useState<Record<string, number>>({});

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const result = await analyticsApi.content({ limit: 50, sort: sortBy });
      setPosts(result.posts ?? []);
      setTotals(result.totals ?? {});
    } catch (e) {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sortBy]);

  useEffect(() => { load(); }, [load]);

  const sorted = useMemo(() => {
    return [...posts].sort((a, b) => {
      switch (sortBy) {
        case 'views':   return b.view_count - a.view_count;
        case 'likes':   return b.like_count - a.like_count;
        case 'orders':  return b.orders_from_post - a.orders_from_post;
        case 'revenue': return b.revenue_from_post - a.revenue_from_post;
        case 'comments':return b.comment_count - a.comment_count;
      }
    });
  }, [posts, sortBy]);

  const best  = sorted.slice(0, 3);
  const worst = sorted.length > 3 ? sorted.slice(-3).reverse() : [];
  const worstFiltered = worst.filter(p => !best.find(b => b.id === p.id));

  const totalRevenue = posts.reduce((s, p) => s + p.revenue_from_post, 0);

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: C.bg }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="arrow-back" size={22} color={C.textInk} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('content_insights.header_title')}</Text>
          <TouchableOpacity onPress={() => router.push('/(cook)/content' as any)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
              <Text style={styles.linkText}>{t('content_insights.manage')}</Text>
              <Ionicons name="chevron-forward" size={13} color={C.spice} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Sort bar */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingBottom: 10, gap: 8 }}
        >
          {([
            { id: 'views'   as SortKey, label: t('content_insights.sort_views')    },
            { id: 'likes'   as SortKey, label: t('content_insights.sort_likes')    },
            { id: 'orders'  as SortKey, label: t('content_insights.sort_orders')   },
            { id: 'revenue' as SortKey, label: t('content_insights.sort_revenue')  },
            { id: 'comments'as SortKey, label: t('content_insights.sort_comments') },
          ]).map(s => (
            <TouchableOpacity
              key={s.id}
              style={[styles.sortChip, sortBy === s.id && styles.sortChipActive]}
              onPress={() => setSortBy(s.id)}
            >
              <Text style={[styles.sortChipText, sortBy === s.id && styles.sortChipTextActive]}>
                {s.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </SafeAreaView>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={C.spice} />
        </View>
      ) : posts.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 }}>
          <Ionicons name="grid-outline" size={48} color={C.bodySoft} />
          <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 16, color: C.textInk }}>{t('content_insights.no_content_title')}</Text>
          <Text style={{ fontFamily: Fonts.sans, fontSize: 13, color: C.bodySoft, textAlign: 'center', lineHeight: 20 }}>
            {t('content_insights.no_content_body')}
          </Text>
          <TouchableOpacity
            style={styles.createBtn}
            onPress={() => router.push('/create-post' as any)}
          >
            <Ionicons name="add-outline" size={16} color={C.canvas} />
            <Text style={styles.createBtnText}>{t('content_insights.create_post')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 48 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(true); }}
              tintColor={C.spice}
            />
          }
        >
          {/* Totals */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 10, marginBottom: 20 }}
          >
            {[
              { label: t('content_insights.total_reach'), value: fmtK(totals.view_count ?? 0)          },
              { label: t('content_insights.likes'),       value: fmtK(totals.like_count ?? 0)          },
              { label: t('content_insights.comments'),    value: String(totals.comment_count ?? 0)      },
              { label: t('content_insights.shares'),      value: String(totals.share_count ?? 0)        },
              { label: t('content_insights.orders'),      value: String(totals.orders_from_post ?? 0)   },
              { label: t('content_insights.revenue'),     value: fmtCurrency(totalRevenue, 'NGN')       },
            ].map(s => (
              <View key={s.label} style={styles.totalPill}>
                <Text style={styles.totalVal}>{s.value}</Text>
                <Text style={styles.totalLabel}>{s.label}</Text>
              </View>
            ))}
          </ScrollView>

          {/* Type breakdown */}
          <TypeBreakdown posts={posts} C={C} styles={styles} />

          {/* Best performing */}
          <Text style={styles.sectionCap}>{t('content_insights.best_performing')}</Text>
          <View style={{ gap: 10, marginBottom: 24 }}>
            {best.map((p, i) => (
              <PostCard key={p.id} post={p} rank={i + 1} highlight="best" C={C} styles={styles} />
            ))}
          </View>

          {/* Worst performing */}
          {worstFiltered.length > 0 && (
            <>
              <Text style={styles.sectionCap}>{t('content_insights.needs_more_attention')}</Text>
              <View style={{ gap: 10, marginBottom: 24 }}>
                {worstFiltered.map((p, i) => (
                  <PostCard key={p.id} post={p} rank={i + 1} highlight="worst" C={C} styles={styles} />
                ))}
              </View>
            </>
          )}

          {/* All posts */}
          {sorted.length > 3 && (
            <>
              <Text style={styles.sectionCap}>{t('content_insights.all_posts', { count: sorted.length })}</Text>
              <View style={{ gap: 8 }}>
                {sorted.map((p, i) => (
                  <PostCard key={p.id} post={p} rank={i + 1} C={C} styles={styles} />
                ))}
              </View>
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

// ── styles ────────────────────────────────────────────────────────────────────

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    header: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingHorizontal: Spacing.lg, paddingTop: 12, paddingBottom: 10,
    },
    headerTitle: { flex: 1, fontFamily: Fonts.serif, fontSize: 20, color: C.textInk },
    linkText:    { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.spice },

    card: {
      backgroundColor: C.bgCard, borderRadius: Radius.lg,
      borderWidth: 0.5, borderColor: C.borderWarm,
      padding: 14, marginBottom: 16, ...Shadow.card,
    },

    sectionCap: {
      fontFamily: Fonts.sansMedium, fontSize: 11, color: C.bodySoft,
      textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10,
    },

    sortChip: {
      paddingHorizontal: 12, paddingVertical: 7,
      borderRadius: 20, backgroundColor: C.borderWarm,
    },
    sortChipActive:     { backgroundColor: C.spice },
    sortChipText:       { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.bodySoft },
    sortChipTextActive: { color: C.canvas },

    totalPill: {
      backgroundColor: C.bgCard, borderRadius: Radius.lg,
      borderWidth: 0.5, borderColor: C.borderWarm,
      padding: 14, minWidth: 110, gap: 2, ...Shadow.card,
    },
    totalVal:   { fontFamily: Fonts.serif, fontSize: 22, color: C.textInk },
    totalLabel: { fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft },

    postCard: {
      backgroundColor: C.bgCard, borderRadius: Radius.lg,
      borderWidth: 0.5, borderColor: C.borderWarm,
      padding: 14, ...Shadow.card,
    },
    postTitle: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.textInk, lineHeight: 20 },

    typeIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    typePill: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 10 },
    typePillText: { fontFamily: Fonts.sansMedium, fontSize: 10, textTransform: 'capitalize' },

    rankBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
    rankText:  { fontFamily: Fonts.sansMedium, fontSize: 12 },

    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },

    typeLabel: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.textInk },
    typeSub:   { fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft },

    createBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: C.ink, borderRadius: 40,
      paddingHorizontal: 20, paddingVertical: 10,
    },
    createBtnText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.canvas },
  });
}
