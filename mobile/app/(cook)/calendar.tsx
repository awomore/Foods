import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { chefAvailabilityApi, type AvailabilitySlot } from '../../src/api/chefAvailability';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { Fonts, Spacing, Radius, Shadow } from '../../src/constants/theme';
import { Bone } from '../../src/components/ui/Skeleton';
import { useFeedback } from '../../src/components/feedback';

const MONTHS_AHEAD = 3;
const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function getDatesForMonth(year: number, month: number): string[] {
  const dates: string[] = [];
  const d = new Date(year, month, 1);
  while (d.getMonth() === month) {
    dates.push(d.toISOString().split('T')[0]);
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

function normDate(date: string): string {
  return date?.split('T')[0] ?? date;
}

function makeOptimisticSlots(dates: string[], isAvailable: boolean): AvailabilitySlot[] {
  return dates.map(date => ({
    id: `opt-${date}`,
    cook_id: '',
    date,
    is_available: isAvailable,
    time_slots: [],
    notes: null,
    created_at: '',
  }));
}

export default function ChefCalendarScreen() {
  const router  = useRouter();
  const C       = useColors();
  const styles  = useMemo(() => makeStyles(C), [C]);
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

  const selectedSlot        = selected ? slotMap[selected] : null;
  const selectedIsAvailable = !selectedSlot || selectedSlot.is_available;

  // ── Optimistic helpers ──────────────────────────────────────────────────────
  function applyOptimistic(dates: string[], isAvailable: boolean) {
    setSlots(prev => {
      const set = new Set(dates);
      return [
        ...prev.filter(s => !set.has(normDate(s.date))),
        ...makeOptimisticSlots(dates, isAvailable),
      ];
    });
  }

  function revertTo(snapshot: AvailabilitySlot[]) {
    setSlots(snapshot);
  }

  // ── Toggle single day ───────────────────────────────────────────────────────
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

  // ── Block / free week ───────────────────────────────────────────────────────
  const blockWeek = async (isAvailable: boolean) => {
    if (!selected) return;
    const d   = new Date(selected + 'T00:00:00');
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

  // ── Block / free month ──────────────────────────────────────────────────────
  const blockMonth = async (isAvailable: boolean) => {
    const monthDates = getDatesForMonth(viewYear, viewMonth).filter(d => d >= todayIso);
    const snapshot   = slots;
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

  const dates     = getDatesForMonth(viewYear, viewMonth);
  const firstDay  = new Date(viewYear, viewMonth, 1).getDay();
  const monthLabel = new Date(viewYear, viewMonth, 1)
    .toLocaleDateString('en-NG', { month: 'long', year: 'numeric' });

  const futureCount     = dates.filter(d => d >= todayIso).length;
  const availableCount  = dates.filter(d => {
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

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
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
        keyboardShouldPersistTaps="always"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(true); }}
            tintColor={C.spice}
          />
        }
      >
        {/* Month navigator */}
        <View style={styles.monthNav}>
          <TouchableOpacity style={styles.navBtn} onPress={prevMonth}>
            <Ionicons name="chevron-back" size={20} color={C.ink} />
          </TouchableOpacity>
          <View style={{ alignItems: 'center', gap: 4 }}>
            <Text style={styles.monthLabel}>{monthLabel}</Text>
            {!loading && (
              <View style={styles.monthStats}>
                <View style={styles.monthStat}>
                  <View style={[styles.monthStatDot, { backgroundColor: C.successFg }]} />
                  <Text style={styles.monthStatText}>{availableCount} open</Text>
                </View>
                <Text style={styles.monthStatSep}>·</Text>
                <View style={styles.monthStat}>
                  <View style={[styles.monthStatDot, { backgroundColor: C.errorFg }]} />
                  <Text style={styles.monthStatText}>{blockedCount} blocked</Text>
                </View>
              </View>
            )}
          </View>
          <TouchableOpacity style={styles.navBtn} onPress={nextMonth}>
            <Ionicons name="chevron-forward" size={20} color={C.ink} />
          </TouchableOpacity>
        </View>

        {/* Month quick actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={[styles.quickBtn, styles.quickBtnOpen]}
            onPress={() => blockMonth(true)}
            disabled={saving}
            activeOpacity={0.7}
          >
            <Ionicons name="sunny-outline" size={14} color={C.successFg} />
            <Text style={[styles.quickBtnText, { color: C.successFg }]}>Open month</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickBtn, styles.quickBtnBlock]}
            onPress={() => blockMonth(false)}
            disabled={saving}
            activeOpacity={0.7}
          >
            <Ionicons name="moon-outline" size={14} color={C.errorFg} />
            <Text style={[styles.quickBtnText, { color: C.errorFg }]}>Block month</Text>
          </TouchableOpacity>
        </View>

        {/* Day-of-week header */}
        <View style={styles.weekHeader}>
          {DAY_LABELS.map((d, i) => (
            <Text key={i} style={styles.weekDayLabel}>{d}</Text>
          ))}
        </View>

        {/* Calendar grid */}
        <View style={styles.calCard}>
          {loading ? (
            <View style={{ padding: Spacing.md, gap: 6 }}>
              {Array(5).fill(0).map((_, i) => (
                <View key={i} style={{ flexDirection: 'row', gap: 6 }}>
                  {Array(7).fill(0).map((_, j) => (
                    <Bone key={j} width={40} height={40} radius={10} delay={i * 40 + j * 10} />
                  ))}
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.calGrid}>
              {Array(firstDay).fill(null).map((_, i) => (
                <View key={`e-${i}`} style={styles.calCell} />
              ))}
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
                      !isPast && isAvailable  && styles.calCellAvailable,
                      !isPast && !isAvailable && styles.calCellBlocked,
                      isPast  && styles.calCellPast,
                      isToday && !isSelected  && styles.calCellToday,
                      isSelected && styles.calCellSelected,
                    ]}
                    onPress={() => !isPast && setSelected(isSelected ? null : date)}
                    disabled={isPast}
                    activeOpacity={0.65}
                  >
                    <Text style={[
                      styles.calCellText,
                      !isPast && isAvailable  && styles.calCellTextAvail,
                      !isPast && !isAvailable && styles.calCellTextBlocked,
                      isPast  && styles.calCellTextPast,
                      isToday && !isSelected  && styles.calCellTextToday,
                      isSelected && styles.calCellTextSelected,
                    ]}>
                      {dayNum}
                    </Text>
                    {isToday && !isSelected && <View style={styles.todayDot} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* Legend */}
        <View style={styles.legend}>
          {[
            { color: C.successFg, bg: C.successBg, label: 'Available' },
            { color: C.errorFg,   bg: C.errorBg,   label: 'Blocked' },
          ].map(({ color, bg, label }) => (
            <View key={label} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: bg, borderColor: color }]} />
              <Text style={styles.legendText}>{label}</Text>
            </View>
          ))}
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: C.bgCard, borderColor: C.borderWarm }]} />
            <Text style={styles.legendText}>Default (open)</Text>
          </View>
        </View>

        {/* Selected day panel */}
        {selected && (
          <View style={styles.dayPanel}>
            {/* Day title + status badge */}
            <View style={styles.dayPanelTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.dayPanelDate}>
                  {new Date(selected + 'T00:00:00').toLocaleDateString('en-NG', {
                    weekday: 'long', day: 'numeric', month: 'long',
                  })}
                </Text>
                <Text style={[styles.dayPanelStatus, { color: selectedIsAvailable ? C.successFg : C.errorFg }]}>
                  {selectedIsAvailable ? 'Open for orders' : 'Blocked'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSelected(null)} style={styles.dayPanelClose}>
                <Ionicons name="close" size={18} color={C.bodySoft} />
              </TouchableOpacity>
            </View>

            {/* Open / Block buttons */}
            <View style={styles.dayToggleRow}>
              <TouchableOpacity
                style={[
                  styles.dayToggleBtn,
                  selectedIsAvailable ? styles.dayToggleBtnActiveOpen : styles.dayToggleBtnIdle,
                ]}
                onPress={() => !selectedIsAvailable && toggleDay(selected, true)}
                disabled={saving || selectedIsAvailable}
                activeOpacity={0.75}
              >
                {saving && !selectedIsAvailable ? (
                  <ActivityIndicator size="small" color={C.canvas} />
                ) : (
                  <Ionicons
                    name="checkmark-circle"
                    size={17}
                    color={selectedIsAvailable ? C.canvas : C.bodySoft}
                  />
                )}
                <Text style={[
                  styles.dayToggleBtnText,
                  { color: selectedIsAvailable ? C.canvas : C.bodySoft },
                ]}>Open</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.dayToggleBtn,
                  !selectedIsAvailable ? styles.dayToggleBtnActiveBlock : styles.dayToggleBtnIdle,
                ]}
                onPress={() => selectedIsAvailable && toggleDay(selected, false)}
                disabled={saving || !selectedIsAvailable}
                activeOpacity={0.75}
              >
                {saving && selectedIsAvailable ? (
                  <ActivityIndicator size="small" color={C.canvas} />
                ) : (
                  <Ionicons
                    name="close-circle"
                    size={17}
                    color={!selectedIsAvailable ? C.canvas : C.bodySoft}
                  />
                )}
                <Text style={[
                  styles.dayToggleBtnText,
                  { color: !selectedIsAvailable ? C.canvas : C.bodySoft },
                ]}>Block</Text>
              </TouchableOpacity>
            </View>

            {/* Divider */}
            <View style={styles.dayPanelDivider} />

            {/* Week actions */}
            <Text style={styles.dayPanelWeekLabel}>This week</Text>
            <View style={styles.weekActions}>
              <TouchableOpacity
                style={[styles.weekBtn, styles.weekBtnOpen]}
                onPress={() => blockWeek(true)}
                disabled={saving}
                activeOpacity={0.7}
              >
                <Ionicons name="sunny-outline" size={14} color={C.successFg} />
                <Text style={[styles.weekBtnText, { color: C.successFg }]}>Open week</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.weekBtn, styles.weekBtnBlock]}
                onPress={() => blockWeek(false)}
                disabled={saving}
                activeOpacity={0.7}
              >
                <Ionicons name="moon-outline" size={14} color={C.errorFg} />
                <Text style={[styles.weekBtnText, { color: C.errorFg }]}>Block week</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Hint */}
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

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },

    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg, paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.borderWarm,
    },
    backBtn:    { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    title:      { fontFamily: Fonts.sansMedium, fontSize: 18, color: C.ink },
    savingChip: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      backgroundColor: C.honey, borderRadius: Radius.full,
      paddingHorizontal: 12, paddingVertical: 6,
    },
    savingText: { fontFamily: Fonts.sans, fontSize: 12, color: C.spice },

    content: { padding: Spacing.lg, gap: 20, paddingBottom: 60 },

    monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    navBtn: {
      width: 42, height: 42, alignItems: 'center', justifyContent: 'center',
      borderRadius: 21, backgroundColor: C.bgCard, ...Shadow.card,
    },
    monthLabel: { fontFamily: Fonts.sansMedium, fontSize: 17, color: C.ink },
    monthStats: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    monthStat:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
    monthStatDot: { width: 7, height: 7, borderRadius: 4 },
    monthStatText: { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft },
    monthStatSep: { fontFamily: Fonts.sans, fontSize: 12, color: C.stone },

    quickActions: { flexDirection: 'row', gap: 10 },
    quickBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 6, paddingVertical: 11, borderRadius: Radius.md, borderWidth: 1.5,
    },
    quickBtnOpen:  { borderColor: C.successFg, backgroundColor: C.successBg },
    quickBtnBlock: { borderColor: C.errorFg,   backgroundColor: C.errorBg },
    quickBtnText:  { fontFamily: Fonts.sansMedium, fontSize: 13 },

    weekHeader: { flexDirection: 'row', paddingBottom: 4 },
    weekDayLabel: {
      width: '14.28%', textAlign: 'center',
      fontFamily: Fonts.sansMedium, fontSize: 11, color: C.bodySoft, letterSpacing: 0.5,
    },

    calCard: {
      backgroundColor: C.bgCard, borderRadius: Radius.lg,
      overflow: 'hidden', ...Shadow.card,
    },
    calGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 8, gap: 0 },
    calCell: {
      width: '14.28%', aspectRatio: 1,
      alignItems: 'center', justifyContent: 'center',
      position: 'relative', padding: 3,
    },
    calCellAvailable: {
      backgroundColor: '#DCFCE7', borderRadius: 10,
    },
    calCellBlocked: {
      backgroundColor: '#FEE2E2', borderRadius: 10,
    },
    calCellPast:    { opacity: 0.25 },
    calCellToday:   { borderWidth: 2, borderColor: C.spice, borderRadius: 10 },
    calCellSelected: { backgroundColor: C.spice, borderRadius: 10 },

    calCellText:         { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.stone },
    calCellTextAvail:    { color: '#15803D' },
    calCellTextBlocked:  { color: '#DC2626' },
    calCellTextPast:     { color: C.stone },
    calCellTextToday:    { color: C.spice },
    calCellTextSelected: { color: C.canvas },
    todayDot: {
      width: 4, height: 4, borderRadius: 2,
      backgroundColor: C.spice, position: 'absolute', bottom: 5,
    },

    legend: { flexDirection: 'row', gap: Spacing.md, justifyContent: 'center' },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendDot: { width: 12, height: 12, borderRadius: 4, borderWidth: 1 },
    legendText: { fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft },

    dayPanel: {
      backgroundColor: C.bgCard, borderRadius: Radius.lg,
      padding: Spacing.md, gap: 12, ...Shadow.card,
      borderWidth: StyleSheet.hairlineWidth, borderColor: C.borderWarm,
    },
    dayPanelTop: { flexDirection: 'row', alignItems: 'flex-start' },
    dayPanelDate: { fontFamily: Fonts.sansMedium, fontSize: 16, color: C.ink },
    dayPanelStatus: { fontFamily: Fonts.sans, fontSize: 13, marginTop: 2 },
    dayPanelClose: { padding: 4 },

    dayToggleRow: { flexDirection: 'row', gap: 10 },
    dayToggleBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 6, paddingVertical: 11, borderRadius: Radius.md, borderWidth: 1.5,
      borderColor: C.borderWarm, backgroundColor: C.bg,
    },
    dayToggleBtnActiveOpen:  { backgroundColor: '#16A34A', borderColor: '#16A34A' },
    dayToggleBtnActiveBlock: { backgroundColor: '#DC2626', borderColor: '#DC2626' },
    dayToggleBtnIdle: {},
    dayToggleBtnText: { fontFamily: Fonts.sansMedium, fontSize: 14 },

    dayPanelDivider: { height: StyleSheet.hairlineWidth, backgroundColor: C.borderWarm },
    dayPanelWeekLabel: { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.bodySoft, letterSpacing: 0.3 },

    weekActions: { flexDirection: 'row', gap: 10 },
    weekBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 5, paddingVertical: 10, borderRadius: Radius.md, borderWidth: 1,
    },
    weekBtnOpen:  { borderColor: C.successFg, backgroundColor: C.successBg },
    weekBtnBlock: { borderColor: C.errorFg,   backgroundColor: C.errorBg },
    weekBtnText:  { fontFamily: Fonts.sansMedium, fontSize: 13 },

    hint: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: C.honey, borderRadius: Radius.md, padding: 12,
    },
    hintText: { fontFamily: Fonts.sans, fontSize: 13, color: C.body, flex: 1 },
  });
}
