import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api/client';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { Fonts, Spacing, Radius, Shadow, FontSize } from '../../src/constants/theme';

interface PlatformSettings {
  platform_fee_rate: number;
  min_order_amount: number;
  max_delivery_radius: number;
  dispute_sla_hours: number;
  escrow_hold_days: number;
  max_refund_days: number;
}

export default function AdminSettingsScreen() {
  const router = useRouter();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<PlatformSettings>('/admin/settings')
      .then(setSettings)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const rows = settings ? [
    { label: 'Platform Fee Rate', value: `${(settings.platform_fee_rate * 100).toFixed(1)}%`, icon: 'trending-up-outline' },
    { label: 'Minimum Order Amount', value: `₦${settings.min_order_amount.toLocaleString()}`, icon: 'bag-outline' },
    { label: 'Max Delivery Radius', value: `${settings.max_delivery_radius} km`, icon: 'map-outline' },
    { label: 'Dispute SLA', value: `${settings.dispute_sla_hours} hours`, icon: 'time-outline' },
    { label: 'Escrow Hold Period', value: `${settings.escrow_hold_days} days`, icon: 'lock-closed-outline' },
    { label: 'Max Refund Window', value: `${settings.max_refund_days} days`, icon: 'card-outline' },
  ] : [];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <Text style={styles.title}>Platform Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.loadingState}><ActivityIndicator size="large" color={C.spice} /></View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <View style={styles.card}>
            {rows.map((row, i) => (
              <View key={row.label} style={[styles.row, i === rows.length - 1 && styles.rowLast]}>
                <View style={styles.rowLeft}>
                  <Ionicons name={row.icon as any} size={18} color={C.spice} />
                  <Text style={styles.rowLabel}>{row.label}</Text>
                </View>
                <Text style={styles.rowValue}>{row.value}</Text>
              </View>
            ))}
          </View>

          <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={18} color={C.infoFg} />
            <Text style={styles.infoText}>
              Settings are managed via Railway environment variables. Contact the platform engineer to update these values.
            </Text>
          </View>
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
    content: { padding: Spacing.lg, gap: Spacing.lg },
    card: { backgroundColor: C.bgCard, borderRadius: Radius.lg, ...Shadow.card, overflow: 'hidden' },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.borderWarm },
    rowLast: { borderBottomWidth: 0 },
    rowLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    rowLabel: { fontFamily: Fonts.sans, fontSize: FontSize.body, color: C.ink },
    rowValue: { fontFamily: Fonts.sansMedium, fontSize: FontSize.body, color: C.spice },
    infoBox: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start', backgroundColor: C.infoBg, borderRadius: Radius.md, padding: Spacing.md },
    infoText: { flex: 1, fontFamily: Fonts.sans, fontSize: FontSize.sm, color: C.body, lineHeight: 20 },
  });
}
