import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView,
  ActivityIndicator, RefreshControl, Modal, TextInput, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
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

interface EditModalProps {
  visible: boolean;
  title: string;
  placeholder: string;
  initialValue: string;
  multiline?: boolean;
  onClose: () => void;
  onSave: (value: string) => Promise<void>;
}

function EditModal({ visible, title, placeholder, initialValue, multiline, onClose, onSave }: EditModalProps) {
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setValue(initialValue); }, [initialValue, visible]);

  async function handleSave() {
    setSaving(true);
    try { await onSave(value.trim()); }
    finally { setSaving(false); }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>{title}</Text>
          <TextInput
            style={[styles.input, multiline && styles.inputMulti]}
            value={value}
            onChangeText={setValue}
            placeholder={placeholder}
            placeholderTextColor={Colors.stone}
            multiline={multiline}
            autoFocus
          />
          <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color={Colors.canvas} /> : <Text style={styles.saveBtnText}>Save</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

interface TimeModalProps {
  visible: boolean;
  openTime: string;
  closeTime: string;
  onClose: () => void;
  onSave: (open: string, close: string) => Promise<void>;
}

function OpenHoursModal({ visible, openTime, closeTime, onClose, onSave }: TimeModalProps) {
  const [open, setOpen] = useState(openTime);
  const [close, setClose] = useState(closeTime);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setOpen(openTime); setClose(closeTime); }, [openTime, closeTime, visible]);

  async function handleSave() {
    setSaving(true);
    try { await onSave(open.trim(), close.trim()); }
    finally { setSaving(false); }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Open hours</Text>
          <View style={styles.timeRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.timeLabel}>Opens at</Text>
              <TextInput style={styles.input} value={open} onChangeText={setOpen} placeholder="08:00" placeholderTextColor={Colors.stone} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.timeLabel}>Closes at</Text>
              <TextInput style={styles.input} value={close} onChangeText={setClose} placeholder="20:00" placeholderTextColor={Colors.stone} />
            </View>
          </View>
          <Text style={styles.timeHint}>Use 24-hour format e.g. 08:00, 20:30</Text>
          <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color={Colors.canvas} /> : <Text style={styles.saveBtnText}>Save</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

interface BankModalProps {
  visible: boolean;
  cook: CookDetail | null;
  onClose: () => void;
  onSave: (data: { bank_name: string; bank_account_number: string; bank_account_name: string; bank_code?: string }) => Promise<void>;
}

