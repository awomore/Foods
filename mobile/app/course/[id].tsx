import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, Share, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Video, ResizeMode } from 'expo-av';
import { coursesApi, type Course, type CourseLesson } from '../../src/api/courses';
import { useAuth } from '../../src/context/AuthContext';
import { useFeedback } from '../../src/components/feedback';
import { Bone } from '../../src/components/ui/Skeleton';
import { Fonts, Spacing, Radius, Shadow, FontSize } from '../../src/constants/theme';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { fmtCurrency } from '../../src/utils/format';
import Avatar from '../../src/components/ui/Avatar';
import { useTranslation } from 'react-i18next';

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner:     '#2D6A4F',
  intermediate: '#FF6B35',
  advanced:     '#9C1C1C',
};

export default function CourseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const feedback = useFeedback();
  const { t } = useTranslation();
  const videoRef = useRef<any>(null);

  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [enrolled, setEnrolled] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [progress, setProgress] = useState(0);
  const [expandedLesson, setExpandedLesson] = useState<string | null>(null);
  const [videoPlaying, setVideoPlaying] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await coursesApi.get(id!);
      setCourse(res.course);
      // Check enrollment
      if (isAuthenticated) {
        coursesApi.myProgress(id!).then(r => {
          if (r?.enrollment) {
            setEnrolled(true);
            setProgress(r.enrollment.progress ?? 0);
          }
        }).catch(() => {});
      }
    } catch {
      feedback.error(t('course.detail.load_error'));
    } finally {
      setLoading(false);
    }
  }, [id, isAuthenticated]);

  useEffect(() => { load(); }, [load]);

  const handleEnrol = async () => {
    if (!isAuthenticated) { router.push('/(auth)/phone' as any); return; }
    if (!course) return;

    if (course.is_free) {
      setEnrolling(true);
      try {
        await coursesApi.enroll(course.id, {});
        setEnrolled(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        feedback.success(t('course.detail.enrolled_title'), t('course.detail.enrolled_body'));
      } catch (e: any) {
        feedback.error(t('common.error'), e.error ?? t('course.detail.enrol_error'));
      } finally {
        setEnrolling(false);
      }
      return;
    }

    // Paid — use Flutterwave
    router.push({
      pathname: '/checkout',
      params: { mode: 'course', course_id: course.id, amount: course.price, title: course.title },
    } as any);
  };

  const handleShare = async () => {
    if (!course) return;
    const BASE = 'https://foodsbyme-production.up.railway.app';
    const url = course.slug ? `${BASE}/course/${course.slug}` : `${BASE}/course/${course.id}`;
    await Share.share({ message: t('course.detail.share_message', { title: course.title, url }), url });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, padding: Spacing.lg, gap: 14 }}>
          <Bone width="100%" height={220} radius={14} />
          <Bone width="70%" height={24} radius={6} />
          <Bone width="45%" height={16} radius={6} />
          <Bone width="100%" height={80} radius={10} />
          <Bone width="55%" height={44} radius={22} />
        </View>
      </SafeAreaView>
    );
  }

  if (!course) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingCenter}>
          <Text style={styles.errorText}>{t('course.detail.not_found')}</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>{t('common.back')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const difficultyColor = DIFFICULTY_COLORS[course.difficulty_level ?? ''] ?? C.spice;
  const freePreviews = (course.lessons ?? []).filter(l => l.is_free_preview);

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

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Cover / Promo video */}
        {course.promo_video_url ? (
          <Video
            ref={videoRef}
            source={{ uri: course.promo_video_url }}
            style={styles.promoVideo}
            useNativeControls
            resizeMode={ResizeMode.COVER}
            onPlaybackStatusUpdate={s => setVideoPlaying((s as any).isPlaying ?? false)}
          />
        ) : course.cover_image ? (
          <Image source={{ uri: course.cover_image }} style={styles.coverImage} resizeMode="cover" />
        ) : (
          <View style={[styles.coverImage, { backgroundColor: C.bgCook, alignItems: 'center', justifyContent: 'center' }]}>
            <Ionicons name="school-outline" size={60} color={C.bodySoft} />
          </View>
        )}

        <View style={styles.body}>
          {/* Badges */}
          <View style={styles.badgeRow}>
            {course.difficulty_level && (
              <View style={[styles.diffBadge, { backgroundColor: difficultyColor + '22' }]}>
                <Text style={[styles.diffText, { color: difficultyColor }]}>{course.difficulty_level}</Text>
              </View>
            )}
            {course.is_free && (
              <View style={styles.freeBadge}><Text style={styles.freeText}>{t('course.detail.free')}</Text></View>
            )}
            {course.category && (
              <View style={styles.categoryBadge}><Text style={styles.categoryText}>{course.category}</Text></View>
            )}
          </View>

          {/* Title */}
          <Text style={styles.title}>{course.title}</Text>

          {/* Stats row */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Ionicons name="play-circle-outline" size={16} color={C.spice} />
              <Text style={styles.statText}>{t('course.detail.lessons_count', { count: course.lesson_count })}</Text>
            </View>
            {course.duration_hours && (
              <View style={styles.statItem}>
                <Ionicons name="time-outline" size={16} color={C.spice} />
                <Text style={styles.statText}>{t('course.detail.hours_total', { count: course.duration_hours })}</Text>
              </View>
            )}
            {course.enrollment_count > 0 && (
              <View style={styles.statItem}>
                <Ionicons name="people-outline" size={16} color={C.spice} />
                <Text style={styles.statText}>{t('course.detail.enrolled_count', { count: course.enrollment_count })}</Text>
              </View>
            )}
            {course.rating > 0 && (
              <View style={styles.statItem}>
                <Ionicons name="star" size={14} color={C.ember} />
                <Text style={styles.statText}>{course.rating.toFixed(1)}</Text>
              </View>
            )}
          </View>

          {/* Instructor */}
          {(course.cook_name || course.cook_avatar) && (
            <TouchableOpacity
              style={styles.instructorCard}
              onPress={() => course.cook_id && router.push(`/cook/${course.cook_id}` as any)}
            >
              <Avatar name={course.cook_name ?? ''} avatarUrl={course.cook_avatar} size={44} />
              <View style={{ flex: 1 }}>
                <Text style={styles.instructorLabel}>{t('course.detail.instructor')}</Text>
                <Text style={styles.instructorName}>{course.cook_name}</Text>
                {course.cook_bio && (
                  <Text style={styles.instructorBio} numberOfLines={2}>{course.cook_bio}</Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={16} color={C.bodySoft} />
            </TouchableOpacity>
          )}

          {/* Enrolled progress bar */}
          {enrolled && (
            <View style={styles.progressCard}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressLabel}>{t('course.detail.your_progress')}</Text>
                <Text style={styles.progressPct}>{progress}%</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progress}%` }]} />
              </View>
              <Text style={styles.progressSub}>
                {progress === 100 ? t('course.detail.course_completed') : t('course.detail.lessons_done', { done: Math.round((progress / 100) * course.lesson_count), total: course.lesson_count })}
              </Text>
            </View>
          )}

          {/* Description */}
          {course.description && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('course.detail.about_course')}</Text>
              <Text style={styles.description}>{course.description}</Text>
            </View>
          )}

          {/* Tags */}
          {course.tags?.length > 0 && (
            <View style={styles.tagsRow}>
              {course.tags.map(t => (
                <View key={t} style={styles.tag}><Text style={styles.tagText}>{t}</Text></View>
              ))}
            </View>
          )}

          {/* Free previews notice */}
          {!enrolled && freePreviews.length > 0 && (
            <View style={styles.previewNotice}>
              <Ionicons name="eye-outline" size={16} color={C.spice} />
              <Text style={styles.previewNoticeText}>
                {t('course.detail.free_previews_available', { count: freePreviews.length })}
              </Text>
            </View>
          )}

          {/* Lessons */}
          {(course.lessons ?? []).length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {t('course.detail.lessons_header', { count: course.lesson_count })}
              </Text>
              {(course.lessons ?? []).map((lesson, i) => {
                const accessible = enrolled || lesson.is_free_preview;
                const isExpanded = expandedLesson === lesson.id;
                return (
                  <TouchableOpacity
                    key={lesson.id}
                    style={styles.lessonRow}
                    onPress={() => {
                      if (!accessible) { handleEnrol(); return; }
                      setExpandedLesson(isExpanded ? null : lesson.id);
                    }}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.lessonNum, accessible && styles.lessonNumActive]}>
                      {accessible
                        ? <Ionicons name="play" size={12} color={accessible ? C.canvas : C.bodySoft} />
                        : <Ionicons name="lock-closed" size={12} color={C.bodySoft} />
                      }
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.lessonTitle, !accessible && { color: C.bodySoft }]}>
                        {i + 1}. {lesson.title}
                      </Text>
                      {lesson.duration_minutes && (
                        <Text style={styles.lessonMeta}>{t('course.detail.duration_min', { count: lesson.duration_minutes })}</Text>
                      )}
                      {isExpanded && lesson.description && (
                        <Text style={styles.lessonDesc}>{lesson.description}</Text>
                      )}
                    </View>
                    {lesson.is_free_preview && !enrolled && (
                      <View style={styles.previewPill}><Text style={styles.previewPillText}>{t('course.detail.preview')}</Text></View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Sticky CTA */}
      <View style={styles.stickyFooter}>
        {enrolled ? (
          <View style={styles.enrolledFooter}>
            <View style={styles.enrolledBadge}>
              <Ionicons name="checkmark-circle" size={18} color={C.successFg} />
              <Text style={styles.enrolledText}>{t('course.detail.enrolled')}</Text>
            </View>
            <TouchableOpacity style={styles.continueBtn}>
              <Text style={styles.continueBtnText}>{t('course.detail.continue_learning')}</Text>
              <Ionicons name="arrow-forward" size={16} color={C.canvas} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.enrolBtn, enrolling && { opacity: 0.6 }]}
            onPress={handleEnrol}
            disabled={enrolling}
          >
            {enrolling ? <ActivityIndicator color={C.canvas} /> : (
              <>
                <Text style={styles.enrolBtnText}>
                  {course.is_free ? t('course.detail.enrol_free') : t('course.detail.enrol_price', { price: fmtCurrency(course.price, 'NGN') })}
                </Text>
                <Ionicons name="arrow-forward" size={18} color={C.canvas} />
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    errorText: { fontFamily: Fonts.sans, fontSize: FontSize.lg, color: C.body, marginBottom: 16 },
    backBtn: { backgroundColor: C.spice, borderRadius: Radius.full, paddingHorizontal: 20, paddingVertical: 10 },
    backBtnText: { fontFamily: Fonts.sansMedium, fontSize: FontSize.body, color: C.canvas },
    header: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
      position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
    },
    headerBtn: {
      width: 44, height: 44, borderRadius: 22,
      backgroundColor: C.bgCard, ...Shadow.card,
      alignItems: 'center', justifyContent: 'center',
    },
    promoVideo: { width: '100%', height: 220 },
    coverImage: { width: '100%', height: 220 },
    body: { padding: Spacing.lg, gap: Spacing.md },
    badgeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    diffBadge: { borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 5 },
    diffText: { fontFamily: Fonts.sansMedium, fontSize: FontSize.sm },
    freeBadge: { backgroundColor: C.successBg, borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 5 },
    freeText: { fontFamily: Fonts.sansMedium, fontSize: FontSize.sm, color: C.successFg },
    categoryBadge: { backgroundColor: C.bgCook, borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 0.5, borderColor: C.borderWarm },
    categoryText: { fontFamily: Fonts.sans, fontSize: FontSize.sm, color: C.bodySoft },
    title: { fontFamily: Fonts.serif, fontSize: 26, color: C.ink, lineHeight: 33 },
    statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
    statItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    statText: { fontFamily: Fonts.sans, fontSize: FontSize.sm, color: C.body },
    instructorCard: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: C.bgCard, borderRadius: Radius.lg,
      borderWidth: 0.5, borderColor: C.borderWarm,
      padding: Spacing.md, ...Shadow.card,
    },
    instructorLabel: { fontFamily: Fonts.sans, fontSize: FontSize.xs, color: C.bodySoft, textTransform: 'uppercase', letterSpacing: 0.8 },
    instructorName: { fontFamily: Fonts.sansMedium, fontSize: FontSize.body, color: C.ink },
    instructorBio: { fontFamily: Fonts.sans, fontSize: FontSize.sm, color: C.bodySoft, marginTop: 2 },
    progressCard: {
      backgroundColor: C.successBg, borderRadius: Radius.lg, padding: Spacing.md, gap: 8,
    },
    progressHeader: { flexDirection: 'row', justifyContent: 'space-between' },
    progressLabel: { fontFamily: Fonts.sansMedium, fontSize: FontSize.sm, color: C.successFg },
    progressPct: { fontFamily: Fonts.sansMedium, fontSize: FontSize.sm, color: C.successFg },
    progressTrack: { height: 6, backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: 3, overflow: 'hidden' },
    progressFill: { height: '100%', backgroundColor: C.successFg, borderRadius: 3 },
    progressSub: { fontFamily: Fonts.sans, fontSize: FontSize.xs, color: C.successFg },
    section: { gap: 12 },
    sectionTitle: { fontFamily: Fonts.sansMedium, fontSize: FontSize.lg, color: C.ink },
    description: { fontFamily: Fonts.sans, fontSize: FontSize.body, color: C.body, lineHeight: 24 },
    tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    tag: { backgroundColor: C.bgCook, borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 0.5, borderColor: C.borderWarm },
    tagText: { fontFamily: Fonts.sans, fontSize: FontSize.sm, color: C.body },
    previewNotice: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: C.honey, borderRadius: Radius.md, padding: 12,
    },
    previewNoticeText: { fontFamily: Fonts.sansMedium, fontSize: FontSize.sm, color: C.spice },
    lessonRow: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 12,
      paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: C.borderWarm,
    },
    lessonNum: {
      width: 28, height: 28, borderRadius: 14,
      backgroundColor: C.bgCook, alignItems: 'center', justifyContent: 'center',
    },
    lessonNumActive: { backgroundColor: C.spice },
    lessonTitle: { fontFamily: Fonts.sansMedium, fontSize: FontSize.body, color: C.ink },
    lessonMeta: { fontFamily: Fonts.sans, fontSize: FontSize.xs, color: C.bodySoft, marginTop: 2 },
    lessonDesc: { fontFamily: Fonts.sans, fontSize: FontSize.sm, color: C.body, lineHeight: 20, marginTop: 6 },
    previewPill: { backgroundColor: C.honey, borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3 },
    previewPillText: { fontFamily: Fonts.sansMedium, fontSize: FontSize.xs, color: C.spice },
    stickyFooter: {
      position: 'absolute', bottom: 0, left: 0, right: 0,
      backgroundColor: C.bg, borderTopWidth: 0.5, borderTopColor: C.borderWarm,
      padding: Spacing.lg, paddingBottom: 34,
    },
    enrolBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
      backgroundColor: C.ink, borderRadius: Radius.lg, paddingVertical: 16,
    },
    enrolBtnText: { fontFamily: Fonts.sansMedium, fontSize: FontSize.lg, color: C.canvas },
    enrolledFooter: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    enrolledBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: C.successBg, borderRadius: Radius.full, paddingHorizontal: 14, paddingVertical: 10,
    },
    enrolledText: { fontFamily: Fonts.sansMedium, fontSize: FontSize.sm, color: C.successFg },
    continueBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      backgroundColor: C.spice, borderRadius: Radius.lg, paddingVertical: 14,
    },
    continueBtnText: { fontFamily: Fonts.sansMedium, fontSize: FontSize.body, color: C.canvas },
  });
}
