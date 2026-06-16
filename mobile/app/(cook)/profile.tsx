import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Share } from 'react-native';
import { useAuth } from '../../src/context/AuthContext';
import { authApi } from '../../src/api/auth';
import { cooksApi, type CookDetail } from '../../src/api/cooks';
import { Fonts, Spacing, Radius, Shadow, FontSize } from '../../src/constants/theme';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import Avatar from '../../src/components/ui/Avatar';
import { SkeletonProfile } from '../../src/components/ui/Skeleton';
import { pickImage, uploadImage } from '../../src/utils/imageUpload';
import { useFeedback } from '../../src/components/feedback';
import StoryCreator from '../../src/components/stories/StoryCreator';
import DishPhoto from '../../src/components/ui/DishPhoto';
import { fmtCurrency } from '../../src/utils/format';
import { type CreatorType, CREATOR_TYPE_LABELS } from '../../src/types';

type ProfileTab = 'posts' | 'stories' | 'reviews';

const PROFILE_TABS: { key: ProfileTab; icon: string; label: string }[] = [
  { key: 'posts',   icon: 'grid-outline',       label: 'Posts' },
  { key: 'stories', icon: 'play-circle-outline', label: 'Stories' },
  { key: 'reviews', icon: 'star-outline',        label: 'Reviews' },
];

