import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { diaryApi, type DiaryPost, type DiaryPostStatus } from '../../src/api/diary';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { useFeedback } from '../../src/components/feedback';
import { Fonts, Spacing, Radius, Shadow } from '../../src/constants/theme';
import { Bone } from '../../src/components/ui/Skeleton';
import { useTranslation } from 'react-i18next';

type FilterTab = 'all' | 'pinned' | 'drafts';

function getTypeMeta(t: (key: string) => string): Record<string, { label: string; color: string }> {
  return {
    dish_reveal:        { label: t('cook_diary.type_dish_reveal'),       color: '#FF8A5C' },
    kitchen_story:      { label: t('cook_diary.type_kitchen_story'),     color: '#FF6B35' },
    behind_the_scenes:  { label: t('cook_diary.type_behind_the_scenes'), color: '#2A5FBF' },
    flash_sale:         { label: t('cook_diary.type_flash_sale'),        color: '#DC2626' },
    weekly_menu:        { label: t('cook_diary.type_weekly_menu'),       color: '#2E8B3F' },
  };
}

function relTime(iso: string, t: (key: string, opts?: any) => string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)    return t('cook_diary.just_now');
  if (diff < 3600)  return t('cook_diary.minutes_ago', { count: Math.floor(diff / 60) });
  if (diff < 86400) return t('cook_diary.hours_ago', { count: Math.floor(diff / 3600) });
  return t('cook_diary.days_ago', { count: Math.floor(diff / 86400) });
}

