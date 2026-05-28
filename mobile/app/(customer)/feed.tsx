import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
  RefreshControl, Animated, TextInput, KeyboardAvoidingView,
  Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { feedApi, type DiaryPost, type DiaryComment } from '../../src/api/feed';
import { useAuth } from '../../src/context/AuthContext';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { Fonts, Spacing, Radius } from '../../src/constants/theme';
import Avatar from '../../src/components/ui/Avatar';
import DishPhoto from '../../src/components/ui/DishPhoto';

type FeedTab = 'following' | 'global';

function relTime(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function CommentBody({ body, C }: { body: string; C: AppColors }) {
  const parts = body.split(/(@\w+)/g);
  return (
    <Text style={{ fontFamily: Fonts.sans, fontSize: 13, color: C.body, lineHeight: 18 }}>
      {parts.map((part, i) =>
        part.startsWith('@')
          ? <Text key={i} style={{ color: C.spice, fontFamily: Fonts.sansMedium }}>{part}</Text>
          : part
      )}
    </Text>
  );
}

function CommentRow({
  comment, isOwn, onLike, onDelete,
}: {
  comment: DiaryComment;
  isOwn: boolean;
  onLike: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const scale = useRef(new Animated.Value(1)).current;

  function handleLike() {
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.3, duration: 80, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();
    onLike(comment.id);
  }

  return (
    <View style={styles.commentRow}>
      <Avatar name={(comment.author_name ?? '?').charAt(0)} avatarBg={C.ember} size={28} />
      <View style={{ flex: 1 }}>
        <View style={styles.commentBubble}>
          <Text style={styles.commentAuthor}>
            {comment.author_username ? `@${comment.author_username}` : comment.author_name}
          </Text>
          <CommentBody body={comment.body} C={C} />
        </View>
        <View style={styles.commentActions}>
          <Text style={styles.commentTime}>{relTime(comment.created_at)}</Text>
          <TouchableOpacity style={styles.commentLike} onPress={handleLike} activeOpacity={0.7}>
            <Animated.View style={{ transform: [{ scale }] }}>
              <Ionicons
                name={comment.user_liked ? 'thumbs-up' : 'thumbs-up-outline'}
                size={13}
                color={comment.user_liked ? C.spice : C.bodySoft}
              />
            </Animated.View>
            {comment.like_count > 0 && (
              <Text style={[styles.commentLikeCount, comment.user_liked && { color: C.spice }]}>
                {comment.like_count}
              </Text>
            )}
          </TouchableOpacity>
          {isOwn && (
            <TouchableOpacity onPress={() => onDelete(comment.id)}>
              <Text style={{ fontFamily: Fonts.sans, fontSize: 11, color: C.errorFg }}>Delete</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

function CommentThread({
  postId, visible, currentUserId,
}: {
  postId: string; visible: boolean; currentUserId: string | undefined;
}) {
  const { isAuthenticated } = useAuth();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [comments, setComments] = useState<DiaryComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    feedApi.getComments(postId)
      .then(({ comments: data }) => setComments(data ?? []))
      .catch(() => setComments([]))
      .finally(() => setLoading(false));
  }, [postId, visible]);

  function handleInputChange(text: string) {
    setInput(text);
    const match = text.match(/@(\w*)$/);
    setMentionQuery(match ? match[1] : null);
  }

  function insertMention(username: string) {
    const replaced = input.replace(/@\w*$/, `@${username} `);
    setInput(replaced);
    setMentionQuery(null);
    inputRef.current?.focus();
  }

  async function submit() {
    const trimmed = input.trim();
    if (!trimmed || !isAuthenticated) return;
    setSubmitting(true);
    try {
      const { comment } = await feedApi.addComment(postId, trimmed, []);
      setComments(prev => [...prev, comment]);
      setInput('');
    } catch {
      Alert.alert('Error', 'Could not post comment');
    } finally {
      setSubmitting(false);
    }
  }

  function handleLikeComment(commentId: string) {
    setComments(prev => prev.map(c =>
      c.id === commentId
        ? { ...c, user_liked: !c.user_liked, like_count: c.user_liked ? c.like_count - 1 : c.like_count + 1 }
        : c
    ));
    feedApi.likeComment(commentId).catch(() => {
      setComments(prev => prev.map(c =>
        c.id === commentId
          ? { ...c, user_liked: !c.user_liked, like_count: c.user_liked ? c.like_count - 1 : c.like_count + 1 }
          : c
      ));
    });
  }

  function handleDeleteComment(commentId: string) {
    Alert.alert('Delete comment', 'Remove this comment?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: () => {
          setComments(prev => prev.filter(c => c.id !== commentId));
          feedApi.deleteComment(commentId).catch(() => {});
        },
      },
    ]);
  }

  if (!visible) return null;

  return (
    <View style={styles.commentThread}>
      {loading ? (
        <ActivityIndicator size="small" color={C.spice} style={{ margin: 12 }} />
      ) : (
        <>
          {comments.length === 0 && (
            <Text style={styles.noComments}>No comments yet. Start the conversation.</Text>
          )}
          {comments.map(c => (
            <CommentRow
              key={c.id}
              comment={c}
              isOwn={c.user_id === currentUserId}
              onLike={handleLikeComment}
              onDelete={handleDeleteComment}
            />
          ))}
        </>
      )}

      {isAuthenticated && (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {mentionQuery !== null && (
            <View style={styles.mentionTray}>
              <Text style={styles.mentionTrayLabel}>Mention someone</Text>
              <Text style={styles.mentionTrayHint}>
                Type a username after @ · e.g. @mama_adunola
              </Text>
              {mentionQuery.length > 0 && (
                <TouchableOpacity
                  style={styles.mentionSuggestion}
                  onPress={() => insertMention(mentionQuery)}
                >
                  <Ionicons name="at" size={14} color={C.spice} />
                  <Text style={styles.mentionSuggestionText}>@{mentionQuery}</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          <View style={styles.commentInputRow}>
            <TextInput
              ref={inputRef}
              style={styles.commentInput}
              placeholder="Add a comment… use @ to mention"
              placeholderTextColor={C.bodySoft}
              value={input}
              onChangeText={handleInputChange}
              multiline
              maxLength={500}
              returnKeyType="send"
              onSubmitEditing={submit}
            />
            <TouchableOpacity
              onPress={submit}
              style={[styles.commentSendBtn, (!input.trim() || submitting) && { opacity: 0.4 }]}
              disabled={!input.trim() || submitting}
            >
              {submitting
                ? <ActivityIndicator size="small" color={C.canvas} />
                : <Ionicons name="send" size={16} color={C.canvas} />
              }
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

function PostCard({ post, onLike, currentUserId }: { post: DiaryPost; onLike: (id: string) => void; currentUserId: string | undefined }) {
  const router = useRouter();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const scale = useRef(new Animated.Value(1)).current;
  const [showComments, setShowComments] = useState(false);

  function handleLike() {
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.3, duration: 80, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();
    onLike(post.id);
  }

  return (
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.authorRow}
        onPress={() => router.push({ pathname: '/cook/[id]', params: { id: post.cook_id } })}
        activeOpacity={0.7}
      >
        <Avatar name={post.cook_name.charAt(0)} avatarUrl={post.cook_avatar ?? undefined} avatarBg={C.ember} size={36} />
        <View style={{ flex: 1 }}>
          <Text style={styles.authorName}>{post.cook_name}</Text>
          <Text style={styles.authorHandle}>@{post.cook_username} · {relTime(post.created_at)}</Text>
        </View>
      </TouchableOpacity>

      <DishPhoto
        uri={post.photo_url}
        label={post.cook_name}
        height={240}
        radius={0}
        recyclingKey={post.id}
      />

      <View style={styles.postBody}>
        <Text style={styles.postText}>{post.body}</Text>

        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={handleLike} activeOpacity={0.7}>
            <Animated.View style={{ transform: [{ scale }] }}>
              <Ionicons
                name={post.user_liked ? 'thumbs-up' : 'thumbs-up-outline'}
                size={20}
                color={post.user_liked ? C.spice : C.bodySoft}
              />
            </Animated.View>
            {post.like_count > 0 && (
              <Text style={[styles.actionCount, post.user_liked && { color: C.spice }]}>
                {post.like_count}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={() => setShowComments(v => !v)} activeOpacity={0.7}>
            <Ionicons
              name={showComments ? 'chatbubble' : 'chatbubble-outline'}
              size={19}
              color={showComments ? C.spice : C.bodySoft}
            />
            {post.comment_count != null && post.comment_count > 0 && (
              <Text style={styles.actionCount}>{post.comment_count}</Text>
            )}
            <Text style={styles.actionLabel}>
              {showComments ? 'Hide' : 'Comment'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <CommentThread postId={post.id} visible={showComments} currentUserId={currentUserId} />
    </View>
  );
}

export default function FeedScreen() {
  const { isAuthenticated, user } = useAuth();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
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
      setPosts(prev => prev.map(p =>
        p.id === postId
          ? { ...p, user_liked: !p.user_liked, like_count: p.user_liked ? p.like_count - 1 : p.like_count + 1 }
          : p
      ));
    }
  }

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: C.bg }}>
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
          <ActivityIndicator color={C.spice} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={C.spice} />
          }
        >
          {posts.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="restaurant-outline" size={40} color={C.stone} />
              <Text style={styles.emptyTitle}>
                {tab === 'following' ? 'No posts from cooks you follow' : 'No posts yet'}
              </Text>
              {tab === 'following' && (
                <Text style={styles.emptySub}>Follow some cooks to see their diary posts here</Text>
              )}
            </View>
          ) : (
            posts.map(post => (
              <PostCard key={post.id} post={post} onLike={handleLike} currentUserId={user?.id} />
            ))
          )}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}
    </View>
  );
}

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    topBar: { paddingHorizontal: Spacing.lg, paddingTop: 16, paddingBottom: 8 },
    pageTitle: { fontFamily: Fonts.serif, fontSize: 26, color: C.textInk },

    tabRow: { flexDirection: 'row', paddingHorizontal: Spacing.lg, gap: 4, paddingBottom: 8, borderBottomWidth: 0.5, borderBottomColor: C.borderWarm },
    tab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 40 },
    tabActive: { backgroundColor: C.bgCard, borderWidth: 0.5, borderColor: C.borderWarm },
    tabLabel: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.bodySoft },
    tabLabelActive: { color: C.textInk },

    card: { backgroundColor: C.bgCard, marginBottom: 8, borderBottomWidth: 0.5, borderBottomColor: C.borderWarm },
    authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
    authorName: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.textInk },
    authorHandle: { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft, marginTop: 1 },

    postBody: { padding: 14, gap: 10 },
    postText: { fontFamily: Fonts.sans, fontSize: 14, color: C.body, lineHeight: 21 },

    actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 20, paddingTop: 4 },
    actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    actionCount: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.bodySoft },
    actionLabel: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.bodySoft },

    commentThread: { borderTopWidth: 0.5, borderTopColor: C.borderWarm, backgroundColor: C.bg },
    noComments: { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft, padding: 14, textAlign: 'center' },

    commentRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingVertical: 8, alignItems: 'flex-start' },
    commentBubble: { backgroundColor: C.bgCook, borderRadius: Radius.md, padding: 10, gap: 3, flex: 1 },
    commentAuthor: { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.spice },
    commentActions: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 4, paddingLeft: 4 },
    commentTime: { fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft },
    commentLike: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    commentLikeCount: { fontFamily: Fonts.sansMedium, fontSize: 11, color: C.bodySoft },

    mentionTray: { backgroundColor: C.bgCard, borderTopWidth: 0.5, borderTopColor: C.borderWarm, padding: 12, gap: 6 },
    mentionTrayLabel: { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.textInk },
    mentionTrayHint: { fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft },
    mentionSuggestion: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: C.bgCook, borderRadius: Radius.md },
    mentionSuggestionText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.spice },

    commentInputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 10, borderTopWidth: 0.5, borderTopColor: C.borderWarm },
    commentInput: { flex: 1, backgroundColor: C.bgCook, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, fontFamily: Fonts.sans, fontSize: 13, color: C.textInk, maxHeight: 80, borderWidth: 0.5, borderColor: C.borderWarm },
    commentSendBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.spice, alignItems: 'center', justifyContent: 'center' },

    emptyState: { alignItems: 'center', paddingTop: 80, gap: 10, paddingHorizontal: Spacing.lg },
    emptyTitle: { fontFamily: Fonts.sansMedium, fontSize: 15, color: C.textInk, textAlign: 'center' },
    emptySub: { fontFamily: Fonts.sans, fontSize: 13, color: C.bodySoft, textAlign: 'center', lineHeight: 20 },
  });
}
