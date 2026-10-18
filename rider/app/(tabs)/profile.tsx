import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, TextInput, Pressable, Modal, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../src/context/AuthContext';
import { riderApi, type IdTypeOption } from '../../src/api/rider';
import { COUNTRIES, countryFromPhone, countryByIso, type Country } from '../../src/constants/countries';
import { C, Sp, R, Fs, F } from '../../src/theme';

const STATUS_COLOR: Record<string, string> = {
  pending:   C.warnFg,
  approved:  C.successFg,
  rejected:  C.errorFg,
  suspended: C.bodySoft,
};

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const [rider, setRider] = useState<any>(null);
  const [kyc, setKyc] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // KYC form state — the rider's own country's national ID (no BVN)
  const [showKycForm, setShowKycForm] = useState(false);
  const [idCountry, setIdCountry] = useState<Country>(COUNTRIES.find(c => c.iso === 'NG')!);
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [idTypes, setIdTypes] = useState<IdTypeOption[]>([]);
  const [kycType, setKycType] = useState<string | null>(null);
  const [kycValue, setKycValue] = useState('');
  const [idPhoto, setIdPhoto] = useState<string | null>(null);
  const [kycLoading, setKycLoading] = useState(false);
  const [kycError, setKycError] = useState('');
  const selectedIdType = idTypes.find(x => x.type === kycType) ?? null;

  useEffect(() => {
    Promise.all([
      riderApi.getMyProfile().then(res => {
        setRider(res.rider);
        const c = countryFromPhone(res.rider?.phone);
        if (c) setIdCountry(c);
      }).catch(() => {}),
      riderApi.getMyKyc().then(res => {
        setKyc(res.kyc);
        const c = countryByIso(res.kyc?.kyc_country);
        if (c) setIdCountry(c);
      }).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let live = true;
    riderApi.idTypes(idCountry.iso)
      .then(res => { if (live) { setIdTypes(res.id_types); setKycType(res.id_types[0]?.type ?? null); } })
      .catch(() => { if (live) setIdTypes([]); });
    setKycValue(''); setKycError('');
    return () => { live = false; };
  }, [idCountry.iso]);

  // The photo goes only to the private KYC endpoint, never a public upload.
  const pickIdPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { setKycError('Allow photo access to add your ID.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7, base64: true });
    if (result.canceled || !result.assets?.[0]?.base64) return;
    const asset = result.assets[0];
    const ext = (asset.uri.split('.').pop() ?? 'jpg').toLowerCase();
    const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    setIdPhoto(`data:${mime};base64,${asset.base64}`);
    setKycError('');
  };

  const handleSubmitKyc = async () => {
    if (!kycType || !kycValue.trim()) { setKycError(`Enter your ${selectedIdType?.label ?? 'ID number'}.`); return; }
    setKycLoading(true);
    setKycError('');
    try {
      const res = await riderApi.submitKyc({ country: idCountry.iso, type: kycType, value: kycValue.trim(), document: idPhoto ?? undefined });
      setKyc({
        kyc_status: res.status, kyc_type: kycType, kyc_country: idCountry.iso,
        kyc_id_suffix: kycValue.trim().slice(-4), kyc_verified_name: res.verified_name ?? null,
      });
      setShowKycForm(false);
      setIdPhoto(null);
    } catch (err: any) {
      setKycError(err?.error ?? 'Verification failed. Check the number and try again.');
    } finally {
      setKycLoading(false);
    }
  };

  const idLabel = (type?: string | null) =>
    type === 'passport' ? 'Passport' : type === 'national_id' ? 'National ID' : type?.toUpperCase() ?? 'ID';

  const kycStatus: string = kyc?.kyc_status ?? 'not_verified';
  const isKycProblem = kycStatus === 'failed' || kycStatus === 'rejected';

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>My Profile</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        {/* Avatar */}
        <View style={s.avatarWrap}>
          <View style={s.avatar}>
            <Ionicons name="person" size={42} color={C.spice} />
          </View>
          <Text style={s.name}>{user?.full_name ?? rider?.full_name ?? 'Rider'}</Text>
          <Text style={s.email}>{user?.email ?? '—'}</Text>
        </View>

        {loading ? <ActivityIndicator color={C.spice} style={{ marginTop: 20 }} /> : null}

        {rider && (
          <>
            <View style={s.statusCard}>
              <View style={[s.statusDot, { backgroundColor: STATUS_COLOR[rider.status] ?? C.stone }]} />
              <Text style={[s.statusText, { color: STATUS_COLOR[rider.status] ?? C.stone }]}>
                Account {rider.status}
              </Text>
            </View>

            {rider.status === 'pending' && (
              <View style={s.pendingNote}>
                <Ionicons name="time-outline" size={16} color={C.warnFg} />
                <Text style={s.pendingNoteText}>Your application is under review. We'll notify you once it's approved.</Text>
              </View>
            )}

            {rider.status === 'rejected' && rider.rejection_reason && (
              <View style={s.rejectedNote}>
                <Ionicons name="alert-circle-outline" size={16} color={C.errorFg} />
                <Text style={s.rejectedNoteText}>{rider.rejection_reason}</Text>
              </View>
            )}

            {/* KYC card */}
            <View style={[s.infoCard, kycStatus === 'verified' && { borderColor: '#86EFAC' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Ionicons
                  name={kycStatus === 'verified' ? 'shield-checkmark' : kycStatus === 'pending_review' ? 'time-outline' : 'shield-outline'}
                  size={18}
                  color={kycStatus === 'verified' ? '#16A34A' : isKycProblem ? C.errorFg : C.stone}
                />
                <Text style={[s.infoCardTitle, {
                  color: kycStatus === 'verified' ? '#16A34A' : isKycProblem ? C.errorFg : C.bodySoft,
                  marginBottom: 0,
                }]}>
                  Identity {kycStatus === 'verified' ? 'Verified'
                    : kycStatus === 'pending_review' ? 'In Review'
                    : isKycProblem ? 'Not Verified — please retry' : 'Not Verified'}
                </Text>
              </View>

              {(kycStatus === 'verified' || kycStatus === 'pending_review') && (
                <>
                  {kyc.kyc_verified_name && <InfoRow icon="person-outline" label="Verified name" value={kyc.kyc_verified_name} />}
                  <InfoRow icon="card-outline" label={idLabel(kyc.kyc_type)} value={`····${kyc.kyc_id_suffix}`} />
                </>
              )}

              {kycStatus === 'pending_review' && (
                <Text style={{ fontFamily: F.sans, fontSize: Fs.xs, color: C.bodySoft }}>
                  Our team is checking your ID. We usually reply within 2 working days.
                </Text>
              )}

              {isKycProblem && (
                <Text style={{ fontFamily: F.sans, fontSize: Fs.xs, color: C.errorFg, marginBottom: 4 }}>
                  {kyc?.kyc_error ?? 'Verification could not be completed.'}
                </Text>
              )}

              {kycStatus !== 'verified' && kycStatus !== 'pending_review' && !showKycForm && (
                <TouchableOpacity
                  style={[s.kycBtn, { borderColor: C.spice }]}
                  onPress={() => setShowKycForm(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="shield-checkmark-outline" size={16} color={C.spice} />
                  <Text style={{ fontFamily: F.sansMedium, fontSize: Fs.sm, color: C.spice }}>
                    {isKycProblem ? 'Retry Verification' : 'Verify Identity Now'}
                  </Text>
                </TouchableOpacity>
              )}

              {showKycForm && (
                <View style={{ gap: 10, marginTop: 4 }}>
                  {/* Country of the ID */}
                  <TouchableOpacity
                    style={[s.kycInput, { borderColor: C.borderWarm, flexDirection: 'row', alignItems: 'center' }]}
                    onPress={() => setCountryPickerOpen(true)}
                  >
                    <Text style={{ flex: 1, fontFamily: F.sans, fontSize: Fs.sm, color: C.textInk }}>ID from: {idCountry.name}</Text>
                    <Ionicons name="chevron-down" size={16} color={C.bodySoft} />
                  </TouchableOpacity>

                  {idTypes.length > 1 && (
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {idTypes.map(opt => (
                        <Pressable
                          key={opt.type}
                          onPress={() => { setKycType(opt.type); setKycValue(''); setKycError(''); }}
                          style={{
                            flex: 1, paddingVertical: 8, borderRadius: 6, borderWidth: 1.5, alignItems: 'center',
                            borderColor: kycType === opt.type ? C.spice : C.borderWarm,
                            backgroundColor: kycType === opt.type ? '#FFF1EB' : C.bg,
                          }}
                        >
                          <Text style={{ fontFamily: F.sansMedium, fontSize: Fs.sm, color: kycType === opt.type ? C.spice : C.body }}>
                            {opt.label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  )}

                  <TextInput
                    style={[s.kycInput, { borderColor: kycError ? C.errorFg : C.borderWarm }]}
                    value={kycValue}
                    onChangeText={v => { setKycValue(v); setKycError(''); }}
                    placeholder={selectedIdType ? `${selectedIdType.label} (${selectedIdType.placeholder})` : 'ID number'}
                    placeholderTextColor={C.stone}
                    autoCapitalize="characters"
                  />

                  {/* Photo — reviewed by our team where there's no instant check */}
                  <TouchableOpacity
                    style={[s.kycInput, { borderColor: idPhoto ? C.spice : C.borderWarm, borderStyle: 'dashed', flexDirection: 'row', alignItems: 'center', gap: 8 }]}
                    onPress={pickIdPhoto}
                  >
                    <Ionicons name={idPhoto ? 'document-text' : 'camera-outline'} size={18} color={idPhoto ? C.spice : C.bodySoft} />
                    <Text style={{ fontFamily: F.sans, fontSize: Fs.sm, color: idPhoto ? C.spice : C.bodySoft }}>
                      {idPhoto ? 'ID photo added' : selectedIdType?.automatic ? 'Add a photo of your ID (optional)' : 'Add a photo of your ID'}
                    </Text>
                  </TouchableOpacity>
                  {!!kycError && <Text style={{ fontFamily: F.sans, fontSize: Fs.xs, color: C.errorFg }}>{kycError}</Text>}

                  <Text style={{ fontFamily: F.sans, fontSize: Fs.xs, color: C.bodySoft }}>
                    {selectedIdType?.automatic
                      ? 'We check this number instantly. We only keep the last 4 characters.'
                      : 'Our team reviews the photo, usually within 2 working days. It is stored privately; we only keep the last 4 characters of the number.'}
                  </Text>

                  <Modal visible={countryPickerOpen} animationType="slide" onRequestClose={() => setCountryPickerOpen(false)}>
                    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
                      <View style={[s.header, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
                        <TouchableOpacity onPress={() => setCountryPickerOpen(false)} hitSlop={12}>
                          <Ionicons name="close" size={24} color={C.textInk} />
                        </TouchableOpacity>
                        <Text style={s.title}>Country of your ID</Text>
                      </View>
                      <TextInput
                        style={[s.kycInput, { margin: Sp.md, borderColor: C.borderWarm }]}
                        placeholder="Search country"
                        placeholderTextColor={C.stone}
                        value={countrySearch}
                        onChangeText={setCountrySearch}
                      />
                      <FlatList
                        data={COUNTRIES.filter(c => c.name.toLowerCase().includes(countrySearch.toLowerCase()))}
                        keyExtractor={item => item.iso}
                        keyboardShouldPersistTaps="handled"
                        renderItem={({ item }) => (
                          <TouchableOpacity
                            style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: Sp.md, paddingVertical: 14 }}
                            onPress={() => { setIdCountry(item); setCountryPickerOpen(false); setCountrySearch(''); }}
                          >
                            <Text style={{ flex: 1, fontFamily: F.sans, fontSize: Fs.md, color: C.textInk }}>{item.name}</Text>
                            {item.iso === idCountry.iso && <Ionicons name="checkmark" size={18} color={C.spice} />}
                          </TouchableOpacity>
                        )}
                      />
                    </SafeAreaView>
                  </Modal>

                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity
                      style={[s.kycActionBtn, { borderColor: C.borderWarm, flex: 1 }]}
                      onPress={() => { setShowKycForm(false); setKycError(''); }}
                    >
                      <Text style={{ fontFamily: F.sans, fontSize: Fs.sm, color: C.body }}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.kycActionBtn, { backgroundColor: C.spice, flex: 2 }]}
                      onPress={handleSubmitKyc}
                      disabled={kycLoading}
                    >
                      {kycLoading
                        ? <ActivityIndicator color="#fff" size="small" />
                        : <Text style={{ fontFamily: F.sansMedium, fontSize: Fs.sm, color: '#fff' }}>Verify Now</Text>}
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>

            {/* Profile details */}
            <View style={s.infoCard}>
              <InfoRow icon="call-outline" label="Phone" value={rider.phone} />
              <InfoRow icon="bicycle-outline" label="Vehicle" value={rider.vehicle_type === 'bike' ? 'Motorbike' : 'Bicycle'} />
              {rider.vehicle_plate && <InfoRow icon="car-outline" label="Plate" value={rider.vehicle_plate} />}
              {rider.fleet_name && <InfoRow icon="business-outline" label="Fleet" value={rider.fleet_name} />}
              <InfoRow icon="trophy-outline" label="Total deliveries" value={String(rider.total_deliveries ?? 0)} />
            </View>

            {/* Bank info (masked) */}
            {rider.bank_name && (
              <View style={s.infoCard}>
                <Text style={s.infoCardTitle}>Payout Account</Text>
                <InfoRow icon="business-outline" label="Bank" value={rider.bank_name} />
                {rider.bank_account_number && (
                  <InfoRow icon="card-outline" label="Account" value={`****${rider.bank_account_number.slice(-4)}`} />
                )}
                {rider.bank_account_name && <InfoRow icon="person-outline" label="Name" value={rider.bank_account_name} />}
              </View>
            )}
          </>
        )}

        {/* Logout */}
        <TouchableOpacity style={s.logoutBtn} onPress={logout} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={20} color={C.errorFg} />
          <Text style={s.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={s.infoRow}>
      <Ionicons name={icon as any} size={16} color={C.bodySoft} />
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: C.bg },
  header:       { padding: Sp.lg, paddingBottom: Sp.md, borderBottomWidth: 1, borderBottomColor: C.borderWarm },
  title:        { fontFamily: F.sansMedium, fontSize: Fs.xl, color: C.textInk },
  scroll:       { padding: Sp.md, gap: 16, paddingBottom: 60 },
  avatarWrap:   { alignItems: 'center', paddingTop: Sp.md, gap: 8 },
  avatar:       { width: 88, height: 88, borderRadius: 44, backgroundColor: C.honey, alignItems: 'center', justifyContent: 'center' },
  name:         { fontFamily: F.sansMedium, fontSize: Fs.xl, color: C.textInk },
  email:        { fontFamily: F.sans, fontSize: Fs.sm, color: C.bodySoft },
  statusCard:   { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center' },
  statusDot:    { width: 10, height: 10, borderRadius: 5 },
  statusText:   { fontFamily: F.sansMedium, fontSize: Fs.md, textTransform: 'capitalize' },
  pendingNote:  { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: C.warnBg, padding: 14, borderRadius: R.md },
  pendingNoteText: { fontFamily: F.sans, fontSize: Fs.sm, color: C.warnFg, flex: 1, lineHeight: 20 },
  rejectedNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: C.errorBg, padding: 14, borderRadius: R.md },
  rejectedNoteText: { fontFamily: F.sans, fontSize: Fs.sm, color: C.errorFg, flex: 1, lineHeight: 20 },
  infoCard:     { borderWidth: 1, borderColor: C.borderWarm, borderRadius: R.lg, padding: Sp.md, gap: 12 },
  infoCardTitle:{ fontFamily: F.sansMedium, fontSize: Fs.sm, color: C.bodySoft, marginBottom: 4 },
  infoRow:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoLabel:    { fontFamily: F.sans, fontSize: Fs.sm, color: C.bodySoft, flex: 1 },
  infoValue:    { fontFamily: F.sansMedium, fontSize: Fs.sm, color: C.textInk },
  kycBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderRadius: R.md, paddingVertical: 10 },
  kycInput:     { borderWidth: 1, borderRadius: R.md, paddingHorizontal: 12, paddingVertical: 10, fontFamily: F.sans, fontSize: Fs.sm, color: C.textInk },
  kycActionBtn: { borderWidth: 1, borderColor: 'transparent', borderRadius: R.md, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  logoutBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: C.errorFg, borderRadius: R.full, paddingVertical: 14, marginTop: 8 },
  logoutText:   { fontFamily: F.sansMedium, fontSize: Fs.md, color: C.errorFg },
});
