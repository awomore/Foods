import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Calendar } from 'react-native-calendars';
import { chefAvailabilityApi, type AvailabilitySlot } from '../../src/api/chefAvailability';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { Fonts, Spacing, Radius, Shadow } from '../../src/constants/theme';
import { useFeedback } from '../../src/components/feedback';

const MONTHS_AHEAD = 3;

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

  const [currentMonth, setCurrentMonth] = useState(todayIso.slice(0, 7));
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

  // Build markedDates for react-native-calendars
  const markedDates = useMemo(() => {
    const marks: Record<string, any> = {};
    slots.forEach(s => {
      const date = normDate(s.date);
      if (date < todayIso) return;
      marks[date] = s.is_available
        ? { customStyles: { container: styles.dotAvail, text: styles.dotAvailText } }
        : { customStyles: { container: styles.dotBlocked, text: styles.dotBlockedText } };
    });
    if (selected) {
      marks[selected] = {
        ...marks[selected],
        customStyles: {
          container: styles.dotSelected,
          text: styles.dotSelectedText,
        },
      };
    }
    return marks;
  }, [slots, selected, C]);

  // ── Optimistic helpers ─────────────────────────────────────────────────────
  function applyOptimistic(dates: string[], isAvailable: boolean) {
    setSlots(prev => {
      const set = new Set(dates);
      return [...prev.filter(s => !set.has(normDate(s.date))), ...makeOptimisticSlots(dates, isAvailable)];
    });
  }
  function revertTo(snapshot: AvailabilitySlot[]) { setSlots(snapshot); }

  // ── Toggle single day ──────────────────────────────────────────────────────
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

  // ── Block / free week ──────────────────────────────────────────────────────
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

  // ── Block / free month ─────────────────────────────────────────────────────
  const blockMonth = async (isAvailable: boolean) => {
    const [y, m] = currentMonth.split('-').map(Number);
    const monthDates = getDatesForMonth(y, m - 1).filter(d => d >= todayIso);
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
      const label = new Date(y, m - 1, 1).toLocaleDateString('en-NG', { month: 'long' });
      feedback.success(isAvailable ? `${label} opened` : `${label} blocked`);
    } catch (e: any) {
      revertTo(snapshot);
      feedback.error('Could not update month', e?.error ?? e?.message);
    } finally { setSaving(false); }
  };

  const selectedSlot        = selected ? slotMap[selected] : null;
  const selectedIsAvailable = !selectedSlot || selectedSlot.is_available;

  const [y, m] = currentMonth.split('-').map(Number);
  const monthDates      = getDatesForMonth(y, m - 1);
  const futureCount     = monthDates.filter(d => d >= todayIso).length;
  const availableCount  = monthDates.filter(d => {
    if (d < todayIso) return false;
    const s = slotMap[d];
    return !s || s.is_available;
  }).length;
  const blockedCount = futureCount - availableCount;

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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={C.spice} />}
      >
        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <View style={[styles.statDot, { backgroundColor: C.successFg }]} />
            <Text style={styles.statText}>{availableCount} open</Text>
          </View>
          <Text style={styles.statSep}>·</Text>
          <View style={styles.statItem}>
            <View style={[styles.statDot, { backgroundColor: C.errorFg }]} />
            <Text style={styles.statText}>{blockedCount} blocked</Text>
          </View>
        </View>

        {/* Month quick actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity style={[styles.quickBtn, styles.quickBtnOpen]} onPress={() => blockMonth(true)} disabled={saving}>
            <Ionicons name="sunny-outline" size={14} color={C.successFg} />
            <Text style={[styles.quickBtnText, { color: C.successFg }]}>Open month</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.quickBtn, styles.quickBtnBlock]} onPress={() => blockMonth(false)} disabled={saving}>
            <Ionicons name="moon-outline" size={14} color={C.errorFg} />
            <Text style={[styles.quickBtnText, { color: C.errorFg }]}>Block month</Text>
          </TouchableOpacity>
        </View>

        {/* Calendar */}
        {loading ? (
          <View style={{ alignItems: 'center', paddingVertical: 40 }}>
            <ActivityIndicator color={C.spice} size="large" />
          </View>
        ) : (
          <View style={styles.calendarCard}>
            <Calendar
              current={currentMonth + '-01'}
              onMonthChange={month => setCurrentMonth(month.dateString.slice(0, 7))}
              onDayPress={day => {
                if (day.dateString < todayIso) return;
                setSelected(prev => prev === day.dateString ? null : day.dateString);
              }}
              markingType="custom"
              markedDates={markedDates}
              minDate={todayIso}
              theme={{
                backgroundColor: C.bgCard,
                calendarBackground: C.bgCard,
                textSectionTitleColor: C.bodySoft,
                selectedDayBackgroundColor: C.spice,
                selectedDayTextColor: '#fff',
                todayTextColor: C.spice,
                dayTextColor: C.textInk,
                textDisabledColor: C.stone,
                arrowColor: C.spice,
                monthTextColor: C.textInk,
                textDayFontFamily: Fonts.sansMedium,
                textMonthFontFamily: Fonts.sansMedium,
                textDayHeaderFontFamily: Fonts.sansMedium,
                textDayFontSize: 14,
                textMonthFontSize: 16,
                textDayHeaderFontSize: 11,
              }}
            />
          </View>
        )}

        {/* Legend */}
        <View style={styles.legend}>
          {[
            { color: C.successFg, bg: '#DCFCE7', label: 'Available' },
            { color: C.errorFg,   bg: '#FEE2E2', label: 'Blocked' },
            { color: C.spice,     bg: C.honey,   label: 'Selected' },
          ].map(({ color, bg, label }) => (
            <View key={label} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: bg, borderColor: color }]} />
              <Text style={styles.legendText}>{label}</Text>
            </View>
          ))}
        </View>

        {/* Selected day panel */}
        {selected && (
          <View style={styles.dayPanel}>
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
              <TouchableOpacity onPress={() => setSelected(null)} style={{ padding: 4 }}>
                <Ionicons name="close" size={18} color={C.bodySoft} />
              </TouchableOpacity>
            </View>

            <View style={styles.dayToggleRow}>
              <TouchableOpacity
                style={[styles.dayToggleBtn, selectedIsAvailable ? styles.dayToggleBtnActiveOpen : styles.dayToggleBtnIdle]}
                onPress={() => !selectedIsAvailable && toggleDay(selected, true)}
                disabled={saving || selectedIsAvailable}
              >
                <Ionicons name="checkmark-circle" size={17} color={selectedIsAvailable ? C.canvas : C.bodySoft} />
                <Text style={[styles.dayToggleBtnText, { color: selectedIsAvailable ? C.canvas : C.bodySoft }]}>Open</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dayToggleBtn, !selectedIsAvailable ? styles.dayToggleBtnActiveBlock : styles.dayToggleBtnIdle]}
                onPress={() => selectedIsAvailable && toggleDay(selected, false)}
                disabled={saving || !selectedIsAvailable}
              >
                <Ionicons name="close-circle" size={17} color={!selectedIsAvailable ? C.canvas : C.bodySoft} />
                <Text style={[styles.dayToggleBtnText, { color: !selectedIsAvailable ? C.canvas : C.bodySoft }]}>Block</Text>
              </TouchableOpacity>
            </View>

            <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: C.borderWarm }} />

            <Text style={styles.weekLabel}>This week</Text>
            <View style={styles.weekActions}>
              <TouchableOpacity style={[styles.weekBtn, styles.weekBtnOpen]} onPress={() => blockWeek(true)} disabled={saving}>
                <Ionicons name="sunny-outline" size={14} color={C.successFg} />
                <Text style={[styles.weekBtnText, { color: C.successFg }]}>Open week</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.weekBtn, styles.weekBtnBlock]} onPress={() => blockWeek(false)} disabled={saving}>
                <Ionicons name="moon-outline" size={14} color={C.errorFg} />
                <Text style={[styles.weekBtnText, { color: C.errorFg }]}>Block week</Text>
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

  content:    { padding: Spacing.lg, gap: 16, paddingBottom: 60 },

  statsRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center' },
  statItem:   { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statDot:    { width: 8, height: 8, borderRadius: 4 },
  statText:   { fontFamily: Fonts.sans, fontSize: 13, color: C.bodySoft },
  statSep:    { fontFamily: Fonts.sans, fontSize: 13, color: C.stone },

  quickActions:   { flexDirection: 'row', gap: 10 },
  quickBtn:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: Radius.md, borderWidth: 1.5 },
  quickBtnOpen:   { borderColor: C.successFg, backgroundColor: C.successBg },
  quickBtnBlock:  { borderColor: C.errorFg,   backgroundColor: C.errorBg },
  quickBtnText:   { fontFamily: Fonts.sansMedium, fontSize: 13 },

  calendarCard:   { borderRadius: Radius.lg, overflow: 'hidden', ...Shadow.card },

  // Custom day styles used by markedDates customStyles
  dotAvail:         { backgroundColor: '#DCFCE7', borderRadius: 8, width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  dotAvailText:     { color: '#15803D', fontFamily: Fonts.sansMedium, fontSize: 14 },
  dotBlocked:       { backgroundColor: '#FEE2E2', borderRadius: 8, width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  dotBlockedText:   { color: '#DC2626', fontFamily: Fonts.sansMedium, fontSize: 14 },
  dotSelected:      { backgroundColor: C.spice, borderRadius: 8, width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  dotSelectedText:  { color: '#FFF', fontFamily: Fonts.sansMedium, fontSize: 14 },

  legend:         { flexDirection: 'row', gap: Spacing.md, justifyContent: 'center' },
  legendItem:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot:      { width: 12, height: 12, borderRadius: 4, borderWidth: 1 },
  legendText:     { fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft },

  dayPanel:         { backgroundColor: C.bgCard, borderRadius: Radius.lg, padding: Spacing.md, gap: 12, ...Shadow.card, borderWidth: StyleSheet.hairlineWidth, borderColor: C.borderWarm },
  dayPanelTop:      { flexDirection: 'row', alignItems: 'flex-start' },
  dayPanelDate:     { fontFamily: Fonts.sansMedium, fontSize: 16, color: C.ink },
  dayPanelStatus:   { fontFamily: Fonts.sans, fontSize: 13, marginTop: 2 },

  dayToggleRow:           { flexDirection: 'row', gap: 10 },
  dayToggleBtn:           { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: Radius.md, borderWidth: 1.5, borderColor: C.borderWarm, backgroundColor: C.bg },
  dayToggleBtnActiveOpen: { backgroundColor: '#16A34A', borderColor: '#16A34A' },
  dayToggleBtnActiveBlock:{ backgroundColor: '#DC2626', borderColor: '#DC2626' },
  dayToggleBtnIdle:       {},
  dayToggleBtnText:       { fontFamily: Fonts.sansMedium, fontSize: 14 },

  weekLabel:      { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.bodySoft, letterSpacing: 0.3 },
  weekActions:    { flexDirection: 'row', gap: 10 },
  weekBtn:        { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10, borderRadius: Radius.md, borderWidth: 1 },
  weekBtnOpen:    { borderColor: C.successFg, backgroundColor: C.successBg },
  weekBtnBlock:   { borderColor: C.errorFg,   backgroundColor: C.errorBg },
  weekBtnText:    { fontFamily: Fonts.sansMedium, fontSize: 13 },

  hint:       { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.honey, borderRadius: Radius.md, padding: 12 },
  hintText:   { fontFamily: Fonts.sans, fontSize: 13, color: C.body, flex: 1 },
}); }
