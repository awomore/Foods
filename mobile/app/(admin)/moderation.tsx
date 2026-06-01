import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api/client';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { Fonts, Spacing, Radius, Shadow, FontSize } from '../../src/constants/theme';
import { relativeTime } from '../../src/utils/format';
import { useFeedback } from '../../src/components/feedback';

interface FlaggedReview {
  id: string;
  comment: string;
  rating: number;
  report_reason: string;
  created_at: string;
  reporter_name: string;
  cook_name: string;
  entity_type: 'review';
}

export default function ModerationScreen() {
  const router = useRouter();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const feedback = useFeedback();
  const [flaggedReviews, setFlaggedReviews] = useState<FlaggedReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    api.get<{ flagged_reviews: FlaggedReview[] }>('/admin/moderation')
      .then(res => setFlaggedReviews(res.flagged_reviews ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const dismiss = async (id: string) => {
    setActioning(id);
    try {
      await api.patch(`/admin/moderation/reviews/${id}/dismiss`, {});
      setFlaggedReviews(prev => prev.filter(r => r.id !== id));
      feedback.toast({ type: 'success', message: 'Report dismissed' });
    } catch { feedback.toast({ type: 'error', message: 'Failed' }); }
    finally { setActioning(null); }
  };

  const removeReview = async (id: string) => {
    setActioning(id);
    try {
      await api.delete(`/admin/moderation/reviews/${id}`);
      setFlaggedReviews(prev => prev.filter(r => r.id !== id));
      feedback.toast({ type: 'success', message: 'Review removed' });
    } catch { feedback.toast({ type: 'error', message: 'Failed' }); }
    finally { setActioning(null); }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <Text style={styles.title}>Moderation Queue</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.loadingState}><ActivityIndicator size="large" color={C.spice} /></View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          {!flaggedReviews.length ? (
            <View style={styles.empty}>
              <Ionicons name="checkmark-circle" size={48} color={C.leaf} />
              <Text style={styles.emptyTitle}>Queue is clear</Text>
              <Text style={styles.emptyBody}>No flagged content to review.</Text>
            </View>
          ) : (
            flaggedReviews.map(r => (
              <View key={r.id} style={styles.reviewCard}>
                <View style={styles.reviewMeta}>
                  <Text style={styles.starRating}>{'★'.repeat(r.rating)}</Text>
                  <Text style={styles.reviewTime}>{relativeTime(r.created_at)}</Text>
                </View>
                <Text style={styles.cookLabel}>on {r.cook_name}</Text>
                <Text style={styles.reviewText}>{r.comment}</Text>
                <View style={styles.flagReason}>
                  <Ionicons name="flag" size={14} color={C.errorFg} />
                  <Text style={styles.flagReasonText}>Reported: {r.report_reason}</Text>
                </View>
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={styles.dismissBtn}
                    onPress={() => dismiss(r.id)}
                    disabled={actioning === r.id}
                  >
                    <Text style={styles.dismissBtnText}>Dismiss</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.removeBtn}
                    onPress={() => removeReview(r.id)}
                    disabled={actioning === r.id}
                  >
                    {actioning === r.id ? (
                      <ActivityIndicator size="small" color={C.canvas} />
                    ) : (
                      <Text style={styles.removeBtnText}>Remove Review</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: C.borderWarm },
    backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    title: { fontFamily: Fonts.sansMedium, fontSize: FontSize.lg, color: C.ink },
    loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    content: { padding: Spacing.lg, gap: Spacing.md },
    empty: { alignItems: 'center', paddingVertical: 80, gap: Spacing.md },
    emptyTitle: { fontFamily: Fonts.sansMedium, fontSize: FontSize.xl, color: C.ink },
    emptyBody: { fontFamily: Fonts.sans, fontSize: FontSize.body, color: C.bodySoft },
    reviewCard: { backgroundColor: C.bgCard, borderRadius: Radius.lg, padding: Spacing.md, ...Shadow.card, gap: 8 },
    reviewMeta: { flexDirection: 'row', justifyContent: 'space-between' },
    starRating: { color: C.ember, fontSize: FontSize.body },
    reviewTime: { fontFamily: Fonts.sans, fontSize: FontSize.xs, color: C.bodySoft },
    cookLabel: { fontFamily: Fonts.sans, fontSize: FontSize.sm, color: C.spice },
    reviewText: { fontFamily: Fonts.sans, fontSize: FontSize.body, color: C.body, lineHeight: 22 },
    flagReason: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.errorBg, borderRadius: Radius.sm, padding: 8 },
    flagReasonText: { fontFamily: Fonts.sans, fontSize: FontSize.sm, color: C.errorFg },
    actionRow: { flexDirection: 'row', gap: Spacing.sm },
    dismissBtn: { flex: 1, borderWidth: 1, borderColor: C.borderWarm, borderRadius: Radius.full, paddingVertical: 10, alignItems: 'center' },
    dismissBtnText: { fontFamily: Fonts.sansMedium, fontSize: FontSize.sm, color: C.body },
    removeBtn: { flex: 1, backgroundColor: C.errorFg, borderRadius: Radius.full, paddingVertical: 10, alignItems: 'center' },
    removeBtnText: { fontFamily: Fonts.sansMedium, fontSize: FontSize.sm, color: C.canvas },
  });
}
