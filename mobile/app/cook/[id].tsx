import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, TextInput, FlatList, Image, Share,
  Modal, Linking,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { cooksApi, type CookDetail, type MenuItem, certificationsApi } from '../../src/api/cooks';
import { followsApi } from '../../src/api/follows';
import { trackEvent } from '../../src/utils/analytics';
import { storiesApi, type Story } from '../../src/api/stories';
import StoryViewer from '../../src/components/stories/StoryViewer';
import { reviewsApi, type Review } from '../../src/api/reviews';
import { chopTalkApi, type ChopTalkPost, type ChopTalkReply } from '../../src/api/chopTalk';
import { useAuth } from '../../src/context/AuthContext';
import { Fonts, Spacing, Radius, Shadow, FontSize } from '../../src/constants/theme';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { useFeedback } from '../../src/components/feedback';
import { fmtCurrency, relativeTime } from '../../src/utils/format';
import Avatar from '../../src/components/ui/Avatar';
import StatusDot from '../../src/components/ui/StatusDot';
import DishPhoto from '../../src/components/ui/DishPhoto';
import { SkeletonProfile } from '../../src/components/ui/Skeleton';
import { coursesApi, type Course } from '../../src/api/courses';
import { digitalProductsApi, type DigitalProduct } from '../../src/api/digitalProducts';
import { weeklyMenusApi, type WeeklyMenu } from '../../src/api/weeklyMenus';

type Tab = 'today' | 'archive' | 'weekly' | 'services' | 'store' | 'courses' | 'community' | 'reviews';

const TABS: { key: Tab; label: string }[] = [
  { key: 'today',     label: 'Today' },
  { key: 'archive',   label: 'Archive' },
  { key: 'weekly',    label: 'Weekly Menu' },
  { key: 'services',  label: 'Services' },
  { key: 'store',     label: 'Store' },
  { key: 'courses',   label: 'Courses' },
  { key: 'community', label: 'Community' },
  { key: 'reviews',   label: 'Reviews' },
];

