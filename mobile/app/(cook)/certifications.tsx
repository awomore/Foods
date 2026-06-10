import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { certificationsApi, type VerificationSubmission, type CertType } from '../../src/api/cooks';
import { uploadImage, pickImage, takePhoto } from '../../src/utils/imageUpload';
import { Fonts, Spacing, Radius, Shadow } from '../../src/constants/theme';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { useFeedback } from '../../src/components/feedback';
import { Bone } from '../../src/components/ui/Skeleton';

const CERT_OPTIONS: { type: CertType; label: string; desc: string; icon: string }[] = [
  { type: 'food_safety_certificate', label: 'Food Safety Certificate', desc: 'NAFDAC, HACCP, or local food safety cert', icon: 'shield-checkmark-outline' },
  { type: 'health_certificate',      label: 'Health Certificate',      desc: 'Certificate from a licensed health authority', icon: 'medkit-outline' },
  { type: 'cac_registration',        label: 'CAC Registration',        desc: 'Corporate Affairs Commission business registration', icon: 'business-outline' },
  { type: 'culinary_certification',  label: 'Culinary Certification',  desc: 'Professional culinary school or chef certificate', icon: 'ribbon-outline' },
  { type: 'nafdac_approval',         label: 'NAFDAC Approval',         desc: 'NAFDAC product registration or facility approval', icon: 'document-text-outline' },
  { type: 'government_permit',       label: 'Government Permit',       desc: 'Any government-issued kitchen or food handling permit', icon: 'id-card-outline' },
];

const STATUS_COLOR: Record<string, string> = {
  pending:  '#D97706',
  approved: '#16A34A',
  rejected: '#DC2626',
};

const STATUS_BG: Record<string, string> = {
  pending:  '#FEF3C7',
  approved: '#F0FDF4',
  rejected: '#FEF2F2',
};

