import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  TextInput, KeyboardAvoidingView, Platform, ScrollView, Linking, Alert, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { riderApi, type RiderOrder } from '../../src/api/rider';
import { C, Sp, R, Fs, F } from '../../src/theme';

const BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'https://foodsbyme-api-production.up.railway.app') + '/api';

async function uploadProofPhoto(dataUri: string, token: string | null): Promise<string> {
  const res = await fetch(`${BASE_URL}/upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ image: dataUri, folder: 'delivery-proofs' }),
  });
  if (!res.ok) throw new Error('Photo upload failed');
  const data = await res.json();
  return data.url as string;
}

// photo_delivery = en_route but waiting for proof photo before confirming
type Stage = 'pickup' | 'otp_collection' | 'en_route' | 'otp_delivery' | 'photo_delivery' | 'done';

function getStage(order: RiderOrder): Stage {
  if (order.status === 'delivered') return 'done';
  if (order.status === 'out_for_delivery' || order.status === 'in_transit') {
    if (order.otp_enabled && !order.delivery_otp_verified_at) return 'otp_delivery';
    return 'en_route';
  }
  if (order.status === 'ready') {
    if (order.otp_enabled && !order.collection_otp_verified_at) return 'otp_collection';
    return 'pickup';
  }
  return 'pickup';
}

export default function DeliveryFlowScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<RiderOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [otpError, setOtpError] = useState('');
  const [proofPhotoUri, setProofPhotoUri] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [showPhotoStep, setShowPhotoStep] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const gpsRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchOrder = useCallback(async () => {
    try {
      const { orders } = await riderApi.getMyOrders();
      const found = orders.find(o => o.id === orderId);
      if (found) setOrder(found);
    } catch { /* network retry */ } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchOrder();
    pollRef.current = setInterval(fetchOrder, 15_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchOrder]);

  // GPS broadcasting — fires every 30s when rider is en route
  useEffect(() => {
    if (!orderId) return;
    const broadcastGps = async () => {
      if (!order) return;
      const activeStages: Stage[] = ['en_route', 'otp_delivery'];
      if (!activeStages.includes(getStage(order))) return;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        await riderApi.postLocation(
          orderId,
          loc.coords.latitude,
          loc.coords.longitude,
          loc.coords.heading ?? undefined,
          loc.coords.speed ?? undefined,
        );
      } catch { /* non-fatal: GPS or network error */ }
    };
    broadcastGps();
    gpsRef.current = setInterval(broadcastGps, 30_000);
    return () => { if (gpsRef.current) clearInterval(gpsRef.current); };
  }, [orderId, order]);

  const handleCollectionOtp = async () => {
    if (otpInput.length !== 6) { setOtpError('Enter the 6-digit code shown by the cook'); return; }
    setActioning(true);
    setOtpError('');
    try {
      const { order: updated } = await riderApi.verifyCollectionOtp(orderId, otpInput);
      setOrder(updated);
      setOtpInput('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      setOtpError(e?.error ?? 'OTP verification failed');
    } finally {
      setActioning(false);
    }
  };

  const handleSkipCollection = async () => {
    setActioning(true);
    try {
      const { order: updated } = await riderApi.skipCollectionOtp(orderId);
      setOrder(updated);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert('Error', e?.error ?? 'Could not advance order');
    } finally {
      setActioning(false);
    }
  };

  const handleDeliveryOtp = async () => {
    if (otpInput.length !== 6) { setOtpError('Enter the 6-digit code from the customer\'s screen'); return; }
    setActioning(true);
    setOtpError('');
    try {
      // Upload proof photo first if captured, then verify OTP in one shot
      let photoUrl: string | undefined;
      if (proofPhotoUri) {
        try {
          const token = await AsyncStorage.getItem('rider_auth_token');
          const response = await fetch(proofPhotoUri);
          const blob = await response.blob();
          const base64: string = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          photoUrl = await uploadProofPhoto(base64, token);
        } catch { /* non-fatal */ }
      }
      const { order: updated } = await riderApi.verifyDeliveryOtp(orderId, otpInput, photoUrl);
      setOrder(updated);
      setOtpInput('');
      setShowPhotoStep(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      setOtpError(e?.error ?? 'Incorrect OTP. Ask the customer to open the tracking screen.');
    } finally {
      setActioning(false);
    }
  };

  const pickProofPhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      const galleryPerm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!galleryPerm.granted) { Alert.alert('Permission needed', 'Allow camera or photo access to take a proof photo.'); return; }
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.75, base64: true })
      .catch(() => ImagePicker.launchImageLibraryAsync({ quality: 0.75, base64: true }));
    if (result.canceled || !result.assets?.[0]) return;
    setProofPhotoUri(result.assets[0].uri);
  };

  const handleSkipDelivery = async () => {
    if (!proofPhotoUri) {
      setShowPhotoStep(true);
      return;
    }
    await handleDeliveryWithPhoto();
  };

  const handleDeliveryWithPhoto = async () => {
    if (!proofPhotoUri) { Alert.alert('Take a photo', 'Take a photo of the delivered order before confirming.'); return; }
    setPhotoUploading(true);
    setActioning(true);
    let photoUrl: string | undefined;
    try {
      const token = await AsyncStorage.getItem('rider_auth_token');
      // Convert URI to base64 for upload
      const response = await fetch(proofPhotoUri);
      const blob = await response.blob();
      const reader = new FileReader();
      const base64: string = await new Promise((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      photoUrl = await uploadProofPhoto(base64, token);
    } catch {
      // Photo upload failed — still confirm delivery, just without stored photo
    } finally {
      setPhotoUploading(false);
    }
    try {
      const { order: updated } = await riderApi.skipDeliveryOtp(orderId, photoUrl);
      setOrder(updated);
      setShowPhotoStep(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert('Error', e?.error ?? 'Could not mark delivered');
    } finally {
      setActioning(false);
    }
  };

  const openMaps = (address: string) => {
    const query = encodeURIComponent(address);
    const url = Platform.OS === 'ios'
      ? `maps://?q=${query}`
      : `geo:0,0?q=${query}`;
    Linking.openURL(url).catch(() =>
      Linking.openURL(`https://maps.google.com/maps?q=${query}`)
    );
  };

  if (loading || !order) {
    return (
      <SafeAreaView style={s.safe}>
        <ActivityIndicator color={C.spice} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  const stage = getStage(order);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={C.textInk} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Active Delivery</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

          {/* Stage progress */}
          <StageBar stage={stage} />

          {/* Fee & payment reminder */}
          <View style={s.feeBanner}>
            <Ionicons name="cash-outline" size={18} color={C.spice} />
            <Text style={s.feeText}>Delivery fee: ₦{order.delivery_fee?.toLocaleString() ?? '—'}</Text>
            {order.delivery_fee_payment_method && order.delivery_fee_payment_method !== 'wallet' && (
              <View style={s.cashPill}>
                <Text style={s.cashPillText}>
                  {order.delivery_fee_payment_method === 'cash' ? 'Collect cash' : 'Customer will transfer'}
                </Text>
              </View>
            )}
          </View>

          {/* ── STAGE: pickup ─────────────────────────────────────────────── */}
          {(stage === 'pickup' || stage === 'otp_collection') && (
            <AddressCard
              label="Pickup from"
              address={order.cook_address ?? 'Address unavailable'}
              icon="restaurant-outline"
              onNavigate={() => order.cook_address && openMaps(order.cook_address)}
            />
          )}

          {/* ── STAGE: en_route / otp_delivery ──────────────────────────── */}
          {(stage === 'en_route' || stage === 'otp_delivery') && (
            <AddressCard
              label="Deliver to"
              address={order.delivery_address ?? 'Address unavailable'}
              icon="navigate-outline"
              onNavigate={() => order.delivery_address && openMaps(order.delivery_address)}
            />
          )}

          {/* ── OTP: collection ───────────────────────────────────────────── */}
          {stage === 'otp_collection' && (
            <View style={s.otpCard}>
              <Ionicons name="shield-checkmark" size={28} color={C.infoFg} />
              <Text style={s.otpTitle}>Enter Collection Code</Text>
              <Text style={s.otpSub}>Ask the cook to show you the 6-digit code on their app.</Text>
              <TextInput
                style={[s.otpInput, otpError ? { borderColor: C.errorFg } : {}]}
                value={otpInput}
                onChangeText={v => { setOtpInput(v.replace(/\D/g, '').slice(0, 6)); setOtpError(''); }}
                placeholder="_ _ _ _ _ _"
                placeholderTextColor={C.stone}
                keyboardType="number-pad"
                maxLength={6}
                textAlign="center"
              />
              {!!otpError && <Text style={s.otpError}>{otpError}</Text>}
              <TouchableOpacity style={s.primaryBtn} onPress={handleCollectionOtp} disabled={actioning}>
                {actioning ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnText}>Verify & Pickup</Text>}
              </TouchableOpacity>
            </View>
          )}

          {/* ── OTP: delivery ─────────────────────────────────────────────── */}
          {stage === 'otp_delivery' && (
            <View style={s.otpCard}>
              <Ionicons name="shield-checkmark" size={28} color={C.successFg} />
              <Text style={s.otpTitle}>Enter Delivery Code</Text>
              <Text style={s.otpSub}>Ask the customer to open their FOODS tracking screen and show you the code.</Text>
              <TextInput
                style={[s.otpInput, otpError ? { borderColor: C.errorFg } : {}]}
                value={otpInput}
                onChangeText={v => { setOtpInput(v.replace(/\D/g, '').slice(0, 6)); setOtpError(''); }}
                placeholder="_ _ _ _ _ _"
                placeholderTextColor={C.stone}
                keyboardType="number-pad"
                maxLength={6}
                textAlign="center"
              />
              {!!otpError && <Text style={s.otpError}>{otpError}</Text>}
              <TouchableOpacity style={s.primaryBtn} onPress={handleDeliveryOtp} disabled={actioning}>
                {actioning ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnText}>Confirm Delivery</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={s.secondaryBtn} onPress={handleSkipDelivery} disabled={actioning}>
                <Text style={s.secondaryBtnText}>Mark delivered without OTP</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── En route (no OTP needed) ─────────────────────────────────── */}
          {stage === 'en_route' && (
            <View style={s.enRouteCard}>
              <Ionicons name="bicycle" size={32} color={C.spice} />
              <Text style={s.enRouteTitle}>On your way!</Text>
              <Text style={s.enRouteSub}>Navigate to the delivery address and hand over the order.</Text>
              <TouchableOpacity style={s.primaryBtn} onPress={handleSkipDelivery} disabled={actioning}>
                {actioning ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnText}>Confirm Delivered</Text>}
              </TouchableOpacity>
            </View>
          )}

          {/* ── No OTP pickup (just proceed) ────────────────────────────── */}
          {stage === 'pickup' && (
            <View style={s.enRouteCard}>
              <Ionicons name="restaurant" size={32} color={C.spice} />
              <Text style={s.enRouteTitle}>Go pick up the order</Text>
              <Text style={s.enRouteSub}>Navigate to the cook, collect the order, then proceed to deliver.</Text>
              <TouchableOpacity style={s.primaryBtn} onPress={handleSkipCollection} disabled={actioning}>
                {actioning ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnText}>Collected — Start Delivery</Text>}
              </TouchableOpacity>
            </View>
          )}

          {/* ── PHOTO PROOF STEP (shown after OTP or before skip-delivery) ── */}
          {showPhotoStep && stage !== 'done' && (
            <View style={s.photoCard}>
              <Ionicons name="camera" size={28} color={C.spice} />
              <Text style={s.photoTitle}>Take a Proof Photo</Text>
              <Text style={s.photoSub}>Snap a quick photo showing where you left the order. This protects you in case of a dispute.</Text>

              {proofPhotoUri ? (
                <View style={s.photoPreviewWrap}>
                  <Image source={{ uri: proofPhotoUri }} style={s.photoPreview} resizeMode="cover" />
                  <TouchableOpacity style={s.retakeBtn} onPress={pickProofPhoto}>
                    <Ionicons name="refresh" size={16} color={C.bodySoft} />
                    <Text style={s.retakeBtnText}>Retake</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={s.cameraBtn} onPress={pickProofPhoto}>
                  <Ionicons name="camera-outline" size={22} color={C.spice} />
                  <Text style={s.cameraBtnText}>Open Camera</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[s.primaryBtn, !proofPhotoUri && { opacity: 0.5 }]}
                onPress={handleDeliveryWithPhoto}
                disabled={!proofPhotoUri || actioning}
              >
                {(actioning || photoUploading)
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.primaryBtnText}>Confirm Delivery</Text>
                }
              </TouchableOpacity>
              <TouchableOpacity style={s.secondaryBtn} onPress={() => { setShowPhotoStep(false); setProofPhotoUri(null); }}>
                <Text style={s.secondaryBtnText}>Skip photo</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── DONE ──────────────────────────────────────────────────────── */}
          {stage === 'done' && !showPhotoStep && (
            <View style={s.doneCard}>
              <Ionicons name="checkmark-circle" size={64} color={C.successFg} />
              <Text style={s.doneTitle}>Delivery Complete!</Text>
              <Text style={s.doneSub}>Great work. Your earnings will be reflected in your weekly payout.</Text>
              {order.delivery_fee_payment_method && order.delivery_fee_payment_method !== 'wallet' && (
                <View style={s.cashReminder}>
                  <Ionicons name="cash" size={18} color={C.warnFg} />
                  <Text style={s.cashReminderText}>
                    Remember to collect ₦{order.delivery_fee?.toLocaleString()} from the customer
                    {order.delivery_fee_payment_method === 'cash' ? ' in cash.' : ' via transfer.'}
                  </Text>
                </View>
              )}
              <TouchableOpacity style={s.primaryBtn} onPress={() => router.replace('/(tabs)/orders')}>
                <Text style={s.primaryBtnText}>Back to Orders</Text>
              </TouchableOpacity>
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function StageBar({ stage }: { stage: Stage }) {
  const stages: Stage[] = ['pickup', 'otp_collection', 'en_route', 'otp_delivery', 'done'];
  // Simplify: show 4-step progress (pickup → en route → delivery → done)
  const steps = ['Pickup', 'En Route', 'Delivery', 'Done'];
  const stepIdx =
    stage === 'pickup' || stage === 'otp_collection' ? 0 :
    stage === 'en_route' ? 1 :
    stage === 'otp_delivery' ? 2 : 3;

  return (
    <View style={sb.row}>
      {steps.map((label, i) => (
        <React.Fragment key={label}>
          <View style={sb.step}>
            <View style={[sb.dot, i <= stepIdx && sb.dotActive]}>
              {i < stepIdx
                ? <Ionicons name="checkmark" size={12} color="#fff" />
                : <Text style={[sb.dotNum, i === stepIdx && sb.dotNumActive]}>{i + 1}</Text>
              }
            </View>
            <Text style={[sb.label, i === stepIdx && sb.labelActive]}>{label}</Text>
          </View>
          {i < steps.length - 1 && (
            <View style={[sb.line, i < stepIdx && sb.lineActive]} />
          )}
        </React.Fragment>
      ))}
    </View>
  );
}

function AddressCard({ label, address, icon, onNavigate }: { label: string; address: string; icon: string; onNavigate: () => void }) {
  return (
    <View style={s.addrCard}>
      <View style={s.addrHeader}>
        <Ionicons name={icon as any} size={18} color={C.spice} />
        <Text style={s.addrLabel}>{label}</Text>
      </View>
      <Text style={s.addrText}>{address}</Text>
      <TouchableOpacity style={s.navBtn} onPress={onNavigate} activeOpacity={0.8}>
        <Ionicons name="navigate" size={16} color={C.spice} />
        <Text style={s.navBtnText}>Open in Maps</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: C.bg },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Sp.md, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.borderWarm },
  headerTitle:  { fontFamily: F.sansMedium, fontSize: Fs.lg, color: C.textInk },
  scroll:       { padding: Sp.md, gap: 16, paddingBottom: 60 },
  feeBanner:    { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.honey, padding: 14, borderRadius: R.md },
  feeText:      { fontFamily: F.sansMedium, fontSize: Fs.md, color: C.textInk, flex: 1 },
  cashPill:     { backgroundColor: C.warnBg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: R.full },
  cashPillText: { fontFamily: F.sansMedium, fontSize: Fs.xs, color: C.warnFg },
  addrCard:     { borderWidth: 1, borderColor: C.borderWarm, borderRadius: R.lg, padding: Sp.md, gap: 8 },
  addrHeader:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  addrLabel:    { fontFamily: F.sansMedium, fontSize: Fs.sm, color: C.bodySoft, textTransform: 'uppercase', letterSpacing: 0.5 },
  addrText:     { fontFamily: F.sansMedium, fontSize: Fs.md, color: C.textInk, lineHeight: 22 },
  navBtn:       { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderWidth: 1.5, borderColor: C.spice, borderRadius: R.full, paddingHorizontal: 14, paddingVertical: 8 },
  navBtnText:   { fontFamily: F.sansMedium, fontSize: Fs.sm, color: C.spice },
  otpCard:      { alignItems: 'center', gap: 14, backgroundColor: C.infoBg, padding: Sp.lg, borderRadius: R.lg },
  otpTitle:     { fontFamily: F.sansMedium, fontSize: Fs.xl, color: C.textInk, textAlign: 'center' },
  otpSub:       { fontFamily: F.sans, fontSize: Fs.md, color: C.bodySoft, textAlign: 'center', lineHeight: 22 },
  otpInput:     { width: '100%', height: 64, borderWidth: 2, borderColor: C.borderWarm, borderRadius: R.lg, fontFamily: F.sansMedium, fontSize: 32, letterSpacing: 8, textAlign: 'center', color: C.textInk, backgroundColor: C.bg },
  otpError:     { fontFamily: F.sans, fontSize: Fs.sm, color: C.errorFg, textAlign: 'center' },
  enRouteCard:  { alignItems: 'center', gap: 14, backgroundColor: C.honey, padding: Sp.lg, borderRadius: R.lg },
  enRouteTitle: { fontFamily: F.sansMedium, fontSize: Fs.xl, color: C.textInk },
  enRouteSub:   { fontFamily: F.sans, fontSize: Fs.md, color: C.bodySoft, textAlign: 'center', lineHeight: 22 },
  doneCard:     { alignItems: 'center', gap: 16, paddingVertical: Sp.xl },
  doneTitle:    { fontFamily: F.sansMedium, fontSize: Fs.xxl, color: C.successFg },
  doneSub:      { fontFamily: F.sans, fontSize: Fs.md, color: C.bodySoft, textAlign: 'center', lineHeight: 24 },
  cashReminder: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: C.warnBg, padding: 14, borderRadius: R.md, width: '100%' },
  cashReminderText: { fontFamily: F.sans, fontSize: Fs.sm, color: C.warnFg, flex: 1, lineHeight: 20 },
  primaryBtn:   { width: '100%', height: 52, borderRadius: R.full, backgroundColor: C.spice, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { fontFamily: F.sansMedium, fontSize: Fs.md, color: '#fff' },
  secondaryBtn: { paddingVertical: 10, alignItems: 'center' },
  secondaryBtnText: { fontFamily: F.sans, fontSize: Fs.sm, color: C.bodySoft, textDecorationLine: 'underline' },

  // Photo proof
  photoCard:        { alignItems: 'center', gap: 14, backgroundColor: C.honey, padding: Sp.lg, borderRadius: R.lg },
  photoTitle:       { fontFamily: F.sansMedium, fontSize: Fs.xl, color: C.textInk, textAlign: 'center' },
  photoSub:         { fontFamily: F.sans, fontSize: Fs.md, color: C.bodySoft, textAlign: 'center', lineHeight: 22 },
  photoPreviewWrap: { width: '100%', alignItems: 'center', gap: 8 },
  photoPreview:     { width: '100%', height: 180, borderRadius: R.lg },
  retakeBtn:        { flexDirection: 'row', alignItems: 'center', gap: 5 },
  retakeBtnText:    { fontFamily: F.sans, fontSize: Fs.sm, color: C.bodySoft },
  cameraBtn:        { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderColor: C.spice, borderRadius: R.full, paddingHorizontal: 20, paddingVertical: 12 },
  cameraBtnText:    { fontFamily: F.sansMedium, fontSize: Fs.md, color: C.spice },
});

const sb = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'center', paddingVertical: Sp.md },
  step:     { alignItems: 'center', gap: 4 },
  dot:      { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: C.borderWarm, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  dotActive:{ borderColor: C.spice, backgroundColor: C.spice },
  dotNum:   { fontFamily: F.sansMedium, fontSize: Fs.sm, color: C.stone },
  dotNumActive: { color: '#fff' },
  label:    { fontFamily: F.sans, fontSize: Fs.xs, color: C.stone },
  labelActive: { color: C.spice, fontFamily: F.sansMedium },
  line:     { flex: 1, height: 2, backgroundColor: C.borderWarm, marginBottom: 20 },
  lineActive: { backgroundColor: C.spice },
});
