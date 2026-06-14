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

type FilterTab = 'all' | 'pinned' | 'drafts';

const TYPE_META: Record<string, { label: string; color: string }> = {
  dish_reveal:        { label: 'Dish Reveal',        color: '#FF8A5C' },
  kitchen_story:      { label: 'Kitchen Story',       color: '#FF6B35' },
  behind_the_scenes:  { label: 'Behind The Scenes',  color: '#2A5FBF' },
  flash_sale:         { label: 'Flash Sale',          color: '#DC2626' },
  weekly_menu:        { label: 'Weekly Menu',         color: '#2E8B3F' },
};

function relTime(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
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
  const thumb = post.photo_urls?.[0] ?? post.photo_url;
  const meta = TYPE_META[post.post_type] ?? { label: post.post_type, color: C.spice };

  function promptActions() {
    const actions: any[] = [];

    if (post.status === 'draft') {
      actions.push({
        label: 'Publish now',
        icon: 'send-outline',
        onPress: () => onPublish(post.id),
      });
    }

    if (post.is_pinned) {
      actions.push({
        label: 'Unpin post',
        icon: 'pin-outline',
        onPress: () => onPin(post.id, false),
      });
    } else if (post.status === 'published') {
      actions.push({
        label: pinnedCount >= 3 ? 'Pin post (unpin one first)' : 'Pin post',
        icon: 'pin-outline',
        onPress: () => {
          if (pinnedCount >= 3) {
            feedback.warn('You already have 3 pinned posts. Unpin one first.');
            return;
          }
          onPin(post.id, true);
        },
      });
    }

    actions.push({
      label: 'Delete',
      icon: 'trash-outline',
      danger: true,
      onPress: () =>
        feedback.confirm({
          title: 'Delete post',
          message: 'This will permanently remove the post.',
          confirmLabel: 'Delete',
          danger: true,
          onConfirm: () => onDelete(post.id),
        }),
    });

    feedback.actionSheet({ title: 'Post options', actions });
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
              <Text style={[styles.pillText, { color: C.spice }]}>Pinned</Text>
            </View>
          )}
          {post.status !== 'published' && (
            <View style={[styles.pill, post.status === 'draft' ? styles.draftPill : styles.scheduledPill]}>
              <Text style={[styles.pillText, post.status === 'draft' ? { color: C.bodySoft } : { color: '#2A5FBF' }]}>
                {post.status === 'draft' ? 'Draft' : 'Scheduled'}
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
          <Text style={styles.time}>{relTime(post.created_at)}</Text>
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
      if (!silent) feedback.error('Error', 'Could not load diary posts');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

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
      feedback.success(pinned ? 'Post pinned' : 'Post unpinned');
    } catch (e: any) {
      feedback.error('Error', e.error ?? e.message ?? 'Could not update post');
    }
  }

  async function handleDelete(id: string) {
    try {
      await diaryApi.delete(id);
      setPosts(prev => prev.filter(p => p.id !== id));
      feedback.success('Post deleted');
    } catch {
      feedback.error('Error', 'Could not delete post');
    }
  }

  async function handlePublish(id: string) {
    try {
      await diaryApi.publish(id);
      setPosts(prev => prev.map(p => p.id === id ? { ...p, status: 'published' } : p));
      feedback.success('Post published');
    } catch {
      feedback.error('Error', 'Could not publish post');
    }
  }

  const TABS: { key: FilterTab; label: string }[] = [
    { key: 'all',    label: 'All' },
    { key: 'pinned', label: `Pinned${pinnedCount ? ` (${pinnedCount}/3)` : ''}` },
    { key: 'drafts', label: 'Drafts' },
  ];

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: C.bg }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
            <Ionicons name="arrow-back" size={22} color={C.textInk} />
          </TouchableOpacity>
          <Text style={styles.pageTitle}>My Diary</Text>
          <TouchableOpacity
            style={styles.newBtn}
            onPress={() => router.push('/diary-post' as any)}
          >
            <Ionicons name="add" size={18} color={C.canvas} />
            <Text style={styles.newBtnText}>New Entry</Text>
          </TouchableOpacity>
        </View>

        {pinnedCount > 0 && (
          <View style={styles.pinBanner}>
            <Ionicons name="pin" size={13} color={C.spice} />
            <Text style={styles.pinBannerText}>
              {pinnedCount}/3 posts pinned to the top of your storefront
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
                {filter === 'pinned' ? 'No pinned posts'
                 : filter === 'drafts' ? 'No drafts or scheduled posts'
                 : 'No diary entries yet'}
              </Text>
              <Text style={styles.emptySub}>
                {filter === 'all'
                  ? 'Share kitchen moments, dish reveals, and behind-the-scenes with your followers.'
                  : filter === 'pinned'
                  ? 'Pin up to 3 posts to keep them at the top of your storefront.'
                  : 'Save a post as a draft to finish it later.'}
              </Text>
              {filter === 'all' && (
                <TouchableOpacity
                  style={styles.emptyAction}
                  onPress={() => router.push('/diary-post' as any)}
                >
                  <Text style={styles.emptyActionText}>Write First Entry</Text>
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
