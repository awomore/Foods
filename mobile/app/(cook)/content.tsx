import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { postsApi, type MyPost, type PostAnalyticsSummary } from '../../src/api/posts';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { useFeedback } from '../../src/components/feedback';
import { Fonts, Spacing, Radius, Shadow } from '../../src/constants/theme';
import { Bone } from '../../src/components/ui/Skeleton';
import type { PostType } from '../../src/api/feed';

type Tab = 'published' | 'scheduled' | 'drafts';

const POST_TYPE_META: Record<PostType, { label: string; color: string }> = {
  dish_reveal:       { label: 'Dish Reveal',        color: '#FF8A5C' },
  kitchen_story:     { label: 'Kitchen Story',       color: '#FF6B35' },
  behind_the_scenes: { label: 'Behind The Scenes',   color: '#2A5FBF' },
  flash_sale:        { label: 'Flash Sale',          color: '#DC2626' },
  weekly_menu:       { label: 'Weekly Menu',         color: '#2E8B3F' },
};

function relTime(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function fmtNum(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function AnalyticsSummaryBanner({ summary }: { summary: PostAnalyticsSummary }) {
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  return (
    <View style={styles.summaryBanner}>
      {[
        { icon: 'eye-outline',           label: 'Reach',    value: fmtNum(summary.total_reach) },
        { icon: 'heart-outline',         label: 'Likes',    value: fmtNum(summary.total_likes) },
        { icon: 'chatbubble-outline',    label: 'Comments', value: fmtNum(summary.total_comments) },
        { icon: 'share-social-outline',  label: 'Shares',   value: fmtNum(summary.total_shares) },
        { icon: 'cart-outline',          label: 'Orders',   value: fmtNum(summary.total_orders_generated) },
      ].map(stat => (
        <View key={stat.label} style={styles.summaryCell}>
          <Text style={styles.summaryValue}>{stat.value}</Text>
          <Text style={styles.summaryLabel}>{stat.label}</Text>
        </View>
      ))}
    </View>
  );
}

function PostRow({ post, onDelete, onPublish }: {
  post: MyPost;
  onDelete: (id: string) => void;
  onPublish: (id: string) => void;
}) {
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const router = useRouter();
  const feedback = useFeedback();
  const meta = POST_TYPE_META[post.post_type] ?? { label: post.post_type, color: C.spice };
  const thumb = post.photo_urls?.[0] ?? post.photo_url;

  function promptActions() {
    const actions: any[] = [
      {
        label: 'Delete',
        icon: 'trash-outline',
        danger: true,
        onPress: () => feedback.confirm({
          title: 'Delete post',
          message: 'This will permanently remove the post.',
          confirmLabel: 'Delete',
          danger: true,
          onConfirm: () => onDelete(post.id),
        }),
      },
    ];
    if (post.status === 'draft' || post.status === 'scheduled') {
      actions.unshift({
        label: 'Publish now',
        icon: 'send-outline',
        onPress: () => onPublish(post.id),
      });
    }
    feedback.actionSheet({ title: 'Post options', actions });
  }

  return (
    <View style={styles.postRow}>
      {thumb ? (
        <Image source={{ uri: thumb }} style={styles.postThumb} resizeMode="cover" />
      ) : (
        <View style={[styles.postThumb, styles.postThumbEmpty]}>
          <Ionicons name="document-text-outline" size={20} color={C.bodySoft} />
        </View>
      )}

      <View style={{ flex: 1, gap: 5 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={[styles.typePill, { backgroundColor: meta.color + '20' }]}>
            <Text style={[styles.typePillText, { color: meta.color }]}>{meta.label}</Text>
          </View>
          {post.status !== 'published' && (
            <View style={[styles.statusPill, post.status === 'draft' ? styles.draftPill : styles.scheduledPill]}>
              <Text style={[styles.statusPillText, post.status === 'draft' ? { color: C.bodySoft } : { color: '#2A5FBF' }]}>
                {post.status === 'draft' ? 'Draft' : 'Scheduled'}
              </Text>
            </View>
          )}
        </View>

        {post.title && (
          <Text style={styles.postTitle} numberOfLines={1}>{post.title}</Text>
        )}
        <Text style={styles.postBody} numberOfLines={2}>{post.body}</Text>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Ionicons name="eye-outline" size={12} color={C.bodySoft} />
            <Text style={styles.statText}>{fmtNum(post.view_count ?? 0)}</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="heart-outline" size={12} color={C.bodySoft} />
            <Text style={styles.statText}>{fmtNum(post.like_count)}</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="chatbubble-outline" size={12} color={C.bodySoft} />
            <Text style={styles.statText}>{fmtNum(post.comment_count)}</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="share-social-outline" size={12} color={C.bodySoft} />
            <Text style={styles.statText}>{fmtNum(post.share_count)}</Text>
          </View>
          {post.orders_generated > 0 && (
            <View style={styles.statItem}>
              <Ionicons name="cart-outline" size={12} color={C.successFg} />
              <Text style={[styles.statText, { color: C.successFg }]}>{post.orders_generated}</Text>
            </View>
          )}
          <Text style={styles.postTime}>{relTime(post.created_at)}</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.moreBtn} onPress={promptActions}>
        <Ionicons name="ellipsis-vertical" size={18} color={C.bodySoft} />
      </TouchableOpacity>
    </View>
  );
}

export default function ContentScreen() {
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const router = useRouter();
  const feedback = useFeedback();

  const [tab, setTab] = useState<Tab>('published');
  const [posts, setPosts] = useState<MyPost[]>([]);
  const [summary, setSummary] = useState<PostAnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const tabStatus: Record<Tab, 'published' | 'scheduled' | 'draft'> = {
    published: 'published',
    scheduled: 'scheduled',
    drafts: 'draft',
  };

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [postsRes, analyticsRes] = await Promise.all([
        postsApi.myPosts({ status: tabStatus[tab], limit: 50 }),
        summary === null ? postsApi.analytics() : Promise.resolve(null),
      ]);
      setPosts(postsRes.posts ?? []);
      if (analyticsRes) setSummary(analyticsRes.summary);
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id: string) {
    try {
      await postsApi.delete(id);
      setPosts(prev => prev.filter(p => p.id !== id));
      feedback.success('Post deleted');
    } catch {
      feedback.error('Error', 'Could not delete post');
    }
  }

  async function handlePublish(id: string) {
    try {
      await postsApi.update(id, { status: 'published' });
      setPosts(prev => prev.map(p => p.id === id ? { ...p, status: 'published' as const } : p));
      feedback.success('Published', 'Your post is now live');
    } catch {
      feedback.error('Error', 'Could not publish post. Please try again.');
    }
  }

  const tabItems: { key: Tab; label: string }[] = [
    { key: 'published', label: 'Published' },
    { key: 'scheduled', label: 'Scheduled' },
    { key: 'drafts',    label: 'Drafts'    },
  ];

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: C.bg }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
            <Ionicons name="arrow-back" size={22} color={C.textInk} />
          </TouchableOpacity>
          <Text style={styles.pageTitle}>My Content</Text>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <TouchableOpacity
              onPress={() => router.push('/(cook)/content-insights' as any)}
              style={{ padding: 6 }}
            >
              <Ionicons name="bar-chart-outline" size={22} color={C.spice} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.newBtn}
              onPress={() => router.push('/create-post' as any)}
            >
              <Ionicons name="add" size={18} color={C.canvas} />
              <Text style={styles.newBtnText}>New Post</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Analytics summary (published tab only) */}
        {tab === 'published' && summary && (
          <AnalyticsSummaryBanner summary={summary} />
        )}

        {/* Tabs */}
        <View style={styles.tabRow}>
          {tabItems.map(t => (
            <TouchableOpacity
              key={t.key}
              onPress={() => setTab(t.key)}
              style={[styles.tab, tab === t.key && styles.tabActive]}
            >
              <Text style={[styles.tabLabel, tab === t.key && styles.tabLabelActive]}>
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
          {posts.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="create-outline" size={40} color={C.stone} />
              <Text style={styles.emptyTitle}>
                {tab === 'published' ? 'No published posts yet'
                 : tab === 'scheduled' ? 'Nothing scheduled'
                 : 'No drafts saved'}
              </Text>
              <Text style={styles.emptySub}>
                {tab === 'published'
                  ? 'Share a dish reveal, kitchen story, or flash sale to reach your followers.'
                  : tab === 'scheduled'
                  ? 'Schedule posts in advance to keep your audience engaged.'
                  : 'Save drafts while you perfect your content.'}
              </Text>
              <TouchableOpacity
                style={styles.emptyAction}
                onPress={() => router.push('/create-post' as any)}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={styles.emptyActionText}>Create Post</Text>
                  <Ionicons name="chevron-forward" size={14} color={C.canvas} />
                </View>
              </TouchableOpacity>
            </View>
          ) : (
            posts.map(post => (
              <PostRow key={post.id} post={post} onDelete={handleDelete} onPublish={handlePublish} />
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

    summaryBanner: {
      flexDirection: 'row', justifyContent: 'space-around',
      paddingVertical: 12, paddingHorizontal: Spacing.md,
      backgroundColor: C.bgCard, borderBottomWidth: 0.5, borderBottomColor: C.borderWarm,
    },
    summaryCell: { alignItems: 'center', gap: 3 },
    summaryValue: { fontFamily: Fonts.serif, fontSize: 18, color: C.textInk },
    summaryLabel: { fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft },

    tabRow: {
      flexDirection: 'row', paddingHorizontal: Spacing.md, gap: 4,
      paddingBottom: 10, borderBottomWidth: 0.5, borderBottomColor: C.borderWarm,
    },
    tab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 40 },
    tabActive: { backgroundColor: C.bgCard, borderWidth: 0.5, borderColor: C.borderWarm },
    tabLabel: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.bodySoft },
    tabLabelActive: { color: C.textInk },

    postRow: {
      flexDirection: 'row', gap: 12, alignItems: 'flex-start',
      backgroundColor: C.bgCard, borderRadius: Radius.lg, padding: 14,
      borderWidth: 0.5, borderColor: C.borderWarm, ...Shadow.card,
    },
    postThumb: { width: 72, height: 72, borderRadius: Radius.md, overflow: 'hidden' },
    postThumbEmpty: {
      backgroundColor: C.bgCook, alignItems: 'center', justifyContent: 'center',
    },

    typePill: {
      alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 40,
    },
    typePillText: { fontFamily: Fonts.sansMedium, fontSize: 10 },
    statusPill: {
      paddingHorizontal: 8, paddingVertical: 3, borderRadius: 40,
    },
    draftPill: { backgroundColor: C.bgCook },
    scheduledPill: { backgroundColor: '#2A5FBF22' },
    statusPillText: { fontFamily: Fonts.sansMedium, fontSize: 10 },

    postTitle: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.textInk },
    postBody: { fontFamily: Fonts.sans, fontSize: 12, color: C.body, lineHeight: 18 },

    statsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
    statItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    statText: { fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft },
    postTime: { fontFamily: Fonts.sans, fontSize: 11, color: C.stone, marginLeft: 'auto' },

    moreBtn: { padding: 4 },

    emptyState: { alignItems: 'center', paddingTop: 60, gap: 10, paddingHorizontal: Spacing.lg },
    emptyTitle: { fontFamily: Fonts.sansMedium, fontSize: 15, color: C.textInk, textAlign: 'center' },
    emptySub: { fontFamily: Fonts.sans, fontSize: 13, color: C.bodySoft, textAlign: 'center', lineHeight: 20 },
    emptyAction: {
      marginTop: 8, backgroundColor: C.spice, borderRadius: 40,
      paddingHorizontal: 20, paddingVertical: 10,
    },
    emptyActionText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.canvas },
  });
}