export default function CreatorProfileScreen() {
  const router = useRouter();
  const { user, refreshUser, signOut, setActiveMode } = useAuth();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const feedback = useFeedback();

  const [cook, setCook] = useState<CookDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<ProfileTab>('posts');
  const [storyCreatorVisible, setStoryCreatorVisible] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [posts, setPosts] = useState<any[]>([]);
  const [stories, setStories] = useState<any[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);

  const load = useCallback(async (silent = false) => {
    if (!user?.cook_id) { setLoading(false); return; }
    try {
      const res = await cooksApi.get(user.cook_id);
      setCook(res.cook);

      // Load tab data in parallel
      cooksApi.getMenu(user.cook_id).then(r => setMenuItems(r.items ?? [])).catch(() => {});

      import('../../src/api/posts').then(({ postsApi }) => {
        postsApi.list({ cook_id: user.cook_id! }).then(r => setPosts(r.posts ?? [])).catch(() => {});
      }).catch(() => {});

      import('../../src/api/stories').then(({ storiesApi }) => {
        storiesApi.forCook(user.cook_id!).then(r => setStories(r.stories ?? [])).catch(() => {});
      }).catch(() => {});

      import('../../src/api/reviews').then(({ reviewsApi }) => {
        reviewsApi.byCook(user.cook_id!).then(r => setReviews(r.reviews ?? [])).catch(() => {});
      }).catch(() => {});
    } catch {
      if (!silent) feedback.error('Error', 'Failed to load profile');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.cook_id]);

  useFocusEffect(useCallback(() => { load(true); }, [load]));

  const handleAvatarPress = async () => {
    const picked = await pickImage();
    if (!picked) return;
    setUploadingAvatar(true);
    try {
      const { url } = await uploadImage(picked, 'avatar');
      await authApi.updateProfile({ avatar_url: url });
      feedback.success('Updated', 'Profile photo updated');
      // Refresh state silently after confirming success — failures here are non-fatal
      await Promise.allSettled([refreshUser(), load(true)]);
    } catch {
      feedback.error('Error', 'Upload failed');
    } finally {
      setUploadingAvatar(false);
    }
  };

  async function saveField(data: Record<string, any>) {
    try {
      if (user?.cook_id) await cooksApi.update(user.cook_id, data as any);
      setCook(prev => prev ? { ...prev, ...data } : prev);
      feedback.success('Saved', 'Profile updated');
    } catch (e: any) {
      feedback.error('Error', e.error ?? 'Could not save');
    }
  }

  async function handleSignOut() {
    feedback.confirm({
      title: 'Sign out',
      message: 'Are you sure you want to sign out?',
      confirmLabel: 'Sign out',
      danger: true,
      onConfirm: async () => {
        await signOut();
        router.replace('/(auth)/welcome' as any);
      },
    });
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
  }, [load]);

  if (loading) return <SkeletonProfile />;

  const creatorTypeLabels = ((cook as any)?.creator_types ?? ['home_cook'])
    .map((t: string) => CREATOR_TYPE_LABELS[t as CreatorType] ?? t)
    .join(' · ');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.spice} />}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Cover image */}
        {(cook as any)?.cover_image ? (
          <Image source={{ uri: (cook as any).cover_image }} style={styles.coverImage} resizeMode="cover" />
        ) : (
          <View style={styles.coverPlaceholder} />
        )}

        {/* Avatar + name row */}
        <View style={styles.heroRow}>
          <TouchableOpacity onPress={handleAvatarPress} style={styles.avatarWrap} disabled={uploadingAvatar}>
            {uploadingAvatar ? (
              <View style={[styles.avatarImg, styles.avatarLoading]}>
                <ActivityIndicator color={C.spice} />
              </View>
            ) : (
              <Avatar avatarUrl={cook?.avatar_url} name={cook?.display_name ?? ''} size={80} />
            )}
            <View style={styles.editBadge}>
              <Ionicons name="camera" size={11} color={C.canvas} />
            </View>
          </TouchableOpacity>

          <View style={styles.heroActions}>
            <TouchableOpacity
              style={styles.storefrontBtn}
              onPress={() => cook && router.push(`/cook/${cook.id}` as any)}
            >
              <Ionicons name="storefront-outline" size={14} color={C.spice} />
              <Text style={styles.storefrontBtnText}>View Storefront</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.brandingBtn}
              onPress={() => router.push('/creator-branding' as any)}
            >
              <Ionicons name="color-palette-outline" size={14} color={C.canvas} />
              <Text style={styles.brandingBtnText}>Branding</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Name + bio */}
        <View style={styles.nameSection}>
          <Text style={styles.displayName}>{cook?.display_name ?? user?.full_name}</Text>
          <Text style={styles.creatorType}>{creatorTypeLabels}</Text>
          {cook?.location && (
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={13} color={C.bodySoft} />
              <Text style={styles.locationText}>{cook.location}</Text>
            </View>
          )}
          {cook?.bio ? (
            <Text style={styles.bio}>{cook.bio}</Text>
          ) : (
            <TouchableOpacity onPress={() => router.push('/creator-branding' as any)}>
              <Text style={styles.addBioPrompt}>+ Add bio</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <TouchableOpacity style={styles.stat} onPress={() => router.push('/(cook)/followers' as any)}>
            <Text style={styles.statValue}>{cook?.platform_follower_count ?? 0}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </TouchableOpacity>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{cook?.total_orders ?? 0}</Text>
            <Text style={styles.statLabel}>Orders</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{cook?.average_rating != null ? Number(cook.average_rating).toFixed(1) : '—'}</Text>
            <Text style={styles.statLabel}>Rating</Text>
          </View>
          {cook?.trust_score != null && (
            <>
              <View style={styles.statDivider} />
              <TouchableOpacity style={styles.stat} onPress={() => router.push('/(cook)/trust-score' as any)}>
                <Text style={styles.statValue}>{Math.round(cook.trust_score as any)}%</Text>
                <Text style={styles.statLabel}>Trust</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Quick actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickAction} onPress={() => setStoryCreatorVisible(true)}>
            <View style={styles.quickActionIcon}>
              <Ionicons name="add" size={20} color={C.spice} />
            </View>
            <Text style={styles.quickActionLabel}>Story</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction} onPress={() => router.push('/diary-post' as any)}>
            <View style={styles.quickActionIcon}>
              <Ionicons name="journal-outline" size={20} color={C.spice} />
            </View>
            <Text style={styles.quickActionLabel}>Diary</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => {
              const url = cook?.id ? `https://foodsbyme.com/cook/${cook.id}` : 'https://foodsbyme.com';
              Share.share({ message: `Check out my kitchen on FOODSbyme: ${url}`, url });
            }}
          >
            <View style={styles.quickActionIcon}>
              <Ionicons name="share-social-outline" size={20} color={C.spice} />
            </View>
            <Text style={styles.quickActionLabel}>Share</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={async () => { await setActiveMode('customer'); router.replace('/(customer)'); }}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: C.bgCook }]}>
              <Ionicons name="cart-outline" size={20} color={C.spice} />
            </View>
            <Text style={styles.quickActionLabel}>Order</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction} onPress={() => router.push('/(cook)/analytics' as any)}>
            <View style={styles.quickActionIcon}>
              <Ionicons name="bar-chart-outline" size={20} color={C.spice} />
            </View>
            <Text style={styles.quickActionLabel}>Analytics</Text>
          </TouchableOpacity>
        </View>

        {/* Profile tabs */}
        <View style={styles.tabsRow}>
          {PROFILE_TABS.map(t => (
            <TouchableOpacity
              key={t.key}
              style={[styles.tabBtn, activeTab === t.key && styles.tabBtnActive]}
              onPress={() => { setActiveTab(t.key); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
            >
              <Ionicons name={t.icon as any} size={20} color={activeTab === t.key ? C.spice : C.bodySoft} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab content */}
        {activeTab === 'posts' && (
          <PostsGrid
            posts={posts}
            router={router}
            C={C}
            styles={styles}
            onPinToggle={async (post: any) => {
              const next = !post.is_pinned;
              if (next) {
                const pinned = posts.filter(p => p.is_pinned && p.id !== post.id);
                if (pinned.length >= 3) {
                  feedback.warn('Limit reached', 'Unpin a post first — you can pin at most 3.');
                  return;
                }
              }
              try {
                await import('../../src/api/posts').then(({ postsApi }) => postsApi.pin(post.id, next));
                setPosts(prev => prev.map(p => p.id === post.id ? { ...p, is_pinned: next } : p));
                feedback.success(next ? 'Pinned' : 'Unpinned', next ? 'Post pinned to your profile' : 'Post removed from pinned');
              } catch {
                feedback.error('Error', 'Could not update pin');
              }
            }}
          />
        )}
        {activeTab === 'stories' && (
          <StoriesGrid stories={stories} onAddStory={() => setStoryCreatorVisible(true)} C={C} styles={styles} />
        )}
        {activeTab === 'reviews' && (
          <ReviewsList reviews={reviews} cook={cook} C={C} styles={styles} />
        )}

        {/* Management section — collapsed by default */}
        <TouchableOpacity
          style={styles.manageToggle}
          onPress={() => setShowManage(v => !v)}
        >
          <Text style={styles.manageToggleText}>Manage</Text>
          <Ionicons name={showManage ? 'chevron-up' : 'chevron-down'} size={16} color={C.bodySoft} />
        </TouchableOpacity>

        {showManage && (
          <View style={styles.manageSection}>
            {[
              { icon: 'person-outline',          label: 'Edit profile',          route: '/creator-branding' as any },
              { icon: 'calendar-outline',        label: 'Availability calendar', route: '/(cook)/calendar' as any },
              { icon: 'cash-outline',            label: 'Earnings',              route: '/(cook)/earnings' as any },
              { icon: 'shield-checkmark-outline',label: 'Certifications',        route: '/(cook)/certifications' as any },
              { icon: 'pulse-outline',           label: 'Trust score',           route: '/(cook)/trust-score' as any },
              { icon: 'leaf-outline',            label: 'Health specialisations',route: '/(cook)/health-specialisations' as any },
              { icon: 'archive-outline',         label: 'Meal archive',          route: '/(cook)/meal-archive' as any },
              { icon: 'star-outline',            label: 'Review centre',         route: '/(cook)/review-center' as any },
              { icon: 'bag-handle-outline',      label: 'Commerce hub',          route: '/(cook)/commerce' as any },
              { icon: 'megaphone-outline',       label: 'Catering briefs',       route: '/catering/marketplace' as any },
              { icon: 'settings-outline',        label: 'Chef settings',         route: '/(cook)/chef-settings' as any },
            ].map((item, i) => (
              <TouchableOpacity
                key={i}
                style={styles.manageRow}
                onPress={() => router.push(item.route)}
              >
                <View style={styles.manageIcon}>
                  <Ionicons name={item.icon as any} size={18} color={C.spice} />
                </View>
                <Text style={styles.manageLabel}>{item.label}</Text>
                <Ionicons name="chevron-forward" size={16} color={C.bodySoft} />
              </TouchableOpacity>
            ))}

            <View style={{ height: 1, backgroundColor: C.borderWarm, marginVertical: 8 }} />

            {cook?.id && (
              <TouchableOpacity
                style={styles.manageRow}
                onPress={() => router.push(`/cook/${cook.id}` as any)}
              >
                <View style={styles.manageIcon}>
                  <Ionicons name="storefront-outline" size={18} color={C.spice} />
                </View>
                <Text style={styles.manageLabel}>Preview my storefront</Text>
                <Ionicons name="chevron-forward" size={16} color={C.bodySoft} />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.manageRow}
              onPress={async () => { await setActiveMode('customer'); router.replace('/(customer)'); }}
            >
              <View style={[styles.manageIcon, { backgroundColor: C.bgCook }]}>
                <Ionicons name="cart-outline" size={18} color={C.spice} />
              </View>
              <Text style={styles.manageLabel}>Switch to customer mode</Text>
              <Ionicons name="chevron-forward" size={16} color={C.bodySoft} />
            </TouchableOpacity>

            <View style={{ height: 1, backgroundColor: C.borderWarm, marginVertical: 8 }} />

            <TouchableOpacity style={styles.manageRow} onPress={handleSignOut}>
              <View style={[styles.manageIcon, { backgroundColor: C.errorBg }]}>
                <Ionicons name="log-out-outline" size={18} color={C.errorFg} />
              </View>
              <Text style={[styles.manageLabel, { color: C.errorFg }]}>Sign out</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <StoryCreator
        visible={storyCreatorVisible}
        onClose={() => setStoryCreatorVisible(false)}
        onCreated={() => feedback.success('Story shared!', 'Followers can see it for 24 hours')}
      />
    </SafeAreaView>
  );
}

// ── Tab sub-components ────────────────────────────────────────────────────────

function PostCell({ p, onLongPress, C, styles }: { p: any; onLongPress: () => void; C: AppColors; styles: any }) {
  return (
    <TouchableOpacity key={p.id} style={styles.gridCell} onLongPress={onLongPress} delayLongPress={400}>
      {p.video_url || p.video_thumbnail ? (
        <View style={{ width: '100%', height: '100%', backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' }}>
          {p.video_thumbnail
            ? <Image source={{ uri: p.video_thumbnail }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            : <Ionicons name="play-circle" size={28} color={C.canvas} />
          }
          <View style={styles.videoBadge}>
            <Ionicons name="play" size={9} color="#fff" />
          </View>
        </View>
      ) : p.photo_urls?.[0] ? (
        <Image source={{ uri: p.photo_urls[0] }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bgCook }}>
          <Ionicons name="text-outline" size={20} color={C.bodySoft} />
        </View>
      )}
      {p.is_pinned && (
        <View style={[styles.videoBadge, { top: 6, left: 6, right: 'auto' }]}>
          <Ionicons name="pin" size={9} color="#fff" />
        </View>
      )}
      {(p.like_count > 0 || p.comment_count > 0) && (
        <View style={styles.cellMeta}>
          <Ionicons name="heart" size={11} color="#fff" />
          <Text style={styles.cellMetaText}>{p.like_count ?? 0}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function PostsGrid({ posts, router, C, styles, onPinToggle }: any) {
  const pinned = posts.filter((p: any) => p.is_pinned);

  if (!posts.length) {
    return (
      <View style={styles.emptyTab}>
        <Ionicons name="camera-outline" size={36} color={C.stone} />
        <Text style={styles.emptyTabTitle}>No posts yet</Text>
        <TouchableOpacity onPress={() => router.push('/create-post' as any)} style={styles.emptyTabBtn}>
          <Text style={styles.emptyTabBtnText}>Create your first post</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View>
      {/* Pinned section */}
      {pinned.length > 0 && (
        <View style={{ paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <Ionicons name="pin" size={13} color={C.spice} />
            <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 11, color: C.caps, textTransform: 'uppercase', letterSpacing: 0.6 }}>Pinned</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {pinned.map((p: any) => (
              <TouchableOpacity
                key={p.id}
                style={{ flex: 1, aspectRatio: 1, borderRadius: 10, overflow: 'hidden', backgroundColor: C.bgCook, maxWidth: '33%' }}
                onLongPress={() => onPinToggle(p)}
                delayLongPress={400}
              >
                {p.photo_urls?.[0] ? (
                  <Image source={{ uri: p.photo_urls[0] }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                ) : (
                  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="text-outline" size={18} color={C.bodySoft} />
                  </View>
                )}
                <View style={{ position: 'absolute', top: 5, right: 5, backgroundColor: C.spice, borderRadius: 4, width: 18, height: 18, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="pin" size={10} color="#fff" />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* All posts grid */}
      <View style={styles.contentGrid}>
        {posts.map((p: any) => (
          <PostCell key={p.id} p={p} C={C} styles={styles} onLongPress={() => onPinToggle(p)} />
        ))}
      </View>
    </View>
  );
}

function StoriesGrid({ stories, onAddStory, C, styles }: any) {
  return (
    <View style={styles.contentGrid}>
      {/* Add story button */}
      <TouchableOpacity style={[styles.gridCell, styles.addStoryCell]} onPress={onAddStory}>
        <View style={[styles.addStoryIcon, { borderWidth: 2, borderColor: C.spice, borderStyle: 'dashed' }]}>
          <Ionicons name="add" size={28} color={C.spice} />
        </View>
        <Text style={styles.addStoryLabel}>New story</Text>
      </TouchableOpacity>

      {stories.map((s: any) => (
        <TouchableOpacity key={s.id} style={styles.gridCell}>
          {s.media_url ? (
            <Image source={{ uri: s.media_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          ) : (
            <View style={{ flex: 1, backgroundColor: C.bgCook, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="image-outline" size={20} color={C.bodySoft} />
            </View>
          )}
          {s.is_video && (
            <View style={styles.videoBadge}>
              <Ionicons name="play" size={9} color="#fff" />
            </View>
          )}
        </TouchableOpacity>
      ))}

      {!stories.length && (
        <View style={styles.emptyTab}>
          <Text style={styles.emptyTabTitle}>No stories yet</Text>
          <Text style={styles.emptyTabSub}>Share a story that disappears after 24 hours</Text>
        </View>
      )}
    </View>
  );
}

function MenuGrid({ items, router, C, styles }: any) {
  if (!items.length) {
    return (
      <View style={styles.emptyTab}>
        <Ionicons name="restaurant-outline" size={36} color={C.stone} />
        <Text style={styles.emptyTabTitle}>No dishes yet</Text>
        <TouchableOpacity onPress={() => router.push('/(cook)/menu' as any)} style={styles.emptyTabBtn}>
          <Text style={styles.emptyTabBtnText}>Add your first dish</Text>
        </TouchableOpacity>
      </View>
    );
  }
  return (
    <View style={styles.contentGrid}>
      {items.map((item: any) => (
        <TouchableOpacity
          key={item.id}
          style={styles.gridCell}
          onPress={() => router.push({ pathname: '/item/[id]', params: { id: item.id } } as any)}
        >
          <DishPhoto uri={item.photos?.[0]} style={{ width: '100%', height: '100%' }} />
          <View style={styles.menuCellOverlay}>
            <Text style={styles.menuCellPrice}>{fmtCurrency(item.base_price ?? item.unit_price, 'NGN')}</Text>
          </View>
          {item.video_url && (
            <View style={styles.videoBadge}>
              <Ionicons name="play" size={9} color="#fff" />
            </View>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}

function ReviewsList({ reviews, cook, C, styles }: any) {
  if (!reviews.length) {
    return (
      <View style={styles.emptyTab}>
        <Ionicons name="star-outline" size={36} color={C.stone} />
        <Text style={styles.emptyTabTitle}>No reviews yet</Text>
        <Text style={styles.emptyTabSub}>Reviews from customers will appear here</Text>
      </View>
    );
  }
  return (
    <View style={{ padding: Spacing.lg, gap: Spacing.md }}>
      {Number(cook?.average_rating) > 0 && (
        <View style={styles.ratingBanner}>
          <Text style={styles.ratingBig}>{Number(cook.average_rating).toFixed(1)}</Text>
          <View>
            <Text style={styles.ratingStars}>
              {'★'.repeat(Math.round(Number(cook.average_rating)))}{'☆'.repeat(5 - Math.round(Number(cook.average_rating)))}
            </Text>
            <Text style={styles.ratingCount}>{cook.total_reviews ?? reviews.length} reviews</Text>
          </View>
        </View>
      )}
      {reviews.slice(0, 6).map((r: any) => (
        <View key={r.id} style={styles.reviewCard}>
          <View style={styles.reviewHeader}>
            <Text style={styles.reviewAuthor}>{r.customer_name ?? 'Customer'}</Text>
            <Text style={styles.reviewStars}>{'★'.repeat(r.rating)}</Text>
          </View>
          {r.comment && <Text style={styles.reviewComment} numberOfLines={3}>{r.comment}</Text>}
          {r.cook_reply && (
            <View style={styles.replyBox}>
              <Text style={styles.replyLabel}>Your reply</Text>
              <Text style={styles.replyText}>{r.cook_reply}</Text>
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    // Cover
    coverImage: { width: '100%', height: 160, backgroundColor: C.bgCook },
    coverPlaceholder: { width: '100%', height: 80, backgroundColor: C.bgCook },
    // Hero
    heroRow: {
      flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg, marginTop: -40, marginBottom: 12,
    },
    avatarWrap: { position: 'relative' },
    avatarImg: { width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: C.bg },
    avatarLoading: { backgroundColor: C.bgCook, alignItems: 'center', justifyContent: 'center' },
    editBadge: {
      position: 'absolute', bottom: 2, right: 2,
      width: 22, height: 22, borderRadius: 11,
      backgroundColor: C.spice, alignItems: 'center', justifyContent: 'center',
      borderWidth: 2, borderColor: C.bg,
    },
    heroActions: { flexDirection: 'row', gap: 8, paddingBottom: 4 },
    storefrontBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      borderWidth: 1.5, borderColor: C.spice, borderRadius: Radius.full,
      paddingHorizontal: 12, paddingVertical: 7,
    },
    storefrontBtnText: { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.spice },
    brandingBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      backgroundColor: C.ink, borderRadius: Radius.full,
      paddingHorizontal: 12, paddingVertical: 7,
    },
    brandingBtnText: { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.canvas },
    // Name section
    nameSection: { paddingHorizontal: Spacing.lg, gap: 3, marginBottom: 16 },
    displayName: { fontFamily: Fonts.serif, fontSize: 22, color: C.ink },
    creatorType: { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.spice, letterSpacing: 0.2 },
    locationRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
    locationText: { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft },
    bio: { fontFamily: Fonts.sans, fontSize: 14, color: C.body, lineHeight: 20, marginTop: 6 },
    addBioPrompt: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.spice, marginTop: 4 },
    // Stats
    statsRow: {
      flexDirection: 'row', alignItems: 'center',
      marginHorizontal: Spacing.lg, marginBottom: 16,
      backgroundColor: C.bgCard, borderRadius: Radius.lg,
      borderWidth: 0.5, borderColor: C.borderWarm,
      paddingVertical: 14,
    },
    stat: { flex: 1, alignItems: 'center' },
    statValue: { fontFamily: Fonts.serif, fontSize: 20, color: C.ink },
    statLabel: { fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft, marginTop: 2 },
    statDivider: { width: 1, height: 32, backgroundColor: C.borderWarm },
    // Quick actions
    quickActions: {
      flexDirection: 'row', justifyContent: 'space-around',
      paddingHorizontal: Spacing.lg, marginBottom: 16,
    },
    quickAction: { alignItems: 'center', gap: 6 },
    quickActionIcon: {
      width: 48, height: 48, borderRadius: 24,
      backgroundColor: C.honey, alignItems: 'center', justifyContent: 'center',
    },
    quickActionLabel: { fontFamily: Fonts.sans, fontSize: 11, color: C.body },
    // Profile tabs
    tabsRow: {
      flexDirection: 'row', borderTopWidth: 0.5, borderBottomWidth: 0.5,
      borderColor: C.borderWarm, marginBottom: 2,
    },
    tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 12 },
    tabBtnActive: { borderBottomWidth: 2, borderBottomColor: C.spice },
    // Content grid (Instagram-style 3-column)
    contentGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 2 },
    gridCell: {
      width: '33%', aspectRatio: 1,
      backgroundColor: C.bgCook, overflow: 'hidden',
      position: 'relative',
    },
    videoBadge: {
      position: 'absolute', top: 6, right: 6,
      backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 4,
      width: 20, height: 20, alignItems: 'center', justifyContent: 'center',
    },
    cellMeta: {
      position: 'absolute', bottom: 4, left: 4,
      flexDirection: 'row', alignItems: 'center', gap: 3,
    },
    cellMetaText: { fontFamily: Fonts.sansMedium, fontSize: 10, color: '#fff' },
    addStoryCell: { alignItems: 'center', justifyContent: 'center', gap: 4 },
    addStoryIcon: {
      width: 44, height: 44, borderRadius: 22,
      alignItems: 'center', justifyContent: 'center',
    },
    addStoryLabel: { fontFamily: Fonts.sans, fontSize: 10, color: C.bodySoft },
    menuCellOverlay: {
      position: 'absolute', bottom: 0, left: 0, right: 0,
      backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 6, paddingVertical: 4,
    },
    menuCellPrice: { fontFamily: Fonts.sansMedium, fontSize: 11, color: '#fff' },
    // Empty tab
    emptyTab: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: Spacing.lg, gap: 10 },
    emptyTabTitle: { fontFamily: Fonts.sansMedium, fontSize: 16, color: C.ink },
    emptyTabSub: { fontFamily: Fonts.sans, fontSize: 13, color: C.bodySoft, textAlign: 'center' },
    emptyTabBtn: { backgroundColor: C.spice, borderRadius: Radius.full, paddingHorizontal: 24, paddingVertical: 12, marginTop: 8 },
    emptyTabBtnText: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.canvas },
    // Reviews
    ratingBanner: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.lg,
      backgroundColor: C.honey, borderRadius: Radius.lg, padding: Spacing.md,
    },
    ratingBig: { fontFamily: Fonts.serif, fontSize: 40, color: C.spice },
    ratingStars: { fontSize: 18, color: C.ember },
    ratingCount: { fontFamily: Fonts.sans, fontSize: 13, color: C.body, marginTop: 2 },
    reviewCard: { backgroundColor: C.bgCard, borderRadius: Radius.lg, padding: Spacing.md, ...Shadow.card },
    reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    reviewAuthor: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.ink },
    reviewStars: { fontSize: 13, color: C.ember },
    reviewComment: { fontFamily: Fonts.sans, fontSize: 13, color: C.body, lineHeight: 19 },
    replyBox: { backgroundColor: C.bgCook, borderRadius: Radius.md, padding: 10, marginTop: 8, borderLeftWidth: 2, borderLeftColor: C.spice },
    replyLabel: { fontFamily: Fonts.sansMedium, fontSize: 11, color: C.spice, marginBottom: 2 },
    replyText: { fontFamily: Fonts.sans, fontSize: 12, color: C.body },
    // Manage section
    manageToggle: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      marginHorizontal: Spacing.lg, marginTop: 24, marginBottom: 8,
      paddingVertical: 12, borderTopWidth: 0.5, borderTopColor: C.borderWarm,
    },
    manageToggleText: { fontFamily: Fonts.sansMedium, fontSize: 15, color: C.ink },
    manageSection: { marginHorizontal: Spacing.lg, gap: 2 },
    manageRow: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingVertical: 13, borderBottomWidth: 0.5, borderBottomColor: C.borderWarm,
    },
    manageIcon: {
      width: 34, height: 34, borderRadius: Radius.md,
      backgroundColor: C.honey, alignItems: 'center', justifyContent: 'center',
    },
    manageLabel: { fontFamily: Fonts.sans, fontSize: 14, color: C.ink, flex: 1 },
  });
}
