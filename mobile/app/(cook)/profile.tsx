import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Modal, TextInput, FlatList, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { authApi } from '../../src/api/auth';
import { cooksApi, type CookDetail } from '../../src/api/cooks';
import { Fonts, Spacing, Radius, Shadow } from '../../src/constants/theme';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import Avatar from '../../src/components/ui/Avatar';
import { pickImage, uploadImage } from '../../src/utils/imageUpload';
import { useFeedback } from '../../src/components/feedback';

const NIGERIAN_BANKS = [
  { name: 'Access Bank', code: '044' },
  { name: 'Citibank', code: '023' },
  { name: 'EcoBank', code: '050' },
  { name: 'Fidelity Bank', code: '070' },
  { name: 'First Bank', code: '011' },
  { name: 'First City Monument Bank (FCMB)', code: '214' },
  { name: 'GTBank', code: '058' },
  { name: 'Heritage Bank', code: '030' },
  { name: 'Keystone Bank', code: '082' },
  { name: 'Kuda Bank', code: '90267' },
  { name: 'Moniepoint', code: '50515' },
  { name: 'OPay', code: '999992' },
  { name: 'PalmPay', code: '999991' },
  { name: 'Polaris Bank', code: '076' },
  { name: 'Stanbic IBTC', code: '221' },
  { name: 'Standard Chartered', code: '068' },
  { name: 'Sterling Bank', code: '232' },
  { name: 'UBA', code: '033' },
  { name: 'Union Bank', code: '032' },
  { name: 'Unity Bank', code: '215' },
  { name: 'Wema Bank', code: '035' },
  { name: 'Zenith Bank', code: '057' },
];

