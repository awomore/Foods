import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView,
  ActivityIndicator, RefreshControl, Image, Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { feedApi, type DiaryPost } from '../../src/api/feed';
import { useAuth } from '../../src/context/AuthContext';
import { Colors, Fonts, Spacing, Radius, Shadow } from '../../src/constants/theme';
import Avatar from '../../src/components/ui/Avatar';
import DishPhoto from '../../src/components/ui/DishPhoto';

type FeedTab = 'following' | 'global';

function relTime(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h';
  return Math.floor(diff / 86400) + 'd';
}

function PostCard({ post, onLike }: { post: DiaryPost; onLike: (id: string) => void }) {
  const router = useRouter();
  const scale = useRef(new Animated.Value(1)).current;

  function handleLike() {
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.3, duration: 80, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();
    onLike(post.id);
  }

  return (
    <View style={styles.card}>
      {/* Author row */}
      <TouchableOpacity
        style={styles.authorRow}
        onPress={() => router.push({ pathname: '/cook/[id]', params: { id: post.cook_id } })}
        activeOpacity={0.7}
      >
        <Avatar name={post.cook_name.charAt(0)} avatarUrl={post.cook_avatar ?? undefined} avatarBg={Colors.ember} size={36} />
        <View style={{ flex: 1 }}>
          <Text style={styles.authorName}>{post.cook_name}</Text>
          <Text style={styles.authorHandle}>@{post.cook_username} · {relTime(post.created_at)}</Text>
        </View>
      </TouchableOpacity>

      {/* Photo */}
      {post.photo_url ? (
        <Image source={{ uri: post.photo_url }} style={styles.postPhoto} resizeMode="cover" />
      ) : (
        <DishPhoto label={post.cook_name} height={160} radius={0} />
      )}

      {/* Body */}
      <View style={styles.postBody}>
        <Text style={styles.postText}>{post.body}</Text>

        {/* Actions */}
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.likeBtn} onPress={handleLike} activeOpacity={0.7}>
            <Animated.View style={{ transform: [{ scale }] }}>
              <Ionicons
                name={post.user_liked ? 'heart' : 'heart-outline'}
                size={20}
                color={post.user_liked ? Colors.errorFg : Colors.bodySoft}
              />
            </Animated.View>
            <Text style={[styles.likeCount, post.user_liked && { color: Colors.errorFg }]}>
              {post.like_count > 0 ? post.like_count : ''}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

export default function FeedScreen() {
  const { isAuthenticated } = useAuth();
  const [tab, setTab] = useState<FeedTab>('global');
  const [posts, setPosts] = useState<DiaryPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const fn = tab === 'following' && isAuthenticated ? feedApi.following : feedApi.global;
      const { posts: data } = await fn({ limit: 30 });
      setPosts(data ?? []);
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab, isAuthenticated]);

  useEffect(() => { load(); }, [load]);

  async function handleLike(postId: string) {
    if (!isAuthenticated) return;
    setPosts(prev => prev.map(p =>
      p.id === postId
        ? { ...p, user_liked: !p.user_liked, like_count: p.user_liked ? p.like_count - 1 : p.like_count + 1 }
        : p
    ));
    try {
      await feedApi.likeDiaryPost(postId);
    } catch {
      // revert on error
      setPosts(prev => prev.map(p =>
        p.id === postId
          ? { ...p, user_liked: !p.user_liked, like_count: p.user_liked ? p.like_count - 1 : p.like_count + 1 }
          : p
      ));
    }
  }

  return (
    <View style={styles.root}>
      <SafeAreaView>
        <View style={styles.topBar}>
          <Text style={styles.pageTitle}>Feed</Text>
        </View>
        <View style={styles.tabRow}>
          {(['global', 'following'] as FeedTab[]).map(t => (
            <TouchableOpacity
              key={t}
              onPress={() => setTab(t)}
              style={[styles.tab, tab === t && styles.tabActive]}
            >
              <Text style={[styles.tabLabel, tab === t && styles.tabLabelActive]}>
                {t === 'global' ? 'Discover' : 'Following'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </SafeAreaView>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={Colors.spice} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={Colors.spice} />
          }
        >
          {posts.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="restaurant-outline" size={40} color={Colors.stone} />
              <Text style={styles.emptyTitle}>
                {tab === 'following' ? 'No posts from cooks you follow' : 'No posts yet'}
              </Text>
              {tab === 'following' && (
                <Text style={styles.emptySub}>Follow some cooks to see their diary posts here</Text>
              )}
            </View>
          ) : (
            posts.map(post => (
              <PostCard key={post.id} post={post} onLike={handleLike} />
            ))
          )}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  topBar: { paddingHorizontal: Spacing.lg, paddingTop: 16, paddingBottom: 8 },
  pageTitle: { fontFamily: Fonts.serif, fontSize: 26, color: Colors.textInk },

  tabRow: { flexDirection: 'row', paddingHorizontal: Spacing.lg, gap: 4, paddingBottom: 8, borderBottomWidth: 0.5, borderBottomColor: Colors.borderWarm },
  tab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 40 },
  tabActive: { backgroundColor: Colors.bgCard, borderWidth: 0.5, borderColor: Colors.borderWarm },
  tabLabel: { fontFamily: Fonts.sansMedium, fontSize: 14, color: Colors.bodySoft },
  tabLabelActive: { color: Colors.textInk },

  card: { backgroundColor: Colors.bgCard, marginBottom: 8, borderBottomWidth: 0.5, borderBottomColor: Colors.borderWarm },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  authorName: { fontFamily: Fonts.sansMedium, fontSize: 14, color: Colors.textInk },
  authorHandle: { fontFamily: Fonts.sans, fontSize: 12, color: Colors.bodySoft, marginTop: 1 },

  postPhoto: { width: '100%', height: 240 },
  postBody: { padding: 14, gap: 10 },
  postText: { fontFamily: Fonts.sans, fontSize: 14, color: Colors.body, lineHeight: 21 },

  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingTop: 4 },
  likeBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  likeCount: { fontFamily: Fonts.sansMedium, fontSize: 13, color: Colors.bodySoft },

  emptyState: { alignItems: 'center', paddingTop: 80, gap: 10, paddingHorizontal: Spacing.lg },
  emptyTitle: { fontFamily: Fonts.sansMedium, fontSize: 15, color: Colors.textInk, textAlign: 'center' },
  emptySub: { fontFamily: Fonts.sans, fontSize: 13, color: Colors.bodySoft, textAlign: 'center', lineHeight: 20 },
});
