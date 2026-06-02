import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Modal, TextInput, FlatList, Image,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../src/context/AuthContext';
import { authApi } from '../../src/api/auth';
import { healthApi } from '../../src/api/health';
import { loyaltyApi, type LoyaltyBalance } from '../../src/api/loyalty';
import { ordersApi, type Order } from '../../src/api/orders';
import { giftingApi, type MealSubscription } from '../../src/api/gifting';
import { walletApi } from '../../src/api/wallet';
import { cravingsApi } from '../../src/api/cravings';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { Fonts, Spacing, Radius, Shadow } from '../../src/constants/theme';
import Avatar from '../../src/components/ui/Avatar';
import { useFeedback } from '../../src/components/feedback';
import GooglePlacesInput from '../../src/components/ui/GooglePlacesInput';
import { fmtCurrency, relativeTime } from '../../src/utils/format';

type ProfileTab = 'activity' | 'settings';

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

// ─── Wallet top-up modal ──────────────────────────────────────────────────────

const TOPUP_PRESETS = [1000, 2500, 5000, 10000, 20000, 50000];
const FLUTTERWAVE_PK = process.env.EXPO_PUBLIC_FLUTTERWAVE_PK ?? 'FLWPUBK_TEST-XXXX';

interface WalletTopupModalProps {
  visible: boolean;
  userEmail: string;
  userName: string;
  userPhone: string;
  onClose: () => void;
  onSuccess: (amount: number) => void;
}