export default function CertificationsScreen() {
  const router = useRouter();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const feedback = useFeedback();

  const [submissions, setSubmissions] = useState<VerificationSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState<CertType | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { submissions: s } = await certificationsApi.mine();
      setSubmissions(s);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleUpload(type: CertType) {
    feedback.actionSheet({
      title: 'Upload document',
      actions: [
        {
          label: 'Take photo',
          icon: 'camera-outline',
          onPress: async () => {
            const picked = await takePhoto();
            if (!picked) return;
            await submitDoc(type, picked);
          },
        },
        {
          label: 'Choose from library',
          icon: 'image-outline',
          onPress: async () => {
            const picked = await pickImage();
            if (!picked) return;
            await submitDoc(type, picked);
          },
        },
      ],
    });
  }

  async function submitDoc(type: CertType, picked: any) {
    setUploading(type);
    try {
      const url = await uploadImage(picked, 'certifications');
      const opt = CERT_OPTIONS.find(o => o.type === type)!;
      await certificationsApi.submit({ type, title: opt.label, document_url: url });
      feedback.success('Submitted', 'Your document is under review. We will notify you within 3-5 business days.');
      await load(true);
    } catch (e: any) {
      feedback.error('Upload failed', e?.error ?? 'Could not upload document. Try again.');
    }
    setUploading(null);
  }

  async function handleDelete(id: string) {
    feedback.confirm({
      title: 'Remove submission',
      message: 'Remove this certification submission?',
      confirmLabel: 'Remove',
      danger: true,
      onConfirm: async () => {
        try {
          await certificationsApi.delete(id);
          setSubmissions(prev => prev.filter(s => s.id !== id));
        } catch (e: any) {
          feedback.error('Error', e?.error ?? 'Could not remove');
        }
      },
    });
  }

  const submittedTypes = new Set(submissions.map(s => s.type));

  if (loading) {
    return (
      <View style={styles.root}>
        <SafeAreaView style={{ flex: 1, padding: Spacing.lg, gap: 14 }}>
          <Bone width="60%" height={22} radius={6} />
          <Bone width="100%" height={80} radius={14} />
          <Bone width="100%" height={80} radius={14} />
          <Bone width="100%" height={80} radius={14} />
          <Bone width="100%" height={80} radius={14} />
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <SafeAreaView>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={C.textInk} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Certifications</Text>
        </View>
      </SafeAreaView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: Spacing.lg, gap: 16, paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={C.spice} />}
      >
        {/* Intro */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={20} color={C.infoFg} />
          <Text style={styles.infoText}>
            Upload your food safety and business documents. Our team reviews each submission within 3-5 business days.
            Approved certifications appear as badges on your storefront.
          </Text>
        </View>

        {/* Existing submissions */}
        {submissions.length > 0 && (
          <View>
            <Text style={styles.sectionLabel}>Your submissions</Text>
            {submissions.map(sub => {
              const opt = CERT_OPTIONS.find(o => o.type === sub.type);
              return (
                <View key={sub.id} style={styles.subCard}>
                  <View style={styles.subCardHeader}>
                    <View style={styles.subIcon}>
                      <Ionicons name={(opt?.icon ?? 'document-outline') as any} size={18} color={C.spice} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.subTitle}>{sub.title ?? opt?.label}</Text>
                      <Text style={styles.subDate}>
                        Submitted {new Date(sub.submitted_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </Text>
                    </View>
                    <View style={[styles.statusPill, { backgroundColor: STATUS_BG[sub.status] }]}>
                      <Text style={[styles.statusText, { color: STATUS_COLOR[sub.status] }]}>
                        {sub.status.charAt(0).toUpperCase() + sub.status.slice(1)}
                      </Text>
                    </View>
                  </View>
                  {sub.review_notes && sub.status === 'rejected' && (
                    <View style={styles.noteBox}>
                      <Text style={styles.noteText}>{sub.review_notes}</Text>
                    </View>
                  )}
                  {sub.status !== 'approved' && (
                    <TouchableOpacity style={styles.removeBtn} onPress={() => handleDelete(sub.id)}>
                      <Text style={styles.removeBtnText}>Remove</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Available cert types to upload */}
        <Text style={styles.sectionLabel}>Upload a document</Text>
        {CERT_OPTIONS.map(opt => {
          const already = submittedTypes.has(opt.type);
          const isUploading = uploading === opt.type;
          return (
            <TouchableOpacity
              key={opt.type}
              style={[styles.certOption, already && styles.certOptionDone]}
              onPress={() => !already && handleUpload(opt.type)}
              activeOpacity={already ? 1 : 0.75}
              disabled={isUploading || already}
            >
              <View style={[styles.certIcon, already && { backgroundColor: C.successBg }]}>
                {isUploading
                  ? <ActivityIndicator size="small" color={C.spice} />
                  : <Ionicons name={opt.icon as any} size={20} color={already ? C.successFg : C.spice} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.certLabel, already && { color: C.successFg }]}>{opt.label}</Text>
                <Text style={styles.certDesc}>{opt.desc}</Text>
              </View>
              {already
                ? <Ionicons name="checkmark-circle" size={20} color={C.successFg} />
                : <Ionicons name="add-circle-outline" size={20} color={C.spice} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

function makeStyles(C: AppColors) { return StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingTop: 8, paddingBottom: 12, gap: 12 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.bgCook, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: Fonts.serif, fontSize: 20, color: C.textInk, flex: 1 },
  sectionLabel: { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.bodySoft, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 },
  infoCard: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: C.infoBg, borderRadius: Radius.lg, padding: 14,
  },
  infoText: { fontFamily: Fonts.sans, fontSize: 13, color: C.infoFg, flex: 1, lineHeight: 20 },
  subCard: { backgroundColor: C.bgCard, borderRadius: Radius.lg, padding: 14, borderWidth: 0.5, borderColor: C.borderWarm, ...Shadow.card, marginBottom: 10, gap: 10 },
  subCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  subIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.bgCook, alignItems: 'center', justifyContent: 'center' },
  subTitle: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.textInk },
  subDate: { fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft, marginTop: 2 },
  statusPill: { borderRadius: 40, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontFamily: Fonts.sansMedium, fontSize: 11 },
  noteBox: { backgroundColor: C.errorBg, borderRadius: Radius.md, padding: 10 },
  noteText: { fontFamily: Fonts.sans, fontSize: 12, color: C.errorFg, lineHeight: 18 },
  removeBtn: { alignSelf: 'flex-start' },
  removeBtnText: { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.errorFg },
  certOption: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: C.bgCard, borderRadius: Radius.lg, padding: 14,
    borderWidth: 0.5, borderColor: C.borderWarm, ...Shadow.card, marginBottom: 10,
  },
  certOptionDone: { borderColor: C.successFg, borderWidth: 1, opacity: 0.7 },
  certIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.bgCook, alignItems: 'center', justifyContent: 'center' },
  certLabel: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.textInk },
  certDesc: { fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft, marginTop: 3, lineHeight: 16 },
}); }