type RowProps = { icon: string; label: string; value?: string; danger?: boolean; onPress?: () => void };
function Row({ icon, label, value, danger, onPress }: RowProps) {
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  return (
    <TouchableOpacity onPress={onPress} style={styles.row} activeOpacity={onPress ? 0.7 : 1}>
      <View style={[styles.rowIcon, danger && styles.rowIconDanger]}>
        <Ionicons name={icon as any} size={18} color={danger ? C.errorFg : C.spice} />
      </View>
      <Text style={[styles.rowLabel, danger && styles.rowLabelDanger]}>{label}</Text>
      {value && <Text style={styles.rowValue} numberOfLines={1}>{value}</Text>}
      {onPress && <Ionicons name="chevron-forward" size={16} color={C.bodySoft} />}
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
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
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
            placeholderTextColor={C.stone}
            multiline={multiline}
            autoFocus
          />
          <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color={C.canvas} /> : <Text style={styles.saveBtnText}>Save</Text>}
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
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
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
              <TextInput style={styles.input} value={open} onChangeText={setOpen} placeholder="08:00" placeholderTextColor={C.stone} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.timeLabel}>Closes at</Text>
              <TextInput style={styles.input} value={close} onChangeText={setClose} placeholder="20:00" placeholderTextColor={C.stone} />
            </View>
          </View>
          <Text style={styles.timeHint}>Use 24-hour format e.g. 08:00, 20:30</Text>
          <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color={C.canvas} /> : <Text style={styles.saveBtnText}>Save</Text>}
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
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [bankName, setBankName] = useState(cook?.bank_name ?? '');
  const [bankCode, setBankCode] = useState(cook?.bank_code ?? '');
  const [accountNumber, setAccountNumber] = useState(cook?.bank_account_number ?? '');
  const [accountName, setAccountName] = useState(cook?.bank_account_name ?? '');
  const feedback = useFeedback();
  const [saving, setSaving] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [bankSearch, setBankSearch] = useState('');

  useEffect(() => {
    setBankName(cook?.bank_name ?? '');
    setBankCode(cook?.bank_code ?? '');
    setAccountNumber(cook?.bank_account_number ?? '');
    setAccountName(cook?.bank_account_name ?? '');
  }, [cook, visible]);

  async function handleSave() {
    if (!bankName || !accountNumber.trim()) { feedback.warn('Required', 'Select a bank and enter account number'); return; }
    setSaving(true);
    try { await onSave({ bank_name: bankName, bank_code: bankCode, bank_account_number: accountNumber.trim(), bank_account_name: accountName.trim() }); }
    finally { setSaving(false); }
  }

  const filteredBanks = NIGERIAN_BANKS.filter(b => b.name.toLowerCase().includes(bankSearch.toLowerCase()));

  return (
    <>
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Bank account</Text>
            <Text style={styles.inputLabel}>Bank</Text>
            <TouchableOpacity
              style={[styles.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
              onPress={() => { setBankSearch(''); setShowPicker(true); }}
              activeOpacity={0.7}
            >
              <Text style={{ fontFamily: Fonts.sans, fontSize: 14, color: bankName ? C.textInk : C.stone }}>
                {bankName || 'Select a bank'}
              </Text>
              <Ionicons name="chevron-down" size={16} color={C.bodySoft} />
            </TouchableOpacity>
            <Text style={[styles.inputLabel, { marginTop: 10 }]}>Account number</Text>
            <TextInput style={styles.input} value={accountNumber} onChangeText={setAccountNumber} keyboardType="numeric" placeholder="0123456789" placeholderTextColor={C.stone} />
            <Text style={[styles.inputLabel, { marginTop: 10 }]}>Account name</Text>
            <TextInput style={styles.input} value={accountName} onChangeText={setAccountName} placeholder="As it appears on the account" placeholderTextColor={C.stone} />
            <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color={C.canvas} /> : <Text style={styles.saveBtnText}>Save</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showPicker} transparent animationType="slide" onRequestClose={() => setShowPicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Select bank</Text>
            <View style={[styles.input, { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }]}>
              <Ionicons name="search-outline" size={16} color={C.bodySoft} />
              <TextInput
                style={{ flex: 1, fontFamily: Fonts.sans, fontSize: 14, color: C.textInk }}
                placeholder="Search…"
                placeholderTextColor={C.stone}
                value={bankSearch}
                onChangeText={setBankSearch}
                autoFocus
              />
            </View>
            <FlatList
              data={filteredBanks}
              keyExtractor={b => b.code}
              showsVerticalScrollIndicator={false}
              style={{ maxHeight: 340 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: C.borderWarm }}
                  onPress={() => { setBankName(item.name); setBankCode(item.code); setShowPicker(false); }}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontFamily: bankCode === item.code ? Fonts.sansMedium : Fonts.sans, fontSize: 14, color: bankCode === item.code ? C.spice : C.textInk }}>
                    {item.name}
                  </Text>
                  {bankCode === item.code && <Ionicons name="checkmark" size={16} color={C.spice} />}
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowPicker(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

export default function CookProfileSettings() {
  const { user, signOut, setActiveMode, refreshUser } = useAuth();
  const router = useRouter();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [cook, setCook] = useState<CookDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);

  type ActiveModal = 'name' | 'bio' | 'hours' | 'location' | 'bank' | null;
  const feedback = useFeedback();
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

  async function handleAvatarUpload() {
    const picked = await pickImage();
    if (!picked) return;
    setAvatarUploading(true);
    try {
      const url = await uploadImage(picked, 'cook-avatars');
      if (url) {
        await authApi.updateProfile({ avatar_url: url });
        await refreshUser();
        await load(true);
      }
    } catch {
      feedback.error('Upload failed', 'Could not update your avatar. Please try again.');
    } finally {
      setAvatarUploading(false);
    }
  }

  async function saveField(data: Partial<CookDetail>) {
    if (!user?.cook_id) return;
    try {
      const { cook: updated } = await cooksApi.update(user.cook_id, data);
      setCook(updated);
      setActiveModal(null);
    } catch (e: any) {
      feedback.error('Error', e.message ?? 'Could not save changes');
    }
  }

  if (loading) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={C.spice} />
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
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={C.spice} />
        }
      >
        <View style={styles.profileCard}>
          <TouchableOpacity onPress={handleAvatarUpload} style={styles.avatarWrap} activeOpacity={0.8}>
            {cook?.avatar_url ? (
              <Image source={{ uri: cook.avatar_url }} style={styles.avatarImg} />
            ) : (
              <Avatar name={initial} avatarBg={C.ember} size={60} />
            )}
            <View style={styles.avatarEditBadge}>
              {avatarUploading
                ? <ActivityIndicator size="small" color={C.canvas} />
                : <Ionicons name="camera-outline" size={12} color={C.canvas} />}
            </View>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.fullName}>{displayName}</Text>
            {cook?.username && <Text style={styles.handle}>@{cook.username}</Text>}
            {location ? <Text style={styles.area}>{location}</Text> : null}
          </View>
          <TouchableOpacity style={styles.editBtn} onPress={() => setActiveModal('name')}>
            <Ionicons name="pencil-outline" size={15} color={C.spice} />
          </TouchableOpacity>
        </View>

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

        {cook && (cook.food_safety_verified || cook.id_verified) && (
          <View>
            <Text style={styles.sectionLabel}>Credentials</Text>
            <View style={styles.card}>
              <View style={styles.credList}>
                {cook.food_safety_verified && (
                  <View style={styles.credRow}>
                    <View style={styles.credCheck}>
                      <Ionicons name="shield-checkmark-outline" size={16} color={C.successFg} />
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
                      <Ionicons name="shield-checkmark-outline" size={16} color={C.successFg} />
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

        <View>
          <Text style={styles.sectionLabel}>Payments</Text>
          <View style={styles.card}>
            <Row icon="card-outline" label="Bank account" value={bankValue} onPress={() => setActiveModal('bank')} />
          </View>
        </View>

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
              <Ionicons name="restaurant-outline" size={20} color={C.canvas} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.modeSwitchTitle}>Order from other cooks</Text>
              <Text style={styles.modeSwitchSub}>Browse and order meals as a customer</Text>
            </View>
            <Ionicons name="arrow-forward" size={18} color={C.canvas} />
          </TouchableOpacity>
        </View>

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

        <View style={styles.card}>
          <Row icon="log-out-outline" label="Sign out" danger onPress={signOut} />
        </View>

        <Text style={styles.version}>FOODS v1.0.0 · Cook edition</Text>
      </ScrollView>

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

function makeStyles(C: AppColors) { return StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  topBar: { paddingHorizontal: Spacing.lg, paddingTop: 16, paddingBottom: 12 },
  pageTitle: { fontFamily: Fonts.serif, fontSize: 26, color: C.textInk },

  profileCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, backgroundColor: C.bgCard, borderRadius: Radius.lg, padding: 16, borderWidth: 0.5, borderColor: C.borderWarm, ...Shadow.card },
  avatarWrap: { position: 'relative' },
  avatarImg: { width: 60, height: 60, borderRadius: 30 },
  avatarEditBadge: { position: 'absolute', bottom: 0, right: 0, width: 22, height: 22, borderRadius: 11, backgroundColor: C.spice, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.bgCard },
  fullName: { fontFamily: Fonts.sansMedium, fontSize: 16, color: C.textInk },
  handle: { fontFamily: Fonts.sans, fontSize: 13, color: C.spice, marginTop: 2 },
  area: { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft, marginTop: 3 },
  editBtn: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: C.borderWarm, alignItems: 'center', justifyContent: 'center' },

  statsStrip: { flexDirection: 'row', backgroundColor: C.bgCard, borderRadius: Radius.lg, padding: 16, borderWidth: 0.5, borderColor: C.borderWarm, ...Shadow.card },
  statItem: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { fontFamily: Fonts.serif, fontSize: 18, color: C.spice },
  statLabel: { fontFamily: Fonts.sans, fontSize: 10, color: C.bodySoft },

  sectionLabel: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.caps, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },

  card: { backgroundColor: C.bgCard, borderRadius: Radius.lg, borderWidth: 0.5, borderColor: C.borderWarm, ...Shadow.card, overflow: 'hidden' },
  divider: { height: 0.5, backgroundColor: C.borderWarm, marginLeft: 50 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  rowIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: C.bgCook, alignItems: 'center', justifyContent: 'center' },
  rowIconDanger: { backgroundColor: C.errorBg },
  rowLabel: { fontFamily: Fonts.sans, fontSize: 14, color: C.textInk, flex: 1 },
  rowLabelDanger: { color: C.errorFg },
  rowValue: { fontFamily: Fonts.sans, fontSize: 13, color: C.bodySoft, maxWidth: 130, textAlign: 'right' },

  credList: { padding: 14, gap: 12 },
  credRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  credCheck: { width: 30, height: 30, borderRadius: 8, backgroundColor: C.successBg, alignItems: 'center', justifyContent: 'center' },
  credLabel: { fontFamily: Fonts.sans, fontSize: 13, color: C.textInk, flex: 1 },
  verifiedPill: { backgroundColor: C.successBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 40 },
  verifiedText: { fontFamily: Fonts.sansMedium, fontSize: 11, color: C.successFg },

  modeSwitchCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: C.ink, borderRadius: Radius.lg,
    padding: 16, ...Shadow.card,
  },
  modeSwitchIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  modeSwitchTitle: { fontFamily: Fonts.sansMedium, fontSize: 15, color: C.canvas, marginBottom: 2 },
  modeSwitchSub:   { fontFamily: Fonts.sans, fontSize: 12, color: 'rgba(250,246,240,0.55)' },

  version: { fontFamily: Fonts.sans, fontSize: 11, color: C.stone, textAlign: 'center', paddingVertical: 8 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: C.bgCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.lg, gap: 12, paddingBottom: 36 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: C.borderWarm, alignSelf: 'center', marginBottom: 4 },
  modalTitle: { fontFamily: Fonts.serif, fontSize: 20, color: C.textInk },
  inputLabel: { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.caps, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: C.bg, borderRadius: Radius.md, borderWidth: 0.5, borderColor: C.borderWarm, paddingHorizontal: 14, paddingVertical: 12, fontFamily: Fonts.sans, fontSize: 14, color: C.textInk },
  inputMulti: { minHeight: 100, textAlignVertical: 'top' },
  timeRow: { flexDirection: 'row', gap: 12 },
  timeLabel: { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.caps, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  timeHint: { fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft },
  saveBtn: { backgroundColor: C.spice, borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  saveBtnText: { fontFamily: Fonts.sansMedium, fontSize: 15, color: C.canvas },
  cancelBtn: { alignItems: 'center', paddingVertical: 8 },
  cancelBtnText: { fontFamily: Fonts.sans, fontSize: 14, color: C.bodySoft },
}); }
