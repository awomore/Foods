import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Switch, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { chefAvailabilityApi, type AvailabilitySlot } from '../../src/api/chefAvailability';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { Fonts, Spacing, Radius, Shadow, FontSize } from '../../src/constants/theme';
import { Bone } from '../../src/components/ui/Skeleton';
import { useFeedback } from '../../src/components/feedback';

const MONTHS_AHEAD = 3;

function getDatesForMonth(year: number, month: number): string[] {
  const dates: string[] = [];
  const d = new Date(year, month, 1);
  while (d.getMonth() === month) {
    dates.push(d.toISOString().split('T')[0]);
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

export default function ChefCalendarScreen() {
  const router = useRouter();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const feedback = useFeedback();

  const today = new Date();
  const todayIso = today.toISOString().split('T')[0];

  const [viewYear, setViewYear]   = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [slots, setSlots]         = useState<AvailabilitySlot[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected]   = useState<string | null>(null);
  const [saving, setSaving]       = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const res = await chefAvailabilityApi.myCalendar(MONTHS_AHEAD * 30);
      setSlots((res.slots ?? []).map(s => ({ ...s, date: s.date?.split('T')[0] ?? s.date })));
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const slotMap = useMemo(() => {
    const m: Record<string, AvailabilitySlot> = {};
    slots.forEach(s => {
      const key = s.date?.split('T')[0] ?? s.date;
      m[key] = { ...s, date: key };
    });
    return m;
  }, [slots]);

  const selectedSlot = selected ? slotMap[selected] : null;
  const selectedIsAvailable = !selectedSlot || selectedSlot.is_available;

  const toggleDay = async (date: string, isAvailable: boolean) => {
    setSaving(true);
    try {
      const { slot } = await chefAvailabilityApi.setDay(date, { is_available: isAvailable });
      const normSlot = { ...slot, date: slot.date?.split('T')[0] ?? slot.date };
      setSlots(prev => {
        const filtered = prev.filter(s => (s.date?.split('T')[0] ?? s.date) !== date);
        return [...filtered, normSlot];
      });
    } catch (e: any) {
      feedback.error(e?.error ?? 'Failed to update availability');
    } finally { setSaving(false); }
  };

  const blockWeek = async (isAvailable: boolean) => {
    if (!selected) return;
    setSaving(true);
    try {
      const d = new Date(selected + 'T00:00:00');
      const dow = d.getDay();
      const weekDates = Array.from({ length: 7 }, (_, i) => {
        const c = new Date(d);
        c.setDate(d.getDate() - dow + i);
        return c.toISOString().split('T')[0];
      });
      const { slots: updated } = await chefAvailabilityApi.setBulk(
        weekDates.map(date => ({ date, is_available: isAvailable }))
      );
      const normUpdated = updated.map(s => ({ ...s, date: s.date?.split('T')[0] ?? s.date }));
      setSlots(prev => {
        const weekSet = new Set(weekDates);
        const filtered = prev.filter(s => !weekSet.has(s.date?.split('T')[0] ?? s.date));
        return [...filtered, ...normUpdated];
      });
      feedback.success(
        isAvailable ? 'Week freed' : 'Week blocked',
        isAvailable ? 'All 7 days marked available.' : 'All 7 days marked unavailable.',
      );
    } catch (e: any) {
      feedback.error(e?.error ?? 'Could not update week');
    } finally { setSaving(false); }
  };

  const blockMonth = async (isAvailable: boolean) => {
    setSaving(true);
    try {
      const monthDates = getDatesForMonth(viewYear, viewMonth).filter(d => d >= todayIso);
      const { slots: updated } = await chefAvailabilityApi.setBulk(
        monthDates.map(date => ({ date, is_available: isAvailable }))
      );
      const normUpdated = updated.map(s => ({ ...s, date: s.date?.split('T')[0] ?? s.date }));
      setSlots(prev => {
        const set = new Set(monthDates);
        const filtered = prev.filter(s => !set.has(s.date?.split('T')[0] ?? s.date));
        return [...filtered, ...normUpdated];
      });
      feedback.success(
        isAvailable ? 'Month freed' : 'Month blocked',
        `All remaining days in ${monthLabel} updated.`,
      );
    } catch (e: any) {
      feedback.error(e?.error ?? 'Could not update month');
    } finally { setSaving(false); }
  };

  const dates    = getDatesForMonth(viewYear, viewMonth);
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const monthLabel = new Date(viewYear, viewMonth, 1)
    .toLocaleDateString('en-NG', { month: 'long', year: 'numeric' });

  const availableCount = dates.filter(d => {
    if (d < todayIso) return false;
    const slot = slotMap[d];
    return !slot || slot.is_available;
  }).length;
  const futureCount = dates.filter(d => d >= todayIso).length;

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

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
        ) : (
          <View style={{ width: 80 }} />
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} />}
      >
        {/* Month navigation */}
        <View style={styles.monthNav}>
          <TouchableOpacity style={styles.navBtn} onPress={prevMonth}>
            <Ionicons name="chevron-back" size={20} color={C.ink} />
          </TouchableOpacity>
          <View style={{ alignItems: 'center', gap: 2 }}>
            <Text style={styles.monthLabel}>{monthLabel}</Text>
            {!loading && (
              <Text style={styles.monthSub}>{availableCount}/{futureCount} days available</Text>
            )}
          </View>
          <TouchableOpacity style={styles.navBtn} onPress={nextMonth}>
            <Ionicons name="chevron-forward" size={20} color={C.ink} />
          </TouchableOpacity>
        </View>

        {/* Quick month actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={[styles.quickBtn, { borderColor: C.successFg }]}
            onPress={() => blockMonth(true)}
            disabled={saving}
          >
            <Ionicons name="sunny-outline" size={13} color={C.successFg} />
            <Text style={[styles.quickBtnText, { color: C.successFg }]}>Open month</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickBtn, { borderColor: C.errorFg }]}
            onPress={() => blockMonth(false)}
            disabled={saving}
          >
            <Ionicons name="moon-outline" size={13} color={C.errorFg} />
            <Text style={[styles.quickBtnText, { color: C.errorFg }]}>Block month</Text>
          </TouchableOpacity>
        </View>

        {/* Day-of-week headers */}
        <View style={styles.weekHeader}>
          {['SUN','MON','TUE','WED','THU','FRI','SAT'].map(d => (
            <Text key={d} style={styles.weekDayLabel}>{d}</Text>
          ))}
        </View>

        {/* Calendar grid */}
        {loading ? (
          <View style={{ padding: Spacing.md, gap: 8 }}>
            {Array(5).fill(0).map((_, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: 6 }}>
                {Array(7).fill(0).map((_, j) => <Bone key={j} width={44} height={44} radius={22} delay={i * 40 + j * 10} />)}
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.calGrid}>
            {Array(firstDay).fill(null).map((_, i) => <View key={`e-${i}`} style={styles.calCell} />)}
            {dates.map(date => {
              const slot        = slotMap[date];
              const isAvailable = !slot || slot.is_available;
              const isPast      = date < todayIso;
              const isToday     = date === todayIso;
              const isSelected  = selected === date;
              const dayNum      = new Date(date + 'T00:00:00').getDate();

              return (
                <TouchableOpacity
                  key={date}
                  style={[
                    styles.calCell,
                    !isPast && isAvailable && styles.calCellAvailable,
                    !isPast && !isAvailable && styles.calCellBlocked,
                    isPast && styles.calCellPast,
                    isToday && styles.calCellToday,
                    isSelected && styles.calCellSelected,
                  ]}
                  onPress={() => !isPast && setSelected(isSelected ? null : date)}
                  disabled={isPast}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.calCellText,
                    !isPast && isAvailable && styles.calCellTextAvailable,
                    !isPast && !isAvailable && styles.calCellTextBlocked,
                    isPast && styles.calCellTextPast,
                    isToday && styles.calCellTextToday,
                    isSelected && styles.calCellTextSelected,
                  ]}>
                    {dayNum}
                  </Text>
                  {isToday && !isSelected && (
                    <View style={styles.todayDot} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Legend */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendSwatch, { backgroundColor: C.successBg }]} />
            <Text style={styles.legendText}>Available</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendSwatch, { backgroundColor: C.errorBg }]} />
            <Text style={styles.legendText}>Blocked</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendSwatch, styles.legendSwatchDefault]} />
            <Text style={styles.legendText}>Default (open)</Text>
          </View>
        </View>

        {/* Selected day panel */}
        {selected && (
          <View style={styles.dayPanel}>
            <View style={styles.dayPanelHeader}>
              <View>
                <Text style={styles.dayPanelTitle}>
                  {new Date(selected + 'T00:00:00').toLocaleDateString('en-NG', {
                    weekday: 'long', day: 'numeric', month: 'long',
                  })}
                </Text>
                <Text style={styles.dayPanelSub}>
                  {selectedIsAvailable ? 'Open for orders' : 'Blocked'}
                </Text>
              </View>
              <View style={[
                styles.dayStatusBadge,
                { backgroundColor: selectedIsAvailable ? C.successBg : C.errorBg }
              ]}>
                <Ionicons
                  name={selectedIsAvailable ? 'checkmark-circle' : 'close-circle'}
                  size={16}
                  color={selectedIsAvailable ? C.successFg : C.errorFg}
                />
                <Text style={[styles.dayStatusText, { color: selectedIsAvailable ? C.successFg : C.errorFg }]}>
                  {selectedIsAvailable ? 'Available' : 'Blocked'}
                </Text>
              </View>
            </View>

            {/* Toggle availability */}
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Accept orders this day</Text>
              {saving ? (
                <ActivityIndicator size="small" color={C.spice} />
              ) : (
                <Switch
                  value={selectedIsAvailable}
                  onValueChange={val => toggleDay(selected, val)}
                  trackColor={{ false: C.errorBg, true: C.leaf }}
                  thumbColor={C.canvas}
                  ios_backgroundColor={C.borderWarm}
                />
              )}
            </View>

            {/* Week actions */}
            <View style={styles.weekActions}>
              <TouchableOpacity
                style={[styles.weekBtn, { backgroundColor: C.errorBg }]}
                onPress={() => blockWeek(false)}
                disabled={saving}
              >
                <Ionicons name="close-circle-outline" size={14} color={C.errorFg} />
                <Text style={[styles.weekBtnText, { color: C.errorFg }]}>Block week</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.weekBtn, { backgroundColor: C.successBg }]}
                onPress={() => blockWeek(true)}
                disabled={saving}
              >
                <Ionicons name="checkmark-circle-outline" size={14} color={C.successFg} />
                <Text style={[styles.weekBtnText, { color: C.successFg }]}>Free week</Text>
              </TouchableOpacity>
            </View>

            {selectedSlot?.notes && (
              <Text style={styles.slotNote}>{selectedSlot.notes}</Text>
            )}
          </View>
        )}

        {/* Hint when nothing selected */}
        {!selected && !loading && (
          <View style={styles.hintBanner}>
            <Ionicons name="tap-outline" size={16} color={C.spice} />
            <Text style={styles.hintBannerText}>Tap any future date to set or change its availability.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    container:  { flex: 1, backgroundColor: C.bg },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
      borderBottomWidth: 1, borderBottomColor: C.borderWarm,
    },
    backBtn:    { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    title:      { fontFamily: Fonts.sansMedium, fontSize: FontSize.lg, color: C.ink },
    savingChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.honey, borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 5 },
    savingText: { fontFamily: Fonts.sans, fontSize: FontSize.xs, color: C.spice },
    content:    { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: 60 },

    monthNav:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    navBtn:     { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: C.bgCard, ...Shadow.card },
    monthLabel: { fontFamily: Fonts.sansMedium, fontSize: FontSize.lg, color: C.ink },
    monthSub:   { fontFamily: Fonts.sans, fontSize: FontSize.xs, color: C.bodySoft },

    quickActions: { flexDirection: 'row', gap: Spacing.sm },
    quickBtn:   { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9, borderRadius: Radius.md, borderWidth: 1, backgroundColor: C.bgCard },
    quickBtnText: { fontFamily: Fonts.sansMedium, fontSize: FontSize.xs },

    weekHeader: { flexDirection: 'row' },
    weekDayLabel: {
      width: '14.28%', textAlign: 'center',
      fontFamily: Fonts.sansMedium, fontSize: 10, color: C.bodySoft,
      paddingVertical: 6, letterSpacing: 0.5,
    },

    calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    calCell: {
      width: '14.28%', aspectRatio: 1,
      alignItems: 'center', justifyContent: 'center',
      padding: 2, position: 'relative',
    },
    calCellAvailable: {
      backgroundColor: C.successBg,
      borderRadius: 99,
    },
    calCellBlocked: {
      backgroundColor: C.errorBg,
      borderRadius: 99,
    },
    calCellPast:    { opacity: 0.3 },
    calCellToday:   { borderWidth: 2, borderColor: C.spice, borderRadius: 99, backgroundColor: 'transparent' },
    calCellSelected: { backgroundColor: C.spice, borderRadius: 99 },
    calCellText:    { fontFamily: Fonts.sansMedium, fontSize: FontSize.sm, color: C.stone },
    calCellTextAvailable: { color: C.successFg },
    calCellTextBlocked:   { color: C.errorFg },
    calCellTextPast:      { color: C.stone },
    calCellTextToday:     { color: C.spice },
    calCellTextSelected:  { color: C.canvas },
    todayDot:       { width: 4, height: 4, borderRadius: 2, backgroundColor: C.spice, position: 'absolute', bottom: 4 },

    legend: { flexDirection: 'row', gap: Spacing.lg, justifyContent: 'center', paddingVertical: 4 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendSwatch: { width: 14, height: 14, borderRadius: 7 },
    legendSwatchDefault: { backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.borderWarm },
    legendText:  { fontFamily: Fonts.sans, fontSize: FontSize.xs, color: C.body },

    dayPanel: {
      backgroundColor: C.bgCard, borderRadius: Radius.lg,
      padding: Spacing.md, gap: Spacing.sm, ...Shadow.card,
    },
    dayPanelHeader:  { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
    dayPanelTitle:   { fontFamily: Fonts.sansMedium, fontSize: FontSize.lg, color: C.ink },
    dayPanelSub:     { fontFamily: Fonts.sans, fontSize: FontSize.sm, color: C.bodySoft, marginTop: 2 },
    dayStatusBadge:  { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 5 },
    dayStatusText:   { fontFamily: Fonts.sansMedium, fontSize: FontSize.xs },

    toggleRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.bg, borderRadius: Radius.md, padding: 12 },
    toggleLabel:     { fontFamily: Fonts.sansMedium, fontSize: FontSize.body, color: C.ink },

    weekActions:     { flexDirection: 'row', gap: 8 },
    weekBtn:         { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10, borderRadius: Radius.md },
    weekBtnText:     { fontFamily: Fonts.sansMedium, fontSize: FontSize.xs },
    slotNote:        { fontFamily: Fonts.sans, fontSize: FontSize.sm, color: C.bodySoft },

    hintBanner:      { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.honey, borderRadius: Radius.md, padding: 12 },
    hintBannerText:  { fontFamily: Fonts.sans, fontSize: FontSize.sm, color: C.body, flex: 1 },
  });
}
