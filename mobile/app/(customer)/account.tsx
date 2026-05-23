import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView,
  ActivityIndicator, Modal, TextInput, Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { authApi } from '../../src/api/auth';
import { healthApi } from '../../src/api/health';
import { loyaltyApi, type LoyaltyBalance } from '../../src/api/loyalty';
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

const COMMON_ALLERGENS = ['Peanuts', 'Tree nuts', 'Dairy', 'Eggs', 'Wheat/Gluten', 'Soy', 'Fish', 'Shellfish', 'Sesame'];

function AllergenModal({
  visible, current, onClose, onSave,
}: {
  visible: boolean;
  current: string[];
  onClose: () => void;
  onSave: (allergens: string[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>(current);
  const [custom, setCustom] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { setSelected(current); }, [current]);

  function toggle(a: string) {
    setSelected(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]);
  }

  function addCustom() {
    const trimmed = custom.trim();
    if (!trimmed) return;
    if (!selected.includes(trimmed)) setSelected(prev => [...prev, trimmed]);
    setCustom('');
  }

  async function save() {
    setSaving(true);
    try { await onSave(selected); }
    finally { setSaving(false); }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Allergen profile</Text>
          <Text style={styles.modalSub}>Cooks see a warning when their dish matches your allergens.</Text>

          <View style={styles.allergenGrid}>
            {COMMON_ALLERGENS.map(a => (
              <TouchableOpacity
                key={a}
                onPress={() => toggle(a)}
                style={[styles.allergenChip, selected.includes(a) && styles.allergenChipActive]}
              >
                {selected.includes(a) && <Ionicons name="warning" size={11} color={Colors.errorFg} />}
                <Text style={[styles.allergenChipText, selected.includes(a) && styles.allergenChipTextActive]}>{a}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {selected.filter(a => !COMMON_ALLERGENS.includes(a)).map(a => (
            <View key={a} style={styles.customAllergenRow}>
              <View style={[styles.allergenChip, styles.allergenChipActive, { flex: 1 }]}>
                <Ionicons name="warning" size={11} color={Colors.errorFg} />
                <Text style={[styles.allergenChipText, styles.allergenChipTextActive]}>{a}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelected(prev => prev.filter(x => x !== a))}>
                <Ionicons name="close-circle" size={18} color={Colors.errorFg} />
              </TouchableOpacity>
            </View>
          ))}

          <View style={styles.customInputRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Add other allergen…"
              placeholderTextColor={Colors.stone}
              value={custom}
              onChangeText={setCustom}
              onSubmitEditing={addCustom}
            />
            <TouchableOpacity style={styles.addBtn} onPress={addCustom}>
              <Ionicons name="add" size={18} color={Colors.canvas} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
            {saving ? <ActivityIndicator color={Colors.canvas} /> : <Text style={styles.saveBtnText}>Save</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelModalBtn} onPress={onClose}>
            <Text style={styles.cancelModalText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function AccountScreen() {
  const { user, signOut, setActiveMode, refreshUser } = useAuth();
  const router = useRouter();
  const [allergens, setAllergens] = useState<string[]>([]);
  const [loadingHealth, setLoadingHealth] = useState(true);
  const [loyaltyBalance, setLoyaltyBalance] = useState<LoyaltyBalance | null>(null);
  const [loyaltyCurrencyValue, setLoyaltyCurrencyValue] = useState(0);
  const [showAllergenModal, setShowAllergenModal] = useState(false);
  const [showEditName, setShowEditName] = useState(false);
  const [editNameValue, setEditNameValue] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [defaultAddress, setDefaultAddress] = useState('');
  const [showEditAddress, setShowEditAddress] = useState(false);
  const [editAddressValue, setEditAddressValue] = useState('');
  const [savingAddress, setSavingAddress] = useState(false);

  const initial = user?.full_name?.charAt(0).toUpperCase() ?? 'U';

  const loadHealth = useCallback(async () => {
    try {
      const { health_profile } = await healthApi.getProfile();
      setAllergens(health_profile?.allergens ?? []);
    } catch {
      setAllergens([]);
    } finally {
      setLoadingHealth(false);
    }
  }, []);

  const loadLoyalty = useCallback(async () => {
    try {
      const data = await loyaltyApi.get();
      setLoyaltyBalance(data.balance);
      setLoyaltyCurrencyValue(data.currency_value);
    } catch {}
  }, []);

  useEffect(() => {
    loadHealth();
    loadLoyalty();
    if (user?.id) {
      AsyncStorage.getItem(`@default_address_${user.id}`).then(v => { if (v) setDefaultAddress(v); });
    }
  }, [loadHealth, loadLoyalty, user?.id]);

  function openEditName() {
    setEditNameValue(user?.full_name ?? '');
    setShowEditName(true);
  }

  async function saveEditName() {
    const trimmed = editNameValue.trim();
    if (!trimmed) return;
    setSavingName(true);
    try {
      await authApi.updateProfile({ full_name: trimmed });
      await refreshUser();
      setShowEditName(false);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Could not update name');
    } finally {
      setSavingName(false);
    }
  }

  function openEditAddress() {
    setEditAddressValue(defaultAddress);
    setShowEditAddress(true);
  }

  async function saveEditAddress() {
    const trimmed = editAddressValue.trim();
    setSavingAddress(true);
    try {
      await AsyncStorage.setItem(`@default_address_${user?.id}`, trimmed);
      setDefaultAddress(trimmed);
      setShowEditAddress(false);
    } catch {
      Alert.alert('Error', 'Could not save address');
    } finally {
      setSavingAddress(false);
    }
  }

  async function saveAllergens(newAllergens: string[]) {
    try {
      const { health_profile } = await healthApi.updateProfile({ allergens: newAllergens });
      setAllergens(health_profile?.allergens ?? newAllergens);
      setShowAllergenModal(false);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Could not save allergens');
    }
  }

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
          <TouchableOpacity style={styles.editBtn} onPress={openEditName}>
            <Ionicons name="pencil-outline" size={15} color={Colors.spice} />
          </TouchableOpacity>
        </View>

        {/* Account section */}
        <View>
          <Text style={styles.sectionLabel}>Account</Text>
          <View style={styles.card}>
            <Row icon="person-outline" label="Full name" value={user?.full_name ?? '—'} onPress={openEditName} />
            <View style={styles.divider} />
            <Row icon="call-outline" label="Phone" value={user?.phone ?? '—'} />
            <View style={styles.divider} />
            <Row
              icon="heart-outline"
              label="My cravings"
              onPress={() => router.push(`/profile/${user?.id}` as any)}
            />
            <View style={styles.divider} />
            <Row icon="location-outline" label="Default address" value={defaultAddress || undefined} onPress={openEditAddress} />
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
                <TouchableOpacity style={styles.addAllergenPill} onPress={() => setShowAllergenModal(true)}>
                  <Ionicons name="add" size={14} color={Colors.spice} />
                  <Text style={styles.addAllergenText}>{allergens.length > 0 ? 'Edit' : 'Add'}</Text>
                </TouchableOpacity>
              </View>
            )}
            <Text style={styles.allergenNote}>
              Cooks are shown a warning when their dish matches your allergens.
            </Text>
          </View>
        </View>

        {/* Loyalty points */}
        {loyaltyBalance !== null && (
          <View>
            <Text style={styles.sectionLabel}>Loyalty points</Text>
            <View style={styles.loyaltyCard}>
              <View style={styles.loyaltyLeft}>
                <Text style={styles.loyaltyPoints}>{loyaltyBalance.balance.toLocaleString()}</Text>
                <Text style={styles.loyaltyLabel}>points</Text>
              </View>
              <View style={styles.loyaltyDivider} />
              <View style={{ flex: 1 }}>
                <Text style={styles.loyaltyValue}>₦{loyaltyCurrencyValue.toLocaleString('en-NG', { maximumFractionDigits: 0 })}</Text>
                <Text style={styles.loyaltyValueLabel}>equivalent value</Text>
                <Text style={styles.loyaltyLifetime}>{loyaltyBalance.lifetime_earned.toLocaleString()} earned lifetime</Text>
              </View>
            </View>
          </View>
        )}

        {/* Bookings */}
        <View>
          <Text style={styles.sectionLabel}>Services</Text>
          <View style={styles.card}>
            <Row
              icon="calendar-outline"
              label="Event bookings"
              onPress={() => router.push('/(customer)/bookings' as any)}
            />
          </View>
        </View>

        {/* Preferences */}
        <View>
          <Text style={styles.sectionLabel}>Preferences</Text>
          <View style={styles.card}>
            <Row icon="notifications-outline" label="Notifications" onPress={() => router.push('/(customer)/notifications' as any)} />
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

        {user?.role === 'cook' && (
          <TouchableOpacity
            style={styles.kitchenCard}
            activeOpacity={0.85}
            onPress={async () => {
              await setActiveMode('cook');
              router.replace('/(cook)');
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

        <View style={styles.card}>
          <Row icon="log-out-outline" label="Sign out" danger onPress={signOut} />
        </View>

        <Text style={styles.version}>FOODSbyme v1.0.0</Text>
      </ScrollView>

      <AllergenModal
        visible={showAllergenModal}
        current={allergens}
        onClose={() => setShowAllergenModal(false)}
        onSave={saveAllergens}
      />

      <Modal visible={showEditAddress} transparent animationType="slide" onRequestClose={() => setShowEditAddress(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Default delivery address</Text>
            <TextInput
              style={[styles.input, styles.inputMulti]}
              value={editAddressValue}
              onChangeText={setEditAddressValue}
              placeholder="e.g. 12 Adeola Odeku, Victoria Island, Lagos"
              placeholderTextColor={Colors.stone}
              autoFocus
              multiline
              numberOfLines={3}
              returnKeyType="done"
            />
            <TouchableOpacity style={[styles.saveBtn, savingAddress && { opacity: 0.6 }]} onPress={saveEditAddress} disabled={savingAddress}>
              {savingAddress ? <ActivityIndicator color={Colors.canvas} /> : <Text style={styles.saveBtnText}>Save address</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelModalBtn} onPress={() => setShowEditAddress(false)}>
              <Text style={styles.cancelModalText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showEditName} transparent animationType="slide" onRequestClose={() => setShowEditName(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Edit name</Text>
            <TextInput
              style={styles.input}
              value={editNameValue}
              onChangeText={setEditNameValue}
              placeholder="Full name"
              placeholderTextColor={Colors.stone}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={saveEditName}
            />
            <TouchableOpacity style={[styles.saveBtn, savingName && { opacity: 0.6 }]} onPress={saveEditName} disabled={savingName}>
              {savingName ? <ActivityIndicator color={Colors.canvas} /> : <Text style={styles.saveBtnText}>Save</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelModalBtn} onPress={() => setShowEditName(false)}>
              <Text style={styles.cancelModalText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  topBar: { paddingHorizontal: Spacing.lg, paddingTop: 16, paddingBottom: 8 },
  pageTitle: { fontFamily: Fonts.serif, fontSize: 26, color: Colors.textInk },

  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: 16, borderWidth: 0.5, borderColor: Colors.borderWarm, ...Shadow.card },
  fullName: { fontFamily: Fonts.sansMedium, fontSize: 16, color: Colors.textInk },
  phone: { fontFamily: Fonts.sans, fontSize: 13, color: Colors.bodySoft, marginTop: 3 },
  editBtn: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: Colors.borderWarm, alignItems: 'center', justifyContent: 'center' },

  sectionLabel: { fontFamily: Fonts.sansMedium, fontSize: 13, color: Colors.caps, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },

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

  loyaltyCard: { backgroundColor: Colors.bgCard, borderRadius: Radius.lg, borderWidth: 0.5, borderColor: Colors.borderWarm, ...Shadow.card, flexDirection: 'row', alignItems: 'center', padding: 16, gap: 16 },
  loyaltyLeft: { alignItems: 'center', gap: 2 },
  loyaltyPoints: { fontFamily: Fonts.serif, fontSize: 28, color: Colors.spice },
  loyaltyLabel: { fontFamily: Fonts.sans, fontSize: 11, color: Colors.bodySoft },
  loyaltyDivider: { width: 0.5, height: 48, backgroundColor: Colors.borderWarm },
  loyaltyValue: { fontFamily: Fonts.sansMedium, fontSize: 16, color: Colors.textInk },
  loyaltyValueLabel: { fontFamily: Fonts.sans, fontSize: 11, color: Colors.bodySoft, marginTop: 2 },
  loyaltyLifetime: { fontFamily: Fonts.sans, fontSize: 11, color: Colors.bodySoft, marginTop: 6 },

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
  kitchenTitle: { fontFamily: Fonts.sansMedium, fontSize: 15, color: Colors.canvas, marginBottom: 2 },
  kitchenSub:   { fontFamily: Fonts.sans, fontSize: 12, color: 'rgba(250,246,240,0.55)' },

  version: { fontFamily: Fonts.sans, fontSize: 11, color: Colors.stone, textAlign: 'center', paddingVertical: 8 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: Colors.bgCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.lg, gap: 14, paddingBottom: 36 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.borderWarm, alignSelf: 'center', marginBottom: 4 },
  modalTitle: { fontFamily: Fonts.serif, fontSize: 20, color: Colors.textInk },
  modalSub: { fontFamily: Fonts.sans, fontSize: 13, color: Colors.bodySoft, lineHeight: 18, marginTop: -6 },
  allergenGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  allergenChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 40, borderWidth: 1, borderColor: Colors.borderWarm, backgroundColor: Colors.bg },
  allergenChipActive: { backgroundColor: Colors.errorBg, borderColor: Colors.errorFg + '40' },
  allergenChipText: { fontFamily: Fonts.sansMedium, fontSize: 12, color: Colors.body },
  allergenChipTextActive: { color: Colors.errorFg },
  customAllergenRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  customInputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: { backgroundColor: Colors.bg, borderRadius: Radius.md, borderWidth: 0.5, borderColor: Colors.borderWarm, paddingHorizontal: 14, paddingVertical: 11, fontFamily: Fonts.sans, fontSize: 14, color: Colors.textInk },
  inputMulti: { minHeight: 80, textAlignVertical: 'top', paddingTop: 12 },
  addBtn: { width: 42, height: 42, borderRadius: Radius.md, backgroundColor: Colors.spice, alignItems: 'center', justifyContent: 'center' },
  saveBtn: { backgroundColor: Colors.spice, borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center' },
  saveBtnText: { fontFamily: Fonts.sansMedium, fontSize: 15, color: Colors.canvas },
  cancelModalBtn: { alignItems: 'center', paddingVertical: 8 },
  cancelModalText: { fontFamily: Fonts.sans, fontSize: 14, color: Colors.bodySoft },
});
