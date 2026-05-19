import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { cooksApi, type CookDetail } from '../../src/api/cooks';
import { Colors, Fonts, Spacing, Radius, Shadow } from '../../src/constants/theme';
import Avatar from '../../src/components/ui/Avatar';

type RowProps = { icon: string; label: string; value?: string; danger?: boolean; onPress?: () => void };
function Row({ icon, label, value, danger, onPress }: RowProps) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.row} activeOpacity={onPress ? 0.7 : 1}>
      <View style={[styles.rowIcon, danger && styles.rowIconDanger]}>
        <Ionicons name={icon as any} size={18} color={danger ? Colors.errorFg : Colors.spice} />
      </View>
      <Text style={[styles.rowLabel, danger && styles.rowLabelDanger]}>{label}</Text>
      {value && <Text style={styles.rowValue} numberOfLines={1}>{value}</Text>}
      {onPress && <Ionicons name="chevron-forward" size={16} color={Colors.bodySoft} />}
    </TouchableOpacity>
  );
}

export default function CookProfileSettings() {
  const { user, signOut } = useAuth();
  const [cook, setCook] = useState<CookDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!user?.cook_id) { setLoading(false); return; }
    if (!silent) setLoading(true);
    try {
      const { cook: c } = await cooksApi.get(user.cook_id);
      setCook(c);
    } catch (e) {
      console.error('cook profile load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.cook_id]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={Colors.spice} />
      </View>
    );
  }

  const displayName = cook?.display_name ?? user?.full_name ?? 'Chef';
  const initial = displayName.charAt(0).toUpperCase();
  const location = cook?.location ?? '';
  const openHours = cook?.open_time_default && cook?.close_time_default
    ? `${cook.open_time_default} – ${cook.close_time_default}`
    : 'Not set';

  return (
    <View style={styles.root}>
      <SafeAreaView>
        <View style={styles.topBar}>
          <Text style={styles.pageTitle}>Profile</Text>
        </View>
      </SafeAreaView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: Spacing.lg, gap: 16, paddingTop: 8 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={Colors.spice} />
        }
      >
        {/* Profile card */}
        <View style={styles.profileCard}>
          <Avatar name={initial} avatarBg={Colors.ember} size={60} />
          <View style={{ flex: 1 }}>
            <Text style={styles.fullName}>{displayName}</Text>
            {cook?.username && <Text style={styles.handle}>@{cook.username}</Text>}
            {location ? <Text style={styles.area}>{location}</Text> : null}
          </View>
          <TouchableOpacity style={styles.editBtn}>
            <Ionicons name="pencil-outline" size={15} color={Colors.spice} />
          </TouchableOpacity>
        </View>

        {/* Stats strip */}
        {cook && (
          <View style={styles.statsStrip}>
            {[
              { value: cook.platform_follower_count.toLocaleString(), label: 'Followers' },
              { value: `${Math.round(cook.repeat_order_rate * 100)}%`, label: 'Repeat rate' },
              { value: cook.total_orders.toLocaleString(), label: 'Orders' },
              { value: cook.average_rating > 0 ? cook.average_rating.toFixed(1) : '—', label: 'Rating' },
            ].map(s => (
              <View key={s.label} style={styles.statItem}>
                <Text style={styles.statValue}>{s.value}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Credentials */}
        {cook && (cook.food_safety_verified || cook.id_verified) && (
          <View>
            <Text style={styles.sectionLabel}>Credentials</Text>
            <View style={styles.card}>
              <View style={styles.credList}>
                {cook.food_safety_verified && (
                  <View style={styles.credRow}>
                    <View style={styles.credCheck}>
                      <Ionicons name="shield-checkmark-outline" size={16} color={Colors.successFg} />
                    </View>
                    <Text style={styles.credLabel}>Food safety certified</Text>
                    <View style={styles.verifiedPill}>
                      <Text style={styles.verifiedText}>Verified</Text>
                    </View>
                  </View>
                )}
                {cook.id_verified && (
                  <View style={styles.credRow}>
                    <View style={styles.credCheck}>
                      <Ionicons name="shield-checkmark-outline" size={16} color={Colors.successFg} />
                    </View>
                    <Text style={styles.credLabel}>ID verified</Text>
                    <View style={styles.verifiedPill}>
                      <Text style={styles.verifiedText}>Verified</Text>
                    </View>
                  </View>
                )}
              </View>
              <TouchableOpacity style={styles.addCredBtn}>
                <Ionicons name="add" size={16} color={Colors.spice} />
                <Text style={styles.addCredText}>Add credential</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Storefront */}
        <View>
          <Text style={styles.sectionLabel}>Storefront</Text>
          <View style={styles.card}>
            <Row icon="storefront-outline" label="Storefront name" value={cook?.storefront_title ?? displayName} onPress={() => {}} />
            <View style={styles.divider} />
            <Row icon="document-text-outline" label="Bio" value={cook?.bio ? cook.bio.slice(0, 40) + (cook.bio.length > 40 ? '…' : '') : undefined} onPress={() => {}} />
            <View style={styles.divider} />
            <Row icon="time-outline" label="Open hours" value={openHours} onPress={() => {}} />
            <View style={styles.divider} />
            <Row icon="location-outline" label="Location" value={location || 'Not set'} onPress={() => {}} />
          </View>
        </View>

        {/* Payments */}
        <View>
          <Text style={styles.sectionLabel}>Payments</Text>
          <View style={styles.card}>
            <Row icon="card-outline" label="Bank account" value="Tap to set up" onPress={() => {}} />
            <View style={styles.divider} />
            <Row icon="phone-portrait-outline" label="Mobile money" onPress={() => {}} />
          </View>
        </View>

        {/* Settings */}
        <View>
          <Text style={styles.sectionLabel}>Settings</Text>
          <View style={styles.card}>
            <Row icon="notifications-outline" label="Notifications" onPress={() => {}} />
            <View style={styles.divider} />
            <Row icon="shield-outline" label="Privacy" onPress={() => {}} />
            <View style={styles.divider} />
            <Row icon="help-circle-outline" label="Help & support" onPress={() => {}} />
          </View>
        </View>

        {/* Sign out */}
        <View style={styles.card}>
          <Row icon="log-out-outline" label="Sign out" danger onPress={signOut} />
        </View>

        <Text style={styles.version}>FOODSbyme v1.0.0 · Cook edition</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  topBar: { paddingHorizontal: Spacing.lg, paddingTop: 16, paddingBottom: 12 },
  pageTitle: { fontFamily: Fonts.serif, fontSize: 26, color: Colors.textInk },

  profileCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: 16, borderWidth: 0.5, borderColor: Colors.borderWarm, ...Shadow.card },
  fullName: { fontFamily: Fonts.sansMedium, fontSize: 16, color: Colors.textInk, fontWeight: '600' },
  handle: { fontFamily: Fonts.sans, fontSize: 13, color: Colors.spice, marginTop: 2 },
  area: { fontFamily: Fonts.sans, fontSize: 12, color: Colors.bodySoft, marginTop: 3 },
  editBtn: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: Colors.borderWarm, alignItems: 'center', justifyContent: 'center' },

  statsStrip: { flexDirection: 'row', backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: 16, borderWidth: 0.5, borderColor: Colors.borderWarm, ...Shadow.card },
  statItem: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { fontFamily: Fonts.serif, fontSize: 18, color: Colors.spice },
  statLabel: { fontFamily: Fonts.sans, fontSize: 10, color: Colors.bodySoft },

  sectionLabel: { fontFamily: Fonts.sansMedium, fontSize: 13, color: Colors.caps, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },

  card: { backgroundColor: Colors.bgCard, borderRadius: Radius.lg, borderWidth: 0.5, borderColor: Colors.borderWarm, ...Shadow.card, overflow: 'hidden' },
  divider: { height: 0.5, backgroundColor: Colors.borderWarm, marginLeft: 50 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  rowIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: Colors.bgCook, alignItems: 'center', justifyContent: 'center' },
  rowIconDanger: { backgroundColor: Colors.errorBg },
  rowLabel: { fontFamily: Fonts.sans, fontSize: 14, color: Colors.textInk, flex: 1 },
  rowLabelDanger: { color: Colors.errorFg },
  rowValue: { fontFamily: Fonts.sans, fontSize: 13, color: Colors.bodySoft, maxWidth: 130, textAlign: 'right' },

  credList: { padding: 14, gap: 12 },
  credRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  credCheck: { width: 30, height: 30, borderRadius: 8, backgroundColor: Colors.successBg, alignItems: 'center', justifyContent: 'center' },
  credLabel: { fontFamily: Fonts.sans, fontSize: 13, color: Colors.textInk, flex: 1 },
  verifiedPill: { backgroundColor: Colors.successBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 40 },
  verifiedText: { fontFamily: Fonts.sansMedium, fontSize: 11, color: Colors.successFg },
  addCredBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, margin: 14, marginTop: 0, paddingVertical: 10, borderTopWidth: 0.5, borderTopColor: Colors.borderWarm },
  addCredText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: Colors.spice },

  version: { fontFamily: Fonts.sans, fontSize: 11, color: Colors.stone, textAlign: 'center', paddingVertical: 8 },
});
