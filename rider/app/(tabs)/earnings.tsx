import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { riderApi, type EarningsSummary } from '../../src/api/rider';
import { C, Sp, R, Fs, F } from '../../src/theme';

function fmtNGN(val: number) {
  return `₦${Number(val ?? 0).toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
}

export default function EarningsScreen() {
  const [data, setData] = useState<EarningsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await riderApi.getEarnings();
      setData(res);
      setError('');
    } catch (e: any) {
      setError(e?.error ?? 'Could not load earnings');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <SafeAreaView style={s.safe}><ActivityIndicator color={C.spice} style={{ marginTop: 60 }} /></SafeAreaView>;
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>Earnings</Text>
        <Text style={s.sub}>All figures reflect the delivery fee portion</Text>
      </View>

      {!!error && (
        <View style={s.errorBanner}>
          <Ionicons name="alert-circle" size={16} color={C.errorFg} />
          <Text style={s.errorText}>{error}</Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={C.spice} />}
      >
        {/* This week */}
        <View style={[s.statCard, { backgroundColor: C.honey }]}>
          <View style={s.statIcon}><Ionicons name="calendar-outline" size={22} color={C.spice} /></View>
          <View>
            <Text style={s.statLabel}>This Week</Text>
            <Text style={s.statValue}>{fmtNGN(data?.this_week?.gross ?? 0)}</Text>
            <Text style={s.statMeta}>{data?.this_week?.count ?? 0} deliveries</Text>
          </View>
        </View>

        {/* All time */}
        <View style={[s.statCard, { backgroundColor: C.successBg }]}>
          <View style={[s.statIcon, { backgroundColor: C.successFg + '20' }]}><Ionicons name="trophy-outline" size={22} color={C.successFg} /></View>
          <View>
            <Text style={s.statLabel}>All Time</Text>
            <Text style={[s.statValue, { color: C.successFg }]}>{fmtNGN(data?.all_time?.gross ?? 0)}</Text>
            <Text style={s.statMeta}>{data?.all_time?.count ?? 0} total deliveries</Text>
          </View>
        </View>

        {/* Daily breakdown */}
        {data?.daily_breakdown?.length ? (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Last 30 days</Text>
            {[...(data.daily_breakdown ?? [])].reverse().map(day => (
              <View key={day.day} style={s.dayRow}>
                <View>
                  <Text style={s.dayLabel}>
                    {new Date(day.day).toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </Text>
                  <Text style={s.dayCount}>{day.deliveries} deliveries</Text>
                </View>
                <Text style={s.dayGross}>{fmtNGN(day.gross)}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={s.payoutNote}>
          <Ionicons name="information-circle-outline" size={16} color={C.bodySoft} />
          <Text style={s.payoutNoteText}>Payouts are processed weekly to your registered bank account.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: C.bg },
  header:       { padding: Sp.lg, paddingBottom: Sp.md, borderBottomWidth: 1, borderBottomColor: C.borderWarm },
  title:        { fontFamily: F.sansMedium, fontSize: Fs.xl, color: C.textInk },
  sub:          { fontFamily: F.sans, fontSize: Fs.sm, color: C.bodySoft, marginTop: 2 },
  errorBanner:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.errorBg, margin: Sp.md, padding: 12, borderRadius: R.md },
  errorText:    { fontFamily: F.sans, fontSize: Fs.sm, color: C.errorFg, flex: 1 },
  scroll:       { padding: Sp.md, gap: 14, paddingBottom: 60 },
  statCard:     { flexDirection: 'row', alignItems: 'center', gap: 14, padding: Sp.md, borderRadius: R.lg },
  statIcon:     { width: 48, height: 48, borderRadius: 24, backgroundColor: C.honey, alignItems: 'center', justifyContent: 'center' },
  statLabel:    { fontFamily: F.sans, fontSize: Fs.sm, color: C.bodySoft },
  statValue:    { fontFamily: F.sansMedium, fontSize: Fs.xxl, color: C.spice },
  statMeta:     { fontFamily: F.sans, fontSize: Fs.xs, color: C.bodySoft },
  section:      { gap: 0 },
  sectionTitle: { fontFamily: F.sansMedium, fontSize: Fs.md, color: C.textInk, marginBottom: 8 },
  dayRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.borderWarm },
  dayLabel:     { fontFamily: F.sansMedium, fontSize: Fs.sm, color: C.textInk },
  dayCount:     { fontFamily: F.sans, fontSize: Fs.xs, color: C.bodySoft, marginTop: 2 },
  dayGross:     { fontFamily: F.sansMedium, fontSize: Fs.md, color: C.textInk },
  payoutNote:   { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: Sp.md, backgroundColor: C.cream, borderRadius: R.md, marginTop: 4 },
  payoutNoteText: { fontFamily: F.sans, fontSize: Fs.sm, color: C.bodySoft, flex: 1, lineHeight: 20 },
});