function WalletTopupModal({ visible, userEmail, userName, userPhone, onClose, onSuccess }: WalletTopupModalProps) {
  const C = useColors();
  const S = useMemo(() => makeStyles(C), [C]);
  const feedback = useFeedback();
  const [preset, setPreset] = useState<number | null>(null);
  const [custom, setCustom] = useState('');
  const [showFW, setShowFW] = useState(false);
  const [loading, setLoading] = useState(false);
  const [txRef, setTxRef] = useState('');

  const amount = preset ?? (custom ? parseInt(custom.replace(/\D/g, ''), 10) : null);

  function handlePay() {
    if (!amount || amount < 100) { feedback.warn('Amount required', 'Minimum top-up is ₦100.'); return; }
    const ref = `WALLET-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    setTxRef(ref);
    setShowFW(true);
  }

  async function handleFWMessage(event: any) {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.status === 'successful' || data.event === 'payment.completed') {
        setShowFW(false);
        setLoading(true);
        try {
          await walletApi.topup({ amount: amount!, tx_ref: txRef, flw_ref: data.transaction_id });
          onSuccess(amount!);
          feedback.success('Wallet topped up!', `₦${amount!.toLocaleString('en-NG')} added.`);
        } catch (e: any) {
          feedback.error('Top-up failed', e.message ?? 'Please contact support.');
        } finally { setLoading(false); }
      } else if (data.status === 'cancelled' || data.event === 'modal.closed') {
        setShowFW(false);
      }
    } catch {}
  }

  const safeCustomer = JSON.stringify({ email: userEmail, name: userName, phone_number: userPhone });
  const safeCustomizations = JSON.stringify({ title: 'FOODS Wallet', description: 'Wallet top-up', logo: 'https://foodsbyme.com/icon.png' });
  const fwHtml = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#FAF6F0;display:flex;align-items:center;justify-content:center;height:100vh;">
<script src="https://checkout.flutterwave.com/v3.js"></script>
<script>
  window.onload=function(){FlutterwaveCheckout({
    public_key:${JSON.stringify(FLUTTERWAVE_PK)},tx_ref:${JSON.stringify(txRef)},
    amount:${Number(amount ?? 0)},currency:"NGN",
    customer:${safeCustomer},customizations:${safeCustomizations},
    callback:function(d){window.ReactNativeWebView.postMessage(JSON.stringify({status:d.status,event:"payment.completed",transaction_id:d.transaction_id}));},
    onclose:function(){window.ReactNativeWebView.postMessage(JSON.stringify({event:"modal.closed",status:"cancelled"}));}
  });};
</script></body></html>`;

  if (!visible) return null;

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={S.modalOverlay}>
        <View style={[S.modalSheet, { paddingBottom: 40 }]}>
          <View style={S.modalHandle} />
          <Text style={S.modalTitle}>Top up wallet</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {TOPUP_PRESETS.map(p => (
              <TouchableOpacity
                key={p}
                onPress={() => { setPreset(p); setCustom(''); }}
                style={[{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 40, backgroundColor: preset === p ? C.ink : C.bgCard, borderWidth: 0.5, borderColor: preset === p ? 'transparent' : C.borderWarm }]}>
                <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 14, color: preset === p ? C.canvas : C.body }}>₦{p.toLocaleString('en-NG')}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput style={S.input} placeholder="Or enter custom amount (₦)" placeholderTextColor={C.stone} keyboardType="numeric" value={custom} onChangeText={v => { setCustom(v); setPreset(null); }} />
          <TouchableOpacity style={[S.saveBtn, (!amount || amount < 100 || loading) && { opacity: 0.45 }]} onPress={handlePay} disabled={!amount || amount < 100 || loading}>
            {loading ? <ActivityIndicator color={C.white} /> : <Text style={S.saveBtnText}>{amount && amount >= 100 ? `Pay ₦${amount.toLocaleString('en-NG')}` : 'Top up wallet'}</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={S.cancelModalBtn} onPress={onClose}>
            <Text style={S.cancelModalText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
      <Modal visible={showFW} animationType="slide" onRequestClose={() => setShowFW(false)}>
        <View style={{ flex: 1 }}>
          <TouchableOpacity style={{ padding: 16, paddingTop: 52, backgroundColor: C.bg }} onPress={() => setShowFW(false)}>
            <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 14, color: C.bodySoft }}>← Cancel</Text>
          </TouchableOpacity>
          <WebView source={{ html: fwHtml }} onMessage={handleFWMessage} javaScriptEnabled domStorageEnabled style={{ flex: 1 }} />
        </View>
      </Modal>
    </Modal>
  );
}

// ─── Recent order card ────────────────────────────────────────────────────────

function OrderCard({ order, onPress, C }: { order: Order; onPress: () => void; C: AppColors }) {
  const statusColor: Record<string, string> = {
    pending_payment: C.warnFg, payment_confirmed: C.infoFg,
    accepted: C.infoFg, preparing: C.infoFg, ready: C.spice,
    out_for_delivery: C.spice, in_transit: C.spice,
    delivered: C.successFg, completed: C.successFg,
    cancelled: C.errorFg, refunded: C.errorFg,
  };
  const col = statusColor[order.status] ?? C.bodySoft;
  const photo = order.item_photos?.[0];
  return (
    <TouchableOpacity onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: 0.5, borderBottomColor: C.borderWarm }} activeOpacity={0.8}>
      {photo ? (
        <Image source={{ uri: photo }} style={{ width: 52, height: 52, borderRadius: 10 }} resizeMode="cover" />
      ) : (
        <View style={{ width: 52, height: 52, borderRadius: 10, backgroundColor: C.bgCook, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="bag-outline" size={22} color={C.bodySoft} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 14, color: C.textInk }} numberOfLines={1}>
          {order.item_title ?? 'Order'} ×{order.quantity}
        </Text>
        <Text style={{ fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft, marginTop: 2 }}>
          {order.cook_name ?? 'Cook'} · {relativeTime(order.created_at)}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 12, color: col, textTransform: 'capitalize' }}>{order.status.replace('_', ' ')}</Text>
        <Text style={{ fontFamily: Fonts.serif, fontSize: 14, color: C.spice }}>{fmtCurrency(order.total_amount, order.currency_code)}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function AccountScreen() {
  const { user, signOut, setActiveMode, refreshUser } = useAuth();
  const C = useColors();
  const S = useMemo(() => makeStyles(C), [C]);
  const router = useRouter();
  const feedback = useFeedback();

  const [activeTab, setActiveTab] = useState<ProfileTab>('activity');
  const [allergens, setAllergens] = useState<string[]>([]);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [showTopup, setShowTopup] = useState(false);
  const [beneficiaries, setBeneficiaries] = useState<MealSubscription[]>([]);
  const [loyaltyBalance, setLoyaltyBalance] = useState<LoyaltyBalance | null>(null);
  const [loyaltyCurrencyValue, setLoyaltyCurrencyValue] = useState(0);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [cravingCount, setCravingCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
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

  const addrStorageKey = `@addresses_v2_${user?.id}`;
  const addrDefaultKey = `@default_addr_idx_${user?.id}`;

  const load = useCallback(async () => {
    if (!user?.id) return;
    const [healthRes, walletRes, ordersRes, loyaltyRes, cravingsRes, profileRes, subsRes, addrRaw, addrIdx] = await Promise.allSettled([
      healthApi.getProfile(),
      walletApi.get(),
      ordersApi.list({ limit: 5 }),
      loyaltyApi.get(),
      cravingsApi.list(),
      authApi.getPublicProfile(user.id),
      giftingApi.listSubscriptions(),
      AsyncStorage.getItem(addrStorageKey),
      AsyncStorage.getItem(addrDefaultKey),
    ]);
    if (healthRes.status === 'fulfilled') setAllergens(healthRes.value.health_profile?.allergens ?? []);
    if (walletRes.status === 'fulfilled') setWalletBalance(walletRes.value.balance_ngn);
    if (ordersRes.status === 'fulfilled') setRecentOrders((ordersRes.value as any).orders ?? []);
    if (loyaltyRes.status === 'fulfilled') { setLoyaltyBalance(loyaltyRes.value.balance); setLoyaltyCurrencyValue(loyaltyRes.value.currency_value); }
    if (cravingsRes.status === 'fulfilled') setCravingCount((cravingsRes.value as any).cravings?.length ?? 0);
    if (profileRes.status === 'fulfilled') setFollowingCount((profileRes.value.user as any).following_count ?? 0);
    if (subsRes.status === 'fulfilled') setBeneficiaries((subsRes.value as any).subscriptions?.slice(0, 5) ?? []);
    if (addrRaw.status === 'fulfilled' && addrRaw.value) setAddresses(JSON.parse(addrRaw.value));
    if (addrIdx.status === 'fulfilled' && addrIdx.value) setDefaultAddrIdx(parseInt(addrIdx.value, 10));
  }, [user?.id, addrStorageKey, addrDefaultKey]);

  useEffect(() => { load(); }, [load]);

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
      const next = editAddressIdx === null ? [...addresses, trimmed] : addresses.map((a, i) => (i === editAddressIdx ? trimmed : a));
      await saveAddresses(next, defaultAddrIdx);
      setShowAddressModal(false);
    } catch { feedback.error('Error', 'Could not save address'); } finally { setSavingAddress(false); }
  }

  async function deleteAddress(idx: number) {
    feedback.confirm({
      title: 'Remove address', message: 'Remove this saved address?', confirmLabel: 'Remove', danger: true,
      onConfirm: async () => {
        const next = addresses.filter((_, i) => i !== idx);
        await saveAddresses(next, Math.min(defaultAddrIdx, Math.max(0, next.length - 1)));
      },
    });
  }

  async function saveAllergens(newAllergens: string[]) {
    try {
      const { health_profile } = await healthApi.updateProfile({ allergens: newAllergens });
      setAllergens(health_profile?.allergens ?? newAllergens);
      setShowAllergenModal(false);
    } catch (e: any) { feedback.error('Error', e.message ?? 'Could not save allergens'); }
  }

  async function saveEditName() {
    const trimmed = editNameValue.trim();
    if (!trimmed) return;
    setSavingName(true);
    try { await authApi.updateProfile({ full_name: trimmed }); await refreshUser(); setShowEditName(false); }
    catch (e: any) { feedback.error('Error', e.message ?? 'Could not update name'); }
    finally { setSavingName(false); }
  }

  async function saveEditUsername() {
    const trimmed = editUsernameValue.trim().toLowerCase();
    if (!trimmed) return;
    setSavingUsername(true);
    try { await authApi.updateProfile({ username: trimmed }); await refreshUser(); setShowEditUsername(false); }
    catch (e: any) { feedback.error('Error', e.error ?? e.message ?? 'Could not update username'); }
    finally { setSavingUsername(false); }
  }

  async function handleSignOut() {
    feedback.confirm({
      title: 'Sign out', message: 'Are you sure you want to sign out?', confirmLabel: 'Sign out', danger: true,
      onConfirm: async () => { await signOut(); router.replace('/(auth)/welcome'); },
    });
  }

  function handleDeleteAccountStep1() {
    feedback.confirm({
      title: 'Delete account',
      message: 'This will permanently delete your account and all associated data. This cannot be undone.',
      confirmLabel: 'Continue', danger: true,
      onConfirm: () => feedback.confirm({
        title: 'Are you absolutely sure?',
        message: `Your account for ${user?.phone ?? 'this phone number'} will be permanently deleted within 30 days.`,
        confirmLabel: 'Delete my account', cancelLabel: 'Go back', danger: true,
        onConfirm: async () => {
          try { await authApi.deleteAccount('User requested deletion via app'); await signOut(); router.replace('/(auth)/welcome'); }
          catch { feedback.error('Could not delete account', 'Please contact support at help@foodsbyme.com'); }
        },
      }),
    });
  }

  const stats = [
    { label: 'Orders', value: String(recentOrders.length), icon: 'bag-outline' as const, onPress: () => router.push('/(customer)/orders' as any) },
    { label: 'Following', value: String(followingCount), icon: 'heart-outline' as const, onPress: () => router.push('/(customer)/following' as any) },
    { label: 'Cravings', value: String(cravingCount), icon: 'bookmark-outline' as const, onPress: () => router.push(`/profile/${user?.id}` as any) },
    { label: 'Points', value: loyaltyBalance ? loyaltyBalance.balance.toLocaleString() : '—', icon: 'star-outline' as const, onPress: undefined },
  ];

  const quickActions = [
    { icon: 'storefront-outline' as const, label: 'Order\nAgain', onPress: () => router.replace('/(customer)') },
    { icon: 'bookmark-outline' as const, label: 'My\nCravings', onPress: () => router.push(`/profile/${user?.id}` as any) },
    { icon: 'repeat-outline' as const, label: 'Subscriptions', onPress: () => router.push('/(customer)/gifting' as any) },
    { icon: 'wallet-outline' as const, label: 'Top Up\nWallet', onPress: () => setShowTopup(true) },
  ];

  return (
    <View style={S.root}>
      {/* ── Hero header ── */}
      <LinearGradient colors={[C.ink, '#2A1A0A']} style={S.hero}>
        <SafeAreaView edges={['top']}>
          <View style={S.heroInner}>
            {/* Avatar + name */}
            <View style={S.heroProfile}>
              <TouchableOpacity
                style={S.avatarWrap}
                onPress={() => { setEditNameValue(user?.full_name ?? ''); setShowEditName(true); }}
                activeOpacity={0.85}
              >
                <Avatar name={user?.full_name?.charAt(0).toUpperCase() ?? 'U'} avatarBg={C.spice} size={72} />
                <View style={S.editBadge}>
                  <Ionicons name="pencil" size={10} color={C.canvas} />
                </View>
              </TouchableOpacity>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={S.heroName}>{user?.full_name ?? 'Customer'}</Text>
                {user?.username
                  ? <Text style={S.heroUsername}>@{user.username}</Text>
                  : <TouchableOpacity onPress={() => { setEditUsernameValue(''); setShowEditUsername(true); }}>
                      <Text style={S.heroSetUsername}>Set username →</Text>
                    </TouchableOpacity>}
                <Text style={S.heroPhone}>{user?.phone}</Text>
              </View>
            </View>

            {/* Wallet balance strip */}
            <TouchableOpacity style={S.walletStrip} onPress={() => setShowTopup(true)} activeOpacity={0.8}>
              <View style={{ flex: 1 }}>
                <Text style={S.walletStripLabel}>Wallet</Text>
                <Text style={S.walletStripBalance}>
                  {walletBalance === null ? '—' : '₦' + walletBalance.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                </Text>
              </View>
              <View style={S.walletStripBtn}>
                <Ionicons name="add" size={14} color={C.ink} />
                <Text style={S.walletStripBtnText}>Top up</Text>
              </View>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* ── Stats row ── */}
      <View style={S.statsRow}>
        {stats.map((s, i) => (
          <React.Fragment key={s.label}>
            {i > 0 && <View style={S.statDivider} />}
            <TouchableOpacity style={S.stat} onPress={s.onPress} activeOpacity={s.onPress ? 0.7 : 1}>
              <Text style={S.statValue}>{s.value}</Text>
              <Text style={S.statLabel}>{s.label}</Text>
            </TouchableOpacity>
          </React.Fragment>
        ))}
      </View>

      {/* ── Quick actions ── */}
      <View style={S.quickRow}>
        {quickActions.map(q => (
          <TouchableOpacity key={q.label} style={S.quickBtn} onPress={q.onPress} activeOpacity={0.8}>
            <View style={S.quickIcon}>
              <Ionicons name={q.icon} size={20} color={C.spice} />
            </View>
            <Text style={S.quickLabel}>{q.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Tabs ── */}
      <View style={S.tabBar}>
        {(['activity', 'settings'] as ProfileTab[]).map(t => (
          <TouchableOpacity
            key={t}
            style={[S.tabBtn, activeTab === t && S.tabBtnActive]}
            onPress={() => { setActiveTab(t); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
          >
            <Ionicons
              name={t === 'activity' ? (activeTab === t ? 'time' : 'time-outline') : (activeTab === t ? 'settings' : 'settings-outline')}
              size={18}
              color={activeTab === t ? C.spice : C.bodySoft}
            />
            <Text style={[S.tabLabel, activeTab === t && S.tabLabelActive]}>
              {t === 'activity' ? 'Activity' : 'Settings'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Tab content ── */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>

        {activeTab === 'activity' && (
          <View>
            {/* Beneficiaries */}
            {beneficiaries.length > 0 && (
              <View style={{ paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, gap: 10 }}>
                <Text style={S.sectionLabel}>Feeding for</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                  {beneficiaries.map(sub => (
                    <TouchableOpacity key={sub.id} style={S.beneficiaryCard} onPress={() => router.push('/(customer)/gifting' as any)} activeOpacity={0.8}>
                      <View style={[S.beneficiaryAvatar, { backgroundColor: C.ember }]}>
                        <Text style={S.beneficiaryInitial}>{sub.recipient_name.charAt(0).toUpperCase()}</Text>
                      </View>
                      <Text style={S.beneficiaryName} numberOfLines={1}>{sub.recipient_name.split(' ')[0]}</Text>
                      <View style={[S.beneficiaryStatus, { backgroundColor: sub.status === 'active' ? C.successBg : C.warnBg }]}>
                        <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 9, color: sub.status === 'active' ? C.successFg : C.warnFg, textTransform: 'capitalize' }}>{sub.status}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Recent orders */}
            <View style={{ marginTop: Spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, marginBottom: 6 }}>
                <Text style={S.sectionLabel}>Recent orders</Text>
                <TouchableOpacity onPress={() => router.push('/(customer)/orders' as any)}>
                  <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 12, color: C.spice }}>See all</Text>
                </TouchableOpacity>
              </View>
              <View style={[S.card, { marginHorizontal: Spacing.lg }]}>
                {recentOrders.length === 0 ? (
                  <View style={{ padding: 24, alignItems: 'center', gap: 8 }}>
                    <Ionicons name="bag-outline" size={32} color={C.stone} />
                    <Text style={{ fontFamily: Fonts.sans, fontSize: 13, color: C.bodySoft }}>No orders yet — start exploring</Text>
                    <TouchableOpacity style={{ backgroundColor: C.ink, borderRadius: Radius.full, paddingHorizontal: 20, paddingVertical: 10 }} onPress={() => router.replace('/(customer)')}>
                      <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 13, color: C.canvas }}>Explore creators</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  recentOrders.map(order => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      C={C}
                      onPress={() => router.push(`/tracking/${order.id}` as any)}
                    />
                  ))
                )}
              </View>
            </View>

            {/* Loyalty */}
            {loyaltyBalance !== null && (
              <View style={{ paddingHorizontal: Spacing.lg, marginTop: Spacing.md }}>
                <Text style={[S.sectionLabel, { marginBottom: 8 }]}>Loyalty points</Text>
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
          </View>
        )}

        {activeTab === 'settings' && (
          <View style={{ padding: Spacing.lg, gap: 16 }}>

            {/* Account */}
            <View>
              <Text style={S.sectionLabel}>Account</Text>
              <View style={S.card}>
                <SettingsRow C={C} icon="person-outline" label="Full name" value={user?.full_name ?? '—'} onPress={() => { setEditNameValue(user?.full_name ?? ''); setShowEditName(true); }} />
                <View style={S.divider} />
                <SettingsRow C={C} icon="at-outline" label="Username" value={user?.username ? `@${user.username}` : 'Not set'} onPress={() => { setEditUsernameValue(user?.username ?? ''); setShowEditUsername(true); }} />
                <View style={S.divider} />
                <SettingsRow C={C} icon="call-outline" label="Phone" value={user?.phone ?? '—'} />
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
                  <View style={S.rowIcon}><Ionicons name="location-outline" size={18} color={C.spice} /></View>
                  <Text style={[S.rowLabel, { color: C.bodySoft }]}>Add a delivery address</Text>
                  <Ionicons name="chevron-forward" size={16} color={C.bodySoft} />
                </TouchableOpacity>
              ) : (
                <View style={S.card}>
                  {addresses.map((addr, idx) => (
                    <React.Fragment key={idx}>
                      {idx > 0 && <View style={S.divider} />}
                      <View style={S.addrRow}>
                        <TouchableOpacity style={[S.addrRadio, defaultAddrIdx === idx && { borderColor: C.spice }]} onPress={() => { AsyncStorage.setItem(addrDefaultKey, String(idx)); setDefaultAddrIdx(idx); }}>
                          {defaultAddrIdx === idx && <View style={[S.addrRadioDot, { backgroundColor: C.spice }]} />}
                        </TouchableOpacity>
                        <View style={{ flex: 1 }}>
                          <Text style={S.addrText} numberOfLines={2}>{addr}</Text>
                          {defaultAddrIdx === idx && <Text style={[{ fontFamily: Fonts.sansMedium, fontSize: 10, marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.5 }, { color: C.spice }]}>Default</Text>}
                        </View>
                        <TouchableOpacity onPress={() => openEditAddress(idx)} style={S.addrAction}><Ionicons name="pencil-outline" size={15} color={C.bodySoft} /></TouchableOpacity>
                        <TouchableOpacity onPress={() => deleteAddress(idx)} style={S.addrAction}><Ionicons name="trash-outline" size={15} color={C.errorFg} /></TouchableOpacity>
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
                <Text style={S.allergenNote}>Cooks are shown a warning when their dish matches your allergens.</Text>
              </View>
            </View>

            {/* Services */}
            <View>
              <Text style={S.sectionLabel}>Services</Text>
              <View style={S.card}>
                <SettingsRow C={C} icon="calendar-outline" label="Event bookings" onPress={() => router.push('/(customer)/bookings' as any)} />
                <View style={S.divider} />
                <SettingsRow C={C} icon="repeat-outline" label="Subscriptions" onPress={() => router.push('/(customer)/gifting' as any)} />
              </View>
            </View>

            {/* Preferences */}
            <View>
              <Text style={S.sectionLabel}>Preferences</Text>
              <View style={S.card}>
                <SettingsRow C={C} icon="notifications-outline" label="Notifications" onPress={() => router.push('/(customer)/notifications' as any)} />
                <View style={S.divider} />
                <SettingsRow C={C} icon="language-outline" label="Language" value="English" />
              </View>
            </View>

            {/* Support */}
            <View>
              <Text style={S.sectionLabel}>Support</Text>
              <View style={S.card}>
                <SettingsRow C={C} icon="help-circle-outline" label="Help & FAQ" onPress={() => {}} />
                <View style={S.divider} />
                <SettingsRow C={C} icon="chatbubble-outline" label="Contact support" onPress={() => {}} />
                <View style={S.divider} />
                <SettingsRow C={C} icon="document-text-outline" label="Terms of Use" onPress={() => router.push('/legal/terms' as any)} />
                <View style={S.divider} />
                <SettingsRow C={C} icon="shield-outline" label="Privacy Policy" onPress={() => router.push('/legal/privacy' as any)} />
              </View>
            </View>

            {/* Account actions */}
            <View>
              <Text style={S.sectionLabel}>Account actions</Text>
              <View style={S.card}>
                <SettingsRow C={C} icon="log-out-outline" label="Sign out" danger onPress={handleSignOut} />
                <View style={S.divider} />
                <SettingsRow C={C} icon="trash-outline" label="Delete account" danger onPress={handleDeleteAccountStep1} />
              </View>
            </View>

            {user?.role === 'cook' && (
              <TouchableOpacity
                style={[S.kitchenCard, { backgroundColor: C.ink }]}
                activeOpacity={0.85}
                onPress={async () => { await setActiveMode('cook'); router.replace('/(cook)'); }}
              >
                <View style={S.kitchenIcon}><Ionicons name="storefront-outline" size={20} color={C.white} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={[S.kitchenTitle, { color: C.white }]}>Back to my kitchen</Text>
                  <Text style={[S.kitchenSub, { color: C.white + '80' }]}>Manage your menu, orders and earnings</Text>
                </View>
                <Ionicons name="arrow-forward" size={18} color={C.white} />
              </TouchableOpacity>
            )}

            <Text style={S.version}>FOODSbyme v1.0.0</Text>
          </View>
        )}
      </ScrollView>

      {/* ── Modals ── */}
      <WalletTopupModal
        visible={showTopup}
        userEmail={user?.email ?? 'customer@foodsbyme.com'}
        userName={user?.full_name ?? 'Customer'}
        userPhone={user?.phone ?? ''}
        onClose={() => setShowTopup(false)}
        onSuccess={(amount) => { setWalletBalance(prev => (prev ?? 0) + amount); setShowTopup(false); }}
      />

      <AllergenModal visible={showAllergenModal} current={allergens} onClose={() => setShowAllergenModal(false)} onSave={saveAllergens} />

      <Modal visible={showAddressModal} transparent animationType="slide" onRequestClose={() => setShowAddressModal(false)}>
        <View style={S.modalOverlay}>
          <View style={[S.modalSheet, { flex: 1, maxHeight: '85%' }]}>
            <View style={S.modalHandle} />
            <Text style={S.modalTitle}>{editAddressIdx === null ? 'Add address' : 'Edit address'}</Text>
            <GooglePlacesInput
              initialValue={editAddressValue}
              placeholder="e.g. 12 Adeola Odeku, Victoria Island, Lagos"
              onSelect={async (addr) => {
                setEditAddressValue(addr);
                setSavingAddress(true);
                try {
                  const next = editAddressIdx === null ? [...addresses, addr] : addresses.map((a, i) => (i === editAddressIdx ? addr : a));
                  await saveAddresses(next, defaultAddrIdx);
                  setShowAddressModal(false);
                } catch { feedback.error('Error', 'Could not save address'); } finally { setSavingAddress(false); }
              }}
              onCancel={() => setShowAddressModal(false)}
            />
          </View>
        </View>
      </Modal>

      <Modal visible={showEditName} transparent animationType="slide" onRequestClose={() => setShowEditName(false)}>
        <View style={S.modalOverlay}>
          <View style={S.modalSheet}>
            <View style={S.modalHandle} />
            <Text style={S.modalTitle}>Edit name</Text>
            <TextInput style={S.input} value={editNameValue} onChangeText={setEditNameValue} placeholder="Full name" placeholderTextColor={C.stone} autoFocus returnKeyType="done" onSubmitEditing={saveEditName} />
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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 18, color: C.spice }}>@</Text>
              <TextInput style={[S.input, { flex: 1 }]} value={editUsernameValue} onChangeText={v => setEditUsernameValue(v.toLowerCase().replace(/[^a-z0-9_]/g, ''))} placeholder="your_username" placeholderTextColor={C.stone} autoFocus autoCapitalize="none" autoCorrect={false} returnKeyType="done" maxLength={20} onSubmitEditing={saveEditUsername} />
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
    </View>
  );
}

// ─── Settings row ─────────────────────────────────────────────────────────────

function SettingsRow({ icon, label, value, danger, onPress, C }: { icon: string; label: string; value?: string; danger?: boolean; onPress?: () => void; C: AppColors }) {
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

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },

    // Hero
    hero: { paddingBottom: 16 },
    heroInner: { paddingHorizontal: Spacing.lg, paddingTop: 8, gap: 14 },
    heroProfile: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    avatarWrap: { position: 'relative' },
    editBadge: { position: 'absolute', bottom: 0, right: 0, width: 20, height: 20, borderRadius: 10, backgroundColor: C.spice, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.ink },
    heroName: { fontFamily: Fonts.serif, fontSize: 20, color: C.canvas, lineHeight: 24 },
    heroUsername: { fontFamily: Fonts.sans, fontSize: 13, color: C.ember },
    heroSetUsername: { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.ember, opacity: 0.8 },
    heroPhone: { fontFamily: Fonts.sans, fontSize: 12, color: 'rgba(250,246,240,0.45)', marginTop: 1 },
    walletStrip: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: Radius.lg, padding: 14, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.12)' },
    walletStripLabel: { fontFamily: Fonts.sansMedium, fontSize: 10, color: 'rgba(250,246,240,0.5)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 2 },
    walletStripBalance: { fontFamily: Fonts.serif, fontSize: 22, color: C.canvas },
    walletStripBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.canvas, borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 8 },
    walletStripBtnText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.ink },

    // Stats
    statsRow: { flexDirection: 'row', backgroundColor: C.bgCard, borderBottomWidth: 0.5, borderBottomColor: C.borderWarm },
    stat: { flex: 1, alignItems: 'center', paddingVertical: 14 },
    statValue: { fontFamily: Fonts.serif, fontSize: 20, color: C.ink },
    statLabel: { fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft, marginTop: 2 },
    statDivider: { width: 0.5, backgroundColor: C.borderWarm, marginVertical: 10 },

    // Quick actions
    quickRow: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: Spacing.lg, paddingVertical: 14, backgroundColor: C.bgCard, borderBottomWidth: 0.5, borderBottomColor: C.borderWarm },
    quickBtn: { alignItems: 'center', gap: 6, flex: 1 },
    quickIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: C.bgCook, alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, borderColor: C.borderWarm },
    quickLabel: { fontFamily: Fonts.sans, fontSize: 10, color: C.body, textAlign: 'center', lineHeight: 14 },

    // Tabs
    tabBar: { flexDirection: 'row', backgroundColor: C.bgCard, borderBottomWidth: 0.5, borderBottomColor: C.borderWarm },
    tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 },
    tabBtnActive: { borderBottomWidth: 2, borderBottomColor: C.spice },
    tabLabel: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.bodySoft },
    tabLabelActive: { color: C.spice },

    sectionLabel: { fontFamily: Fonts.sansMedium, fontSize: 11, color: C.caps, textTransform: 'uppercase', letterSpacing: 0.6 },

    card: { backgroundColor: C.bgCard, borderRadius: Radius.lg, borderWidth: 0.5, borderColor: C.borderWarm, ...Shadow.card, overflow: 'hidden' },
    divider: { height: 0.5, backgroundColor: C.borderWarm, marginLeft: 50 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
    rowIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: C.bgCook, alignItems: 'center', justifyContent: 'center' },
    rowLabel: { fontFamily: Fonts.sans, fontSize: 14, color: C.textInk, flex: 1 },
    rowValue: { fontFamily: Fonts.sans, fontSize: 13, color: C.bodySoft, maxWidth: 140, textAlign: 'right' },

    addAddrBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 40, borderWidth: 1, borderColor: C.borderWarm },
    addAddrText: { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.spice },
    addrRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
    addrRadio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: C.borderWarm, alignItems: 'center', justifyContent: 'center' },
    addrRadioDot: { width: 10, height: 10, borderRadius: 5 },
    addrText: { fontFamily: Fonts.sans, fontSize: 13, color: C.textInk, lineHeight: 18 },
    addrAction: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },

    allergenRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 14 },
    allergenPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 40 },
    allergenText: { fontFamily: Fonts.sansMedium, fontSize: 12 },
    addAllergenPill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: C.borderWarm, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 40, borderStyle: 'dashed' },
    addAllergenText: { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.spice },
    allergenNote: { fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft, paddingHorizontal: 14, paddingBottom: 14, lineHeight: 16 },

    beneficiaryCard: { alignItems: 'center', gap: 6, backgroundColor: C.bgCard, borderRadius: Radius.lg, padding: 14, borderWidth: 0.5, borderColor: C.borderWarm, width: 96, ...Shadow.card },
    beneficiaryAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    beneficiaryInitial: { fontFamily: Fonts.serif, fontSize: 20, color: C.canvas },
    beneficiaryName: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.textInk, textAlign: 'center' },
    beneficiaryStatus: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },

    loyaltyCard: { backgroundColor: C.bgCard, borderRadius: Radius.lg, borderWidth: 0.5, borderColor: C.borderWarm, ...Shadow.card, flexDirection: 'row', alignItems: 'center', padding: 16, gap: 16 },
    loyaltyPoints: { fontFamily: Fonts.serif, fontSize: 28 },
    loyaltyLabel: { fontFamily: Fonts.sans, fontSize: 11 },
    loyaltyDivider: { width: 0.5, height: 48 },
    loyaltyValue: { fontFamily: Fonts.sansMedium, fontSize: 16 },

    kitchenCard: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: Radius.lg, padding: 16, ...Shadow.card },
    kitchenIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
    kitchenTitle: { fontFamily: Fonts.sansMedium, fontSize: 15, marginBottom: 2 },
    kitchenSub: { fontFamily: Fonts.sans, fontSize: 12 },

    version: { fontFamily: Fonts.sans, fontSize: 11, color: C.stone, textAlign: 'center', paddingVertical: 8 },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalSheet: { backgroundColor: C.bgCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.lg, gap: 14, paddingBottom: 40 },
    modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: C.borderWarm, alignSelf: 'center', marginBottom: 4 },
    modalTitle: { fontFamily: Fonts.serif, fontSize: 20, color: C.textInk },
    modalSub: { fontFamily: Fonts.sans, fontSize: 13, color: C.bodySoft, lineHeight: 18, marginTop: -6 },
    allergenGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    allergenChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 40, borderWidth: 1, borderColor: C.borderWarm, backgroundColor: C.bg },
    allergenChipText: { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.body },
    customAllergenRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    customInputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    input: { backgroundColor: C.bg, borderRadius: Radius.md, borderWidth: 0.5, borderColor: C.borderWarm, paddingHorizontal: 14, paddingVertical: 11, fontFamily: Fonts.sans, fontSize: 14, color: C.textInk },
    addBtn: { width: 42, height: 42, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
    saveBtn: { backgroundColor: C.spice, borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center' },
    saveBtnText: { fontFamily: Fonts.sansMedium, fontSize: 15, color: C.white },
    cancelModalBtn: { alignItems: 'center', paddingVertical: 10 },
    cancelModalText: { fontFamily: Fonts.sans, fontSize: 14, color: C.bodySoft },
    white: { color: '#fff' },
  });
}