function BankModal({ visible, cook, onClose, onSave }: BankModalProps) {
  const [bankName, setBankName] = useState(cook?.bank_name ?? '');
  const [accountNumber, setAccountNumber] = useState(cook?.bank_account_number ?? '');
  const [accountName, setAccountName] = useState(cook?.bank_account_name ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setBankName(cook?.bank_name ?? '');
    setAccountNumber(cook?.bank_account_number ?? '');
    setAccountName(cook?.bank_account_name ?? '');
  }, [cook, visible]);

  async function handleSave() {
    if (!bankName.trim() || !accountNumber.trim()) { Alert.alert('Error', 'Bank name and account number required'); return; }
    setSaving(true);
    try { await onSave({ bank_name: bankName.trim(), bank_account_number: accountNumber.trim(), bank_account_name: accountName.trim() }); }
    finally { setSaving(false); }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Bank account</Text>
          <Text style={styles.inputLabel}>Bank name</Text>
          <TextInput style={styles.input} value={bankName} onChangeText={setBankName} placeholder="e.g. Access Bank" placeholderTextColor={Colors.stone} />
          <Text style={styles.inputLabel}>Account number</Text>
          <TextInput style={styles.input} value={accountNumber} onChangeText={setAccountNumber} keyboardType="numeric" placeholder="0123456789" placeholderTextColor={Colors.stone} />
          <Text style={styles.inputLabel}>Account name</Text>
          <TextInput style={styles.input} value={accountName} onChangeText={setAccountName} placeholder="As it appears on the account" placeholderTextColor={Colors.stone} />
          <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color={Colors.canvas} /> : <Text style={styles.saveBtnText}>Save</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function CookProfileSettings() {
  const { user, signOut, setActiveMode } = useAuth();
  const router = useRouter();
  const [cook, setCook] = useState<CookDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  type ActiveModal = 'name' | 'bio' | 'hours' | 'location' | 'bank' | null;
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);

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

  async function saveField(data: Partial<CookDetail>) {
    if (!user?.cook_id) return;
    try {
      const { cook: updated } = await cooksApi.update(user.cook_id, data);
      setCook(updated);
      setActiveModal(null);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Could not save changes');
    }
  }

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

  const bankValue = cook?.bank_account_number
    ? `${cook.bank_name ?? ''} ···${cook.bank_account_number.slice(-4)}`
    : 'Tap to set up';

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
          <TouchableOpacity style={styles.editBtn} onPress={() => setActiveModal('name')}>
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
            </View>
          </View>
        )}

        {/* Storefront */}
        <View>
          <Text style={styles.sectionLabel}>Storefront</Text>
          <View style={styles.card}>
            <Row icon="storefront-outline" label="Storefront name" value={cook?.storefront_title ?? displayName} onPress={() => setActiveModal('name')} />
            <View style={styles.divider} />
            <Row icon="document-text-outline" label="Bio" value={cook?.bio ? cook.bio.slice(0, 40) + (cook.bio.length > 40 ? '…' : '') : undefined} onPress={() => setActiveModal('bio')} />
            <View style={styles.divider} />
            <Row icon="time-outline" label="Open hours" value={openHours} onPress={() => setActiveModal('hours')} />
            <View style={styles.divider} />
            <Row icon="location-outline" label="Location" value={location || 'Not set'} onPress={() => setActiveModal('location')} />
          </View>
        </View>

        {/* Payments */}
        <View>
          <Text style={styles.sectionLabel}>Payments</Text>
          <View style={styles.card}>
            <Row icon="card-outline" label="Bank account" value={bankValue} onPress={() => setActiveModal('bank')} />
          </View>
        </View>

        {/* Mode switch */}
        <View>
          <Text style={styles.sectionLabel}>Switch mode</Text>
          <TouchableOpacity
            style={styles.modeSwitchCard}
            activeOpacity={0.85}
            onPress={async () => {
              await setActiveMode('customer');
              router.replace('/(customer)');
            }}
          >
            <View style={styles.modeSwitchIcon}>
              <Ionicons name="restaurant-outline" size={20} color={Colors.canvas} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.modeSwitchTitle}>Order from other cooks</Text>
              <Text style={styles.modeSwitchSub}>Browse and order meals as a customer</Text>
            </View>
            <Ionicons name="arrow-forward" size={18} color={Colors.canvas} />
          </TouchableOpacity>
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

      {/* Edit modals */}
      <EditModal
        visible={activeModal === 'name'}
        title="Storefront name"
        placeholder="e.g. Mama Ngozi's Kitchen"
        initialValue={cook?.storefront_title ?? cook?.display_name ?? ''}
        onClose={() => setActiveModal(null)}
        onSave={v => saveField({ storefront_title: v, display_name: v })}
      />
      <EditModal
        visible={activeModal === 'bio'}
        title="Bio"
        placeholder="Tell customers about your cooking style…"
        initialValue={cook?.bio ?? ''}
        multiline
        onClose={() => setActiveModal(null)}
        onSave={v => saveField({ bio: v })}
      />
      <OpenHoursModal
        visible={activeModal === 'hours'}
        openTime={cook?.open_time_default ?? ''}
        closeTime={cook?.close_time_default ?? ''}
        onClose={() => setActiveModal(null)}
        onSave={async (open, close) => saveField({ open_time_default: open, close_time_default: close })}
      />
      <EditModal
        visible={activeModal === 'location'}
        title="Location"
        placeholder="e.g. Lekki Phase 1, Lagos"
        initialValue={cook?.location ?? ''}
        onClose={() => setActiveModal(null)}
        onSave={v => saveField({ location: v })}
      />
      <BankModal
        visible={activeModal === 'bank'}
        cook={cook}
        onClose={() => setActiveModal(null)}
        onSave={data => saveField(data as any)}
      />
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

  modeSwitchCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.ink, borderRadius: Radius.lg,
    padding: 16, ...Shadow.card,
  },
  modeSwitchIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  modeSwitchTitle: { fontFamily: Fonts.sansMedium, fontSize: 15, color: Colors.canvas, fontWeight: '600', marginBottom: 2 },
  modeSwitchSub:   { fontFamily: Fonts.sans, fontSize: 12, color: 'rgba(250,246,240,0.55)' },

  version: { fontFamily: Fonts.sans, fontSize: 11, color: Colors.stone, textAlign: 'center', paddingVertical: 8 },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: Colors.bgCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.lg, gap: 12, paddingBottom: 36 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.borderWarm, alignSelf: 'center', marginBottom: 4 },
  modalTitle: { fontFamily: Fonts.serif, fontSize: 20, color: Colors.textInk },
  inputLabel: { fontFamily: Fonts.sansMedium, fontSize: 12, color: Colors.caps, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: Colors.bg, borderRadius: Radius.md, borderWidth: 0.5, borderColor: Colors.borderWarm, paddingHorizontal: 14, paddingVertical: 12, fontFamily: Fonts.sans, fontSize: 14, color: Colors.textInk },
  inputMulti: { minHeight: 100, textAlignVertical: 'top' },
  timeRow: { flexDirection: 'row', gap: 12 },
  timeLabel: { fontFamily: Fonts.sansMedium, fontSize: 12, color: Colors.caps, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  timeHint: { fontFamily: Fonts.sans, fontSize: 11, color: Colors.bodySoft },
  saveBtn: { backgroundColor: Colors.spice, borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  saveBtnText: { fontFamily: Fonts.sansMedium, fontSize: 15, color: Colors.canvas, fontWeight: '600' },
  cancelBtn: { alignItems: 'center', paddingVertical: 8 },
  cancelBtnText: { fontFamily: Fonts.sans, fontSize: 14, color: Colors.bodySoft },
});
