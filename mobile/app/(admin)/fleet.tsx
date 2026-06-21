import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, TextInput, RefreshControl, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { Fonts, Spacing, Radius, Shadow, FontSize } from '../../src/constants/theme';
import { fleetApi, type FleetOperator, type RiderProfile } from '../../src/api/fleet';
import { useFeedback } from '../../src/components/feedback';
import { relativeTime } from '../../src/utils/format';

type Tab = 'operators' | 'riders';
type FilterStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

const STATUS_COLOR: Record<string, string> = {
  pending:   '#B45309',
  approved:  '#16A34A',
  rejected:  '#DC2626',
  suspended: '#6B7280',
};

export default function AdminFleetScreen() {
  const router = useRouter();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const feedback = useFeedback();

  const [tab, setTab] = useState<Tab>('operators');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('pending');
  const [operators, setOperators] = useState<FleetOperator[]>([]);
  const [riders, setRiders] = useState<RiderProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Review panel
  const [selectedOp, setSelectedOp] = useState<FleetOperator | null>(null);
  const [selectedRider, setSelectedRider] = useState<RiderProfile | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actioning, setActioning] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      if (tab === 'operators') {
        const res = await fleetApi.adminListOperators({ status: filterStatus, limit: 50 });
        setOperators(res.fleet_operators ?? []);
      } else {
        const res = await fleetApi.adminListRiders({ status: filterStatus, limit: 50 });
        setRiders(res.riders ?? []);
      }
    } catch {
      feedback.toast('Failed to load fleet data', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab, filterStatus, feedback]);

  useEffect(() => { load(); }, [load]);

  const reviewOperator = async (decision: 'approved' | 'rejected' | 'suspended') => {
    if (!selectedOp) return;
    if (decision === 'rejected' && !rejectReason.trim()) {
      feedback.toast('Provide a rejection reason', 'error');
      return;
    }
    setActioning(true);
    try {
      await fleetApi.adminReviewOperator(selectedOp.id, {
        status: decision,
        rejection_reason: rejectReason.trim() || undefined,
      });
      feedback.toast(`Fleet operator ${decision}`, 'success');
      setSelectedOp(null);
      setRejectReason('');
      load();
    } catch {
      feedback.toast('Action failed. Try again.', 'error');
    } finally {
      setActioning(false);
    }
  };

  const reviewRider = async (decision: 'approved' | 'rejected' | 'suspended') => {
    if (!selectedRider) return;
    if (decision === 'rejected' && !rejectReason.trim()) {
      feedback.toast('Provide a rejection reason', 'error');
      return;
    }
    setActioning(true);
    try {
      await fleetApi.adminReviewRider(selectedRider.id, {
        status: decision,
        rejection_reason: rejectReason.trim() || undefined,
      });
      feedback.toast(`Rider ${decision}`, 'success');
      setSelectedRider(null);
      setRejectReason('');
      load();
    } catch {
      feedback.toast('Action failed. Try again.', 'error');
    } finally {
      setActioning(false);
    }
  };

  const renderOperator = (op: FleetOperator) => (
    <TouchableOpacity
      key={op.id}
      style={[styles.card, Shadow.card]}
      onPress={() => { setSelectedOp(op); setRejectReason(op.rejection_reason ?? ''); }}
      activeOpacity={0.85}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.typeBadge, { backgroundColor: op.operator_type === 'company' ? '#EFF6FF' : '#FFF1EB' }]}>
          <Text style={[styles.typeBadgeText, { color: op.operator_type === 'company' ? '#2563EB' : C.spice }]}>
            {op.operator_type === 'company' ? 'Company' : 'Individual'}
          </Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: STATUS_COLOR[op.status] + '20' }]}>
          <Text style={[styles.statusPillText, { color: STATUS_COLOR[op.status] }]}>{op.status}</Text>
        </View>
      </View>
      <Text style={[styles.cardTitle, { color: C.textInk }]}>{op.business_name}</Text>
      <Text style={[styles.cardSub, { color: C.bodySoft }]}>{op.contact_name} · {op.contact_phone}</Text>
      <Text style={[styles.cardMeta, { color: C.bodySoft }]}>
        {op.vehicle_count} vehicle{op.vehicle_count !== 1 ? 's' : ''} · {op.vehicle_types?.join(', ') ?? '—'} · {op.service_areas?.slice(0, 3).join(', ')}{(op.service_areas?.length ?? 0) > 3 ? ' +more' : ''}
      </Text>
      <Text style={[styles.cardTime, { color: C.caps }]}>{relativeTime(op.created_at)}</Text>
    </TouchableOpacity>
  );

  const renderRider = (rider: RiderProfile) => (
    <TouchableOpacity
      key={rider.id}
      style={[styles.card, Shadow.card]}
      onPress={() => { setSelectedRider(rider); setRejectReason(rider.rejection_reason ?? ''); }}
      activeOpacity={0.85}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.typeBadge, { backgroundColor: rider.vehicle_type === 'bike' ? '#FFF1EB' : '#F0FDF4' }]}>
          <Text style={[styles.typeBadgeText, { color: rider.vehicle_type === 'bike' ? C.spice : '#16A34A' }]}>
            {rider.vehicle_type === 'bike' ? 'Motorbike' : 'Bicycle'}
          </Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: STATUS_COLOR[rider.status] + '20' }]}>
          <Text style={[styles.statusPillText, { color: STATUS_COLOR[rider.status] }]}>{rider.status}</Text>
        </View>
      </View>
      <Text style={[styles.cardTitle, { color: C.textInk }]}>{rider.full_name}</Text>
      <Text style={[styles.cardSub, { color: C.bodySoft }]}>{rider.phone}{rider.fleet_name ? ` · ${rider.fleet_name}` : ' · Solo rider'}</Text>
      {rider.vehicle_plate && <Text style={[styles.cardMeta, { color: C.bodySoft }]}>Plate: {rider.vehicle_plate}</Text>}
      <Text style={[styles.cardMeta, { color: C.bodySoft }]}>{rider.service_areas?.slice(0, 3).join(', ')}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
        <Ionicons
          name={rider.kyc_status === 'verified' ? 'shield-checkmark' : rider.kyc_status === 'failed' ? 'shield-outline' : 'shield-outline'}
          size={13}
          color={rider.kyc_status === 'verified' ? '#16A34A' : rider.kyc_status === 'failed' ? '#DC2626' : C.stone}
        />
        <Text style={{ fontFamily: Fonts.sans, fontSize: FontSize.xs, color: rider.kyc_status === 'verified' ? '#16A34A' : rider.kyc_status === 'failed' ? '#DC2626' : C.stone }}>
          {rider.kyc_status === 'verified' ? `KYC verified · ${rider.kyc_type?.toUpperCase()} ····${rider.kyc_id_suffix}` : rider.kyc_status === 'failed' ? 'KYC failed' : 'KYC not verified'}
        </Text>
      </View>
      <Text style={[styles.cardTime, { color: C.caps }]}>{relativeTime(rider.created_at)}</Text>
    </TouchableOpacity>
  );

  // ── Review modal overlay ──
  const reviewTarget = selectedOp ?? selectedRider;
  const isOperatorReview = !!selectedOp;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.bg }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: C.borderWarm }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={C.textInk} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: C.textInk }]}>Fleet Approvals</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Tabs */}
      <View style={[styles.tabRow, { borderBottomColor: C.borderWarm }]}>
        {(['operators', 'riders'] as Tab[]).map(t => (
          <Pressable key={t} style={[styles.tabBtn, tab === t && styles.tabBtnActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, { color: tab === t ? C.spice : C.bodySoft }]}>
              {t === 'operators' ? 'Fleet Operators' : 'Riders'}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Status filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {(['pending', 'approved', 'rejected', 'suspended'] as FilterStatus[]).map(s => (
          <Pressable
            key={s}
            style={[styles.filterChip, filterStatus === s && { backgroundColor: C.spice, borderColor: C.spice }]}
            onPress={() => setFilterStatus(s)}
          >
            <Text style={[styles.filterChipText, filterStatus === s && { color: '#fff' }]}>{s}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* List */}
      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} />}
      >
        {loading
          ? <ActivityIndicator color={C.spice} style={{ marginTop: 40 }} />
          : tab === 'operators'
          ? operators.length
            ? operators.map(renderOperator)
            : <EmptyState label={`No ${filterStatus} fleet operators`} C={C} />
          : riders.length
          ? riders.map(renderRider)
          : <EmptyState label={`No ${filterStatus} riders`} C={C} />
        }
      </ScrollView>

      {/* Review panel */}
      {reviewTarget && (
        <View style={[StyleSheet.absoluteFillObject, styles.overlay]}>
          <Pressable style={styles.overlayBg} onPress={() => { setSelectedOp(null); setSelectedRider(null); }} />
          <View style={[styles.reviewSheet, { backgroundColor: C.bg }]}>
            <Text style={[styles.reviewTitle, { color: C.textInk }]}>
              {isOperatorReview ? (reviewTarget as FleetOperator).business_name : (reviewTarget as RiderProfile).full_name}
            </Text>
            <Text style={[styles.reviewSub, { color: C.bodySoft }]}>
              {isOperatorReview
                ? `${(reviewTarget as FleetOperator).operator_type} · ${(reviewTarget as FleetOperator).vehicle_count} vehicles`
                : `${(reviewTarget as RiderProfile).vehicle_type} · ${(reviewTarget as RiderProfile).phone}`}
            </Text>

            {/* Doc links */}
            {isOperatorReview && (
              <View style={styles.docLinks}>
                {(reviewTarget as FleetOperator).id_document_url && <DocLink label="ID Document" C={C} />}
                {(reviewTarget as FleetOperator).vehicle_docs_url && <DocLink label="Vehicle Docs" C={C} />}
                {(reviewTarget as FleetOperator).insurance_url && <DocLink label="Insurance" C={C} />}
              </View>
            )}
            {!isOperatorReview && (
              <>
                <View style={styles.docLinks}>
                  {(reviewTarget as RiderProfile).government_id_url && <DocLink label="Gov ID" C={C} />}
                  {(reviewTarget as RiderProfile).vehicle_registration_url && <DocLink label="Vehicle Reg" C={C} />}
                </View>
                {/* KYC status */}
                {(() => {
                  const r = reviewTarget as RiderProfile;
                  const kycColor = r.kyc_status === 'verified' ? '#16A34A' : r.kyc_status === 'failed' ? '#DC2626' : C.stone;
                  const kycBg   = r.kyc_status === 'verified' ? '#F0FDF4' : r.kyc_status === 'failed' ? '#FEF2F2' : C.borderWarm + '40';
                  return (
                    <View style={{ backgroundColor: kycBg, borderRadius: 8, padding: 10, gap: 4 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name={r.kyc_status === 'verified' ? 'shield-checkmark' : 'shield-outline'} size={15} color={kycColor} />
                        <Text style={{ fontFamily: Fonts.sansMedium, fontSize: FontSize.sm, color: kycColor }}>
                          {r.kyc_status === 'verified' ? 'Identity Verified' : r.kyc_status === 'failed' ? 'KYC Failed' : 'KYC Not Submitted'}
                        </Text>
                      </View>
                      {r.kyc_status === 'verified' && (
                        <>
                          {r.kyc_type && <Text style={{ fontFamily: Fonts.sans, fontSize: FontSize.xs, color: C.body }}>{r.kyc_type.toUpperCase()} ····{r.kyc_id_suffix}</Text>}
                          {r.kyc_verified_name && <Text style={{ fontFamily: Fonts.sans, fontSize: FontSize.xs, color: C.body }}>Name: {r.kyc_verified_name}</Text>}
                          {r.kyc_verified_dob && <Text style={{ fontFamily: Fonts.sans, fontSize: FontSize.xs, color: C.body }}>DOB: {r.kyc_verified_dob}</Text>}
                        </>
                      )}
                      {r.kyc_status === 'failed' && r.kyc_error && (
                        <Text style={{ fontFamily: Fonts.sans, fontSize: FontSize.xs, color: '#DC2626' }}>{r.kyc_error}</Text>
                      )}
                    </View>
                  );
                })()}
              </>
            )}

            <Text style={[styles.rejectLabel, { color: C.body }]}>Rejection reason (required to reject):</Text>
            <TextInput
              style={[styles.rejectInput, { borderColor: C.borderWarm, color: C.textInk }]}
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder="e.g. Documents unclear, please resubmit"
              placeholderTextColor={C.stone}
              multiline
              numberOfLines={3}
            />

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: '#FEF2F2' }]}
                onPress={() => isOperatorReview ? reviewOperator('rejected') : reviewRider('rejected')}
                disabled={actioning}
              >
                {actioning ? <ActivityIndicator color="#DC2626" /> : <Text style={[styles.actionBtnText, { color: '#DC2626' }]}>Reject</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: '#F0FDF4' }]}
                onPress={() => isOperatorReview ? reviewOperator('approved') : reviewRider('approved')}
                disabled={actioning}
              >
                {actioning ? <ActivityIndicator color="#16A34A" /> : <Text style={[styles.actionBtnText, { color: '#16A34A' }]}>Approve</Text>}
              </TouchableOpacity>
            </View>
            {(reviewTarget as any).status === 'approved' && (
              <TouchableOpacity
                style={[styles.suspendBtn, { borderColor: C.borderWarm }]}
                onPress={() => isOperatorReview ? reviewOperator('suspended') : reviewRider('suspended')}
                disabled={actioning}
              >
                <Text style={[styles.suspendText, { color: C.bodySoft }]}>Suspend Account</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

function DocLink({ label, C }: { label: string; C: any }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Ionicons name="document-outline" size={14} color={C.spice} />
      <Text style={{ fontFamily: Fonts.sans, fontSize: FontSize.sm, color: C.spice }}>{label}</Text>
    </View>
  );
}

function EmptyState({ label, C }: { label: string; C: any }) {
  return (
    <View style={{ alignItems: 'center', marginTop: 60, gap: 12 }}>
      <Ionicons name="bicycle-outline" size={48} color={C.stone} />
      <Text style={{ fontFamily: Fonts.sans, fontSize: FontSize.md, color: C.bodySoft }}>{label}</Text>
    </View>
  );
}

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1 },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: Spacing.md, paddingVertical: 14, borderBottomWidth: 1,
    },
    headerTitle: { fontFamily: Fonts.sansMedium, fontSize: FontSize.lg },
    tabRow: { flexDirection: 'row', borderBottomWidth: 1 },
    tabBtn: { flex: 1, paddingVertical: 14, alignItems: 'center' },
    tabBtnActive: { borderBottomWidth: 2, borderBottomColor: C.spice },
    tabText: { fontFamily: Fonts.sansMedium, fontSize: FontSize.md },
    filterRow: { paddingHorizontal: Spacing.md, paddingVertical: 12, gap: 8 },
    filterChip: {
      paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radius.full,
      borderWidth: 1, borderColor: C.borderWarm,
    },
    filterChipText: { fontFamily: Fonts.sans, fontSize: FontSize.sm, color: C.body },
    list: { padding: Spacing.md, gap: 12, paddingBottom: 60 },
    card: {
      backgroundColor: C.bg, borderRadius: Radius.lg, padding: Spacing.md,
      borderWidth: 1, borderColor: C.borderWarm, gap: 4,
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    typeBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: Radius.full },
    typeBadgeText: { fontFamily: Fonts.sansMedium, fontSize: FontSize.xs },
    statusPill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: Radius.full },
    statusPillText: { fontFamily: Fonts.sansMedium, fontSize: FontSize.xs, textTransform: 'capitalize' },
    cardTitle: { fontFamily: Fonts.sansMedium, fontSize: FontSize.md },
    cardSub: { fontFamily: Fonts.sans, fontSize: FontSize.sm },
    cardMeta: { fontFamily: Fonts.sans, fontSize: FontSize.sm },
    cardTime: { fontFamily: Fonts.sans, fontSize: FontSize.xs, marginTop: 4 },
    overlay: { zIndex: 100, justifyContent: 'flex-end' },
    overlayBg: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
    reviewSheet: {
      borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
      padding: Spacing.lg, paddingBottom: 40, gap: 14,
      ...Shadow.lift,
    },
    reviewTitle: { fontFamily: Fonts.sansMedium, fontSize: FontSize.xl },
    reviewSub: { fontFamily: Fonts.sans, fontSize: FontSize.sm },
    docLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    rejectLabel: { fontFamily: Fonts.sansMedium, fontSize: FontSize.sm },
    rejectInput: {
      borderWidth: 1, borderRadius: Radius.md, padding: 12,
      fontFamily: Fonts.sans, fontSize: FontSize.sm, minHeight: 72, textAlignVertical: 'top',
    },
    actionRow: { flexDirection: 'row', gap: 12 },
    actionBtn: {
      flex: 1, height: 46, borderRadius: Radius.md,
      alignItems: 'center', justifyContent: 'center',
    },
    actionBtnText: { fontFamily: Fonts.sansMedium, fontSize: FontSize.md },
    suspendBtn: {
      borderWidth: 1, borderRadius: Radius.md, paddingVertical: 12,
      alignItems: 'center',
    },
    suspendText: { fontFamily: Fonts.sans, fontSize: FontSize.sm },
  });
}
