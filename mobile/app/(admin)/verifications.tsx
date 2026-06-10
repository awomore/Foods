import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, FlatList, Image, TextInput, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api/client';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { Fonts, Spacing, Radius, Shadow, FontSize } from '../../src/constants/theme';
import { relativeTime } from '../../src/utils/format';
import { useFeedback } from '../../src/components/feedback';
import { Bone } from '../../src/components/ui/Skeleton';

interface Submission {
  id: string;
  cook_id: string;
  type: string;
  title: string;
  document_url: string;
  status: string;
  submitted_at: string;
  review_notes: string | null;
  cook_name: string;
  cook_avatar: string | null;
}

export default function AdminVerificationsScreen() {
  const router = useRouter();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const feedback = useFeedback();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<Submission | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [actioning, setActioning] = useState(false);

  const load = useCallback((isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    api.get<{ submissions: Submission[] }>('/admin/verifications?status=pending')
      .then(res => setSubmissions(res.submissions ?? []))
      .catch(() => {})
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  const approve = async () => {
    if (!selected) return;
    setActioning(true);
    try {
      await api.patch(`/admin/verifications/${selected.id}/approve`, { review_notes: reviewNotes });
      feedback.toast({ type: 'success', message: 'Verification approved' });
      setSelected(null);
      setReviewNotes('');
      load();
    } catch {
      feedback.toast({ type: 'error', message: 'Failed to approve' });
    } finally { setActioning(false); }
  };

  const reject = async () => {
    if (!selected || !reviewNotes.trim()) {
      feedback.toast({ type: 'error', message: 'Provide rejection reason' });
      return;
    }
    setActioning(true);
    try {
      await api.patch(`/admin/verifications/${selected.id}/reject`, { review_notes: reviewNotes });
      feedback.toast({ type: 'success', message: 'Verification rejected' });
      setSelected(null);
      setReviewNotes('');
      load();
    } catch {
      feedback.toast({ type: 'error', message: 'Failed to reject' });
    } finally { setActioning(false); }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <Text style={styles.title}>Verification Queue</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={{ flex: 1, padding: Spacing.lg, gap: 12 }}>
          <Bone width="100%" height={100} radius={12} />
          <Bone width="100%" height={100} radius={12} />
          <Bone width="100%" height={100} radius={12} />
        </View>
      ) : (
        <FlatList
          data={submissions}
          keyExtractor={s => s.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} />}
          ListEmptyComponent={<View style={styles.empty}><Ionicons name="shield-checkmark-outline" size={40} color={C.stone} /><Text style={styles.emptyText}>No pending verifications</Text></View>}
          renderItem={({ item: s }) => (
            <TouchableOpacity style={styles.card} onPress={() => { setSelected(s); setReviewNotes(''); }}>
              <View style={styles.cardHeader}>
                <View style={styles.cookInfo}>
                  {s.cook_avatar ? (
                    <Image source={{ uri: s.cook_avatar }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, styles.avatarPlaceholder]}>
                      <Ionicons name="person" size={18} color={C.stone} />
                    </View>
                  )}
                  <View>
                    <Text style={styles.cookName}>{s.cook_name}</Text>
                    <Text style={styles.subType}>{s.type.replace(/_/g,' ')}</Text>
                  </View>
                </View>
                <Text style={styles.time}>{relativeTime(s.submitted_at)}</Text>
              </View>
              {s.title && <Text style={styles.certTitle}>{s.title}</Text>}
              {s.document_url && (
                <Image source={{ uri: s.document_url }} style={styles.docPreview} resizeMode="cover" />
              )}
              {selected?.id === s.id && (
                <View style={styles.actionPanel}>
                  <TextInput
                    style={styles.notesInput}
                    value={reviewNotes}
                    onChangeText={setReviewNotes}
                    placeholder="Review notes (required for rejection)"
                    placeholderTextColor={C.stone}
                    multiline
                  />
                  <View style={styles.actionBtns}>
                    <TouchableOpacity style={styles.rejectBtn} onPress={reject} disabled={actioning}>
                      {actioning ? <ActivityIndicator size="small" color={C.errorFg} /> : <Text style={styles.rejectBtnText}>Reject</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.approveBtn} onPress={approve} disabled={actioning}>
                      {actioning ? <ActivityIndicator size="small" color={C.canvas} /> : <Text style={styles.approveBtnText}>Approve</Text>}
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: C.borderWarm },
    backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    title: { fontFamily: Fonts.sansMedium, fontSize: FontSize.lg, color: C.ink },
    loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    list: { padding: Spacing.lg, gap: Spacing.md },
    empty: { alignItems: 'center', paddingVertical: 60, gap: Spacing.md },
    emptyText: { fontFamily: Fonts.sans, fontSize: FontSize.body, color: C.bodySoft },
    card: { backgroundColor: C.bgCard, borderRadius: Radius.lg, padding: Spacing.md, ...Shadow.card, gap: Spacing.sm },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    cookInfo: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    avatar: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden' },
    avatarPlaceholder: { backgroundColor: C.bgCook, alignItems: 'center', justifyContent: 'center' },
    cookName: { fontFamily: Fonts.sansMedium, fontSize: FontSize.body, color: C.ink },
    subType: { fontFamily: Fonts.sans, fontSize: FontSize.sm, color: C.spice },
    time: { fontFamily: Fonts.sans, fontSize: FontSize.xs, color: C.bodySoft },
    certTitle: { fontFamily: Fonts.sansMedium, fontSize: FontSize.sm, color: C.body },
    docPreview: { width: '100%', height: 160, borderRadius: Radius.md, backgroundColor: C.bgCook },
    actionPanel: { gap: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: C.borderWarm },
    notesInput: { backgroundColor: C.bg, borderRadius: Radius.md, borderWidth: 1, borderColor: C.borderWarm, padding: Spacing.sm, fontFamily: Fonts.sans, fontSize: FontSize.sm, color: C.ink, minHeight: 70 },
    actionBtns: { flexDirection: 'row', gap: Spacing.sm },
    rejectBtn: { flex: 1, borderWidth: 1.5, borderColor: C.errorFg, borderRadius: Radius.full, paddingVertical: 10, alignItems: 'center' },
    rejectBtnText: { fontFamily: Fonts.sansMedium, fontSize: FontSize.sm, color: C.errorFg },
    approveBtn: { flex: 1, backgroundColor: C.leaf, borderRadius: Radius.full, paddingVertical: 10, alignItems: 'center' },
    approveBtnText: { fontFamily: Fonts.sansMedium, fontSize: FontSize.sm, color: C.canvas },
  });
}
