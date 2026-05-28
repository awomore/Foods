import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Modal, TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../src/context/AuthContext';
import { authApi } from '../../src/api/auth';
import { healthApi } from '../../src/api/health';
import { loyaltyApi, type LoyaltyBalance } from '../../src/api/loyalty';
import { useTheme, useColors, THEME_PRESETS, type AppColors } from '../../src/context/ThemeContext';
import { Fonts, Spacing, Radius, Shadow } from '../../src/constants/theme';
import Avatar from '../../src/components/ui/Avatar';

// ─── Row ──────────────────────────────────────────────────────────────────────

type RowProps = { icon: string; label: string; value?: string; danger?: boolean; onPress?: () => void; C: AppColors };

function Row({ icon, label, value, danger, onPress, C }: RowProps) {
  const S = useMemo(() => makeStyles(C), [C]);
  return (
    <TouchableOpacity onPress={onPress} style={S.row} activeOpacity={onPress ? 0.7 : 1}>
      <View style={[S.rowIcon, danger && { backgroundColor: C.errorBg }]}>
        <Ionicons name={icon as any} size={18} color={danger ? C.errorFg : C.spice} />
      </View>
      <Text style={[S.rowLabel, danger && { color: C.errorFg }]}>{label}</Text>
      {value && <Text style={S.rowValue}>{value}</Text>}
      {onPress && <Ionicons name="chevron-forward" size={16} color={C.bodySoft} />}
    </TouchableOpacity>
  );
}

// ─── Allergen modal ───────────────────────────────────────────────────────────

const COMMON_ALLERGENS = ['Peanuts', 'Tree nuts', 'Dairy', 'Eggs', 'Wheat/Gluten', 'Soy', 'Fish', 'Shellfish', 'Sesame'];

