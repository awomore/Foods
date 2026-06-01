import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, Image, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../src/context/AuthContext';
import { customerPostsApi } from '../../src/api/customerPosts';
import { type CustomerPost } from '../../src/types';
import { Fonts, Spacing, Radius, Shadow, FontSize } from '../../src/constants/theme';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import Avatar from '../../src/components/ui/Avatar';
import { relativeTime } from '../../src/utils/format';

export default function CustomerFeedScreen() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);

  const [posts, setPosts] = useState<CustomerPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const res = await customerPostsApi.list({ limit: 30 });
      setPosts(res.posts ?? []);
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
  }, [load]);

  const handleLike = async (post: CustomerPost) => {
    if (!isAuthenticated) { router.push('/(auth)/phone' as any); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const alreadyLiked = likedPosts.has(post.id);
    setLikedPosts(prev => {
      const next = new Set(prev);
      alreadyLiked ? next.delete(post.id) : next.add(post.id);
      return next;
    });
    setPosts(prev => prev.map(p =>
      p.id === post.id
        ? { ...p, like_count: p.like_count + (alreadyLiked ? -1 : 1) }
        : p
    ));
    try {
      alreadyLiked ? await customerPostsApi.unlike(post.id) : await customerPostsApi.like(post.id);
    } catch {
      setLikedPosts(prev => {
        const next = new Set(prev);
        alreadyLiked ? next.add(post.id) : next.delete(post.id);
        return next;
      });
    }
  };

  function renderPost({ item }: { item: CustomerPost }) {
    const liked = likedPosts.has(item.id);
    const hasMedia = item.video_url || item.video_thumbnail || (item.photo_urls?.length ?? 0) > 0;

    return (
      <View style={styles.postCard}>
        <View style={styles.postHeader}>
          <Avatar name={item.author_name ?? 'Customer'} uri={item.author_avatar} size={38} />
          <View style={{ flex: 1 }}>
            <Text style={styles.authorName}>{item.author_name ?? 'Customer'}</Text>
            <Text style={styles.postTime}>{relativeTime(item.created_at)}</Text>
          </View>
          {item.user_id === user?.id && (
            <TouchableOpacity onPress={async () => {
              await customerPostsApi.remove(item.id);
              setPosts(prev => prev.filter(p => p.id !== item.id));
            }}>
              <Ionicons name="trash-outline" size={18} color={C.errorFg} />
            </TouchableOpacity>
          )}
        </View>

        {item.body ? <Text style={styles.postBody}>{item.body}</Text> : null}

        {hasMedia && (
          <View style={styles.mediaWrap}>
            {item.video_url || item.video_thumbnail ? (
              <View style={styles.videoThumb}>
                {item.video_thumbnail
                  ? <Image source={{ uri: item.video_thumbnail }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  : <View style={{ flex: 1, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="play-circle" size={48} color={C.canvas} />
                    </View>
                }
                <View style={styles.videoPlayOverlay}>
                  <Ionicons name="play-circle" size={40} color="rgba(255,255,255,0.9)" />
                </View>
              </View>
            ) : item.photo_urls?.length === 1 ? (
              <Image source={{ uri: item.photo_urls[0] }} style={styles.singlePhoto} resizeMode="cover" />
            ) : (
              <View style={styles.photoGrid}>
                {item.photo_urls.slice(0, 4).map((url, i) => (
                  <View key={i} style={styles.photoGridCell}>
                    <Image source={{ uri: url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    {i === 3 && item.photo_urls.length > 4 && (
                      <View style={styles.moreOverlay}>
                        <Text style={styles.moreOverlayText}>+{item.photo_urls.length - 4}</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {(item.tagged_cook_ids?.length ?? 0) > 0 && (
          <View style={styles.tagRow}>
            <Ionicons name="person-outline" size={12} color={C.bodySoft} />
            <Text style={styles.tagText}>Tagged {item.tagged_cook_ids.length} creator{item.tagged_cook_ids.length > 1 ? 's' : ''}</Text>
          </View>
        )}

        <View style={styles.postActions}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => handleLike(item)}>
            <Ionicons name={liked ? 'heart' : 'heart-outline'} size={20} color={liked ? C.errorFg : C.bodySoft} />
            {item.like_count > 0 && <Text style={[styles.actionCount, liked && { color: C.errorFg }]}>{item.like_count}</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn}>
            <Ionicons name="chatbubble-outline" size={18} color={C.bodySoft} />
            {item.comment_count > 0 && <Text style={styles.actionCount}>{item.comment_count}</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn}>
            <Ionicons name="share-outline" size={20} color={C.bodySoft} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Food Stories</Text>
        {isAuthenticated && (
          <TouchableOpacity
            style={styles.createBtn}
            onPress={() => router.push('/customer-post' as any)}
          >
            <Ionicons name="add" size={18} color={C.canvas} />
            <Text style={styles.createBtnText}>Post</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.loadingWrap}><ActivityIndicator color={C.spice} /></View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={p => p.id}
          renderItem={renderPost}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.spice} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="images-outline" size={48} color={C.stone} />
              <Text style={styles.emptyTitle}>No food stories yet</Text>
              <Text style={styles.emptySub}>Be the first to share a food experience</Text>
              {isAuthenticated && (
                <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/customer-post' as any)}>
                  <Text style={styles.emptyBtnText}>Share your first post</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg, paddingVertical: 12,
      borderBottomWidth: 0.5, borderBottomColor: C.borderWarm,
    },
    headerTitle: { fontFamily: Fonts.serif, fontSize: 22, color: C.ink },
    createBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: C.spice, borderRadius: Radius.full,
      paddingHorizontal: 14, paddingVertical: 8,
    },
    createBtnText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.canvas },
    loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    postCard: { backgroundColor: C.bgCard, borderBottomWidth: 0.5, borderBottomColor: C.borderWarm },
    postHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: Spacing.lg, paddingVertical: 12 },
    authorName: { fontFamily: Fonts.sansMedium, fontSize: FontSize.body, color: C.ink },
    postTime: { fontFamily: Fonts.sans, fontSize: FontSize.xs, color: C.bodySoft, marginTop: 1 },
    postBody: { fontFamily: Fonts.sans, fontSize: FontSize.body, color: C.body, lineHeight: 22, paddingHorizontal: Spacing.lg, paddingBottom: 10 },
    mediaWrap: { width: '100%' },
    videoThumb: { width: '100%', height: 300, backgroundColor: C.bgCook, position: 'relative' },
    videoPlayOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.2)' },
    singlePhoto: { width: '100%', height: 300 },
    photoGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    photoGridCell: { width: '50%', aspectRatio: 1, overflow: 'hidden', position: 'relative' },
    moreOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
    moreOverlayText: { fontFamily: Fonts.sansMedium, fontSize: 22, color: '#fff' },
    tagRow: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: Spacing.lg, paddingTop: 8 },
    tagText: { fontFamily: Fonts.sans, fontSize: FontSize.xs, color: C.bodySoft },
    postActions: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.lg, paddingVertical: 12 },
    actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 4 },
    actionCount: { fontFamily: Fonts.sansMedium, fontSize: FontSize.sm, color: C.bodySoft },
    emptyState: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: Spacing.xl, gap: 10 },
    emptyTitle: { fontFamily: Fonts.sansMedium, fontSize: 18, color: C.ink },
    emptySub: { fontFamily: Fonts.sans, fontSize: 14, color: C.bodySoft, textAlign: 'center' },
    emptyBtn: { backgroundColor: C.spice, borderRadius: Radius.full, paddingHorizontal: 24, paddingVertical: 12, marginTop: 8 },
    emptyBtnText: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.canvas },
  });
}
