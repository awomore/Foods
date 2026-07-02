import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, TextInput, RefreshControl, Modal, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { reviewsApi, type Review, type ReviewAnalytics } from '../../src/api/reviews';
import { Fonts, Spacing, Radius, Shadow } from '../../src/constants/theme';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { useFeedback } from '../../src/components/feedback';
import { relativeTime } from '../../src/utils/format';
import Avatar from '../../src/components/ui/Avatar';
import { Bone } from '../../src/components/ui/Skeleton';
import { useTranslation } from 'react-i18next';

const STAR_FILTERS = [0, 5, 4, 3, 2, 1];

export default function ReviewCenterScreen() {
  const router = useRouter();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const feedback = useFeedback();
  const { t } = useTranslation();

  const [reviews, setReviews] = useState<Review[]>([]);
  const [analytics, setAnalytics] = useState<ReviewAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [starFilter, setStarFilter] = useState(0);
  const [replyModal, setReplyModal] = useState<{ review: Review } | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);
  const [reportModal, setReportModal] = useState<{ review: Review } | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [reporting, setReporting] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { reviews: r, analytics: a } = await reviewsApi.mine({
        limit: 50,
        rating: starFilter > 0 ? starFilter : undefined,
      });
      setReviews(r);
      setAnalytics(a);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, [starFilter]);

  useEffect(() => { load(); }, [load]);

  async function submitReply() {
    if (!replyModal || !replyText.trim()) return;
    setReplying(true);
    try {
      const { review } = await reviewsApi.reply(replyModal.review.id, replyText.trim());
      setReviews(prev => prev.map(r => r.id === review.id ? review : r));
      setReplyModal(null);
      setReplyText('');
      feedback.success(t('cook_reviews.replied'), t('cook_reviews.replied_body'));
    } catch (e: any) {
      feedback.error(t('common.error'), e?.error ?? t('cook_reviews.reply_error'));
    }
    setReplying(false);
  }

  async function submitReport() {
    if (!reportModal || !reportReason.trim()) return;
    setReporting(true);
    try {
      await reviewsApi.report(reportModal.review.id, reportReason.trim());
      setReportModal(null);
      setReportReason('');
      feedback.success(t('cook_reviews.reported'), t('cook_reviews.reported_body'));
    } catch (e: any) {
      feedback.error(t('common.error'), e?.error ?? t('cook_reviews.report_error'));
    }
    setReporting(false);
  }

  if (loading) {
    return (
      <View style={styles.root}>
        <SafeAreaView style={{ flex: 1, padding: Spacing.lg, gap: 12 }}>
          <Bone width="50%" height={22} radius={6} />
          <Bone width="100%" height={80} radius={14} />
          <Bone width="100%" height={80} radius={14} />
          <Bone width="100%" height={80} radius={14} />
          <Bone width="100%" height={80} radius={14} />
        </SafeAreaView>
      </View>
    );
  }

  const replyRate = analytics && analytics.total_reviews > 0
    ? Math.round((analytics.replied_count / analytics.total_reviews) * 100)
    : 0;

  return (
    <View style={styles.root}>
      <SafeAreaView>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={C.textInk} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('cook_profile.review_centre')}</Text>
        </View>
      </SafeAreaView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: 16, paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={C.spice} />}
      >
        {/* Analytics summary */}
        {analytics && (
          <View style={{ paddingHorizontal: Spacing.lg }}>
            <View style={styles.analyticsCard}>
              <View style={styles.ratingBig}>
                <Text style={styles.ratingNum}>{Number(analytics.avg_rating).toFixed(1)}</Text>
                <View style={{ flexDirection: 'row', gap: 2, marginTop: 4 }}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Ionicons key={i} name={i < Math.round(Number(analytics.avg_rating)) ? 'star' : 'star-outline'} size={14} color={C.spice} />
                  ))}
                </View>
                <Text style={styles.ratingTotal}>{t('cook_reviews.reviews_count', { count: analytics.total_reviews })}</Text>
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                {[5, 4, 3, 2, 1].map(star => {
                  const count = analytics[`${['one','two','three','four','five'][star - 1]}_star` as keyof ReviewAnalytics] as number ?? 0;
                  const pct = analytics.total_reviews > 0 ? (count / analytics.total_reviews) * 100 : 0;
                  return (
                    <View key={star} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.barLabel}>{star}</Text>
                      <View style={styles.barBg}>
                        <View style={[styles.barFill, { width: `${pct}%` }]} />
                      </View>
                      <Text style={styles.barCount}>{count}</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            <View style={styles.metaStrip}>
              <View style={styles.metaCell}>
                <Text style={styles.metaNum}>{replyRate}%</Text>
                <Text style={styles.metaLabel}>{t('cook_reviews.reply_rate')}</Text>
              </View>
              <View style={[styles.metaCell, styles.metaCellBorder]}>
                <Text style={styles.metaNum}>{analytics.replied_count}</Text>
                <Text style={styles.metaLabel}>{t('cook_reviews.replied_label')}</Text>
              </View>
              <View style={styles.metaCell}>
                <Text style={[styles.metaNum, analytics.reported_count > 0 ? { color: C.errorFg } : {}]}>
                  {analytics.reported_count}
                </Text>
                <Text style={styles.metaLabel}>{t('cook_reviews.reported_label')}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Star filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: Spacing.lg, gap: 8 }}>
          {STAR_FILTERS.map(s => (
            <TouchableOpacity
              key={s}
              onPress={() => setStarFilter(s)}
              style={[styles.filterChip, starFilter === s && styles.filterChipActive]}
            >
              {s > 0 && <Ionicons name="star" size={12} color={starFilter === s ? C.canvas : C.spice} />}
              <Text style={[styles.filterChipText, starFilter === s && styles.filterChipTextActive]}>
                {s === 0 ? t('cook_reviews.filter_all') : t('cook_reviews.filter_star', { count: s })}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Reviews list */}
        <View style={{ paddingHorizontal: Spacing.lg, gap: 12 }}>
          {reviews.length === 0 && (
            <View style={{ alignItems: 'center', paddingVertical: 40, paddingHorizontal: Spacing.lg, gap: 10 }}>
              <Ionicons name="star-outline" size={36} color={C.stone} />
              <Text style={{ fontFamily: Fonts.serif, fontSize: 18, color: C.textInk }}>
                {starFilter > 0 ? t('cook_reviews.no_reviews_star', { count: starFilter }) : t('cook_reviews.no_reviews_yet')}
              </Text>
              {starFilter === 0 && (
                <>
                  <Text style={{ fontFamily: Fonts.sans, fontSize: 13, color: C.bodySoft, textAlign: 'center', lineHeight: 20 }}>
                    {t('cook_reviews.share_hint')}
                  </Text>
                  <TouchableOpacity
                    onPress={() => Share.share({ message: t('cook_reviews.share_order_message') }).catch(() => {})}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 40, backgroundColor: C.spice }}
                  >
                    <Ionicons name="share-outline" size={16} color={C.canvas} />
                    <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 14, color: C.canvas }}>{t('cook_reviews.share_profile')}</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}

          {reviews.map(review => (
            <View key={review.id} style={styles.reviewCard}>
              <View style={styles.reviewHeader}>
                <Avatar name={(review.customer_name ?? '?').charAt(0)} avatarBg={C.ember} size={32} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.reviewerName}>{review.customer_name ?? t('cook_profile.customer_fallback')}</Text>
                  {review.dish_title && (
                    <Text style={styles.reviewDish}>{review.dish_title}</Text>
                  )}
                </View>
                <View>
                  <View style={{ flexDirection: 'row', gap: 2, marginBottom: 2 }}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Ionicons key={i} name={i < review.rating ? 'star' : 'star-outline'} size={12} color={C.spice} />
                    ))}
                  </View>
                  <Text style={styles.reviewDate}>{relativeTime(review.created_at)}</Text>
                </View>
              </View>

              {review.body && <Text style={styles.reviewBody}>{review.body}</Text>}

              {review.cook_reply && (
                <View style={styles.replyBox}>
                  <Text style={styles.replyLabel}>{t('cook_profile.your_reply')}</Text>
                  <Text style={styles.replyText}>{review.cook_reply}</Text>
                </View>
              )}

              <View style={styles.reviewActions}>
                {!review.cook_reply && (
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => { setReplyModal({ review }); setReplyText(''); }}
                  >
                    <Ionicons name="chatbubble-outline" size={14} color={C.spice} />
                    <Text style={styles.actionBtnText}>{t('cook_reviews.reply')}</Text>
                  </TouchableOpacity>
                )}
                {!review.reported && (
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: C.errorBg }]}
                    onPress={() => { setReportModal({ review }); setReportReason(''); }}
                  >
                    <Ionicons name="flag-outline" size={14} color={C.errorFg} />
                    <Text style={[styles.actionBtnText, { color: C.errorFg }]}>{t('cook_reviews.report')}</Text>
                  </TouchableOpacity>
                )}
                {review.reported && (
                  <View style={[styles.actionBtn, { backgroundColor: C.stone + '22' }]}>
                    <Ionicons name="flag" size={14} color={C.bodySoft} />
                    <Text style={[styles.actionBtnText, { color: C.bodySoft }]}>{t('cook_reviews.reported_label')}</Text>
                  </View>
                )}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Reply modal */}
      <Modal visible={!!replyModal} transparent animationType="slide" onRequestClose={() => setReplyModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{t('cook_reviews.reply_to_review')}</Text>
            {replyModal?.review.body && (
              <View style={styles.quoteBox}>
                <Text style={styles.quoteText} numberOfLines={2}>{replyModal.review.body}</Text>
              </View>
            )}
            <TextInput
              style={styles.replyInput}
              value={replyText}
              onChangeText={setReplyText}
              placeholder={t('cook_reviews.reply_placeholder')}
              placeholderTextColor={C.stone}
              multiline
              autoFocus
              maxLength={500}
            />
            <TouchableOpacity
              style={[styles.submitBtn, (!replyText.trim() || replying) && { opacity: 0.5 }]}
              onPress={submitReply}
              disabled={!replyText.trim() || replying}
            >
              {replying ? <ActivityIndicator color={C.canvas} /> : <Text style={styles.submitBtnText}>{t('cook_reviews.post_reply')}</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setReplyModal(null)}>
              <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Report modal */}
      <Modal visible={!!reportModal} transparent animationType="slide" onRequestClose={() => setReportModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{t('cook_reviews.report_review')}</Text>
            <Text style={styles.modalSub}>{t('cook_reviews.report_why')}</Text>
            {[
              t('cook_reviews.reason_abusive'),
              t('cook_reviews.reason_fake'),
              t('cook_reviews.reason_irrelevant'),
              t('cook_reviews.reason_incorrect'),
            ].map(reason => (
              <TouchableOpacity
                key={reason}
                onPress={() => setReportReason(reason)}
                style={[styles.reasonOption, reportReason === reason && styles.reasonOptionActive]}
              >
                {reportReason === reason
                  ? <Ionicons name="radio-button-on" size={18} color={C.spice} />
                  : <Ionicons name="radio-button-off" size={18} color={C.stone} />}
                <Text style={[styles.reasonText, reportReason === reason && { color: C.spice }]}>{reason}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: C.errorFg }, (!reportReason || reporting) && { opacity: 0.5 }]}
              onPress={submitReport}
              disabled={!reportReason || reporting}
            >
              {reporting ? <ActivityIndicator color={C.canvas} /> : <Text style={styles.submitBtnText}>{t('cook_reviews.flag_review')}</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setReportModal(null)}>
              <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function makeStyles(C: AppColors) { return StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingTop: 8, paddingBottom: 12, gap: 12 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.bgCook, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: Fonts.serif, fontSize: 20, color: C.textInk, flex: 1 },

  analyticsCard: {
    flexDirection: 'row', gap: 16, backgroundColor: C.bgCard,
    borderRadius: Radius.xl, padding: 16, borderWidth: 0.5, borderColor: C.borderWarm, ...Shadow.card,
  },
  ratingBig: { alignItems: 'center', justifyContent: 'center', paddingRight: 16, borderRightWidth: 0.5, borderRightColor: C.borderWarm },
  ratingNum: { fontFamily: Fonts.serif, fontSize: 40, color: C.spice },
  ratingTotal: { fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft, marginTop: 6 },
  barLabel: { fontFamily: Fonts.sansMedium, fontSize: 11, color: C.bodySoft, width: 10, textAlign: 'right' },
  barBg: { flex: 1, height: 6, backgroundColor: C.bgCook, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: C.spice, borderRadius: 3 },
  barCount: { fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft, width: 20, textAlign: 'right' },

  metaStrip: { flexDirection: 'row', backgroundColor: C.bgCard, borderRadius: Radius.lg, borderWidth: 0.5, borderColor: C.borderWarm, marginTop: 10 },
  metaCell: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  metaCellBorder: { borderLeftWidth: 0.5, borderRightWidth: 0.5, borderColor: C.borderWarm },
  metaNum: { fontFamily: Fonts.serif, fontSize: 18, color: C.textInk },
  metaLabel: { fontFamily: Fonts.sans, fontSize: 10, color: C.bodySoft, marginTop: 2 },

  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 40, backgroundColor: C.bgCard, borderWidth: 0.5, borderColor: C.borderWarm },
  filterChipActive: { backgroundColor: C.ink, borderColor: C.ink },
  filterChipText: { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.bodySoft },
  filterChipTextActive: { color: C.canvas },

  reviewCard: { backgroundColor: C.bgCard, borderRadius: Radius.lg, padding: 14, borderWidth: 0.5, borderColor: C.borderWarm, ...Shadow.card, gap: 10 },
  reviewHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  reviewerName: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.textInk },
  reviewDish: { fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft, marginTop: 2 },
  reviewDate: { fontFamily: Fonts.sans, fontSize: 10, color: C.bodySoft },
  reviewBody: { fontFamily: Fonts.sans, fontSize: 13, color: C.body, lineHeight: 20 },
  replyBox: { backgroundColor: C.honey, borderRadius: Radius.md, padding: 10 },
  replyLabel: { fontFamily: Fonts.sansMedium, fontSize: 10, color: '#5C3B16', marginBottom: 4 },
  replyText: { fontFamily: Fonts.sans, fontSize: 12, color: '#5C3B16', lineHeight: 18 },
  reviewActions: { flexDirection: 'row', gap: 8 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 40, backgroundColor: C.bgCook },
  actionBtnText: { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.spice },

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  modalSheet: { backgroundColor: C.bgCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, gap: 12 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: C.borderWarm, alignSelf: 'center', marginBottom: 8 },
  modalTitle: { fontFamily: Fonts.serif, fontSize: 20, color: C.textInk },
  modalSub: { fontFamily: Fonts.sans, fontSize: 13, color: C.bodySoft },
  quoteBox: { backgroundColor: C.bgCook, borderRadius: Radius.md, padding: 10, borderLeftWidth: 3, borderLeftColor: C.spice },
  quoteText: { fontFamily: Fonts.sans, fontSize: 13, color: C.body, fontStyle: 'italic' },
  replyInput: { backgroundColor: C.bg, borderRadius: Radius.md, borderWidth: 0.5, borderColor: C.borderWarm, padding: 12, fontFamily: Fonts.sans, fontSize: 14, color: C.textInk, minHeight: 100, textAlignVertical: 'top' },
  submitBtn: { backgroundColor: C.spice, borderRadius: Radius.lg, paddingVertical: 14, alignItems: 'center' },
  submitBtnText: { fontFamily: Fonts.sansMedium, fontSize: 15, color: C.canvas },
  cancelBtn: { alignItems: 'center', paddingVertical: 10 },
  cancelBtnText: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.bodySoft },
  reasonOption: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: C.borderWarm },
  reasonOptionActive: {},
  reasonText: { fontFamily: Fonts.sans, fontSize: 13, color: C.body, flex: 1 },
}); }