function AllergenModal({ visible, current, onClose, onSave }: { visible: boolean; current: string[]; onClose: () => void; onSave: (a: string[]) => void }) {
  const C = useColors();
  const S = useMemo(() => makeStyles(C), [C]);
  const [selected, setSelected] = useState<string[]>(current);
  const [custom, setCustom] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { setSelected(current); }, [current]);

  function toggle(a: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelected(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]);
  }

  function addCustom() {
    const t = custom.trim();
    if (!t || selected.includes(t)) return;
    setSelected(prev => [...prev, t]);
    setCustom('');
  }

  async function save() {
    setSaving(true);
    try { await onSave(selected); } finally { setSaving(false); }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={S.modalOverlay}>
        <View style={S.modalSheet}>
          <View style={S.modalHandle} />
          <Text style={S.modalTitle}>Allergen profile</Text>
          <Text style={S.modalSub}>Cooks see a warning when their dish matches your allergens.</Text>
          <View style={S.allergenGrid}>
            {COMMON_ALLERGENS.map(a => (
              <TouchableOpacity
                key={a}
                onPress={() => toggle(a)}
                style={[S.allergenChip, selected.includes(a) && { backgroundColor: C.errorBg, borderColor: C.errorFg + '40' }]}
              >
                {selected.includes(a) && <Ionicons name="warning" size={11} color={C.errorFg} />}
                <Text style={[S.allergenChipText, selected.includes(a) && { color: C.errorFg }]}>{a}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {selected.filter(a => !COMMON_ALLERGENS.includes(a)).map(a => (
            <View key={a} style={S.customAllergenRow}>
              <View style={[S.allergenChip, { backgroundColor: C.errorBg, borderColor: C.errorFg + '40', flex: 1 }]}>
                <Ionicons name="warning" size={11} color={C.errorFg} />
                <Text style={[S.allergenChipText, { color: C.errorFg }]}>{a}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelected(prev => prev.filter(x => x !== a))}>
                <Ionicons name="close-circle" size={18} color={C.errorFg} />
              </TouchableOpacity>
            </View>
          ))}
          <View style={S.customInputRow}>
            <TextInput
              style={[S.input, { flex: 1 }]}
              placeholder="Add other allergen…"
              placeholderTextColor={C.stone}
              value={custom}
              onChangeText={setCustom}
              onSubmitEditing={addCustom}
            />
            <TouchableOpacity style={[S.addBtn, { backgroundColor: C.spice }]} onPress={addCustom}>
              <Ionicons name="add" size={18} color={C.white} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={[S.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
            {saving ? <ActivityIndicator color={C.white} /> : <Text style={S.saveBtnText}>Save</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={S.cancelModalBtn} onPress={onClose}>
            <Text style={S.cancelModalText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function AccountScreen() {
  const { user, signOut, setActiveMode, refreshUser } = useAuth();
  const { accent, setAccent, setDarkOverride, darkOverride } = useTheme();
  const C = useColors();
  const S = useMemo(() => makeStyles(C), [C]);
  const router = useRouter();

  const [allergens, setAllergens] = useState<string[]>([]);
  const [loadingHealth, setLoadingHealth] = useState(true);
  const [loyaltyBalance, setLoyaltyBalance] = useState<LoyaltyBalance | null>(null);
  const [loyaltyCurrencyValue, setLoyaltyCurrencyValue] = useState(0);
  const [showAllergenModal, setShowAllergenModal] = useState(false);
  const [showEditName, setShowEditName] = useState(false);
  const [editNameValue, setEditNameValue] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [showEditUsername, setShowEditUsername] = useState(false);
  const [editUsernameValue, setEditUsernameValue] = useState('');
  const [savingUsername, setSavingUsername] = useState(false);
  const [addresses, setAddresses] = useState<string[]>([]);
  const [defaultAddrIdx, setDefaultAddrIdx] = useState(0);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [editAddressValue, setEditAddressValue] = useState('');
  const [editAddressIdx, setEditAddressIdx] = useState<number | null>(null);
  const [savingAddress, setSavingAddress] = useState(false);
  const [showThemePicker, setShowThemePicker] = useState(false);

  const initial = user?.full_name?.charAt(0).toUpperCase() ?? 'U';
  const addrStorageKey = `@addresses_v2_${user?.id}`;
  const addrDefaultKey = `@default_addr_idx_${user?.id}`;

  const loadHealth = useCallback(async () => {
    try {
      const { health_profile } = await healthApi.getProfile();
      setAllergens(health_profile?.allergens ?? []);
    } catch { setAllergens([]); } finally { setLoadingHealth(false); }
  }, []);

  const loadLoyalty = useCallback(async () => {
    try {
      const data = await loyaltyApi.get();
      setLoyaltyBalance(data.balance);
      setLoyaltyCurrencyValue(data.currency_value);
    } catch {}
  }, []);

  const loadAddresses = useCallback(async () => {
    if (!user?.id) return;
    try {
      const raw = await AsyncStorage.getItem(addrStorageKey);
      const idx = await AsyncStorage.getItem(addrDefaultKey);
      setAddresses(raw ? JSON.parse(raw) : []);
      setDefaultAddrIdx(idx ? parseInt(idx, 10) : 0);
    } catch {}
  }, [user?.id, addrStorageKey, addrDefaultKey]);

  useEffect(() => { loadHealth(); loadLoyalty(); loadAddresses(); }, [loadHealth, loadLoyalty, loadAddresses]);

  async function saveAddresses(list: string[], defIdx: number) {
    await AsyncStorage.setItem(addrStorageKey, JSON.stringify(list));
    await AsyncStorage.setItem(addrDefaultKey, String(defIdx));
    setAddresses(list);
    setDefaultAddrIdx(defIdx);
  }

  function openAddAddress() { setEditAddressValue(''); setEditAddressIdx(null); setShowAddressModal(true); }
  function openEditAddress(idx: number) { setEditAddressValue(addresses[idx]); setEditAddressIdx(idx); setShowAddressModal(true); }

  async function saveAddress() {
    const trimmed = editAddressValue.trim();
    if (!trimmed) return;
    setSavingAddress(true);
    try {
      const next = editAddressIdx === null
        ? [...addresses, trimmed]
        : addresses.map((a, i) => (i === editAddressIdx ? trimmed : a));
      await saveAddresses(next, defaultAddrIdx);
      setShowAddressModal(false);
    } catch { Alert.alert('Error', 'Could not save address'); } finally { setSavingAddress(false); }
  }

  async function deleteAddress(idx: number) {
    Alert.alert('Remove address', 'Remove this saved address?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          const next = addresses.filter((_, i) => i !== idx);
          await saveAddresses(next, Math.min(defaultAddrIdx, Math.max(0, next.length - 1)));
        },
      },
    ]);
  }

  async function setDefaultAddress(idx: number) {
    await AsyncStorage.setItem(addrDefaultKey, String(idx));
    setDefaultAddrIdx(idx);
  }

  async function saveEditName() {
    const trimmed = editNameValue.trim();
    if (!trimmed) return;
    setSavingName(true);
    try { await authApi.updateProfile({ full_name: trimmed }); await refreshUser(); setShowEditName(false); }
    catch (e: any) { Alert.alert('Error', e.message ?? 'Could not update name'); }
    finally { setSavingName(false); }
  }

  async function saveEditUsername() {
    const trimmed = editUsernameValue.trim().toLowerCase();
    if (!trimmed) return;
    setSavingUsername(true);
    try { await authApi.updateProfile({ username: trimmed }); await refreshUser(); setShowEditUsername(false); }
    catch (e: any) { Alert.alert('Error', e.error ?? e.message ?? 'Could not update username'); }
    finally { setSavingUsername(false); }
  }

  async function saveAllergens(newAllergens: string[]) {
    try {
      const { health_profile } = await healthApi.updateProfile({ allergens: newAllergens });
      setAllergens(health_profile?.allergens ?? newAllergens);
      setShowAllergenModal(false);
    } catch (e: any) { Alert.alert('Error', e.message ?? 'Could not save allergens'); }
  }

  async function handleSignOut() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: async () => { await signOut(); router.replace('/(auth)/welcome'); } },
    ]);
  }

  function handleDeleteAccountStep1() {
    Alert.alert('Delete account', 'This will permanently delete your account and all associated data. Orders in progress may not be refunded. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Continue', style: 'destructive', onPress: handleDeleteAccountStep2 },
    ]);
  }

  function handleDeleteAccountStep2() {
    Alert.alert('Are you absolutely sure?', `Your account for ${user?.phone ?? 'this phone number'} will be permanently deleted within 30 days.`, [
      { text: 'Go back', style: 'cancel' },
      {
        text: 'Delete my account', style: 'destructive',
        onPress: async () => {
          try { await authApi.deleteAccount('User requested deletion via app'); await signOut(); router.replace('/(auth)/welcome'); }
          catch { Alert.alert('Could not delete account', 'Please contact support at help@foodsbyme.com and we will process the deletion within 48 hours.'); }
        },
      },
    ]);
  }

  const rowC = C; // pass C to Row components

  return (
    <View style={S.root}>
      <SafeAreaView edges={['top']}>
        <View style={S.topBar}>
          <Text style={S.pageTitle}>You</Text>
        </View>
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: Spacing.lg, gap: 16, paddingTop: 8, paddingBottom: 48 }}>

        {/* Profile card */}
        <View style={S.profileCard}>
          <Avatar name={initial} avatarBg={C.spice} size={56} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={S.fullName}>{user?.full_name ?? 'Customer'}</Text>
            {user?.username
              ? <Text style={S.usernameDisplay}>@{user.username}</Text>
              : <TouchableOpacity onPress={() => { setEditUsernameValue(''); setShowEditUsername(true); }}>
                  <Text style={S.setUsernameHint}>Set username</Text>
                </TouchableOpacity>
            }
            <Text style={S.phone}>{user?.phone ?? '+234 — —'}</Text>
          </View>
          <TouchableOpacity style={S.editBtn} onPress={() => { setEditNameValue(user?.full_name ?? ''); setShowEditName(true); }}>
            <Ionicons name="pencil-outline" size={15} color={C.spice} />
          </TouchableOpacity>
        </View>

        {/* Account section */}
        <View>
          <Text style={S.sectionLabel}>Account</Text>
          <View style={S.card}>
            <Row C={rowC} icon="person-outline" label="Full name" value={user?.full_name ?? '—'} onPress={() => { setEditNameValue(user?.full_name ?? ''); setShowEditName(true); }} />
            <View style={S.divider} />
            <Row C={rowC} icon="at-outline" label="Username" value={user?.username ? `@${user.username}` : 'Not set'} onPress={() => { setEditUsernameValue(user?.username ?? ''); setShowEditUsername(true); }} />
            <View style={S.divider} />
            <Row C={rowC} icon="call-outline" label="Phone" value={user?.phone ?? '—'} />
            <View style={S.divider} />
            <Row C={rowC} icon="heart-outline" label="My cravings" onPress={() => router.push(`/profile/${user?.id}` as any)} />
          </View>
        </View>

        {/* Delivery addresses */}
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={S.sectionLabel}>Delivery addresses</Text>
            <TouchableOpacity onPress={openAddAddress} style={S.addAddrBtn}>
              <Ionicons name="add" size={16} color={C.spice} />
              <Text style={S.addAddrText}>Add</Text>
            </TouchableOpacity>
          </View>
          {addresses.length === 0 ? (
            <TouchableOpacity style={[S.card, { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }]} onPress={openAddAddress}>
              <View style={S.rowIcon}>
                <Ionicons name="location-outline" size={18} color={C.spice} />
              </View>
              <Text style={[S.rowLabel, { color: C.bodySoft }]}>Add a delivery address</Text>
              <Ionicons name="chevron-forward" size={16} color={C.bodySoft} />
            </TouchableOpacity>
          ) : (
            <View style={S.card}>
              {addresses.map((addr, idx) => (
                <React.Fragment key={idx}>
                  {idx > 0 && <View style={S.divider} />}
                  <View style={S.addrRow}>
                    <TouchableOpacity style={[S.addrRadio, defaultAddrIdx === idx && { borderColor: C.spice }]} onPress={() => setDefaultAddress(idx)}>
                      {defaultAddrIdx === idx && <View style={[S.addrRadioDot, { backgroundColor: C.spice }]} />}
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                      <Text style={S.addrText} numberOfLines={2}>{addr}</Text>
                      {defaultAddrIdx === idx && <Text style={[S.addrDefault, { color: C.spice }]}>Default</Text>}
                    </View>
                    <TouchableOpacity onPress={() => openEditAddress(idx)} style={S.addrAction}>
                      <Ionicons name="pencil-outline" size={15} color={C.bodySoft} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => deleteAddress(idx)} style={S.addrAction}>
                      <Ionicons name="trash-outline" size={15} color={C.errorFg} />
                    </TouchableOpacity>
                  </View>
                </React.Fragment>
              ))}
            </View>
          )}
        </View>

        {/* Allergens */}
        <View>
          <Text style={S.sectionLabel}>Allergen profile</Text>
          <View style={S.card}>
            {loadingHealth ? (
              <View style={{ padding: 14, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={C.spice} />
              </View>
            ) : (
              <View style={S.allergenRow}>
                {allergens.map(a => (
                  <View key={a} style={[S.allergenPill, { backgroundColor: C.errorBg }]}>
                    <Ionicons name="warning-outline" size={12} color={C.errorFg} />
                    <Text style={[S.allergenText, { color: C.errorFg }]}>{a}</Text>
                  </View>
                ))}
                <TouchableOpacity style={S.addAllergenPill} onPress={() => setShowAllergenModal(true)}>
                  <Ionicons name="add" size={14} color={C.spice} />
                  <Text style={S.addAllergenText}>{allergens.length > 0 ? 'Edit' : 'Add'}</Text>
                </TouchableOpacity>
              </View>
            )}
            <Text style={S.allergenNote}>Cooks are shown a warning when their dish matches your allergens.</Text>
          </View>
        </View>

        {/* Loyalty */}
        {loyaltyBalance !== null && (
          <View>
            <Text style={S.sectionLabel}>Loyalty points</Text>
            <View style={S.loyaltyCard}>
              <View style={{ alignItems: 'center', gap: 2 }}>
                <Text style={[S.loyaltyPoints, { color: C.spice }]}>{loyaltyBalance.balance.toLocaleString()}</Text>
                <Text style={[S.loyaltyLabel, { color: C.bodySoft }]}>points</Text>
              </View>
              <View style={[S.loyaltyDivider, { backgroundColor: C.borderWarm }]} />
              <View style={{ flex: 1 }}>
                <Text style={[S.loyaltyValue, { color: C.textInk }]}>₦{loyaltyCurrencyValue.toLocaleString('en-NG', { maximumFractionDigits: 0 })}</Text>
                <Text style={[S.loyaltyLabel, { color: C.bodySoft }]}>equivalent value</Text>
                <Text style={[S.loyaltyLabel, { color: C.bodySoft, marginTop: 4 }]}>{loyaltyBalance.lifetime_earned.toLocaleString()} earned lifetime</Text>
              </View>
            </View>
          </View>
        )}

        {/* Services */}
        <View>
          <Text style={S.sectionLabel}>Services</Text>
          <View style={S.card}>
            <Row C={rowC} icon="calendar-outline" label="Event bookings" onPress={() => router.push('/(customer)/bookings' as any)} />
            <View style={S.divider} />
            <Row C={rowC} icon="gift-outline" label="Gift cards" onPress={() => router.push('/(customer)/gifting' as any)} />
          </View>
        </View>

        {/* Preferences */}
        <View>
          <Text style={S.sectionLabel}>Preferences</Text>
          <View style={S.card}>
            <Row C={rowC} icon="notifications-outline" label="Notifications" onPress={() => router.push('/(customer)/notifications' as any)} />
            <View style={S.divider} />
            <Row C={rowC} icon="color-palette-outline" label="App theme" value={accent.label} onPress={() => setShowThemePicker(true)} />
            <View style={S.divider} />
            <Row C={rowC} icon="moon-outline" label="Dark mode" value={darkOverride === 'auto' ? 'Auto' : darkOverride === 'dark' ? 'Dark' : 'Light'} onPress={() => {
              const next = darkOverride === 'auto' ? 'dark' : darkOverride === 'dark' ? 'light' : 'auto';
              setDarkOverride(next);
            }} />
            <View style={S.divider} />
            <Row C={rowC} icon="language-outline" label="Language" value="English" />
          </View>
        </View>

        {/* Support */}
        <View>
          <Text style={S.sectionLabel}>Support</Text>
          <View style={S.card}>
            <Row C={rowC} icon="help-circle-outline" label="Help & FAQ" onPress={() => {}} />
            <View style={S.divider} />
            <Row C={rowC} icon="chatbubble-outline" label="Contact support" onPress={() => {}} />
            <View style={S.divider} />
            <Row C={rowC} icon="document-text-outline" label="Terms of Use" onPress={() => router.push('/legal/terms' as any)} />
            <View style={S.divider} />
            <Row C={rowC} icon="shield-outline" label="Privacy Policy" onPress={() => router.push('/legal/privacy' as any)} />
          </View>
        </View>

        {/* Account actions */}
        <View>
          <Text style={S.sectionLabel}>Account actions</Text>
          <View style={S.card}>
            <Row C={rowC} icon="log-out-outline" label="Sign out" danger onPress={handleSignOut} />
            <View style={S.divider} />
            <Row C={rowC} icon="trash-outline" label="Delete account" danger onPress={handleDeleteAccountStep1} />
          </View>
        </View>

        {user?.role === 'cook' && (
          <TouchableOpacity
            style={[S.kitchenCard, { backgroundColor: C.ink }]}
            activeOpacity={0.85}
            onPress={async () => { await setActiveMode('cook'); router.replace('/(cook)'); }}
          >
            <View style={S.kitchenIcon}>
              <Ionicons name="storefront-outline" size={20} color={C.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[S.kitchenTitle, { color: C.white }]}>Back to my kitchen</Text>
              <Text style={[S.kitchenSub, { color: C.white + '80' }]}>Manage your menu, orders and earnings</Text>
            </View>
            <Ionicons name="arrow-forward" size={18} color={C.white} />
          </TouchableOpacity>
        )}

        <Text style={S.version}>FOODSbyme v1.0.0</Text>
      </ScrollView>

      {/* Modals */}
      <AllergenModal visible={showAllergenModal} current={allergens} onClose={() => setShowAllergenModal(false)} onSave={saveAllergens} />

      <Modal visible={showAddressModal} transparent animationType="slide" onRequestClose={() => setShowAddressModal(false)}>
        <View style={S.modalOverlay}>
          <View style={S.modalSheet}>
            <View style={S.modalHandle} />
            <Text style={S.modalTitle}>{editAddressIdx === null ? 'Add address' : 'Edit address'}</Text>
            <TextInput
              style={[S.input, S.inputMulti]}
              value={editAddressValue}
              onChangeText={setEditAddressValue}
              placeholder="e.g. 12 Adeola Odeku, Victoria Island, Lagos"
              placeholderTextColor={C.stone}
              autoFocus
              multiline
              numberOfLines={3}
              returnKeyType="done"
            />
            <TouchableOpacity style={[S.saveBtn, savingAddress && { opacity: 0.6 }]} onPress={saveAddress} disabled={savingAddress}>
              {savingAddress ? <ActivityIndicator color={C.white} /> : <Text style={S.saveBtnText}>Save address</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={S.cancelModalBtn} onPress={() => setShowAddressModal(false)}>
              <Text style={S.cancelModalText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showEditName} transparent animationType="slide" onRequestClose={() => setShowEditName(false)}>
        <View style={S.modalOverlay}>
          <View style={S.modalSheet}>
            <View style={S.modalHandle} />
            <Text style={S.modalTitle}>Edit name</Text>
            <TextInput
              style={S.input}
              value={editNameValue}
              onChangeText={setEditNameValue}
              placeholder="Full name"
              placeholderTextColor={C.stone}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={saveEditName}
            />
            <TouchableOpacity style={[S.saveBtn, savingName && { opacity: 0.6 }]} onPress={saveEditName} disabled={savingName}>
              {savingName ? <ActivityIndicator color={C.white} /> : <Text style={S.saveBtnText}>Save</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={S.cancelModalBtn} onPress={() => setShowEditName(false)}>
              <Text style={S.cancelModalText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showEditUsername} transparent animationType="slide" onRequestClose={() => setShowEditUsername(false)}>
        <View style={S.modalOverlay}>
          <View style={S.modalSheet}>
            <View style={S.modalHandle} />
            <Text style={S.modalTitle}>Set username</Text>
            <Text style={S.modalSub}>3–20 characters. Letters, numbers and underscores only.</Text>
            <View style={S.usernameInputRow}>
              <Text style={[S.usernameAt, { color: C.spice }]}>@</Text>
              <TextInput
                style={[S.input, { flex: 1 }]}
                value={editUsernameValue}
                onChangeText={v => setEditUsernameValue(v.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder="your_username"
                placeholderTextColor={C.stone}
                autoFocus
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                maxLength={20}
                onSubmitEditing={saveEditUsername}
              />
            </View>
            <TouchableOpacity style={[S.saveBtn, savingUsername && { opacity: 0.6 }]} onPress={saveEditUsername} disabled={savingUsername}>
              {savingUsername ? <ActivityIndicator color={C.white} /> : <Text style={S.saveBtnText}>Save username</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={S.cancelModalBtn} onPress={() => setShowEditUsername(false)}>
              <Text style={S.cancelModalText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showThemePicker} transparent animationType="slide" onRequestClose={() => setShowThemePicker(false)}>
        <View style={S.modalOverlay}>
          <View style={S.modalSheet}>
            <View style={S.modalHandle} />
            <Text style={S.modalTitle}>App theme</Text>
            <Text style={S.modalSub}>Personalise your accent colour. Core layout stays the same.</Text>
            <View style={{ gap: 10 }}>
              {THEME_PRESETS.map(p => (
                <TouchableOpacity
                  key={p.id}
                  style={[S.themeRow, accent.id === p.id && { borderColor: C.spice, backgroundColor: C.bgCook }]}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setAccent(p.id); setShowThemePicker(false); }}
                  activeOpacity={0.8}
                >
                  <View style={[S.themeSwatchOuter, { borderColor: p.spice }]}>
                    <View style={[S.themeSwatch, { backgroundColor: p.ember }]} />
                  </View>
                  <Text style={S.themeLabel}>{p.label}</Text>
                  {accent.id === p.id && <Ionicons name="checkmark-circle" size={20} color={p.spice} />}
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={S.cancelModalBtn} onPress={() => setShowThemePicker(false)}>
              <Text style={S.cancelModalText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    root:     { flex: 1, backgroundColor: C.bg },
    topBar:   { paddingHorizontal: Spacing.lg, paddingTop: 16, paddingBottom: 8 },
    pageTitle:{ fontFamily: Fonts.serif, fontSize: 26, color: C.textInk },

    profileCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.bgCard, borderRadius: Radius.lg, padding: 16, borderWidth: 0.5, borderColor: C.borderWarm, ...Shadow.card },
    fullName:     { fontFamily: Fonts.sansMedium, fontSize: 16, color: C.textInk },
    usernameDisplay: { fontFamily: Fonts.sans, fontSize: 13, color: C.spice },
    setUsernameHint: { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft, textDecorationLine: 'underline' },
    phone:       { fontFamily: Fonts.sans, fontSize: 13, color: C.bodySoft, marginTop: 2 },
    editBtn:     { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: C.borderWarm, alignItems: 'center', justifyContent: 'center' },

    sectionLabel: { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.caps, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },

    card:    { backgroundColor: C.bgCard, borderRadius: Radius.lg, borderWidth: 0.5, borderColor: C.borderWarm, ...Shadow.card, overflow: 'hidden' },
    divider: { height: 0.5, backgroundColor: C.borderWarm, marginLeft: 50 },
    row:     { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
    rowIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: C.bgCook, alignItems: 'center', justifyContent: 'center' },
    rowLabel:{ fontFamily: Fonts.sans, fontSize: 14, color: C.textInk, flex: 1 },
    rowValue:{ fontFamily: Fonts.sans, fontSize: 13, color: C.bodySoft, maxWidth: 140, textAlign: 'right' },

    addAddrBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 40, borderWidth: 1, borderColor: C.borderWarm },
    addAddrText: { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.spice },
    addrRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
    addrRadio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: C.borderWarm, alignItems: 'center', justifyContent: 'center' },
    addrRadioDot: { width: 10, height: 10, borderRadius: 5 },
    addrText: { fontFamily: Fonts.sans, fontSize: 13, color: C.textInk, lineHeight: 18 },
    addrDefault: { fontFamily: Fonts.sansMedium, fontSize: 10, marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.5 },
    addrAction: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },

    allergenRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 14 },
    allergenPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 40 },
    allergenText: { fontFamily: Fonts.sansMedium, fontSize: 12 },
    addAllergenPill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: C.borderWarm, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 40, borderStyle: 'dashed' },
    addAllergenText: { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.spice },
    allergenNote: { fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft, paddingHorizontal: 14, paddingBottom: 14, lineHeight: 16 },

    loyaltyCard: { backgroundColor: C.bgCard, borderRadius: Radius.lg, borderWidth: 0.5, borderColor: C.borderWarm, ...Shadow.card, flexDirection: 'row', alignItems: 'center', padding: 16, gap: 16 },
    loyaltyPoints: { fontFamily: Fonts.serif, fontSize: 28 },
    loyaltyLabel: { fontFamily: Fonts.sans, fontSize: 11 },
    loyaltyDivider: { width: 0.5, height: 48 },
    loyaltyValue: { fontFamily: Fonts.sansMedium, fontSize: 16 },

    kitchenCard: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: Radius.lg, padding: 16, ...Shadow.card },
    kitchenIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
    kitchenTitle:{ fontFamily: Fonts.sansMedium, fontSize: 15, marginBottom: 2 },
    kitchenSub:  { fontFamily: Fonts.sans, fontSize: 12 },

    version: { fontFamily: Fonts.sans, fontSize: 11, color: C.stone, textAlign: 'center', paddingVertical: 8 },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalSheet:   { backgroundColor: C.bgCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.lg, gap: 14, paddingBottom: 40 },
    modalHandle:  { width: 40, height: 4, borderRadius: 2, backgroundColor: C.borderWarm, alignSelf: 'center', marginBottom: 4 },
    modalTitle:   { fontFamily: Fonts.serif, fontSize: 20, color: C.textInk },
    modalSub:     { fontFamily: Fonts.sans, fontSize: 13, color: C.bodySoft, lineHeight: 18, marginTop: -6 },
    allergenGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    allergenChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 40, borderWidth: 1, borderColor: C.borderWarm, backgroundColor: C.bg },
    allergenChipText: { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.body },
    customAllergenRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    customInputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    usernameInputRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    usernameAt: { fontFamily: Fonts.sansMedium, fontSize: 18 },
    input: { backgroundColor: C.bg, borderRadius: Radius.md, borderWidth: 0.5, borderColor: C.borderWarm, paddingHorizontal: 14, paddingVertical: 11, fontFamily: Fonts.sans, fontSize: 14, color: C.textInk },
    inputMulti: { minHeight: 80, textAlignVertical: 'top', paddingTop: 12 },
    addBtn: { width: 42, height: 42, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
    saveBtn: { backgroundColor: C.spice, borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center' },
    saveBtnText: { fontFamily: Fonts.sansMedium, fontSize: 15, color: C.white },
    cancelModalBtn: { alignItems: 'center', paddingVertical: 10 },
    cancelModalText: { fontFamily: Fonts.sans, fontSize: 14, color: C.bodySoft },

    themeRow: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, borderRadius: Radius.md, borderWidth: 1, borderColor: C.borderWarm, backgroundColor: C.bg },
    themeSwatchOuter: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
    themeSwatch: { width: 20, height: 20, borderRadius: 10 },
    themeLabel: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.textInk, flex: 1 },
  });
}
