import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { chefAvailabilityApi, type AvailabilitySlot, type TimeSlot } from '../../src/api/chefAvailability';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { Fonts, Spacing, Radius, Shadow, FontSize } from '../../src/constants/theme';
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
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await chefAvailabilityApi.myCalendar(MONTHS_AHEAD * 30);
      setSlots(res.slots ?? []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const slotMap = useMemo(() => {
    const m: Record<string, AvailabilitySlot> = {};
    slots.forEach(s => { m[s.date] = s; });
    return m;
  }, [slots]);

  const selectedSlot = selected ? slotMap[selected] : null;

  const toggleDay = async (date: string, isAvailable: boolean) => {
    setSaving(true);
    try {
      const { slot } = await chefAvailabilityApi.setDay(date, { is_available: isAvailable });
      setSlots(prev => {
        const filtered = prev.filter(s => s.date !== date);
        return [...filtered, slot];
      });
    } catch {
      feedback.toast({ type: 'error', message: 'Failed to update' });
    } finally { setSaving(false); }
  };

  const dates = getDatesForMonth(viewYear, viewMonth);
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString('en-NG', { month: 'long', year: 'numeric' });

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
        <Text style={styles.title}>My Availability</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Month navigation */}
        <View style={styles.monthNav}>
          <TouchableOpacity style={styles.monthBtn} onPress={prevMonth}>
            <Ionicons name="chevron-back" size={20} color={C.ink} />
          </TouchableOpacity>
          <Text style={styles.monthLabel}>{monthLabel}</Text>
          <TouchableOpacity style={styles.monthBtn} onPress={nextMonth}>
            <Ionicons name="chevron-forward" size={20} color={C.ink} />
          </TouchableOpacity>
        </View>

        {/* Day-of-week headers */}
        <View style={styles.weekHeader}>
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
            <Text key={d} style={styles.weekDay}>{d}</Text>
          ))}
        </View>

        {/* Calendar grid */}
        {loading ? (
          <View style={styles.loadingState}><ActivityIndicator size="large" color={C.spice} /></View>
        ) : (
          <View style={styles.calGrid}>
            {Array(firstDay).fill(null).map((_, i) => <View key={`e-${i}`} style={styles.calCell} />)}
            {dates.map(date => {
              const slot = slotMap[date];
              const isAvailable = !slot || slot.is_available;
              const isPast = date < today.toISOString().split('T')[0];
              return (
                <TouchableOpacity
                  key={date}
                  style={[
                    styles.calCell,
                    isAvailable && !isPast && styles.calCellAvailable,
                    !isAvailable && styles.calCellBlocked,
                    isPast && styles.calCellPast,
                    selected === date && styles.calCellSelected,
                  ]}
                  onPress={() => !isPast && setSelected(selected === date ? null : date)}
                  disabled={isPast}
                >
                  <Text style={[
                    styles.calCellText,
                    isAvailable && !isPast && styles.calCellTextAvailable,
                    selected === date && styles.calCellTextSelected,
                    isPast && styles.calCellTextPast,
                  ]}>
                    {new Date(date + 'T00:00:00').getDate()}
                  </Text>
                  {slot && !isPast && (
                    <View style={[styles.calDot, { backgroundColor: isAvailable ? C.leaf : C.errorFg }]} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Legend */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: C.leaf }]} />
            <Text style={styles.legendText}>Available</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: C.errorFg }]} />
            <Text style={styles.legendText}>Blocked</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: C.bgCook }]} />
            <Text style={styles.legendText}>Not set</Text>
          </View>
        </View>

        {/* Selected day panel */}
        {selected && (
          <View style={styles.dayPanel}>
            <Text style={styles.dayPanelTitle}>
              {new Date(selected + 'T00:00:00').toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long' })}
            </Text>
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Available for bookings</Text>
              <Switch
                value={!selectedSlot || selectedSlot.is_available}
                onValueChange={(val) => toggleDay(selected, val)}
                trackColor={{ false: C.borderWarm, true: C.leaf }}
                thumbColor={C.canvas}
                disabled={saving}
              />
            </View>
            {selectedSlot?.notes && (
              <Text style={styles.slotNote}>{selectedSlot.notes}</Text>
            )}
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
      paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
      borderBottomWidth: 1, borderBottomColor: C.borderWarm,
    },
    backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    title: { fontFamily: Fonts.sansMedium, fontSize: FontSize.lg, color: C.ink },
    content: { padding: Spacing.lg, gap: Spacing.lg },
    monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    monthBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: C.bgCard },
    monthLabel: { fontFamily: Fonts.sansMedium, fontSize: FontSize.lg, color: C.ink },
    weekHeader: { flexDirection: 'row', justifyContent: 'space-around' },
    weekDay: { fontFamily: Fonts.sansMedium, fontSize: FontSize.xs, color: C.bodySoft, width: '14%', textAlign: 'center' },
    loadingState: { height: 200, alignItems: 'center', justifyContent: 'center' },
    calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    calCell: {
      width: '14.28%', aspectRatio: 1,
      alignItems: 'center', justifyContent: 'center', position: 'relative',
    },
    calCellAvailable: { backgroundColor: C.successBg, borderRadius: Radius.sm },
    calCellBlocked: { backgroundColor: C.errorBg, borderRadius: Radius.sm },
    calCellPast: { opacity: 0.35 },
    calCellSelected: { backgroundColor: C.spice, borderRadius: Radius.sm },
    calCellText: { fontFamily: Fonts.sansMedium, fontSize: FontSize.sm, color: C.bodySoft },
    calCellTextAvailable: { color: C.successFg },
    calCellTextSelected: { color: C.canvas },
    calCellTextPast: { color: C.stone },
    calDot: { width: 4, height: 4, borderRadius: 2, position: 'absolute', bottom: 4 },
    legend: { flexDirection: 'row', gap: Spacing.lg, justifyContent: 'center' },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendDot: { width: 10, height: 10, borderRadius: 5 },
    legendText: { fontFamily: Fonts.sans, fontSize: FontSize.sm, color: C.body },
    dayPanel: {
      backgroundColor: C.bgCard, borderRadius: Radius.lg, padding: Spacing.md,
      gap: Spacing.sm, ...Shadow.card,
    },
    dayPanelTitle: { fontFamily: Fonts.sansMedium, fontSize: FontSize.lg, color: C.ink },
    toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    toggleLabel: { fontFamily: Fonts.sans, fontSize: FontSize.body, color: C.ink },
    slotNote: { fontFamily: Fonts.sans, fontSize: FontSize.sm, color: C.bodySoft },
  });
}
