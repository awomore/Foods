import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  SafeAreaView, ActivityIndicator, TextInput, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { cooksApi, type CookDetail, type MenuItem } from '../../src/api/cooks';
import { followsApi } from '../../src/api/follows';
import { reviewsApi, type Review } from '../../src/api/reviews';
import { chopTalkApi, type ChopTalkPost, type ChopTalkReply } from '../../src/api/chopTalk';
import { useAuth } from '../../src/context/AuthContext';
import { Colors, Fonts, Spacing, Radius, Shadow } from '../../src/constants/theme';
import Avatar from '../../src/components/ui/Avatar';
import StatusDot from '../../src/components/ui/StatusDot';
import DishPhoto from '../../src/components/ui/DishPhoto';

type Tab = 'today' | 'menu' | 'reviews' | 'talk';

function fmtCurrency(amount: number, currency = 'NGN'): string {
  const symbols: Record<string, string> = { NGN: '₦', KES: 'KSh ', GHS: 'GH₵', ZAR: 'R', EGP: 'E£' };
  return (symbols[currency] ?? currency + ' ') + Number(amount).toLocaleString('en-NG', { maximumFractionDigits: 0 });
}

function relativeTime(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  return Math.floor(diff / 86400) + 'd ago';
}

export default function CookProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isAuthenticated } = useAuth();
  const [tab, setTab] = useState<Tab>('today');
  const [cook, setCook] = useState<CookDetail | null>(null);
  const [todayItems, setTodayItems] = useState<MenuItem[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  // Chop Talk state
  const [talkPosts, setTalkPosts] = useState<ChopTalkPost[]>([]);
  const [talkLoading, setTalkLoading] = useState(false);
  const [talkPosted, setTalkPosted] = useState(false);
  const [newPostBody, setNewPostBody] = useState('');
  const [posting, setPosting] = useState(false);
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [replies, setReplies] = useState<Record<string, ChopTalkReply[]>>({});
  const [replyBody, setReplyBody] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const { cook: c, today_items, realtime_items } = await cooksApi.get(id!);
      setCook(c);
      setTodayItems([...today_items, ...realtime_items]);

      if (isAuthenticated) {
        const { is_following } = await followsApi.status(c.id);
        setIsFollowing(is_following);
      }
    } catch (e: any) {
      console.error('CookProfile load error:', e);
    } finally {
      setLoading(false);
    }
  }, [id, isAuthenticated]);

  const loadReviews = useCallback(async () => {
    if (!cook) return;
    const { reviews: r } = await reviewsApi.byCook(cook.id, { limit: 20 });
    setReviews(r);
  }, [cook]);

  const loadTalk = useCallback(async () => {
    if (!cook) return;
    setTalkLoading(true);
    try {
      const { posts } = await chopTalkApi.getPosts(cook.id, { limit: 30 });
      setTalkPosts(posts);
    } catch {}
    setTalkLoading(false);
  }, [cook]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (tab === 'reviews') loadReviews(); }, [tab, loadReviews]);
  useEffect(() => { if (tab === 'talk') loadTalk(); }, [tab, loadTalk]);

  async function handlePost() {
    if (!cook || !newPostBody.trim()) return;
    setPosting(true);
    try {
      const { post } = await chopTalkApi.post(cook.id, { body: newPostBody.trim() });
      setTalkPosts(prev => [post, ...prev]);
      setNewPostBody('');
      setTalkPosted(true);
    } catch (e: any) {
      Alert.alert('Cannot post', e.error ?? 'You need at least one delivered order to post here');
    }
    setPosting(false);
  }

  async function loadReplies(postId: string) {
    try {
      const { replies: r } = await chopTalkApi.getReplies(postId);
      setReplies(prev => ({ ...prev, [postId]: r }));
    } catch {}
  }

  async function handleReply(postId: string) {
    if (!replyBody.trim()) return;
    try {
      const { reply } = await chopTalkApi.reply(postId, replyBody.trim());
      setReplies(prev => ({ ...prev, [postId]: [...(prev[postId] ?? []), reply] }));
      setReplyBody('');
      setReplyingTo(null);
    } catch (e: any) {
      Alert.alert('Cannot reply', e.error ?? 'Follow this cook to reply');
    }
  }

  async function toggleFollow() {
    if (!cook || !isAuthenticated) return;
    setFollowLoading(true);
    try {
      if (isFollowing) {
        await followsApi.unfollow(cook.id);
        setIsFollowing(false);
      } else {
        await followsApi.follow(cook.id);
        setIsFollowing(true);
      }
    } catch {}
    setFollowLoading(false);
  }

  if (loading) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={Colors.spice} />
      </View>
    );
  }

  if (!cook) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center', padding: 24 }]}>
        <Text style={{ fontFamily: Fonts.serif, fontSize: 20, color: Colors.textInk }}>Kitchen not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ fontFamily: Fonts.sans, color: Colors.spice }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const heroDish = todayItems[0];
  const followers = cook.platform_follower_count >= 1000
    ? (cook.platform_follower_count / 1000).toFixed(1) + 'k'
    : String(cook.platform_follower_count);
  const initials = cook.display_name.charAt(0).toUpperCase();

  const TABS: [Tab, string][] = [
    ['today', "Today's table"],
    ['menu', 'Full menu'],
    ['reviews', 'Reviews'],
    ['talk', 'Chop talk'],
  ];

  return (
    <View style={styles.root}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Hero */}
        <View style={styles.hero}>
          <DishPhoto label={heroDish?.title ?? cook.display_name} height={280} radius={0} />
          <SafeAreaView style={styles.heroOverlay}>
            <View style={styles.heroActions}>
              <TouchableOpacity onPress={() => router.back()} style={styles.backPill}>
                <Ionicons name="chevron-back" size={18} color={Colors.textInk} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.backPill}>
                <Ionicons name="share-outline" size={18} color={Colors.textInk} />
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>

        {/* Identity card */}
        <View style={styles.identityWrap}>
          <View style={styles.identityCard}>
            <View style={{ flexDirection: 'row', gap: 14, alignItems: 'flex-start' }}>
              <Avatar name={initials} avatarBg={Colors.ember} size={54} />
              <View style={{ flex: 1 }}>
                <Text style={styles.cookName}>{cook.display_name}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5 }}>
                  <StatusDot status={cook.is_live ? 'cooking-now' : 'done'} />
                  <Text style={[styles.statusText, cook.is_live && { color: Colors.leaf }]}>
                    {cook.is_live ? 'Cooking now' : 'Not live today'}
                  </Text>
                </View>
                {cook.location && <Text style={styles.cookMeta}>{cook.location}</Text>}
              </View>
              <TouchableOpacity
                style={[styles.followBtn, isFollowing && styles.followBtnActive]}
                onPress={toggleFollow}
                disabled={followLoading}
              >
                <Text style={[styles.followText, isFollowing && styles.followTextActive]}>
                  {isFollowing ? 'Following' : 'Follow'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Stats */}
            <View style={styles.statsRow}>
              {[
                { n: cook.average_rating.toFixed(1), label: 'rating' },
                { n: cook.repeat_order_rate + '%', label: 'come back' },
                { n: cook.total_orders, label: 'orders' },
                { n: followers, label: 'followers' },
              ].map((s, i) => (
                <View key={i} style={[styles.statCell, i < 3 && styles.statCellBorder]}>
                  <Text style={styles.statNum}>{s.n}</Text>
                  <Text style={styles.statLabel}>{s.label}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Credentials */}
        <View style={styles.pills}>
          {cook.food_safety_verified && <CredPill label="Food safety certified" color="info" />}
          {cook.id_verified && <CredPill label="ID verified" color="success" />}
          {cook.is_health_kitchen && <CredPill label="Health Kitchen" color="health" />}
          {cook.instagram_handle && (
            <CredPill label={'@' + cook.instagram_handle} color="default" />
          )}
          {cook.active_discounts.length > 0 && (
            <View style={styles.discPill}>
              <Text style={styles.discText}>{cook.active_discounts[0].discount_value}% off</Text>
            </View>
          )}
        </View>

        {/* Bio */}
        {cook.bio && (
          <View style={styles.bio}>
            <Text style={styles.bioText}>"{cook.bio}"</Text>
          </View>
        )}

        {/* Tab bar */}
        <View style={styles.tabRow}>
          {TABS.map(([k, label]) => (
            <TouchableOpacity key={k} onPress={() => setTab(k)} style={[styles.tabBtn, tab === k && styles.tabBtnActive]}>
              <Text style={[styles.tabText, tab === k && styles.tabTextActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Today tab */}
        {tab === 'today' && (
          <View style={{ padding: Spacing.lg, gap: 20 }}>
            {todayItems.length === 0 && (
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <Text style={{ fontFamily: Fonts.serif, fontSize: 18, color: Colors.textInk }}>No menu for today</Text>
                <Text style={{ fontFamily: Fonts.sans, fontSize: 13, color: Colors.bodySoft, marginTop: 8 }}>Check the full menu for other days</Text>
              </View>
            )}
            {todayItems.map(item => {
              const slotsLeft = item.total_slots - item.slots_claimed;
              return (
                <View key={item.id} style={styles.dishCard}>
                  <DishPhoto label={item.title} height={180} radius={10} />
                  <View style={{ padding: 14 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                      <Text style={[styles.cookName, { flex: 1, fontSize: 18 }]}>{item.title}</Text>
                      <Text style={styles.dishPrice}>{fmtCurrency(item.unit_price, item.currency_code)}</Text>
                    </View>
                    {item.description && <Text style={styles.dishDesc}>{item.description}</Text>}
                    {item.cook_note && (
                      <View style={styles.noteBox}>
                        <Text style={styles.noteText}>{item.cook_note}</Text>
                      </View>
                    )}
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                      <View style={[styles.slotPill, slotsLeft <= 2 && styles.slotPillLow]}>
                        <Text style={[styles.slotText, slotsLeft <= 2 && styles.slotTextLow]}>
                          {slotsLeft <= 0 ? 'Sold out' : slotsLeft <= 2 ? `Only ${slotsLeft} left` : `${slotsLeft} of ${item.total_slots} left`}
                        </Text>
                      </View>
                      {item.realtime_available && (
                        <View style={[styles.slotPill, { backgroundColor: Colors.infoBg }]}>
                          <Text style={[styles.slotText, { color: Colors.infoFg }]}>Real-time</Text>
                        </View>
                      )}
                    </View>
                    <TouchableOpacity
                      onPress={() => router.push({ pathname: '/item/[id]', params: { id: item.id, cookId: cook.id } })}
                      style={[styles.claimBtn, slotsLeft <= 0 && { opacity: 0.5 }]}
                      disabled={slotsLeft <= 0}
                    >
                      <Text style={styles.claimText}>Order</Text>
                      <Ionicons name="arrow-forward" size={16} color={Colors.canvas} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Full menu tab */}
        {tab === 'menu' && (
          <View style={{ padding: Spacing.lg }}>
            {todayItems.length === 0 && (
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <Text style={{ fontFamily: Fonts.serif, fontSize: 18, color: Colors.textInk }}>No published menu</Text>
              </View>
            )}
            {todayItems.map((item, i) => (
              <View key={item.id}>
                <TouchableOpacity
                  onPress={() => router.push({ pathname: '/item/[id]', params: { id: item.id, cookId: cook.id } })}
                  style={styles.menuRow}
                >
                  <View style={[styles.menuThumb, { backgroundColor: Colors.ember }]}>
                    <Text style={styles.menuThumbText}>{item.title.split(',')[0]}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.menuTitle} numberOfLines={2}>{item.title}</Text>
                    {item.cook_note && <Text style={styles.menuNote}>{item.cook_note}</Text>}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
                      <Text style={styles.dishPrice}>{fmtCurrency(item.unit_price, item.currency_code)}</Text>
                      <View style={styles.slotPill}>
                        <Text style={styles.slotText}>{item.total_slots - item.slots_claimed} left</Text>
                      </View>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => router.push({ pathname: '/item/[id]', params: { id: item.id, cookId: cook.id } })}
                    style={styles.plusBtn}
                  >
                    <Ionicons name="add" size={18} color={Colors.canvas} />
                  </TouchableOpacity>
                </TouchableOpacity>
                {i < todayItems.length - 1 && <View style={styles.divider} />}
              </View>
            ))}
          </View>
        )}

        {/* Reviews tab */}
        {tab === 'reviews' && (
          <View style={{ padding: Spacing.lg, gap: 12 }}>
            {reviews.length === 0 && (
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <Text style={{ fontFamily: Fonts.serif, fontSize: 18, color: Colors.textInk }}>No reviews yet</Text>
              </View>
            )}
            {reviews.map(r => (
              <View key={r.id} style={styles.reviewCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                    <Avatar name={(r.customer_name ?? '?').charAt(0)} avatarBg={Colors.ember} size={32} />
                    <View>
                      <Text style={styles.chopName}>{r.customer_name ?? 'Anonymous'}</Text>
                      <Text style={styles.chopWhen}>{relativeTime(r.created_at)}</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 2 }}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Ionicons key={i} name={i < r.rating ? 'star' : 'star-outline'} size={12} color={Colors.spice} />
                    ))}
                  </View>
                </View>
                {r.body && <Text style={styles.chopBody}>{r.body}</Text>}
                {r.cook_reply && (
                  <View style={styles.cookReply}>
                    <Text style={styles.cookReplyText}><Text style={{ fontFamily: Fonts.sansMedium }}>{cook.display_name}</Text>: {r.cook_reply}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Chop talk tab */}
        {tab === 'talk' && (
          <View style={{ padding: Spacing.lg, gap: 14 }}>
            {/* New post composer */}
            {isAuthenticated && (
              <View style={styles.composerBox}>
                <TextInput
                  style={styles.composerInput}
                  placeholder={`Share your experience with ${cook.display_name}…`}
                  placeholderTextColor={Colors.stone}
                  multiline
                  value={newPostBody}
                  onChangeText={setNewPostBody}
                  maxLength={500}
                />
                <TouchableOpacity
                  style={[styles.composerBtn, (!newPostBody.trim() || posting) && { opacity: 0.4 }]}
                  onPress={handlePost}
                  disabled={!newPostBody.trim() || posting}
                >
                  {posting
                    ? <ActivityIndicator size="small" color={Colors.canvas} />
                    : <Text style={styles.composerBtnText}>Post</Text>}
                </TouchableOpacity>
              </View>
            )}

            {talkPosted && (
              <View style={styles.talkSuccessBanner}>
                <Ionicons name="checkmark-circle" size={14} color={Colors.successFg} />
                <Text style={styles.talkSuccessText}>Your post is live!</Text>
              </View>
            )}

            {talkLoading ? (
              <ActivityIndicator color={Colors.spice} style={{ marginTop: 32 }} />
            ) : talkPosts.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <Ionicons name="chatbubbles-outline" size={36} color={Colors.stone} />
                <Text style={styles.emptyTalkTitle}>No posts yet</Text>
                <Text style={styles.emptyTalkSub}>
                  {isAuthenticated
                    ? 'Order from ' + cook.display_name + ' to start the conversation'
                    : 'Sign in to join the conversation'}
                </Text>
              </View>
            ) : (
              talkPosts.map(post => {
                const isExpanded = expandedPost === post.id;
                const postReplies = replies[post.id] ?? [];
                return (
                  <View key={post.id} style={styles.talkCard}>
                    {post.is_pinned && (
                      <View style={styles.pinnedBadge}>
                        <Ionicons name="pin" size={10} color={Colors.spice} />
                        <Text style={styles.pinnedText}>Pinned</Text>
                      </View>
                    )}
                    {post.is_milestone && (
                      <View style={styles.milestoneBadge}>
                        <Text style={styles.milestoneText}>{post.order_count_with_cook} orders</Text>
                      </View>
                    )}
                    <View style={styles.talkAuthorRow}>
                      <Avatar name={post.author_name.charAt(0)} avatarBg={Colors.ember} size={30} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.talkAuthorName}>{post.author_name}</Text>
                        <Text style={styles.talkWhen}>{relativeTime(post.created_at)}</Text>
                      </View>
                      <Text style={styles.talkReplyCount}>{post.reply_count} {post.reply_count === 1 ? 'reply' : 'replies'}</Text>
                    </View>
                    <Text style={styles.talkBody}>{post.body}</Text>

                    <TouchableOpacity
                      style={styles.talkReplyToggle}
                      onPress={() => {
                        if (!isExpanded) {
                          setExpandedPost(post.id);
                          loadReplies(post.id);
                        } else {
                          setExpandedPost(null);
                        }
                      }}
                    >
                      <Text style={styles.talkReplyToggleText}>
                        {isExpanded ? 'Hide replies' : 'View replies'}
                      </Text>
                    </TouchableOpacity>

                    {isExpanded && (
                      <View style={styles.repliesWrap}>
                        {postReplies.map(r => (
                          <View key={r.id} style={styles.replyRow}>
                            <Avatar name={r.author_name.charAt(0)} avatarBg={r.is_cook_reply ? Colors.spice : Colors.stone} size={24} />
                            <View style={styles.replyBubble}>
                              <Text style={styles.replyAuthor}>{r.author_name}</Text>
                              <Text style={styles.replyBody}>{r.body}</Text>
                            </View>
                          </View>
                        ))}
                        {isAuthenticated && (
                          <View style={styles.replyComposer}>
                            <TextInput
                              style={styles.replyInput}
                              placeholder="Write a reply…"
                              placeholderTextColor={Colors.stone}
                              value={replyingTo === post.id ? replyBody : ''}
                              onChangeText={t => { setReplyingTo(post.id); setReplyBody(t); }}
                              onFocus={() => setReplyingTo(post.id)}
                            />
                            <TouchableOpacity
                              onPress={() => handleReply(post.id)}
                              disabled={!replyBody.trim() || replyingTo !== post.id}
                              style={[styles.replySendBtn, (!replyBody.trim() || replyingTo !== post.id) && { opacity: 0.3 }]}
                            >
                              <Ionicons name="send" size={16} color={Colors.spice} />
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </View>
        )}
      </ScrollView>

      {/* Sticky CTA */}
      <View style={styles.stickyBar}>
        {heroDish && (
          <TouchableOpacity
            onPress={() => router.push({ pathname: '/item/[id]', params: { id: heroDish.id, cookId: cook.id } })}
            style={styles.claimBtn}
            activeOpacity={0.85}
          >
            <View>
              <Text style={styles.claimText}>Order from {cook.display_name}</Text>
              <Text style={{ fontFamily: Fonts.sans, fontSize: 12, color: 'rgba(250,246,240,0.65)', marginTop: 2 }}>
                {fmtCurrency(heroDish.unit_price, heroDish.currency_code)} · {heroDish.total_slots - heroDish.slots_claimed} left
              </Text>
            </View>
            <Ionicons name="arrow-forward" size={18} color={Colors.canvas} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={() => router.push({ pathname: '/hire/[cookId]', params: { cookId: cook.id, cookName: cook.display_name } } as any)}
          style={styles.hireBtn}
          activeOpacity={0.85}
        >
          <Ionicons name="calendar-outline" size={16} color={Colors.spice} />
          <Text style={styles.hireText}>Hire for an event</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function CredPill({ label, color }: { label: string; color: 'info' | 'success' | 'health' | 'default' }) {
  const map = {
    info:    { bg: Colors.infoBg,    text: Colors.infoFg },
    success: { bg: Colors.successBg, text: Colors.successFg },
    health:  { bg: Colors.healthBg,  text: Colors.healthFg },
    default: { bg: Colors.bgCook,    text: Colors.body },
  };
  const s = map[color];
  return (
    <View style={[styles.credPill, { backgroundColor: s.bg }]}>
      <Text style={[styles.credText, { color: s.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  hero: { position: 'relative' },
  heroOverlay: { position: 'absolute', top: 0, left: 0, right: 0 },
  heroActions: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, paddingTop: 8 },
  backPill: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(250,246,240,0.88)', alignItems: 'center', justifyContent: 'center' },
  identityWrap: { paddingHorizontal: 20, marginTop: -24, zIndex: 2 },
  identityCard: { backgroundColor: Colors.bgCard, borderRadius: Radius.xl, borderWidth: 0.5, borderColor: Colors.borderWarm, padding: 16, ...Shadow.card },
  cookName: { fontFamily: Fonts.serif, fontSize: 20, color: Colors.textInk, lineHeight: 25 },
  statusText: { fontFamily: Fonts.sans, fontSize: 12, color: Colors.bodySoft },
  cookMeta: { fontFamily: Fonts.sans, fontSize: 12, color: Colors.bodySoft, marginTop: 3 },
  followBtn: { paddingHorizontal: 14, minHeight: 44, borderRadius: Radius.full, backgroundColor: Colors.ink, alignItems: 'center', justifyContent: 'center' },
  followBtnActive: { backgroundColor: Colors.bgCook, borderWidth: 0.5, borderColor: Colors.borderWarm },
  followText: { fontFamily: Fonts.sansMedium, fontSize: 12, color: Colors.canvas },
  followTextActive: { color: Colors.body },
  statsRow: { flexDirection: 'row', marginTop: 16, paddingTop: 14, borderTopWidth: 0.5, borderTopColor: Colors.borderWarm },
  statCell: { flex: 1, alignItems: 'center' },
  statCellBorder: { borderRightWidth: 0.5, borderRightColor: Colors.borderWarm },
  statNum: { fontFamily: Fonts.serif, fontSize: 18, color: Colors.spice },
  statLabel: { fontFamily: Fonts.sans, fontSize: 10, color: Colors.bodySoft, marginTop: 3 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 20, marginTop: 14 },
  credPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 40 },
  credText: { fontFamily: Fonts.sansMedium, fontSize: 11 },
  discPill: { backgroundColor: '#FAECE7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 40 },
  discText: { fontFamily: Fonts.sansMedium, fontSize: 11, color: Colors.spice },
  bio: { marginHorizontal: 20, marginTop: 16, paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: Colors.ember },
  bioText: { fontFamily: Fonts.sans, fontSize: 14, color: Colors.body, lineHeight: 22, fontStyle: 'italic' },
  tabRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: Colors.borderWarm, marginTop: 20 },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive: { borderBottomColor: Colors.spice },
  tabText: { fontFamily: Fonts.sansMedium, fontSize: 12, color: Colors.bodySoft },
  tabTextActive: { color: Colors.spice },
  dishCard: { backgroundColor: Colors.bgCard, borderRadius: Radius.xl, overflow: 'hidden', borderWidth: 0.5, borderColor: Colors.borderWarm, ...Shadow.card },
  dishPrice: { fontFamily: Fonts.serif, fontSize: 18, color: Colors.spice, flexShrink: 0 },
  dishDesc: { fontFamily: Fonts.sans, fontSize: 13, color: Colors.body, marginTop: 8, lineHeight: 20 },
  noteBox: { backgroundColor: Colors.honey, borderRadius: 10, padding: 12, marginTop: 12 },
  noteText: { fontFamily: Fonts.sans, fontSize: 12, color: '#5C3B16', lineHeight: 18, fontStyle: 'italic' },
  slotPill: { backgroundColor: Colors.honey, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 40 },
  slotPillLow: { backgroundColor: Colors.errorBg },
  slotText: { fontFamily: Fonts.sansMedium, fontSize: 11, color: '#5C3B16' },
  slotTextLow: { color: Colors.errorFg },
  claimBtn: { backgroundColor: Colors.ink, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  claimText: { fontFamily: Fonts.sansMedium, fontSize: 14, color: Colors.canvas },
  caps: { fontFamily: Fonts.sansMedium, fontSize: 10, color: Colors.spice, letterSpacing: 1.2, textTransform: 'uppercase' },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
  menuThumb: { width: 72, height: 72, borderRadius: 10, alignItems: 'center', justifyContent: 'center', padding: 6 },
  menuThumbText: { fontFamily: Fonts.serifItalic, fontSize: 11, color: 'rgba(255,247,232,0.9)', textAlign: 'center', lineHeight: 14 },
  menuTitle: { fontFamily: Fonts.serif, fontSize: 14, color: Colors.textInk, lineHeight: 18 },
  menuNote: { fontFamily: Fonts.sans, fontSize: 11, color: Colors.bodySoft, fontStyle: 'italic', marginTop: 4 },
  plusBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.ink, alignItems: 'center', justifyContent: 'center' },
  divider: { height: 0.5, backgroundColor: Colors.borderWarm },
  reviewCard: { backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: 14, borderWidth: 0.5, borderColor: Colors.borderWarm, ...Shadow.card },
  chopCard: { backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: 14, borderWidth: 0.5, borderColor: Colors.borderWarm, ...Shadow.card },
  chopName: { fontFamily: Fonts.sansMedium, fontSize: 13, color: Colors.textInk },
  chopWhen: { fontFamily: Fonts.sans, fontSize: 11, color: Colors.bodySoft },
  chopBody: { fontFamily: Fonts.sans, fontSize: 13, color: Colors.body, lineHeight: 20, marginTop: 8 },
  cookReply: { backgroundColor: Colors.honey, borderRadius: 8, padding: 8, marginTop: 8 },
  cookReplyText: { fontFamily: Fonts.sans, fontSize: 12, color: '#5C3B16', lineHeight: 18 },
  // Chop Talk
  composerBox: { backgroundColor: Colors.bgCard, borderRadius: Radius.lg, borderWidth: 0.5, borderColor: Colors.borderWarm, padding: 12, gap: 10, ...Shadow.card },
  composerInput: { fontFamily: Fonts.sans, fontSize: 14, color: Colors.textInk, minHeight: 72, textAlignVertical: 'top' },
  composerBtn: { backgroundColor: Colors.spice, borderRadius: Radius.md, paddingVertical: 10, alignItems: 'center' },
  composerBtnText: { fontFamily: Fonts.sansMedium, fontSize: 14, color: Colors.canvas },
  talkSuccessBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.successBg, borderRadius: Radius.md, padding: 10 },
  talkSuccessText: { fontFamily: Fonts.sans, fontSize: 13, color: Colors.successFg },
  emptyTalkTitle: { fontFamily: Fonts.sansMedium, fontSize: 15, color: Colors.textInk, marginTop: 10 },
  emptyTalkSub: { fontFamily: Fonts.sans, fontSize: 13, color: Colors.bodySoft, textAlign: 'center', lineHeight: 20, marginTop: 4 },
  talkCard: { backgroundColor: Colors.bgCard, borderRadius: Radius.lg, borderWidth: 0.5, borderColor: Colors.borderWarm, padding: 14, gap: 8, ...Shadow.card },
  pinnedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  pinnedText: { fontFamily: Fonts.sans, fontSize: 10, color: Colors.spice },
  milestoneBadge: { backgroundColor: Colors.honey, borderRadius: 40, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' },
  milestoneText: { fontFamily: Fonts.sansMedium, fontSize: 11, color: '#5C3B16' },
  talkAuthorRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  talkAuthorName: { fontFamily: Fonts.sansMedium, fontSize: 13, color: Colors.textInk },
  talkWhen: { fontFamily: Fonts.sans, fontSize: 11, color: Colors.bodySoft },
  talkBody: { fontFamily: Fonts.sans, fontSize: 14, color: Colors.body, lineHeight: 21 },
  talkReplyCount: { fontFamily: Fonts.sans, fontSize: 11, color: Colors.bodySoft },
  talkReplyToggle: { paddingTop: 4 },
  talkReplyToggleText: { fontFamily: Fonts.sansMedium, fontSize: 12, color: Colors.spice },
  repliesWrap: { marginTop: 8, gap: 10, borderTopWidth: 0.5, borderTopColor: Colors.borderWarm, paddingTop: 10 },
  replyRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  replyBubble: { flex: 1, backgroundColor: Colors.bgCook, borderRadius: Radius.md, padding: 10 },
  replyAuthor: { fontFamily: Fonts.sansMedium, fontSize: 12, color: Colors.textInk, marginBottom: 3 },
  replyBody: { fontFamily: Fonts.sans, fontSize: 13, color: Colors.body, lineHeight: 19 },
  replyComposer: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.bgCook, borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 6 },
  replyInput: { flex: 1, fontFamily: Fonts.sans, fontSize: 13, color: Colors.textInk, paddingVertical: 6 },
  replySendBtn: { padding: 6 },

  stickyBar: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, paddingBottom: 36, backgroundColor: 'transparent', gap: 8 },
  hireBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.bgCard, borderRadius: 14, paddingVertical: 13,
    borderWidth: 1, borderColor: Colors.borderWarm,
    shadowColor: Colors.ink, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  hireText: { fontFamily: Fonts.sansMedium, fontSize: 14, color: Colors.spice },
});
