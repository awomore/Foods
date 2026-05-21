import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { healthApi } from '../../src/api/health';
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
      {value && <Text style={styles.rowValue}>{value}</Text>}
      {onPress && <Ionicons name="chevron-forward" size={16} color={Colors.bodySoft} />}
    </TouchableOpacity>
  );
}

export default function AccountScreen() {
  const { user, signOut, setActiveMode } = useAuth();
  const router = useRouter();
  const [allergens, setAllergens] = useState<string[]>([]);
  const [loadingHealth, setLoadingHealth] = useState(true);

  const initial = user?.full_name?.charAt(0).toUpperCase() ?? 'U';

  const loadHealth = useCallback(async () => {
    try {
      const { profile } = await healthApi.getProfile();
      setAllergens(profile?.allergens ?? []);
    } catch {
      setAllergens([]);
    } finally {
      setLoadingHealth(false);
    }
  }, []);

  useEffect(() => { loadHealth(); }, [loadHealth]);

  return (
    <View style={styles.root}>
      <SafeAreaView>
        <View style={styles.topBar}>
          <Text style={styles.pageTitle}>You</Text>
        </View>
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: Spacing.lg, gap: 16, paddingTop: 8 }}>

        {/* Profile card */}
        <View style={styles.profileCard}>
          <Avatar name={initial} avatarBg={Colors.spice} size={56} />
          <View style={{ flex: 1 }}>
            <Text style={styles.fullName}>{user?.full_name ?? 'Customer'}</Text>
            <Text style={styles.phone}>{user?.phone ?? '+234 — —'}</Text>
          </View>
          <TouchableOpacity style={styles.editBtn}>
            <Ionicons name="pencil-outline" size={15} color={Colors.spice} />
          </TouchableOpacity>
        </View>

        {/* Account section */}
        <View>
          <Text style={styles.sectionLabel}>Account</Text>
          <View style={styles.card}>
            <Row icon="person-outline" label="Full name" value={user?.full_name ?? '—'} onPress={() => {}} />
            <View style={styles.divider} />
            <Row icon="call-outline" label="Phone" value={user?.phone ?? '—'} />
            <View style={styles.divider} />
            <Row icon="location-outline" label="Default address" onPress={() => {}} />
          </View>
        </View>

        {/* Allergens */}
        <View>
          <Text style={styles.sectionLabel}>Allergen profile</Text>
          <View style={styles.card}>
            {loadingHealth ? (
              <View style={{ padding: 14, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={Colors.spice} />
              </View>
            ) : (
              <View style={styles.allergenRow}>
                {allergens.map(a => (
                  <View key={a} style={styles.allergenPill}>
                    <Ionicons name="warning-outline" size={12} color={Colors.errorFg} />
                    <Text style={styles.allergenText}>{a}</Text>
                  </View>
                ))}
                <TouchableOpacity style={styles.addAllergenPill}>
                  <Ionicons name="add" size={14} color={Colors.spice} />
                  <Text style={styles.addAllergenText}>Add</Text>
                </TouchableOpacity>
              </View>
            )}
            <Text style={styles.allergenNote}>
              Cooks are shown a warning when their dish matches your allergens.
            </Text>
          </View>
        </View>

        {/* Preferences */}
        <View>
          <Text style={styles.sectionLabel}>Preferences</Text>
          <View style={styles.card}>
            <Row icon="notifications-outline" label="Notifications" onPress={() => {}} />
            <View style={styles.divider} />
            <Row icon="moon-outline" label="Appearance" value="System" onPress={() => {}} />
            <View style={styles.divider} />
            <Row icon="language-outline" label="Language" value="English" onPress={() => {}} />
          </View>
        </View>

        {/* Support */}
        <View>
          <Text style={styles.sectionLabel}>Support</Text>
          <View style={styles.card}>
            <Row icon="help-circle-outline" label="Help & FAQ" onPress={() => {}} />
            <View style={styles.divider} />
            <Row icon="chatbubble-outline" label="Contact support" onPress={() => {}} />
            <View style={styles.divider} />
            <Row icon="document-text-outline" label="Terms & Privacy" onPress={() => {}} />
          </View>
        </View>

        {/* Kitchen switch — only visible to users whose primary role is cook */}
        {user?.role === 'cook' && (
          <TouchableOpacity
            style={styles.kitchenCard}
            activeOpacity={0.85}
            onPress={async () => {
              await setActiveMode('cook');
              router.replace('/(cook)/');
            }}
          >
            <View style={styles.kitchenIcon}>
              <Ionicons name="storefront-outline" size={20} color={Colors.canvas} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.kitchenTitle}>Back to my kitchen</Text>
              <Text style={styles.kitchenSub}>Manage your menu, orders and earnings</Text>
            </View>
            <Ionicons name="arrow-forward" size={18} color={Colors.canvas} />
          </TouchableOpacity>
        )}

        {/* Sign out */}
        <View style={styles.card}>
          <Row icon="log-out-outline" label="Sign out" danger onPress={signOut} />
        </View>

        <Text style={styles.version}>FOODSbyme v1.0.0</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  topBar: { paddingHorizontal: Spacing.lg, paddingTop: 16, paddingBottom: 8 },
  pageTitle: { fontFamily: Fonts.serif, fontSize: 26, color: Colors.textInk },

  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: 16, borderWidth: 0.5, borderColor: Colors.borderWarm, ...Shadow.card },
  fullName: { fontFamily: Fonts.sansMedium, fontSize: 16, color: Colors.textInk, fontWeight: '600' },
  phone: { fontFamily: Fonts.sans, fontSize: 13, color: Colors.bodySoft, marginTop: 3 },
  editBtn: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: Colors.borderWarm, alignItems: 'center', justifyContent: 'center' },

  sectionLabel: { fontFamily: Fonts.sansMedium, fontSize: 13, color: Colors.caps, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },

  card: { backgroundColor: Colors.bgCard, borderRadius: Radius.lg, borderWidth: 0.5, borderColor: Colors.borderWarm, ...Shadow.card, overflow: 'hidden' },
  divider: { height: 0.5, backgroundColor: Colors.borderWarm, marginLeft: 50 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  rowIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: Colors.bgCook, alignItems: 'center', justifyContent: 'center' },
  rowIconDanger: { backgroundColor: Colors.errorBg },
  rowLabel: { fontFamily: Fonts.sans, fontSize: 14, color: Colors.textInk, flex: 1 },
  rowLabelDanger: { color: Colors.errorFg },
  rowValue: { fontFamily: Fonts.sans, fontSize: 13, color: Colors.bodySoft, maxWidth: 120, textAlign: 'right' },

  allergenRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 14 },
  allergenPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.errorBg, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 40 },
  allergenText: { fontFamily: Fonts.sansMedium, fontSize: 12, color: Colors.errorFg },
  addAllergenPill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: Colors.borderWarm, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 40, borderStyle: 'dashed' },
  addAllergenText: { fontFamily: Fonts.sansMedium, fontSize: 12, color: Colors.spice },
  allergenNote: { fontFamily: Fonts.sans, fontSize: 11, color: Colors.bodySoft, paddingHorizontal: 14, paddingBottom: 14, lineHeight: 16 },

  kitchenCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.ink, borderRadius: Radius.lg,
    padding: 16, ...Shadow.card,
  },
  kitchenIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  kitchenTitle: { fontFamily: Fonts.sansMedium, fontSize: 15, color: Colors.canvas, fontWeight: '600', marginBottom: 2 },
  kitchenSub:   { fontFamily: Fonts.sans, fontSize: 12, color: 'rgba(250,246,240,0.55)' },

  version: { fontFamily: Fonts.sans, fontSize: 11, color: Colors.stone, textAlign: 'center', paddingVertical: 8 },
});
