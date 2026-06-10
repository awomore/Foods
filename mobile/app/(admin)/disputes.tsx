import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api/client';
import { type Dispute } from '../../src/api/disputes';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { Fonts, Spacing, Radius, Shadow, FontSize } from '../../src/constants/theme';
import { fmtCurrency, relativeTime } from '../../src/utils/format';
import { Bone } from '../../src/components/ui/Skeleton';

const STATUS_FILTER = ['all', 'open', 'evidence_review', 'admin_review', 'resolved', 'escalated'];

export default function AdminDisputesScreen() {
  const router = useRouter();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [total, setTotal] = useState(0);

  const load = useCallback((isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    const q = statusFilter !== 'all' ? `?status=${statusFilter}` : '';
    api.get<{ disputes: Dispute[]; total: number }>(`/admin/disputes${q}`)
      .then(res => { setDisputes(res.disputes ?? []); setTotal(res.total ?? 0); })
      .catch(() => {})
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const isSlaBreached = (d: Dispute) => new Date(d.sla_deadline) < new Date();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <Text style={styles.title}>Dispute Queue ({total})</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterBar} contentContainerStyle={styles.filterContent}>
        {STATUS_FILTER.map(s => (
          <TouchableOpacity
            key={s}
            style={[styles.filterTab, statusFilter === s && styles.filterTabActive]}
            onPress={() => setStatusFilter(s)}
          >
            <Text style={[styles.filterTabText, statusFilter === s && styles.filterTabTextActive]}>
              {s === 'all' ? 'All' : s.replace('_', ' ')}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={{ flex: 1, padding: Spacing.lg, gap: 12 }}>
          <Bone width="100%" height={80} radius={12} />
          <Bone width="100%" height={80} radius={12} />
          <Bone width="100%" height={80} radius={12} />
        </View>
      ) : (
        <FlatList
          data={disputes}
          keyExtractor={d => d.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} />}
          ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyText}>No disputes found</Text></View>}
          renderItem={({ item: d }) => (
            <TouchableOpacity
              style={[styles.disputeCard, isSlaBreached(d) && d.status !== 'resolved' && styles.disputeCardSLA]}
              onPress={() => router.push({ pathname: '/dispute/status/[id]', params: { id: d.id } } as any)}
            >
              <View style={styles.disputeHeader}>
                <Text style={styles.disputeType}>{d.type.replace('_', ' ')}</Text>
                <Text style={styles.disputeTime}>{relativeTime(d.created_at)}</Text>
              </View>
              <Text style={styles.disputeReason} numberOfLines={2}>{d.reason}</Text>
              <View style={styles.disputeMeta}>
                <Text style={styles.disputeParty}>{d.customer_name} vs {d.cook_name}</Text>
                {d.order_total && <Text style={styles.disputeAmount}>{fmtCurrency(d.order_total, 'NGN')}</Text>}
              </View>
              <View style={styles.disputeFooter}>
                <View style={[styles.statusPill, { backgroundColor: d.status === 'resolved' ? C.successBg : d.status === 'escalated' ? C.errorBg : C.warnBg }]}>
                  <Text style={[styles.statusPillText, { color: d.status === 'resolved' ? C.successFg : d.status === 'escalated' ? C.errorFg : C.warnFg }]}>
                    {d.status}
                  </Text>
                </View>
                {isSlaBreached(d) && d.status !== 'resolved' && (
                  <View style={styles.slaBreach}>
                    <Ionicons name="time" size={12} color={C.errorFg} />
                    <Text style={styles.slaBreachText}>SLA BREACHED</Text>
                  </View>
                )}
              </View>
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
    filterBar: { maxHeight: 48, borderBottomWidth: 1, borderBottomColor: C.borderWarm },
    filterContent: { paddingHorizontal: Spacing.lg, gap: 8, alignItems: 'center' },
    filterTab: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.full, borderWidth: 1, borderColor: C.borderWarm },
    filterTabActive: { backgroundColor: C.ink, borderColor: C.ink },
    filterTabText: { fontFamily: Fonts.sansMedium, fontSize: FontSize.sm, color: C.body },
    filterTabTextActive: { color: C.canvas },
    loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    list: { padding: Spacing.lg, gap: Spacing.md },
    empty: { alignItems: 'center', paddingVertical: 60 },
    emptyText: { fontFamily: Fonts.sans, fontSize: FontSize.body, color: C.bodySoft },
    disputeCard: { backgroundColor: C.bgCard, borderRadius: Radius.lg, padding: Spacing.md, ...Shadow.card, gap: 6 },
    disputeCardSLA: { borderWidth: 1.5, borderColor: C.errorFg },
    disputeHeader: { flexDirection: 'row', justifyContent: 'space-between' },
    disputeType: { fontFamily: Fonts.sansMedium, fontSize: FontSize.body, color: C.ink, textTransform: 'capitalize' },
    disputeTime: { fontFamily: Fonts.sans, fontSize: FontSize.xs, color: C.bodySoft },
    disputeReason: { fontFamily: Fonts.sans, fontSize: FontSize.sm, color: C.body, lineHeight: 20 },
    disputeMeta: { flexDirection: 'row', justifyContent: 'space-between' },
    disputeParty: { fontFamily: Fonts.sans, fontSize: FontSize.sm, color: C.bodySoft },
    disputeAmount: { fontFamily: Fonts.sansMedium, fontSize: FontSize.sm, color: C.spice },
    disputeFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    statusPill: { borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4 },
    statusPillText: { fontFamily: Fonts.sansMedium, fontSize: FontSize.xs },
    slaBreach: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    slaBreachText: { fontFamily: Fonts.sansMedium, fontSize: FontSize.xs, color: C.errorFg },
  });
}
