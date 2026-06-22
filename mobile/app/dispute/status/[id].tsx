import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Image, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { disputesApi, type Dispute, type DisputeEvidence, type DisputeMessage } from '../../../src/api/disputes';
import { uploadApi } from '../../../src/api/upload';
import { useColors, type AppColors } from '../../../src/context/ThemeContext';
import { Fonts, Spacing, Radius, Shadow, FontSize } from '../../../src/constants/theme';
import { useFeedback } from '../../../src/components/feedback';
import { Bone } from '../../../src/components/ui/Skeleton';
import { fmtCurrency, relativeTime } from '../../../src/utils/format';

const STATUS_STEPS = [
  { key: 'open',             label: 'Dispute Filed',       icon: 'document-text-outline' },
  { key: 'evidence_review',  label: 'Evidence Review',     icon: 'images-outline' },
  { key: 'admin_review',     label: 'Admin Review',        icon: 'person-outline' },
  { key: 'resolved',         label: 'Resolved',            icon: 'checkmark-circle-outline' },
];

const RESOLUTION_LABEL: Record<string, string> = {
  full_refund:    'Full refund approved',
  partial_refund: 'Partial refund approved',
  no_refund:      "No refund — case closed in cook's favour",
  replacement:    'Replacement order approved',
};

export default function DisputeStatusScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const feedback = useFeedback();

  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [evidence, setEvidence] = useState<DisputeEvidence[]>([]);
  const [messages, setMessages] = useState<DisputeMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [msgText, setMsgText] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const [uploadingEvidence, setUploadingEvidence] = useState(false);

  const load = useCallback(async () => {
    try {
      const { dispute: d, evidence: ev, messages: ms } = await disputesApi.get(id!);
      setDispute(d);
      setEvidence(ev);
      setMessages(ms);
    } catch {
      feedback.error('Failed to load dispute');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const sendMessage = async () => {
    if (!msgText.trim()) return;
    setSendingMsg(true);
    try {
      const { message } = await disputesApi.sendMessage(id!, msgText.trim());
      setMessages(prev => [...prev, message]);
      setMsgText('');
    } catch {
      feedback.error('Failed to send message');
    } finally { setSendingMsg(false); }
  };

  const uploadEvidence = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      feedback.error('Permission required', 'Allow FOODS to access your photos to upload evidence.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    setUploadingEvidence(true);
    try {
      const asset = result.assets[0];
      const formData = new FormData();
      formData.append('file', { uri: asset.uri, type: asset.mimeType ?? 'image/jpeg', name: `evidence-${Date.now()}.jpg` } as any);
      const { url } = await uploadApi.upload(formData);
      const { evidence: ev } = await disputesApi.addEvidence(id!, {
        file_url: url,
        file_type: 'image',
        description: 'Photo evidence',
      });
      setEvidence(prev => [...prev, ev]);
      feedback.success('Evidence uploaded');
    } catch {
      feedback.error('Failed to upload evidence');
    } finally { setUploadingEvidence(false); }
  };

  const currentStep = STATUS_STEPS.findIndex(s =>
    s.key === (dispute?.status === 'escalated' ? 'admin_review' : dispute?.status)
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, padding: Spacing.lg, gap: 14 }}>
          <Bone width="55%" height={22} radius={6} />
          <Bone width="100%" height={80} radius={14} />
          <Bone width="100%" height={120} radius={14} />
          <Bone width="100%" height={60} radius={14} />
        </View>
      </SafeAreaView>
    );
  }

  if (!dispute) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorState}>
          <Text style={styles.errorText}>Dispute not found</Text>
          <TouchableOpacity onPress={() => router.back()}><Text style={styles.link}>Go back</Text></TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <Text style={styles.title}>Dispute #{id!.slice(0,8)}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Status stepper */}
        <View style={styles.stepper}>
          {STATUS_STEPS.map((step, i) => {
            const done = i < currentStep;
            const active = i === currentStep;
            return (
              <View key={step.key} style={styles.stepRow}>
                <View style={[styles.stepDot, done && styles.stepDotDone, active && styles.stepDotActive]}>
                  {done ? (
                    <Ionicons name="checkmark" size={14} color={C.canvas} />
                  ) : (
                    <Ionicons name={step.icon as any} size={14} color={active ? C.canvas : C.stone} />
                  )}
                </View>
                <View style={styles.stepInfo}>
                  <Text style={[styles.stepLabel, active && styles.stepLabelActive]}>{step.label}</Text>
                </View>
                {i < STATUS_STEPS.length - 1 && (
                  <View style={[styles.stepLine, done && styles.stepLineDone]} />
                )}
              </View>
            );
          })}
        </View>

        {/* Dispute details */}
        <View style={styles.detailCard}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Type</Text>
            <Text style={styles.detailValue}>{dispute.type.replace('_', ' ')}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Filed</Text>
            <Text style={styles.detailValue}>{relativeTime(dispute.created_at)}</Text>
          </View>
          {dispute.order_total != null && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Order Value</Text>
              <Text style={styles.detailValue}>{fmtCurrency(dispute.order_total, 'NGN')}</Text>
            </View>
          )}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>SLA Deadline</Text>
            <Text style={styles.detailValue}>{new Date(dispute.sla_deadline).toLocaleDateString('en-NG', { dateStyle: 'medium' })}</Text>
          </View>
          <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.detailLabel}>Reason</Text>
          </View>
          <Text style={styles.reasonText}>{dispute.reason}</Text>
        </View>

        {/* Resolution (if resolved) */}
        {dispute.status === 'resolved' && dispute.resolution && (
          <View style={styles.resolutionCard}>
            <View style={styles.resolutionHeader}>
              <Ionicons name="checkmark-circle" size={20} color={C.successFg} />
              <Text style={styles.resolutionTitle}>Dispute Resolved</Text>
            </View>
            {dispute.resolution_type && (
              <View style={styles.resolutionBadge}>
                <Text style={styles.resolutionBadgeText}>{RESOLUTION_LABEL[dispute.resolution_type]}</Text>
              </View>
            )}
            {dispute.refund_amount && (
              <Text style={styles.refundAmount}>
                Refund: {fmtCurrency(dispute.refund_amount, 'NGN')}
              </Text>
            )}
            <Text style={styles.resolutionText}>{dispute.resolution}</Text>
          </View>
        )}

        {/* Evidence section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Evidence ({evidence.length})</Text>
            {dispute.status !== 'resolved' && (
              <TouchableOpacity
                style={styles.addBtn}
                onPress={uploadEvidence}
                disabled={uploadingEvidence}
              >
                {uploadingEvidence ? (
                  <ActivityIndicator size="small" color={C.spice} />
                ) : (
                  <>
                    <Ionicons name="cloud-upload-outline" size={16} color={C.spice} />
                    <Text style={styles.addBtnText}>Add Photo</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
          {evidence.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: Spacing.sm }}>
              {evidence.map(ev => (
                <View key={ev.id} style={styles.evidenceThumb}>
                  {ev.file_type === 'image' ? (
                    <Image source={{ uri: ev.file_url }} style={styles.evidenceImage} />
                  ) : (
                    <View style={styles.evidenceDoc}>
                      <Ionicons name="document-outline" size={28} color={C.spice} />
                    </View>
                  )}
                  <Text style={styles.evidenceRole}>{ev.role}</Text>
                </View>
              ))}
            </ScrollView>
          ) : (
            <Text style={styles.noEvidenceText}>No evidence uploaded yet. Upload photos or documents to support your case.</Text>
          )}
        </View>

        {/* Message thread */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Messages</Text>
          {messages.length === 0 ? (
            <Text style={styles.noEvidenceText}>No messages yet.</Text>
          ) : (
            messages.map(msg => (
              <View key={msg.id} style={[styles.msgBubble, msg.role === 'admin' && styles.msgBubbleAdmin]}>
                <View style={styles.msgHeader}>
                  <Text style={styles.msgSender}>{msg.sender_name ?? msg.role}</Text>
                  <Text style={styles.msgTime}>{relativeTime(msg.created_at)}</Text>
                </View>
                <Text style={styles.msgText}>{msg.message}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Message input */}
      {dispute.status !== 'resolved' && dispute.status !== 'closed' && (
        <View style={styles.msgComposer}>
          <TextInput
            style={styles.msgInput}
            value={msgText}
            onChangeText={setMsgText}
            placeholder="Send a message..."
            placeholderTextColor={C.stone}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!msgText.trim() || sendingMsg) && styles.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={!msgText.trim() || sendingMsg}
          >
            {sendingMsg ? (
              <ActivityIndicator size="small" color={C.canvas} />
            ) : (
              <Ionicons name="send" size={18} color={C.canvas} />
            )}
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
      borderBottomWidth: 1, borderBottomColor: C.borderWarm,
    },
    backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    title: { fontFamily: Fonts.sansMedium, fontSize: FontSize.lg, color: C.ink },
    loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    errorState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
    errorText: { fontFamily: Fonts.sans, fontSize: FontSize.body, color: C.body },
    link: { fontFamily: Fonts.sansMedium, fontSize: FontSize.body, color: C.spice },
    content: { padding: Spacing.lg, gap: Spacing.lg },
    stepper: { backgroundColor: C.bgCard, borderRadius: Radius.lg, padding: Spacing.md, gap: 2, ...Shadow.card },
    stepRow: { flexDirection: 'row', alignItems: 'center', position: 'relative' },
    stepDot: {
      width: 30, height: 30, borderRadius: 15,
      backgroundColor: C.bgCook, alignItems: 'center', justifyContent: 'center',
      borderWidth: 1.5, borderColor: C.borderWarm,
    },
    stepDotDone: { backgroundColor: C.leaf, borderColor: C.leaf },
    stepDotActive: { backgroundColor: C.spice, borderColor: C.spice },
    stepInfo: { flex: 1, paddingHorizontal: Spacing.sm },
    stepLabel: { fontFamily: Fonts.sans, fontSize: FontSize.sm, color: C.bodySoft },
    stepLabelActive: { fontFamily: Fonts.sansMedium, color: C.ink },
    stepLine: {
      position: 'absolute', left: 14, top: 30, width: 2, height: 20,
      backgroundColor: C.borderWarm,
    },
    stepLineDone: { backgroundColor: C.leaf },
    detailCard: { backgroundColor: C.bgCard, borderRadius: Radius.lg, ...Shadow.card },
    detailRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingHorizontal: Spacing.md, paddingVertical: 12,
      borderBottomWidth: 1, borderBottomColor: C.borderWarm,
    },
    detailLabel: { fontFamily: Fonts.sans, fontSize: FontSize.sm, color: C.bodySoft },
    detailValue: { fontFamily: Fonts.sansMedium, fontSize: FontSize.sm, color: C.ink },
    reasonText: { fontFamily: Fonts.sans, fontSize: FontSize.body, color: C.body, padding: Spacing.md, lineHeight: 24 },
    resolutionCard: {
      backgroundColor: C.successBg, borderRadius: Radius.lg, padding: Spacing.md, gap: 8,
    },
    resolutionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    resolutionTitle: { fontFamily: Fonts.sansMedium, fontSize: FontSize.lg, color: C.successFg },
    resolutionBadge: {
      backgroundColor: C.leaf, borderRadius: Radius.full,
      paddingHorizontal: 12, paddingVertical: 5, alignSelf: 'flex-start',
    },
    resolutionBadgeText: { fontFamily: Fonts.sansMedium, fontSize: FontSize.sm, color: C.canvas },
    refundAmount: { fontFamily: Fonts.sansMedium, fontSize: FontSize.xl, color: C.successFg },
    resolutionText: { fontFamily: Fonts.sans, fontSize: FontSize.body, color: C.body, lineHeight: 22 },
    section: { gap: 8 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    sectionTitle: { fontFamily: Fonts.sansMedium, fontSize: FontSize.lg, color: C.ink },
    addBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    addBtnText: { fontFamily: Fonts.sansMedium, fontSize: FontSize.sm, color: C.spice },
    evidenceThumb: { marginRight: Spacing.sm, alignItems: 'center', gap: 4 },
    evidenceImage: { width: 80, height: 80, borderRadius: Radius.md },
    evidenceDoc: {
      width: 80, height: 80, borderRadius: Radius.md,
      backgroundColor: C.honey, alignItems: 'center', justifyContent: 'center',
    },
    evidenceRole: { fontFamily: Fonts.sans, fontSize: FontSize.xs, color: C.bodySoft },
    noEvidenceText: { fontFamily: Fonts.sans, fontSize: FontSize.sm, color: C.bodySoft, lineHeight: 20 },
    msgBubble: {
      backgroundColor: C.bgCard, borderRadius: Radius.lg, padding: Spacing.md, ...Shadow.card,
    },
    msgBubbleAdmin: { backgroundColor: C.infoBg },
    msgHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    msgSender: { fontFamily: Fonts.sansMedium, fontSize: FontSize.sm, color: C.ink },
    msgTime: { fontFamily: Fonts.sans, fontSize: FontSize.xs, color: C.bodySoft },
    msgText: { fontFamily: Fonts.sans, fontSize: FontSize.body, color: C.body, lineHeight: 22 },
    msgComposer: {
      flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-end',
      padding: Spacing.md, borderTopWidth: 1, borderTopColor: C.borderWarm,
      backgroundColor: C.bg,
    },
    msgInput: {
      flex: 1, backgroundColor: C.bgCard, borderRadius: Radius.md,
      borderWidth: 1, borderColor: C.borderWarm,
      paddingHorizontal: Spacing.md, paddingVertical: 10,
      fontFamily: Fonts.sans, fontSize: FontSize.body, color: C.ink,
      maxHeight: 100,
    },
    sendBtn: {
      width: 44, height: 44, borderRadius: 22,
      backgroundColor: C.spice, alignItems: 'center', justifyContent: 'center',
    },
    sendBtnDisabled: { opacity: 0.4 },
  });
}