function fmtNum(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

interface PostRowProps {
  post: DiaryPost;
  pinnedCount: number;
  onPin: (id: string, pinned: boolean) => void;
  onDelete: (id: string) => void;
  onPublish: (id: string) => void;
}

function PostRow({ post, pinnedCount, onPin, onDelete, onPublish }: PostRowProps) {
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const feedback = useFeedback();
  const { t } = useTranslation();
  const thumb = post.photo_urls?.[0] ?? post.photo_url;
  const TYPE_META = useMemo(() => getTypeMeta(t), [t]);
  const meta = TYPE_META[post.post_type] ?? { label: post.post_type, color: C.spice };

  function promptActions() {
    const actions: any[] = [];

    if (post.status === 'draft') {
      actions.push({
        label: t('cook_diary.publish_now'),
        icon: 'send-outline',
        onPress: () => onPublish(post.id),
      });
    }

    if (post.is_pinned) {
      actions.push({
        label: t('cook_diary.unpin_post'),
        icon: 'pin-outline',
        onPress: () => onPin(post.id, false),
      });
    } else if (post.status === 'published') {
      actions.push({
        label: pinnedCount >= 3 ? t('cook_diary.pin_post_limit') : t('cook_diary.pin_post'),
        icon: 'pin-outline',
        onPress: () => {
          if (pinnedCount >= 3) {
            feedback.warn(t('cook_diary.pin_limit_warning'));
            return;
          }
          onPin(post.id, true);
        },
      });
    }

    actions.push({
      label: t('common.delete'),
      icon: 'trash-outline',
      danger: true,
      onPress: () =>
        feedback.confirm({
          title: t('cook_diary.delete_post_title'),
          message: t('cook_diary.delete_post_message'),
          confirmLabel: t('common.delete'),
          danger: true,
          onConfirm: () => onDelete(post.id),
        }),
    });

    feedback.actionSheet({ title: t('cook_diary.post_options'), actions });
  }

  return (
    <View style={[styles.row, post.is_pinned && styles.rowPinned]}>
      {thumb ? (
        <Image source={{ uri: thumb }} style={styles.thumb} resizeMode="cover" />
      ) : (
        <View style={[styles.thumb, styles.thumbEmpty]}>
          <Ionicons name="document-text-outline" size={20} color={C.bodySoft} />
        </View>
      )}

      <View style={{ flex: 1, gap: 5 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <View style={[styles.pill, { backgroundColor: meta.color + '20' }]}>
            <Text style={[styles.pillText, { color: meta.color }]}>{meta.label}</Text>
          </View>
          {post.is_pinned && (
            <View style={[styles.pill, { backgroundColor: C.spice + '22' }]}>
              <Ionicons name="pin" size={10} color={C.spice} />
              <Text style={[styles.pillText, { color: C.spice }]}>{t('cook_diary.pinned')}</Text>
            </View>
          )}
          {post.status !== 'published' && (
            <View style={[styles.pill, post.status === 'draft' ? styles.draftPill : styles.scheduledPill]}>
              <Text style={[styles.pillText, post.status === 'draft' ? { color: C.bodySoft } : { color: '#2A5FBF' }]}>
                {post.status === 'draft' ? t('cook_diary.draft') : t('cook_diary.scheduled')}
              </Text>
            </View>
          )}
        </View>

        {post.title ? (
          <Text style={styles.title} numberOfLines={1}>{post.title}</Text>
        ) : null}
        <Text style={styles.body} numberOfLines={2}>{post.body}</Text>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Ionicons name="eye-outline" size={12} color={C.bodySoft} />
            <Text style={styles.statText}>{fmtNum(post.view_count ?? 0)}</Text>
          </View>
          <View style={styles.stat}>
            <Ionicons name="heart-outline" size={12} color={C.bodySoft} />
            <Text style={styles.statText}>{fmtNum(post.like_count)}</Text>
          </View>
          <View style={styles.stat}>
            <Ionicons name="chatbubble-outline" size={12} color={C.bodySoft} />
            <Text style={styles.statText}>{fmtNum(post.comment_count)}</Text>
          </View>
          {(post.orders_generated ?? 0) > 0 && (
            <View style={styles.stat}>
              <Ionicons name="cart-outline" size={12} color={C.successFg} />
              <Text style={[styles.statText, { color: C.successFg }]}>{post.orders_generated}</Text>
            </View>
          )}
          <Text style={styles.time}>{relTime(post.created_at, t)}</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.moreBtn} onPress={promptActions}>
        <Ionicons name="ellipsis-vertical" size={18} color={C.bodySoft} />
      </TouchableOpacity>
    </View>
  );
}

export default function DiaryScreen() {
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const router = useRouter();
  const feedback = useFeedback();
  const { t } = useTranslation();

  const [posts, setPosts]       = useState<DiaryPost[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter]     = useState<FilterTab>('all');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await diaryApi.myPosts({ limit: 100 });
      setPosts(res.posts ?? []);
    } catch {
      if (!silent) feedback.error(t('common.error'), t('cook_diary.load_error'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const pinnedCount = posts.filter(p => p.is_pinned).length;

  const visible = useMemo(() => {
    if (filter === 'pinned') return posts.filter(p => p.is_pinned);
    if (filter === 'drafts') return posts.filter(p => p.status === 'draft' || p.status === 'scheduled');
    return posts;
  }, [posts, filter]);

  async function handlePin(id: string, pinned: boolean) {
    try {
      await diaryApi.pin(id, pinned);
      setPosts(prev => prev.map(p => p.id === id ? { ...p, is_pinned: pinned } : p));
      feedback.success(pinned ? t('cook_diary.post_pinned') : t('cook_diary.post_unpinned'));
    } catch (e: any) {
      feedback.error(t('common.error'), e.error ?? e.message ?? t('cook_diary.update_error'));
    }
  }

  async function handleDelete(id: string) {
    try {
      await diaryApi.delete(id);
      setPosts(prev => prev.filter(p => p.id !== id));
      feedback.success(t('cook_diary.post_deleted'));
    } catch {
      feedback.error(t('common.error'), t('cook_diary.delete_error'));
    }
  }

  async function handlePublish(id: string) {
    try {
      await diaryApi.publish(id);
      setPosts(prev => prev.map(p => p.id === id ? { ...p, status: 'published' } : p));
      feedback.success(t('cook_diary.post_published'));
    } catch {
      feedback.error(t('common.error'), t('cook_diary.publish_error'));
    }
  }

  const TABS: { key: FilterTab; label: string }[] = [
    { key: 'all',    label: t('cook_diary.tab_all') },
    { key: 'pinned', label: pinnedCount ? t('cook_diary.tab_pinned_count', { count: pinnedCount }) : t('cook_diary.tab_pinned') },
    { key: 'drafts', label: t('cook_diary.tab_drafts') },
  ];

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: C.bg }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
            <Ionicons name="arrow-back" size={22} color={C.textInk} />
          </TouchableOpacity>
          <Text style={styles.pageTitle}>{t('cook_diary.title')}</Text>
          <TouchableOpacity
            style={styles.newBtn}
            onPress={() => router.push('/diary-post' as any)}
          >
            <Ionicons name="add" size={18} color={C.canvas} />
            <Text style={styles.newBtnText}>{t('cook_diary.new_entry')}</Text>
          </TouchableOpacity>
        </View>

        {pinnedCount > 0 && (
          <View style={styles.pinBanner}>
            <Ionicons name="pin" size={13} color={C.spice} />
            <Text style={styles.pinBannerText}>
              {t('cook_diary.pin_banner', { count: pinnedCount })}
            </Text>
          </View>
        )}

        <View style={styles.tabRow}>
          {TABS.map(t => (
            <TouchableOpacity
              key={t.key}
              onPress={() => setFilter(t.key)}
              style={[styles.tab, filter === t.key && styles.tabActive]}
            >
              <Text style={[styles.tabLabel, filter === t.key && styles.tabLabelActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </SafeAreaView>

      {loading ? (
        <View style={{ flex: 1, padding: Spacing.lg, gap: 12 }}>
          <Bone width="100%" height={100} radius={14} />
          <Bone width="100%" height={100} radius={14} />
          <Bone width="100%" height={100} radius={14} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: Spacing.md, gap: 12, paddingBottom: 60 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(true); }}
              tintColor={C.spice}
            />
          }
        >
          {visible.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="book-outline" size={40} color={C.stone} />
              <Text style={styles.emptyTitle}>
                {filter === 'pinned' ? t('cook_diary.empty_pinned_title')
                 : filter === 'drafts' ? t('cook_diary.empty_drafts_title')
                 : t('cook_diary.empty_all_title')}
              </Text>
              <Text style={styles.emptySub}>
                {filter === 'all'
                  ? t('cook_diary.empty_all_sub')
                  : filter === 'pinned'
                  ? t('cook_diary.empty_pinned_sub')
                  : t('cook_diary.empty_drafts_sub')}
              </Text>
              {filter === 'all' && (
                <TouchableOpacity
                  style={styles.emptyAction}
                  onPress={() => router.push('/diary-post' as any)}
                >
                  <Text style={styles.emptyActionText}>{t('cook_diary.write_first_entry')}</Text>
                  <Ionicons name="chevron-forward" size={14} color={C.canvas} />
                </TouchableOpacity>
              )}
            </View>
          ) : (
            visible.map(post => (
              <PostRow
                key={post.id}
                post={post}
                pinnedCount={pinnedCount}
                onPin={handlePin}
                onDelete={handleDelete}
                onPublish={handlePublish}
              />
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },

    header: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingHorizontal: Spacing.md, paddingTop: 12, paddingBottom: 10,
    },
    pageTitle: { fontFamily: Fonts.serif, fontSize: 22, color: C.textInk, flex: 1 },
    newBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      backgroundColor: C.spice, borderRadius: 40,
      paddingVertical: 7, paddingHorizontal: 14,
    },
    newBtnText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.canvas },

    pinBanner: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: Spacing.md, paddingVertical: 8,
      backgroundColor: C.spice + '12',
    },
    pinBannerText: { fontFamily: Fonts.sans, fontSize: 12, color: C.spice },

    tabRow: {
      flexDirection: 'row', paddingHorizontal: Spacing.md, gap: 4,
      paddingBottom: 10, borderBottomWidth: 0.5, borderBottomColor: C.borderWarm,
    },
    tab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 40 },
    tabActive: { backgroundColor: C.bgCard, borderWidth: 0.5, borderColor: C.borderWarm },
    tabLabel: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.bodySoft },
    tabLabelActive: { color: C.textInk },

    row: {
      flexDirection: 'row', gap: 12, alignItems: 'flex-start',
      backgroundColor: C.bgCard, borderRadius: Radius.lg, padding: 14,
      borderWidth: 0.5, borderColor: C.borderWarm, ...Shadow.card,
    },
    rowPinned: { borderColor: C.spice + '50' },

    thumb: { width: 72, height: 72, borderRadius: Radius.md, overflow: 'hidden' },
    thumbEmpty: { backgroundColor: C.bgCook, alignItems: 'center', justifyContent: 'center' },

    pill: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 40 },
    pillText: { fontFamily: Fonts.sansMedium, fontSize: 10 },
    draftPill: { backgroundColor: C.bgCook },
    scheduledPill: { backgroundColor: '#2A5FBF22' },

    title: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.textInk },
    body: { fontFamily: Fonts.sans, fontSize: 12, color: C.body, lineHeight: 18 },

    statsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
    stat: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    statText: { fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft },
    time: { fontFamily: Fonts.sans, fontSize: 11, color: C.stone, marginLeft: 'auto' },

    moreBtn: { padding: 4 },

    empty: { alignItems: 'center', paddingTop: 60, gap: 10, paddingHorizontal: Spacing.lg },
    emptyTitle: { fontFamily: Fonts.sansMedium, fontSize: 15, color: C.textInk, textAlign: 'center' },
    emptySub: { fontFamily: Fonts.sans, fontSize: 13, color: C.bodySoft, textAlign: 'center', lineHeight: 20 },
    emptyAction: {
      marginTop: 8, backgroundColor: C.spice, borderRadius: 40,
      paddingHorizontal: 20, paddingVertical: 10,
      flexDirection: 'row', alignItems: 'center', gap: 4,
    },
    emptyActionText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.canvas },
  });
}
