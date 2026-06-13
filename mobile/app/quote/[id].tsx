import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { quotationsApi, type Quotation } from '../../src/api/invoices';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { Fonts, Spacing, Radius, Shadow } from '../../src/constants/theme';
import { useFeedback } from '../../src/components/feedback';
import { Bone } from '../../src/components/ui/Skeleton';
import { fmtCurrency, relativeTime } from '../../src/utils/format';

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  draft:     { bg: '#F5F5F5', fg: '#9CA3AF' },
  sent:      { bg: '#EBF0FA', fg: '#2A5FBF' },
  accepted:  { bg: '#EBF5EC', fg: '#2E8B3F' },
  rejected:  { bg: '#FEF2F2', fg: '#DC2626' },
  expired:   { bg: '#F5F5F5', fg: '#9CA3AF' },
  converted: { bg: '#F0EBF5', fg: '#6A2E8B' },
};

export default function QuoteDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const feedback = useFeedback();

  const [quote, setQuote]   = useState<Quotation | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing]   = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { quote: q } = await quotationsApi.get(id);
      setQuote(q);
    } catch {
      feedback.error('Error', 'Could not load quote');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function handleSend() {
    if (!quote) return;
    setActing(true);
    try {
      const { quote: updated } = await quotationsApi.send(quote.id);
      setQuote(updated);
      feedback.success('Sent', 'Quote sent to customer.');
    } catch (e: any) {
      feedback.error('Error', e.message ?? 'Could not send quote');
    } finally {
      setActing(false);
    }
  }

  async function handleConvert() {
    if (!quote) return;
    feedback.confirm({
      title: 'Convert to invoice',
      message: 'This will create an invoice based on this quote.',
      confirmLabel: 'Convert',
      onConfirm: async () => {
        setActing(true);
        try {
          const { invoice } = await quotationsApi.convert(quote.id, {});
          feedback.success('Converted', 'Invoice created from quote.');
          router.replace({ pathname: '/invoice/[id]', params: { id: invoice.id } } as any);
        } catch (e: any) {
          feedback.error('Error', e.message ?? 'Could not convert quote');
          setActing(false);
        }
      },
    });
  }

  if (loading) {
    return (
      <View style={styles.root}>
        <SafeAreaView style={{ flex: 1, padding: Spacing.lg, gap: 14 }}>
          <Bone width="50%" height={22} radius={6} />
          <Bone width="100%" height={80} radius={14} />
          <Bone width="100%" height={120} radius={14} />
          <Bone width="100%" height={48} radius={12} />
        </SafeAreaView>
      </View>
    );
  }

  if (!quote) {
    return (
      <SafeAreaView style={styles.root}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: Spacing.lg }}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <View style={{ alignItems: 'center', marginTop: 60 }}>
          <Text style={{ fontFamily: Fonts.sans, color: C.bodySoft }}>Quote not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const sc = STATUS_COLORS[quote.status] ?? STATUS_COLORS.draft;

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <Text style={styles.title}>{quote.quote_number}</Text>
        <View style={[styles.statusPill, { backgroundColor: sc.bg }]}>
          <Text style={[styles.statusText, { color: sc.fg }]}>{quote.status}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          {quote.title ? <Row label="Title"    value={quote.title} C={C} /> : null}
          <Row label="Customer"  value={quote.customer_name ?? '—'} C={C} />
          <Row label="Created"   value={relativeTime(quote.created_at)} C={C} />
          {quote.valid_until && <Row label="Valid until" value={quote.valid_until} C={C} />}
          {quote.invoice_id && <Row label="Invoice" value="Converted ✓" C={C} />}
        </View>

        <Text style={styles.sectionLabel}>Items</Text>
        <View style={styles.card}>
          {(quote.line_items ?? []).map((item, i) => (
            <View key={i} style={[styles.lineRow, i > 0 && { borderTopWidth: 0.5, borderTopColor: C.borderWarm, marginTop: 8, paddingTop: 8 }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.lineDesc}>{item.description}</Text>
                <Text style={styles.lineSub}>{item.quantity} × {fmtCurrency(item.unit_price, quote.currency ?? 'NGN')}</Text>
              </View>
              <Text style={styles.lineAmount}>{fmtCurrency(item.amount, quote.currency ?? 'NGN')}</Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Row label="Subtotal" value={fmtCurrency(quote.subtotal, quote.currency ?? 'NGN')} C={C} />
          {quote.discount_amount > 0 && <Row label="Discount" value={`− ${fmtCurrency(quote.discount_amount, quote.currency ?? 'NGN')}`} C={C} />}
          <View style={[styles.row, { borderTopWidth: 0.5, borderTopColor: C.borderWarm, marginTop: 4, paddingTop: 8 }]}>
            <Text style={[styles.rowLabel, { fontFamily: Fonts.sansMedium, color: C.textInk }]}>Total</Text>
            <Text style={[styles.rowValue, { fontFamily: Fonts.serif, fontSize: 18, color: C.spice }]}>{fmtCurrency(quote.total, quote.currency ?? 'NGN')}</Text>
          </View>
        </View>

        {quote.notes ? (
          <>
            <Text style={styles.sectionLabel}>Notes</Text>
            <View style={styles.card}>
              <Text style={{ fontFamily: Fonts.sans, fontSize: 14, color: C.body, lineHeight: 20 }}>{quote.notes}</Text>
            </View>
          </>
        ) : null}

        <View style={styles.actions}>
          {quote.status === 'draft' && (
            <TouchableOpacity style={[styles.actionBtn, styles.primaryBtn, acting && { opacity: 0.6 }]} onPress={handleSend} disabled={acting}>
              {acting ? <ActivityIndicator size="small" color={C.canvas} /> : <Text style={styles.primaryBtnText}>Send to customer</Text>}
            </TouchableOpacity>
          )}
          {(quote.status === 'sent' || quote.status === 'accepted') && !quote.invoice_id && (
            <TouchableOpacity style={[styles.actionBtn, styles.secondaryBtn, acting && { opacity: 0.6 }]} onPress={handleConvert} disabled={acting}>
              {acting ? <ActivityIndicator size="small" color={C.spice} /> : <Text style={styles.secondaryBtnText}>Convert to invoice</Text>}
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value, C }: { label: string; value: string; C: AppColors }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 }}>
      <Text style={{ fontFamily: Fonts.sans, fontSize: 13, color: C.bodySoft }}>{label}</Text>
      <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 13, color: C.textInk, flexShrink: 1, textAlign: 'right', marginLeft: 8 }}>{value}</Text>
    </View>
  );
}

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    root:           { flex: 1, backgroundColor: C.bg },
    header:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingTop: 16, paddingBottom: 12, gap: 8 },
    backBtn:        { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    title:          { flex: 1, fontFamily: Fonts.serif, fontSize: 20, color: C.textInk },
    statusPill:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 40 },
    statusText:     { fontFamily: Fonts.sansMedium, fontSize: 12 },
    content:        { padding: Spacing.lg, gap: 8, paddingBottom: 50 },
    sectionLabel:   { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.textInk, marginTop: 8 },
    card:           { backgroundColor: C.bgCard, borderRadius: Radius.md, padding: 14, borderWidth: 0.5, borderColor: C.borderWarm, ...Shadow.card },
    row:            { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3 },
    rowLabel:       { fontFamily: Fonts.sans, fontSize: 13, color: C.bodySoft },
    rowValue:       { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.textInk },
    lineRow:        { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    lineDesc:       { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.textInk },
    lineSub:        { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft, marginTop: 2 },
    lineAmount:     { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.spice },
    actions:        { gap: 10, marginTop: 16 },
    actionBtn:      { borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center' },
    primaryBtn:     { backgroundColor: C.spice },
    primaryBtnText: { fontFamily: Fonts.sansMedium, fontSize: 15, color: C.canvas },
    secondaryBtn:   { borderWidth: 1.5, borderColor: C.spice },
    secondaryBtnText:{ fontFamily: Fonts.sansMedium, fontSize: 15, color: C.spice },
  });
}
