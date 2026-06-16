import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { chefAvailabilityApi, type AvailabilitySlot } from '../../src/api/chefAvailability';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { Fonts, Spacing, Radius, Shadow } from '../../src/constants/theme';
import { useFeedback } from '../../src/components/feedback';

const MONTHS_AHEAD = 3;
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const CELL_SIZE = Math.floor((Dimensions.get('window').width - 48 - 12) / 7);

function normDate(date: string): string {
  return date?.split('T')[0] ?? date;
}

function getDatesForMonth(year: number, month: number): string[] {
  const dates: string[] = [];
  const d = new Date(year, month, 1);
  while (d.getMonth() === month) {
    dates.push(d.toISOString().split('T')[0]);
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

function makeOptimisticSlots(dates: string[], isAvailable: boolean): AvailabilitySlot[] {
  return dates.map(date => ({
    id: `opt-${date}`, cook_id: '', date,
    is_available: isAvailable, time_slots: [], notes: null, created_at: '',
  }));
}

export default function ChefCalendarScreen() {
  const router   = useRouter();
  const C        = useColors();
  const styles   = useMemo(() => makeStyles(C), [C]);
  const feedback = useFeedback();

  const today    = new Date();
  const todayIso = today.toISOString().split('T')[0];

  const [viewYear, setViewYear]     = useState(today.getFullYear());
  const [viewMonth, setViewMonth]   = useState(today.getMonth());
  const [slots, setSlots]           = useState<AvailabilitySlot[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected]     = useState<string | null>(null);
  const [saving, setSaving]         = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const res = await chefAvailabilityApi.myCalendar(MONTHS_AHEAD * 30);
      setSlots((res.slots ?? []).map(s => ({ ...s, date: normDate(s.date) })));
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const slotMap = useMemo(() => {
    const m: Record<string, AvailabilitySlot> = {};
    slots.forEach(s => { m[normDate(s.date)] = { ...s, date: normDate(s.date) }; });
    return m;
  }, [slots]);

  function applyOptimistic(dates: string[], isAvailable: boolean) {
    setSlots(prev => {
      const set = new Set(dates);
      return [...prev.filter(s => !set.has(normDate(s.date))), ...makeOptimisticSlots(dates, isAvailable)];
    });
  }
  function revertTo(snapshot: AvailabilitySlot[]) { setSlots(snapshot); }

  const toggleDay = async (date: string, isAvailable: boolean) => {
    const snapshot = slots;
    applyOptimistic([date], isAvailable);
    setSaving(true);
    try {
      const { slot } = await chefAvailabilityApi.setDay(date, { is_available: isAvailable });
      const norm = { ...slot, date: normDate(slot.date) };
      setSlots(prev => [...prev.filter(s => normDate(s.date) !== date), norm]);
    } catch (e: any) {
      revertTo(snapshot);
      feedback.error('Could not update day', e?.error ?? e?.message);
    } finally { setSaving(false); }
  };

  const blockWeek = async (isAvailable: boolean) => {
    if (!selected) return;
    const d = new Date(selected + 'T00:00:00');
    const dow = d.getDay();
    const weekDates = Array.from({ length: 7 }, (_, i) => {
      const c = new Date(d);
      c.setDate(d.getDate() - dow + i);
      return c.toISOString().split('T')[0];
    });
    const snapshot = slots;
    applyOptimistic(weekDates, isAvailable);
    setSaving(true);
    try {
      const { slots: updated } = await chefAvailabilityApi.setBulk(
        weekDates.map(date => ({ date, is_available: isAvailable }))
      );
      const norm = updated.map(s => ({ ...s, date: normDate(s.date) }));
      setSlots(prev => {
        const set = new Set(weekDates);
        return [...prev.filter(s => !set.has(normDate(s.date))), ...norm];
      });
      feedback.success(isAvailable ? 'Week opened' : 'Week blocked');
    } catch (e: any) {
      revertTo(snapshot);
      feedback.error('Could not update week', e?.error ?? e?.message);
    } finally { setSaving(false); }
  };

  const blockMonth = async (isAvailable: boolean) => {
    const monthDates = getDatesForMonth(viewYear, viewMonth).filter(d => d >= todayIso);
    const snapshot = slots;
    applyOptimistic(monthDates, isAvailable);
    setSaving(true);
    try {
      const { slots: updated } = await chefAvailabilityApi.setBulk(
        monthDates.map(date => ({ date, is_available: isAvailable }))
      );
      const norm = updated.map(s => ({ ...s, date: normDate(s.date) }));
      setSlots(prev => {
        const set = new Set(monthDates);
        return [...prev.filter(s => !set.has(normDate(s.date))), ...norm];
      });
      feedback.success(isAvailable ? `${monthLabel} opened` : `${monthLabel} blocked`);
    } catch (e: any) {
      revertTo(snapshot);
      feedback.error('Could not update month', e?.error ?? e?.message);
    } finally { setSaving(false); }
  };

  const dates      = getDatesForMonth(viewYear, viewMonth);
  const firstDay   = new Date(viewYear, viewMonth, 1).getDay();
  const monthLabel = new Date(viewYear, viewMonth, 1)
    .toLocaleDateString('en-NG', { month: 'long', year: 'numeric' });

  const futureCount    = dates.filter(d => d >= todayIso).length;
  const availableCount = dates.filter(d => {
    if (d < todayIso) return false;
    const s = slotMap[d];
    return !s || s.is_available;
  }).length;
  const blockedCount = futureCount - availableCount;

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  const selectedSlot        = selected ? slotMap[selected] : null;
  const selectedIsAvailable = !selectedSlot || selectedSlot.is_available;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <Text style={styles.title}>Availability</Text>
        {saving ? (
          <View style={styles.savingChip}>
            <ActivityIndicator size="small" color={C.spice} />
            <Text style={styles.savingText}>Saving…</Text>
          </View>
        ) : <View style={{ width: 80 }} />}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={C.spice} />}
      >
        {/* Month navigator */}
        <View style={styles.monthNav}>
          <TouchableOpacity style={styles.navBtn} onPress={prevMonth}>
            <Ionicons name="chevron-back" size={18} color={C.ink} />
          </TouchableOpacity>
          <View style={{ alignItems: 'center', gap: 6 }}>
            <Text style={styles.monthLabel}>{monthLabel}</Text>
            <View style={styles.monthStats}>
              <View style={[styles.statDot, { backgroundColor: '#16A34A' }]} />
              <Text style={styles.statText}>{availableCount} open</Text>
              <Text style={styles.statSep}>·</Text>
              <View style={[styles.statDot, { backgroundColor: '#DC2626' }]} />
              <Text style={styles.statText}>{blockedCount} blocked</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.navBtn} onPress={nextMonth}>
            <Ionicons name="chevron-forward" size={18} color={C.ink} />
          </TouchableOpacity>
        </View>

        {/* Month quick actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity style={[styles.quickBtn, { borderColor: '#16A34A', backgroundColor: '#F0FDF4' }]} onPress={() => blockMonth(true)} disabled={saving}>
            <Ionicons name="sunny-outline" size={14} color="#16A34A" />
            <Text style={[styles.quickBtnText, { color: '#16A34A' }]}>Open month</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.quickBtn, { borderColor: '#DC2626', backgroundColor: '#FEF2F2' }]} onPress={() => blockMonth(false)} disabled={saving}>
            <Ionicons name="moon-outline" size={14} color="#DC2626" />
            <Text style={[styles.quickBtnText, { color: '#DC2626' }]}>Block month</Text>
          </TouchableOpacity>
        </View>

        {/* Calendar grid */}
        <View style={styles.calCard}>
          {/* Day headers */}
          <View style={styles.dayHeaderRow}>
            {DAY_LABELS.map(d => (
              <Text key={d} style={styles.dayHeader}>{d}</Text>
            ))}
          </View>

          {loading ? (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
              <ActivityIndicator color={C.spice} size="large" />
            </View>
          ) : (
            <View style={styles.grid}>
              {Array(firstDay).fill(null).map((_, i) => (
                <View key={`empty-${i}`} style={styles.cell} />
              ))}
              {dates.map(date => {
                const slot        = slotMap[date];
                const isAvailable = !slot || slot.is_available;
                const isPast      = date < todayIso;
                const isToday     = date === todayIso;
                const isSelected  = selected === date;
                const dayNum      = new Date(date + 'T00:00:00').getDate();

                let cellBg = 'transparent';
                let textColor = C.bodySoft;
                if (!isPast) {
                  if (isSelected) { cellBg = C.spice; textColor = '#FFF'; }
                  else if (isAvailable) { cellBg = '#DCFCE7'; textColor = '#15803D'; }
                  else { cellBg = '#FEE2E2'; textColor = '#DC2626'; }
                }

                return (
                  <TouchableOpacity
                    key={date}
                    style={[
                      styles.cell,
                      { backgroundColor: cellBg, borderRadius: 10 },
                      isToday && !isSelected && { borderWidth: 2, borderColor: C.spice },
                      isPast && { opacity: 0.3 },
                    ]}
                    onPress={() => !isPast && setSelected(isSelected ? null : date)}
                    disabled={isPast}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.cellText, { color: textColor }]}>{dayNum}</Text>
                    {isToday && !isSelected && (
                      <View style={[styles.todayDot, { backgroundColor: C.spice }]} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* Legend */}
        <View style={styles.legend}>
          {[
            { color: '#15803D', bg: '#DCFCE7', label: 'Available' },
            { color: '#DC2626', bg: '#FEE2E2', label: 'Blocked' },
            { color: C.spice,   bg: C.spice,   label: 'Selected', text: '#FFF' },
          ].map(({ color, bg, label, text }) => (
            <View key={label} style={styles.legendItem}>
              <View style={[styles.legendSwatch, { backgroundColor: bg, borderColor: color }]}>
                {text && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: text }} />}
              </View>
              <Text style={styles.legendText}>{label}</Text>
            </View>
          ))}
        </View>

        {/* Selected day panel */}
        {selected && (
          <View style={styles.dayPanel}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.dayPanelDate}>
                  {new Date(selected + 'T00:00:00').toLocaleDateString('en-NG', {
                    weekday: 'long', day: 'numeric', month: 'long',
                  })}
                </Text>
                <Text style={[styles.dayPanelStatus, { color: selectedIsAvailable ? '#16A34A' : '#DC2626' }]}>
                  {selectedIsAvailable ? 'Open for orders' : 'Blocked'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSelected(null)} style={{ padding: 4 }}>
                <Ionicons name="close" size={18} color={C.bodySoft} />
              </TouchableOpacity>
            </View>

            <View style={styles.dayToggleRow}>
              <TouchableOpacity
                style={[styles.toggleBtn, selectedIsAvailable ? styles.toggleBtnActiveOpen : styles.toggleBtnIdle]}
                onPress={() => !selectedIsAvailable && toggleDay(selected, true)}
                disabled={saving || selectedIsAvailable}
              >
                <Ionicons name="checkmark-circle" size={16} color={selectedIsAvailable ? '#FFF' : C.bodySoft} />
                <Text style={[styles.toggleBtnText, { color: selectedIsAvailable ? '#FFF' : C.bodySoft }]}>Open</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, !selectedIsAvailable ? styles.toggleBtnActiveBlock : styles.toggleBtnIdle]}
                onPress={() => selectedIsAvailable && toggleDay(selected, false)}
                disabled={saving || !selectedIsAvailable}
              >
                <Ionicons name="close-circle" size={16} color={!selectedIsAvailable ? '#FFF' : C.bodySoft} />
                <Text style={[styles.toggleBtnText, { color: !selectedIsAvailable ? '#FFF' : C.bodySoft }]}>Block</Text>
              </TouchableOpacity>
            </View>

            <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: C.borderWarm }} />

            <Text style={styles.weekLabel}>This week</Text>
            <View style={styles.weekActions}>
              <TouchableOpacity style={[styles.weekBtn, { borderColor: '#16A34A', backgroundColor: '#F0FDF4' }]} onPress={() => blockWeek(true)} disabled={saving}>
                <Ionicons name="sunny-outline" size={13} color="#16A34A" />
                <Text style={[styles.weekBtnText, { color: '#16A34A' }]}>Open week</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.weekBtn, { borderColor: '#DC2626', backgroundColor: '#FEF2F2' }]} onPress={() => blockWeek(false)} disabled={saving}>
                <Ionicons name="moon-outline" size={13} color="#DC2626" />
                <Text style={[styles.weekBtnText, { color: '#DC2626' }]}>Block week</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {!selected && !loading && (
          <View style={styles.hint}>
            <Ionicons name="finger-print-outline" size={15} color={C.spice} />
            <Text style={styles.hintText}>Tap any future date to open or block it.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(C: AppColors) { return StyleSheet.create({
  container:  { flex: 1, backgroundColor: C.bg },
  header:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.borderWarm },
  backBtn:    { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title:      { fontFamily: Fonts.sansMedium, fontSize: 18, color: C.ink },
  savingChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.honey, borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 6 },
  savingText: { fontFamily: Fonts.sans, fontSize: 12, color: C.spice },

  content: { padding: Spacing.lg, gap: 18, paddingBottom: 60 },

  monthNav:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navBtn:     { width: 40, height: 40, borderRadius: 20, backgroundColor: C.bgCard, alignItems: 'center', justifyContent: 'center', ...Shadow.card },
  monthLabel: { fontFamily: Fonts.sansMedium, fontSize: 17, color: C.ink },
  monthStats: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statDot:    { width: 7, height: 7, borderRadius: 4 },
  statText:   { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft },
  statSep:    { fontFamily: Fonts.sans, fontSize: 12, color: C.stone },

  quickActions: { flexDirection: 'row', gap: 10 },
  quickBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: Radius.md, borderWidth: 1.5 },
  quickBtnText: { fontFamily: Fonts.sansMedium, fontSize: 13 },

  calCard:      { backgroundColor: C.bgCard, borderRadius: Radius.lg, overflow: 'hidden', ...Shadow.card, padding: 8 },
  dayHeaderRow: { flexDirection: 'row', paddingBottom: 6, paddingTop: 4 },
  dayHeader:    { width: CELL_SIZE, textAlign: 'center', fontFamily: Fonts.sansMedium, fontSize: 10, color: C.bodySoft, letterSpacing: 0.3 },

  grid:     { flexDirection: 'row', flexWrap: 'wrap' },
  cell:     { width: CELL_SIZE, height: CELL_SIZE, alignItems: 'center', justifyContent: 'center', margin: 1 },
  cellText: { fontFamily: Fonts.sansMedium, fontSize: 13 },
  todayDot: { width: 4, height: 4, borderRadius: 2, position: 'absolute', bottom: 4 },

  legend:       { flexDirection: 'row', gap: 16, justifyContent: 'center' },
  legendItem:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendSwatch: { width: 16, height: 16, borderRadius: 5, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  legendText:   { fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft },

  dayPanel:     { backgroundColor: C.bgCard, borderRadius: Radius.lg, padding: Spacing.md, gap: 12, ...Shadow.card, borderWidth: StyleSheet.hairlineWidth, borderColor: C.borderWarm },
  dayPanelDate: { fontFamily: Fonts.sansMedium, fontSize: 16, color: C.ink },
  dayPanelStatus: { fontFamily: Fonts.sans, fontSize: 13, marginTop: 2 },

  dayToggleRow:        { flexDirection: 'row', gap: 10 },
  toggleBtn:           { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: Radius.md, borderWidth: 1.5, borderColor: C.borderWarm, backgroundColor: C.bg },
  toggleBtnActiveOpen: { backgroundColor: '#16A34A', borderColor: '#16A34A' },
  toggleBtnActiveBlock:{ backgroundColor: '#DC2626', borderColor: '#DC2626' },
  toggleBtnIdle:       {},
  toggleBtnText:       { fontFamily: Fonts.sansMedium, fontSize: 14 },

  weekLabel:   { fontFamily: Fonts.sansMedium, fontSize: 11, color: C.bodySoft, letterSpacing: 0.3, textTransform: 'uppercase' },
  weekActions: { flexDirection: 'row', gap: 10 },
  weekBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10, borderRadius: Radius.md, borderWidth: 1 },
  weekBtnText: { fontFamily: Fonts.sansMedium, fontSize: 13 },

  hint:     { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.honey, borderRadius: Radius.md, padding: 12 },
  hintText: { fontFamily: Fonts.sans, fontSize: 13, color: C.body, flex: 1 },
}); }
