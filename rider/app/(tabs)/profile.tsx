import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, TextInput, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { riderApi } from '../../src/api/rider';
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

  // KYC form state
  const [showKycForm, setShowKycForm] = useState(false);
  const [kycType, setKycType] = useState<'bvn' | 'nin'>('bvn');
  const [kycValue, setKycValue] = useState('');
  const [kycLoading, setKycLoading] = useState(false);
  const [kycError, setKycError] = useState('');

  useEffect(() => {
    Promise.all([
      riderApi.getMyProfile().then(res => setRider(res.rider)).catch(() => {}),
      riderApi.getMyKyc().then(res => setKyc(res.kyc)).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const handleSubmitKyc = async () => {
    if (!/^\d{11}$/.test(kycValue.trim())) {
      setKycError(`${kycType.toUpperCase()} must be exactly 11 digits`);
      return;
    }
    setKycLoading(true);
    setKycError('');
    try {
      const res = await riderApi.submitKyc(kycType, kycValue.trim());
      setKyc({ kyc_status: 'verified', kyc_type: kycType, kyc_id_suffix: kycValue.slice(-4), kyc_verified_name: res.verified_name });
      setShowKycForm(false);
    } catch (err: any) {
      setKycError(err?.error ?? 'Verification failed. Check the number and try again.');
    } finally {
      setKycLoading(false);
    }
  };

  const kycStatus: string = kyc?.kyc_status ?? 'not_verified';

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
                  name={kycStatus === 'verified' ? 'shield-checkmark' : 'shield-outline'}
                  size={18}
                  color={kycStatus === 'verified' ? '#16A34A' : kycStatus === 'failed' ? C.errorFg : C.stone}
                />
                <Text style={[s.infoCardTitle, {
                  color: kycStatus === 'verified' ? '#16A34A' : kycStatus === 'failed' ? C.errorFg : C.bodySoft,
                  marginBottom: 0,
                }]}>
                  Identity {kycStatus === 'verified' ? 'Verified' : kycStatus === 'failed' ? 'Verification Failed' : 'Not Verified'}
                </Text>
              </View>

              {kycStatus === 'verified' && (
                <>
                  {kyc.kyc_verified_name && <InfoRow icon="person-outline" label="Verified name" value={kyc.kyc_verified_name} />}
                  <InfoRow icon="card-outline" label={kyc.kyc_type?.toUpperCase() ?? 'ID'} value={`····${kyc.kyc_id_suffix}`} />
                </>
              )}

              {kycStatus === 'failed' && (
                <Text style={{ fontFamily: F.sans, fontSize: Fs.xs, color: C.errorFg, marginBottom: 4 }}>
                  {kyc?.kyc_error ?? 'Verification could not be completed.'}
                </Text>
              )}

              {kycStatus !== 'verified' && !showKycForm && (
                <TouchableOpacity
                  style={[s.kycBtn, { borderColor: C.spice }]}
                  onPress={() => setShowKycForm(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="shield-checkmark-outline" size={16} color={C.spice} />
                  <Text style={{ fontFamily: F.sansMedium, fontSize: Fs.sm, color: C.spice }}>
                    {kycStatus === 'failed' ? 'Retry Verification' : 'Verify Identity Now'}
                  </Text>
                </TouchableOpacity>
              )}

              {showKycForm && (
                <View style={{ gap: 10, marginTop: 4 }}>
                  {/* BVN / NIN toggle */}
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {(['bvn', 'nin'] as const).map(t => (
                      <Pressable
                        key={t}
                        onPress={() => { setKycType(t); setKycValue(''); setKycError(''); }}
                        style={{
                          flex: 1, paddingVertical: 8, borderRadius: 6, borderWidth: 1.5, alignItems: 'center',
                          borderColor: kycType === t ? C.spice : C.borderWarm,
                          backgroundColor: kycType === t ? '#FFF1EB' : C.bg,
                        }}
                      >
                        <Text style={{ fontFamily: F.sansMedium, fontSize: Fs.sm, color: kycType === t ? C.spice : C.body }}>
                          {t.toUpperCase()}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <TextInput
                    style={[s.kycInput, { borderColor: kycError ? C.errorFg : C.borderWarm }]}
                    value={kycValue}
                    onChangeText={v => { setKycValue(v); setKycError(''); }}
                    placeholder={kycType === 'bvn' ? 'Bank Verification Number (11 digits)' : 'National ID Number (11 digits)'}
                    placeholderTextColor={C.stone}
                    keyboardType="number-pad"
                    maxLength={11}
                  />
                  {!!kycError && <Text style={{ fontFamily: F.sans, fontSize: Fs.xs, color: C.errorFg }}>{kycError}</Text>}

                  <Text style={{ fontFamily: F.sans, fontSize: Fs.xs, color: C.bodySoft }}>
                    {kycType === 'bvn' ? 'Dial *565*0# on your registered line to get your BVN.' : 'Dial *346# on MTN or check your NIMC slip.'}
                  </Text>

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