export default function StorefrontScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isAuthenticated } = useAuth();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [tab, setTab] = useState<Tab>('today');
  const [cook, setCook] = useState<CookDetail | null>(null);
  const [todayItems, setTodayItems] = useState<MenuItem[]>([]);
  const [archiveItems, setArchiveItems] = useState<MenuItem[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [products, setProducts] = useState<DigitalProduct[]>([]);
  const [weeklyMenus, setWeeklyMenus] = useState<WeeklyMenu[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [cookStories, setCookStories] = useState<Story[]>([]);
  const [viewingStories, setViewingStories] = useState(false);
  const [certifications, setCertifications] = useState<any[]>([]);
  const [galleryPhoto, setGalleryPhoto] = useState<string | null>(null);
  const [talkPosts, setTalkPosts] = useState<ChopTalkPost[]>([]);
  const [newPostBody, setNewPostBody] = useState('');
  const [posting, setPosting] = useState(false);
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [replies, setReplies] = useState<Record<string, ChopTalkReply[]>>({});
  const [replyBody, setReplyBody] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const feedback = useFeedback();

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const { cook: c, today_items, realtime_items } = await cooksApi.get(id!);
      setCook(c);
      setTodayItems([...today_items, ...realtime_items]);
      trackEvent('cook_profile_viewed', {}, { cook_id: c.id });

      storiesApi.forCook(c.id).then(res => setCookStories(res.stories ?? [])).catch(() => {});
      certificationsApi.forCook(c.id).then(res => setCertifications(res.submissions ?? [])).catch(() => {});
      reviewsApi.forCook(c.id).then(res => setReviews(res.reviews ?? [])).catch(() => {});
      coursesApi.list({ cook_id: c.id }).then(res => setCourses(res.courses ?? [])).catch(() => {});
      digitalProductsApi.list({ cook_id: c.id }).then(res => setProducts(res.products ?? [])).catch(() => {});
      weeklyMenusApi.forCook(c.id).then(res => setWeeklyMenus(res.menus ?? [])).catch(() => {});

      // Archive = all menu items
      cooksApi.menu(c.id).then(res => setArchiveItems(res.items ?? [])).catch(() => {});
    } catch {
      feedback.toast({ type: 'error', message: 'Failed to load storefront' });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const loadTalk = useCallback(async () => {
    if (!cook) return;
    try {
      const res = await chopTalkApi.list(cook.id);
      setTalkPosts(res.posts ?? []);
    } catch {}
  }, [cook]);

  useEffect(() => {
    if (tab === 'community') loadTalk();
  }, [tab, loadTalk]);

  const handleFollow = async () => {
    if (!isAuthenticated) { router.push('/(auth)/phone' as any); return; }
    if (!cook) return;
    setFollowLoading(true);
    try {
      if (isFollowing) {
        await followsApi.unfollow(cook.id);
        setIsFollowing(false);
        setCook(prev => prev ? { ...prev, platform_follower_count: (prev.platform_follower_count ?? 1) - 1 } : prev);
      } else {
        await followsApi.follow(cook.id);
        setIsFollowing(true);
        setCook(prev => prev ? { ...prev, platform_follower_count: (prev.platform_follower_count ?? 0) + 1 } : prev);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {
      feedback.toast({ type: 'error', message: 'Failed to update follow' });
    } finally {
      setFollowLoading(false);
    }
  };

  const handleShare = async () => {
    if (!cook) return;
    await Share.share({
      message: `Check out ${cook.display_name} on FOODSbyme — real home-cooked meals near you!`,
      url: `https://foodsbyme-production.up.railway.app/cook/${cook.id}`,
    });
  };

  const postTalk = async () => {
    if (!isAuthenticated) { router.push('/(auth)/phone' as any); return; }
    if (!cook || !newPostBody.trim()) return;
    setPosting(true);
    try {
      const res = await chopTalkApi.create(cook.id, newPostBody.trim());
      setTalkPosts(prev => [res.post, ...prev]);
      setNewPostBody('');
    } catch {
      feedback.toast({ type: 'error', message: 'Failed to post' });
    } finally { setPosting(false); }
  };

  const loadReplies = async (postId: string) => {
    try {
      const res = await chopTalkApi.replies(postId);
      setReplies(prev => ({ ...prev, [postId]: res.replies ?? [] }));
    } catch {}
  };

  const postReply = async (postId: string) => {
    if (!isAuthenticated || !replyBody.trim()) return;
    try {
      const res = await chopTalkApi.reply(postId, replyBody.trim());
      setReplies(prev => ({ ...prev, [postId]: [...(prev[postId] ?? []), res.reply] }));
      setReplyBody('');
      setReplyingTo(null);
    } catch {}
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <SkeletonProfile />
      </SafeAreaView>
    );
  }

  if (!cook) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorState}>
          <Text style={styles.errorText}>Cook not found</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleShare} style={styles.headerBtn}>
          <Ionicons name="share-outline" size={22} color={C.ink} />
        </TouchableOpacity>
      </View>

      <ScrollView stickyHeaderIndices={[1]} showsVerticalScrollIndicator={false}>
        {/* Hero section */}
        <View style={styles.heroSection}>
          <TouchableOpacity
            onPress={() => cookStories.length > 0 && setViewingStories(true)}
            activeOpacity={cookStories.length > 0 ? 0.7 : 1}
          >
            <Avatar
              uri={cook.avatar_url}
              name={cook.display_name}
              size={80}
              style={cookStories.length > 0 ? styles.storyRing : undefined}
            />
          </TouchableOpacity>

          <View style={styles.heroInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.cookName}>{cook.display_name}</Text>
              {cook.food_safety_verified && (
                <Ionicons name="shield-checkmark" size={16} color={C.leaf} />
              )}
            </View>
            {cook.location && (
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={13} color={C.bodySoft} />
                <Text style={styles.locationText}>{cook.location}</Text>
              </View>
            )}
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{cook.platform_follower_count ?? 0}</Text>
                <Text style={styles.statLabel}>Followers</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{cook.total_orders ?? 0}</Text>
                <Text style={styles.statLabel}>Orders</Text>
              </View>
              {cook.average_rating > 0 && (
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{cook.average_rating.toFixed(1)} ★</Text>
                  <Text style={styles.statLabel}>Rating</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Bio */}
        {cook.bio ? <Text style={styles.bio}>{cook.bio}</Text> : null}

        {/* CTA buttons */}
        <View style={styles.ctaRow}>
          <TouchableOpacity
            style={[styles.followBtn, isFollowing && styles.followingBtn]}
            onPress={handleFollow}
            disabled={followLoading}
          >
            {followLoading ? (
              <ActivityIndicator size="small" color={isFollowing ? C.spice : C.canvas} />
            ) : (
              <Text style={[styles.followBtnText, isFollowing && styles.followingBtnText]}>
                {isFollowing ? 'Following' : 'Follow'}
              </Text>
            )}
          </TouchableOpacity>

          {cook.accepts_private_chef && (
            <TouchableOpacity
              style={styles.hireBtn}
              onPress={() => router.push({ pathname: '/hire/[cookId]', params: { cookId: cook.id } } as any)}
            >
              <Ionicons name="calendar-outline" size={15} color={C.canvas} />
              <Text style={styles.hireBtnText}>Book Chef</Text>
            </TouchableOpacity>
          )}

          {cook.accepts_catering && (
            <TouchableOpacity
              style={styles.cateringBtn}
              onPress={() => router.push({ pathname: '/catering/request', params: { cookId: cook.id } } as any)}
            >
              <Ionicons name="restaurant-outline" size={15} color={C.spice} />
              <Text style={styles.cateringBtnText}>Catering</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Trust badges */}
        {certifications.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.badgeRow} contentContainerStyle={{ paddingHorizontal: Spacing.lg }}>
            {cook.food_safety_verified && (
              <View style={styles.badge}>
                <Ionicons name="shield-checkmark" size={14} color={C.leaf} />
                <Text style={styles.badgeText}>Food Safe</Text>
              </View>
            )}
            {cook.health_certified && (
              <View style={styles.badge}>
                <Ionicons name="medkit-outline" size={14} color={C.healthFg} />
                <Text style={styles.badgeText}>Health Cert</Text>
              </View>
            )}
            {cook.licensed_kitchen && (
              <View style={styles.badge}>
                <Ionicons name="business-outline" size={14} color={C.spice} />
                <Text style={styles.badgeText}>Licensed Kitchen</Text>
              </View>
            )}
            {cook.professional_chef && (
              <View style={styles.badge}>
                <Ionicons name="ribbon-outline" size={14} color={C.ember} />
                <Text style={styles.badgeText}>Pro Chef</Text>
              </View>
            )}
          </ScrollView>
        )}

        {/* Tab bar */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar} contentContainerStyle={styles.tabBarContent}>
          {TABS.map(t => (
            <TouchableOpacity
              key={t.key}
              style={[styles.tabItem, tab === t.key && styles.tabItemActive]}
              onPress={() => setTab(t.key)}
            >
              <Text style={[styles.tabLabel, tab === t.key && styles.tabLabelActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Tab content */}
        <View style={styles.tabContent}>
          {tab === 'today' && (
            <TodayTab items={todayItems} cookId={cook.id} router={router} C={C} styles={styles} />
          )}
          {tab === 'archive' && (
            <ArchiveTab items={archiveItems} router={router} C={C} styles={styles} />
          )}
          {tab === 'weekly' && (
            <WeeklyMenuTab menus={weeklyMenus} C={C} styles={styles} />
          )}
          {tab === 'services' && (
            <ServicesTab cook={cook} router={router} C={C} styles={styles} />
          )}
          {tab === 'store' && (
            <StoreTab products={products} router={router} C={C} styles={styles} />
          )}
          {tab === 'courses' && (
            <CoursesTab courses={courses} router={router} C={C} styles={styles} />
          )}
          {tab === 'community' && (
            <CommunityTab
              posts={talkPosts}
              cookId={cook.id}
              newPostBody={newPostBody}
              setNewPostBody={setNewPostBody}
              onPost={postTalk}
              posting={posting}
              expandedPost={expandedPost}
              setExpandedPost={(id) => {
                setExpandedPost(id);
                if (id && !replies[id]) loadReplies(id);
              }}
              replies={replies}
              replyBody={replyBody}
              setReplyBody={setReplyBody}
              replyingTo={replyingTo}
              setReplyingTo={setReplyingTo}
              onReply={postReply}
              isAuthenticated={isAuthenticated}
              C={C} styles={styles}
            />
          )}
          {tab === 'reviews' && (
            <ReviewsTab reviews={reviews} cook={cook} C={C} styles={styles} />
          )}
        </View>
      </ScrollView>

      {/* Story viewer */}
      {viewingStories && cookStories.length > 0 && (
        <StoryViewer
          stories={[{ cook_id: cook.id, cook_name: cook.display_name, cook_avatar: cook.avatar_url, stories: cookStories }]}
          initialCookIndex={0}
          onClose={() => setViewingStories(false)}
        />
      )}

      {/* Gallery modal */}
      <Modal visible={!!galleryPhoto} transparent animationType="fade">
        <TouchableOpacity style={styles.galleryOverlay} onPress={() => setGalleryPhoto(null)}>
          {galleryPhoto && (
            <Image source={{ uri: galleryPhoto }} style={styles.galleryImage} resizeMode="contain" />
          )}
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

// ── Sub-tab components ────────────────────────────────────────────────────────

function TodayTab({ items, cookId, router, C, styles }: any) {
  if (!items.length) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyIcon}>🍽️</Text>
        <Text style={styles.emptyTitle}>Nothing available today</Text>
        <Text style={styles.emptyBody}>Check back tomorrow or browse the archive.</Text>
      </View>
    );
  }
  return (
    <View style={styles.grid}>
      {items.map((item: MenuItem) => (
        <TouchableOpacity
          key={item.id}
          style={styles.dishCard}
          onPress={() => router.push({ pathname: '/item/[id]', params: { id: item.id } } as any)}
        >
          <DishPhoto uri={item.photos?.[0]} style={styles.dishPhoto} />
          <View style={styles.dishInfo}>
            <Text style={styles.dishName} numberOfLines={2}>{item.name}</Text>
            <Text style={styles.dishPrice}>{fmtCurrency(item.base_price, 'NGN')}</Text>
            {item.dietary_labels?.length > 0 && (
              <View style={styles.labelRow}>
                {item.dietary_labels.slice(0, 2).map((l: string) => (
                  <View key={l} style={styles.dietLabel}>
                    <Text style={styles.dietLabelText}>{l}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function ArchiveTab({ items, router, C, styles }: any) {
  if (!items.length) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyIcon}>📦</Text>
        <Text style={styles.emptyTitle}>No archived dishes yet</Text>
      </View>
    );
  }
  return (
    <View style={styles.grid}>
      {items.map((item: MenuItem) => (
        <TouchableOpacity
          key={item.id}
          style={[styles.dishCard, !item.is_available && styles.dishCardUnavailable]}
          onPress={() => router.push({ pathname: '/item/[id]', params: { id: item.id } } as any)}
        >
          <DishPhoto uri={item.photos?.[0]} style={styles.dishPhoto} />
          <View style={styles.dishInfo}>
            <Text style={styles.dishName} numberOfLines={2}>{item.name}</Text>
            <Text style={styles.dishPrice}>{fmtCurrency(item.base_price, 'NGN')}</Text>
            {!item.is_available && (
              <Text style={styles.unavailableTag}>Unavailable</Text>
            )}
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function WeeklyMenuTab({ menus, C, styles }: any) {
  if (!menus.length) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyIcon}>📅</Text>
        <Text style={styles.emptyTitle}>No weekly menus posted</Text>
      </View>
    );
  }
  return (
    <View style={{ gap: Spacing.md }}>
      {menus.map((menu: WeeklyMenu) => (
        <View key={menu.id} style={styles.weeklyCard}>
          <Text style={styles.weeklyTitle}>{menu.title ?? `Week of ${menu.week_start}`}</Text>
          {menu.description && <Text style={styles.weeklyDesc}>{menu.description}</Text>}
          {menu.items.map((item, i) => (
            <View key={i} style={styles.weeklyItem}>
              <View style={styles.weeklyItemLeft}>
                <Text style={styles.weeklyItemDay}>{item.day ?? `Day ${i + 1}`}</Text>
                <Text style={styles.weeklyItemName}>{item.name}</Text>
                {item.description && <Text style={styles.weeklyItemDesc} numberOfLines={1}>{item.description}</Text>}
              </View>
              <Text style={styles.weeklyItemPrice}>{fmtCurrency(item.price, 'NGN')}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function ServicesTab({ cook, router, C, styles }: any) {
  const services = [];
  if (cook.accepts_private_chef) {
    services.push({
      icon: 'person-outline',
      title: 'Private Chef',
      desc: 'Book this chef for your home event. Exclusive, personal service.',
      action: () => router.push({ pathname: '/hire/[cookId]', params: { cookId: cook.id } } as any),
      actionLabel: 'Book Now',
    });
  }
  if (cook.accepts_catering) {
    services.push({
      icon: 'restaurant-outline',
      title: 'Catering',
      desc: `Catering for up to ${cook.max_guest_count ?? 100} guests. Weddings, corporate events, parties.`,
      action: () => router.push({ pathname: '/catering/request', params: { cookId: cook.id } } as any),
      actionLabel: 'Request Quote',
    });
  }

  if (!services.length) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyIcon}>🛎️</Text>
        <Text style={styles.emptyTitle}>No services offered</Text>
        <Text style={styles.emptyBody}>This cook currently only offers regular food orders.</Text>
      </View>
    );
  }

  return (
    <View style={{ gap: Spacing.md }}>
      {services.map((s, i) => (
        <View key={i} style={styles.serviceCard}>
          <View style={styles.serviceIcon}>
            <Ionicons name={s.icon as any} size={24} color={C.spice} />
          </View>
          <View style={styles.serviceBody}>
            <Text style={styles.serviceTitle}>{s.title}</Text>
            <Text style={styles.serviceDesc}>{s.desc}</Text>
            {cook.service_regions?.length > 0 && (
              <Text style={styles.serviceRegions}>
                Areas: {cook.service_regions.join(', ')}
              </Text>
            )}
            <TouchableOpacity style={styles.serviceActionBtn} onPress={s.action}>
              <Text style={styles.serviceActionText}>{s.actionLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </View>
  );
}

function StoreTab({ products, router, C, styles }: any) {
  if (!products.length) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyIcon}>📚</Text>
        <Text style={styles.emptyTitle}>No digital products yet</Text>
        <Text style={styles.emptyBody}>Recipe books, meal plans and more coming soon.</Text>
      </View>
    );
  }
  return (
    <View style={styles.grid}>
      {products.map((p: DigitalProduct) => (
        <TouchableOpacity
          key={p.id}
          style={styles.productCard}
          onPress={() => router.push({ pathname: '/product/[id]', params: { id: p.id } } as any)}
        >
          {p.cover_image ? (
            <Image source={{ uri: p.cover_image }} style={styles.productCover} />
          ) : (
            <View style={[styles.productCover, styles.productCoverPlaceholder]}>
              <Ionicons name="book-outline" size={32} color={C.bodySoft} />
            </View>
          )}
          <View style={styles.productInfo}>
            <View style={styles.productTypeBadge}>
              <Text style={styles.productTypeText}>{p.type.replace('_', ' ')}</Text>
            </View>
            <Text style={styles.productTitle} numberOfLines={2}>{p.title}</Text>
            <Text style={styles.productPrice}>{fmtCurrency(p.price, 'NGN')}</Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function CoursesTab({ courses, router, C, styles }: any) {
  if (!courses.length) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyIcon}>🎓</Text>
        <Text style={styles.emptyTitle}>No courses yet</Text>
      </View>
    );
  }
  return (
    <View style={{ gap: Spacing.md }}>
      {courses.map((c: Course) => (
        <TouchableOpacity
          key={c.id}
          style={styles.courseCard}
          onPress={() => router.push({ pathname: '/course/[id]', params: { id: c.id } } as any)}
        >
          {c.cover_image && (
            <Image source={{ uri: c.cover_image }} style={styles.courseCover} />
          )}
          <View style={styles.courseInfo}>
            <View style={styles.courseRow}>
              {c.difficulty_level && (
                <View style={styles.diffBadge}>
                  <Text style={styles.diffText}>{c.difficulty_level}</Text>
                </View>
              )}
              {c.is_free && (
                <View style={styles.freeBadge}>
                  <Text style={styles.freeText}>Free</Text>
                </View>
              )}
            </View>
            <Text style={styles.courseTitle}>{c.title}</Text>
            <Text style={styles.courseDesc} numberOfLines={2}>{c.description}</Text>
            <View style={styles.courseMeta}>
              <Text style={styles.courseMetaText}>{c.lesson_count} lessons</Text>
              {c.duration_hours && <Text style={styles.courseMetaText}>{c.duration_hours}h</Text>}
              <Text style={styles.courseMetaText}>{c.enrollment_count} enrolled</Text>
            </View>
            <Text style={styles.coursePrice}>
              {c.is_free ? 'Free' : fmtCurrency(c.price, 'NGN')}
            </Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function CommunityTab({
  posts, cookId, newPostBody, setNewPostBody, onPost, posting,
  expandedPost, setExpandedPost, replies, replyBody, setReplyBody,
  replyingTo, setReplyingTo, onReply, isAuthenticated, C, styles,
}: any) {
  return (
    <View style={{ gap: Spacing.md }}>
      {isAuthenticated && (
        <View style={styles.talkComposer}>
          <TextInput
            style={styles.talkInput}
            value={newPostBody}
            onChangeText={setNewPostBody}
            placeholder="Ask a question or leave a comment..."
            placeholderTextColor={C.stone}
            multiline
          />
          <TouchableOpacity
            style={[styles.talkPostBtn, (!newPostBody.trim() || posting) && styles.talkPostBtnDisabled]}
            onPress={onPost}
            disabled={!newPostBody.trim() || posting}
          >
            {posting ? (
              <ActivityIndicator size="small" color={C.canvas} />
            ) : (
              <Text style={styles.talkPostBtnText}>Post</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
      {!posts.length ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>💬</Text>
          <Text style={styles.emptyTitle}>No community posts yet</Text>
          <Text style={styles.emptyBody}>Be the first to start a conversation!</Text>
        </View>
      ) : (
        posts.map((post: ChopTalkPost) => (
          <View key={post.id} style={styles.talkPost}>
            <View style={styles.talkPostHeader}>
              <Text style={styles.talkAuthor}>{post.user_name ?? 'Customer'}</Text>
              <Text style={styles.talkTime}>{relativeTime(post.created_at)}</Text>
            </View>
            <Text style={styles.talkBody}>{post.body}</Text>
            <TouchableOpacity
              style={styles.talkReplyBtn}
              onPress={() => {
                setExpandedPost(expandedPost === post.id ? null : post.id);
                if (replyingTo !== post.id) setReplyingTo(null);
              }}
            >
              <Text style={styles.talkReplyBtnText}>
                {post.reply_count ?? 0} replies
              </Text>
            </TouchableOpacity>
            {expandedPost === post.id && (
              <View style={styles.repliesContainer}>
                {(replies[post.id] ?? []).map((r: ChopTalkReply) => (
                  <View key={r.id} style={styles.reply}>
                    <Text style={styles.replyAuthor}>{r.user_name ?? 'User'}</Text>
                    <Text style={styles.replyBody}>{r.body}</Text>
                  </View>
                ))}
                {isAuthenticated && (
                  <View style={styles.replyComposer}>
                    <TextInput
                      style={styles.replyInput}
                      value={replyingTo === post.id ? replyBody : ''}
                      onChangeText={text => { setReplyingTo(post.id); setReplyBody(text); }}
                      placeholder="Write a reply..."
                      placeholderTextColor={C.stone}
                    />
                    <TouchableOpacity
                      style={styles.replySendBtn}
                      onPress={() => onReply(post.id)}
                      disabled={!replyBody.trim() || replyingTo !== post.id}
                    >
                      <Ionicons name="send" size={16} color={C.spice} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </View>
        ))
      )}
    </View>
  );
}

function ReviewsTab({ reviews, cook, C, styles }: any) {
  return (
    <View style={{ gap: Spacing.md }}>
      {cook.average_rating > 0 && (
        <View style={styles.ratingBanner}>
          <Text style={styles.ratingBig}>{cook.average_rating.toFixed(1)}</Text>
          <View>
            <Text style={styles.ratingStars}>
              {'★'.repeat(Math.round(cook.average_rating))}{'☆'.repeat(5 - Math.round(cook.average_rating))}
            </Text>
            <Text style={styles.ratingCount}>{cook.total_reviews ?? reviews.length} reviews</Text>
          </View>
        </View>
      )}
      {!reviews.length ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>⭐</Text>
          <Text style={styles.emptyTitle}>No reviews yet</Text>
        </View>
      ) : (
        reviews.map((r: Review) => (
          <View key={r.id} style={styles.reviewCard}>
            <View style={styles.reviewHeader}>
              <Text style={styles.reviewAuthor}>{r.customer_name ?? 'Customer'}</Text>
              <Text style={styles.reviewStars}>{'★'.repeat(r.rating)}</Text>
            </View>
            {r.comment && <Text style={styles.reviewComment}>{r.comment}</Text>}
            <Text style={styles.reviewTime}>{relativeTime(r.created_at)}</Text>
            {r.cook_reply && (
              <View style={styles.cookReply}>
                <Text style={styles.cookReplyLabel}>Chef's reply</Text>
                <Text style={styles.cookReplyText}>{r.cook_reply}</Text>
              </View>
            )}
          </View>
        ))
      )}
    </View>
  );
}

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    header: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    },
    headerBtn: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: C.bgCard, ...Shadow.card,
      alignItems: 'center', justifyContent: 'center',
    },
    heroSection: {
      flexDirection: 'row', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm,
    },
    storyRing: { borderWidth: 3, borderColor: C.spice, borderRadius: 44 },
    heroInfo: { flex: 1, gap: 4 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    cookName: { fontFamily: Fonts.serif, fontSize: FontSize.xl, color: C.ink },
    locationRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    locationText: { fontFamily: Fonts.sans, fontSize: FontSize.sm, color: C.bodySoft },
    statsRow: { flexDirection: 'row', gap: Spacing.md, marginTop: 4 },
    stat: { alignItems: 'center' },
    statValue: { fontFamily: Fonts.sansMedium, fontSize: FontSize.md, color: C.ink },
    statLabel: { fontFamily: Fonts.sans, fontSize: FontSize.xs, color: C.bodySoft },
    bio: {
      fontFamily: Fonts.sans, fontSize: FontSize.body, color: C.body,
      lineHeight: 22, paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm,
    },
    ctaRow: {
      flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md, flexWrap: 'wrap',
    },
    followBtn: {
      flex: 1, backgroundColor: C.ink, borderRadius: Radius.full,
      paddingVertical: 10, alignItems: 'center', justifyContent: 'center',
    },
    followingBtn: { backgroundColor: C.canvas, borderWidth: 1.5, borderColor: C.spice },
    followBtnText: { fontFamily: Fonts.sansMedium, fontSize: FontSize.md, color: C.canvas },
    followingBtnText: { color: C.spice },
    hireBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: C.spice, borderRadius: Radius.full,
      paddingHorizontal: Spacing.md, paddingVertical: 10,
    },
    hireBtnText: { fontFamily: Fonts.sansMedium, fontSize: FontSize.sm, color: C.canvas },
    cateringBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: C.honey, borderRadius: Radius.full,
      paddingHorizontal: Spacing.md, paddingVertical: 10,
    },
    cateringBtnText: { fontFamily: Fonts.sansMedium, fontSize: FontSize.sm, color: C.spice },
    badgeRow: { marginTop: Spacing.md },
    badge: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      backgroundColor: C.successBg, borderRadius: Radius.full,
      paddingHorizontal: 10, paddingVertical: 5, marginRight: 8,
    },
    badgeText: { fontFamily: Fonts.sansMedium, fontSize: FontSize.xs, color: C.successFg },
    tabBar: { backgroundColor: C.bg },
    tabBarContent: { paddingHorizontal: Spacing.lg, paddingVertical: 12, gap: 4 },
    tabItem: {
      paddingHorizontal: 14, paddingVertical: 7,
      borderRadius: Radius.full, marginRight: 4,
    },
    tabItemActive: { backgroundColor: C.ink },
    tabLabel: { fontFamily: Fonts.sansMedium, fontSize: FontSize.sm, color: C.bodySoft },
    tabLabelActive: { color: C.canvas },
    tabContent: { padding: Spacing.lg, paddingTop: Spacing.md },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
    dishCard: {
      width: '47%', backgroundColor: C.bgCard, borderRadius: Radius.lg, overflow: 'hidden', ...Shadow.card,
    },
    dishCardUnavailable: { opacity: 0.5 },
    dishPhoto: { width: '100%', height: 120 },
    dishInfo: { padding: Spacing.sm },
    dishName: { fontFamily: Fonts.sansMedium, fontSize: FontSize.sm, color: C.ink, marginBottom: 3 },
    dishPrice: { fontFamily: Fonts.sansMedium, fontSize: FontSize.md, color: C.spice },
    labelRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 3, marginTop: 4 },
    dietLabel: { backgroundColor: C.healthBg, borderRadius: Radius.full, paddingHorizontal: 6, paddingVertical: 2 },
    dietLabelText: { fontFamily: Fonts.sans, fontSize: FontSize.xs, color: C.healthFg },
    unavailableTag: { fontFamily: Fonts.sans, fontSize: FontSize.xs, color: C.errorFg, marginTop: 4 },
    weeklyCard: {
      backgroundColor: C.bgCard, borderRadius: Radius.lg, padding: Spacing.md, ...Shadow.card,
    },
    weeklyTitle: { fontFamily: Fonts.sansMedium, fontSize: FontSize.lg, color: C.ink, marginBottom: 4 },
    weeklyDesc: { fontFamily: Fonts.sans, fontSize: FontSize.sm, color: C.body, marginBottom: Spacing.sm },
    weeklyItem: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
      paddingVertical: 8, borderTopWidth: 1, borderTopColor: C.borderWarm,
    },
    weeklyItemLeft: { flex: 1, marginRight: Spacing.sm },
    weeklyItemDay: { fontFamily: Fonts.sans, fontSize: FontSize.xs, color: C.caps, textTransform: 'uppercase', letterSpacing: 0.8 },
    weeklyItemName: { fontFamily: Fonts.sansMedium, fontSize: FontSize.body, color: C.ink },
    weeklyItemDesc: { fontFamily: Fonts.sans, fontSize: FontSize.sm, color: C.bodySoft },
    weeklyItemPrice: { fontFamily: Fonts.sansMedium, fontSize: FontSize.body, color: C.spice },
    serviceCard: {
      flexDirection: 'row', gap: Spacing.md,
      backgroundColor: C.bgCard, borderRadius: Radius.lg, padding: Spacing.md, ...Shadow.card,
    },
    serviceIcon: {
      width: 48, height: 48, borderRadius: 24,
      backgroundColor: C.honey, alignItems: 'center', justifyContent: 'center',
    },
    serviceBody: { flex: 1 },
    serviceTitle: { fontFamily: Fonts.sansMedium, fontSize: FontSize.lg, color: C.ink, marginBottom: 4 },
    serviceDesc: { fontFamily: Fonts.sans, fontSize: FontSize.sm, color: C.body, lineHeight: 20 },
    serviceRegions: { fontFamily: Fonts.sans, fontSize: FontSize.xs, color: C.bodySoft, marginTop: 4 },
    serviceActionBtn: {
      backgroundColor: C.spice, borderRadius: Radius.full,
      paddingHorizontal: Spacing.md, paddingVertical: 8,
      alignSelf: 'flex-start', marginTop: Spacing.sm,
    },
    serviceActionText: { fontFamily: Fonts.sansMedium, fontSize: FontSize.sm, color: C.canvas },
    productCard: {
      width: '47%', backgroundColor: C.bgCard, borderRadius: Radius.lg, overflow: 'hidden', ...Shadow.card,
    },
    productCover: { width: '100%', height: 130 },
    productCoverPlaceholder: { backgroundColor: C.bgCook, alignItems: 'center', justifyContent: 'center' },
    productInfo: { padding: Spacing.sm },
    productTypeBadge: {
      backgroundColor: C.honey, borderRadius: Radius.full,
      paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start', marginBottom: 4,
    },
    productTypeText: { fontFamily: Fonts.sans, fontSize: FontSize.xs, color: C.spice },
    productTitle: { fontFamily: Fonts.sansMedium, fontSize: FontSize.sm, color: C.ink },
    productPrice: { fontFamily: Fonts.sansMedium, fontSize: FontSize.md, color: C.spice, marginTop: 4 },
    courseCard: {
      backgroundColor: C.bgCard, borderRadius: Radius.lg, overflow: 'hidden', ...Shadow.card,
    },
    courseCover: { width: '100%', height: 140 },
    courseInfo: { padding: Spacing.md },
    courseRow: { flexDirection: 'row', gap: 6, marginBottom: 6 },
    diffBadge: { backgroundColor: C.infoBg, borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3 },
    diffText: { fontFamily: Fonts.sans, fontSize: FontSize.xs, color: C.infoFg },
    freeBadge: { backgroundColor: C.successBg, borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3 },
    freeText: { fontFamily: Fonts.sans, fontSize: FontSize.xs, color: C.successFg },
    courseTitle: { fontFamily: Fonts.sansMedium, fontSize: FontSize.lg, color: C.ink, marginBottom: 4 },
    courseDesc: { fontFamily: Fonts.sans, fontSize: FontSize.sm, color: C.body, lineHeight: 20, marginBottom: 8 },
    courseMeta: { flexDirection: 'row', gap: Spacing.md, marginBottom: 6 },
    courseMetaText: { fontFamily: Fonts.sans, fontSize: FontSize.sm, color: C.bodySoft },
    coursePrice: { fontFamily: Fonts.sansMedium, fontSize: FontSize.md, color: C.spice },
    talkComposer: {
      backgroundColor: C.bgCard, borderRadius: Radius.lg, padding: Spacing.md,
      flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-end', ...Shadow.card,
    },
    talkInput: {
      flex: 1, fontFamily: Fonts.sans, fontSize: FontSize.body, color: C.ink,
      maxHeight: 100, paddingVertical: 0,
    },
    talkPostBtn: {
      backgroundColor: C.spice, borderRadius: Radius.full,
      paddingHorizontal: Spacing.md, paddingVertical: 8,
    },
    talkPostBtnDisabled: { opacity: 0.4 },
    talkPostBtnText: { fontFamily: Fonts.sansMedium, fontSize: FontSize.sm, color: C.canvas },
    talkPost: {
      backgroundColor: C.bgCard, borderRadius: Radius.lg, padding: Spacing.md, ...Shadow.card,
    },
    talkPostHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    talkAuthor: { fontFamily: Fonts.sansMedium, fontSize: FontSize.sm, color: C.ink },
    talkTime: { fontFamily: Fonts.sans, fontSize: FontSize.xs, color: C.bodySoft },
    talkBody: { fontFamily: Fonts.sans, fontSize: FontSize.body, color: C.body, lineHeight: 22 },
    talkReplyBtn: { marginTop: 8 },
    talkReplyBtnText: { fontFamily: Fonts.sansMedium, fontSize: FontSize.sm, color: C.spice },
    repliesContainer: { marginTop: Spacing.sm, gap: Spacing.sm },
    reply: {
      backgroundColor: C.bgCook, borderRadius: Radius.md,
      padding: Spacing.sm, borderLeftWidth: 3, borderLeftColor: C.spice,
    },
    replyAuthor: { fontFamily: Fonts.sansMedium, fontSize: FontSize.xs, color: C.bodySoft },
    replyBody: { fontFamily: Fonts.sans, fontSize: FontSize.sm, color: C.body, marginTop: 2 },
    replyComposer: {
      flexDirection: 'row', gap: 8, alignItems: 'center',
      backgroundColor: C.bgCook, borderRadius: Radius.md, paddingHorizontal: Spacing.sm,
    },
    replyInput: {
      flex: 1, fontFamily: Fonts.sans, fontSize: FontSize.sm, color: C.ink,
      paddingVertical: 8,
    },
    replySendBtn: { padding: 8 },
    ratingBanner: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.lg,
      backgroundColor: C.honey, borderRadius: Radius.lg, padding: Spacing.md,
    },
    ratingBig: { fontFamily: Fonts.serif, fontSize: FontSize.xxl, color: C.spice },
    ratingStars: { fontSize: FontSize.lg, color: C.ember },
    ratingCount: { fontFamily: Fonts.sans, fontSize: FontSize.sm, color: C.body },
    reviewCard: {
      backgroundColor: C.bgCard, borderRadius: Radius.lg, padding: Spacing.md, ...Shadow.card,
    },
    reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    reviewAuthor: { fontFamily: Fonts.sansMedium, fontSize: FontSize.sm, color: C.ink },
    reviewStars: { fontSize: FontSize.sm, color: C.ember },
    reviewComment: { fontFamily: Fonts.sans, fontSize: FontSize.body, color: C.body, lineHeight: 22 },
    reviewTime: { fontFamily: Fonts.sans, fontSize: FontSize.xs, color: C.bodySoft, marginTop: 4 },
    cookReply: {
      backgroundColor: C.bgCook, borderRadius: Radius.md,
      padding: Spacing.sm, marginTop: 8,
    },
    cookReplyLabel: { fontFamily: Fonts.sansMedium, fontSize: FontSize.xs, color: C.spice, marginBottom: 2 },
    cookReplyText: { fontFamily: Fonts.sans, fontSize: FontSize.sm, color: C.body },
    emptyState: { alignItems: 'center', paddingVertical: Spacing.xxl },
    emptyIcon: { fontSize: 40, marginBottom: Spacing.sm },
    emptyTitle: { fontFamily: Fonts.sansMedium, fontSize: FontSize.lg, color: C.ink },
    emptyBody: { fontFamily: Fonts.sans, fontSize: FontSize.body, color: C.bodySoft, textAlign: 'center', marginTop: 4 },
    errorState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    errorText: { fontFamily: Fonts.sans, fontSize: FontSize.lg, color: C.body },
    backBtn: { marginTop: Spacing.md },
    backBtnText: { fontFamily: Fonts.sansMedium, fontSize: FontSize.body, color: C.spice },
    galleryOverlay: {
      flex: 1, backgroundColor: 'rgba(0,0,0,0.9)',
      alignItems: 'center', justifyContent: 'center',
    },
    galleryImage: { width: '100%', height: '80%' },
  });
}
