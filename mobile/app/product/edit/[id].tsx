import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Switch, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { digitalProductsApi, type DigitalProduct } from '../../../src/api/digitalProducts';
import { useColors, type AppColors } from '../../../src/context/ThemeContext';
import { Fonts, Spacing, Radius, Shadow } from '../../../src/constants/theme';
import { useFeedback } from '../../../src/components/feedback';
import { fmtCurrency, relativeTime } from '../../../src/utils/format';
import Avatar from '../../../src/components/ui/Avatar';

export default function ProductEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const feedback = useFeedback();

  const [product, setProduct] = useState<DigitalProduct | null>(null);
  const [buyers, setBuyers] = useState<any[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [copiesSold, setCopiesSold] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Editable fields
  const [title, setTitle] = useState('');
  const [description, setDesc] = useState('');
  const [price, setPrice] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [isPublished, setIsPublished] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [prodRes, salesRes] = await Promise.allSettled([
        digitalProductsApi.get(id!),
        digitalProductsApi.sales(id!),
      ]);
      if (prodRes.status === 'fulfilled') {
        const p = prodRes.value.product;
        setProduct(p);
        setTitle(p.title);
        setDesc(p.description ?? '');
        setPrice(p.price > 0 ? String(p.price) : '');
        setFileUrl((p as any).file_url ?? '');
        setPreviewUrl(p.preview_url ?? '');
        setIsPublished(p.is_published);
      }
      if (salesRes.status === 'fulfilled') {
        setBuyers(salesRes.value.buyers ?? []);
        setTotalRevenue(salesRes.value.total_revenue ?? 0);
        setCopiesSold(salesRes.value.copies_sold ?? 0);
      }
    } catch (e) {
      feedback.error('Failed to load product');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    if (!title.trim()) { feedback.warn('Title required'); return; }
    setSaving(true);
    try {
      const { product: updated } = await digitalProductsApi.update(id!, {
        title: title.trim(),
        description: description.trim() || undefined,
        price: parseFloat(price) || 0,
        file_url: fileUrl.trim() || undefined,
        preview_url: previewUrl.trim() || undefined,
        is_published: isPublished,
      } as any);
      setProduct(updated);
      feedback.success('Saved', 'Your product has been updated.');
    } catch (e: any) {
      feedback.error('Failed to save', e.error ?? 'Try again');
    } finally {
      setSaving(false);
    }
  }

  async function handleTogglePublish(val: boolean) {
    setIsPublished(val);
    try {
      await digitalProductsApi.update(id!, { is_published: val } as any);
      feedback.success(val ? 'Product published' : 'Product unpublished');
    } catch {
      setIsPublished(!val);
      feedback.error('Could not update');
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={22} color={C.textInk} /></TouchableOpacity>
          <Text style={styles.headerTitle}>Product</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={C.spice} />
        </View>
      </SafeAreaView>
    );
  }

  if (!product) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={22} color={C.textInk} /></TouchableOpacity>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 15, color: C.bodySoft }}>Product not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={C.textInk} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{product.title}</Text>
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
        >
          {saving
            ? <ActivityIndicator size="small" color="#FFF" />
            : <Text style={styles.saveBtnText}>Save</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} />}
        contentContainerStyle={{ padding: Spacing.lg, gap: 20, paddingBottom: 50 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Sales stats */}
        <View style={styles.statsRow}>
          {[
            { label: 'Revenue', value: fmtCurrency(totalRevenue, 'NGN') },
            { label: 'Copies sold', value: String(copiesSold) },
            { label: 'Downloads', value: String(product.download_count) },
          ].map(s => (
            <View key={s.label} style={styles.statCard}>
              <Text style={styles.statValue} numberOfLines={1}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Published toggle */}
        <View style={styles.publishRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.publishLabel}>Published</Text>
            <Text style={styles.publishSub}>
              {isPublished ? 'Visible to customers' : 'Only you can see this'}
            </Text>
          </View>
          <Switch
            value={isPublished}
            onValueChange={handleTogglePublish}
            trackColor={{ true: C.spice, false: C.borderWarm }}
            thumbColor="#FFF"
          />
        </View>

        {/* Edit fields */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Product details</Text>

          <Text style={styles.fieldLabel}>Title</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholderTextColor={C.bodySoft}
            maxLength={100}
          />

          <Text style={styles.fieldLabel}>Description</Text>
          <TextInput
            style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
            value={description}
            onChangeText={setDesc}
            placeholder="What's included? Who is it for?"
            placeholderTextColor={C.bodySoft}
            multiline
            maxLength={500}
          />

          <Text style={styles.fieldLabel}>Price (NGN) — 0 for free</Text>
          <TextInput
            style={styles.input}
            value={price}
            onChangeText={setPrice}
            placeholder="0"
            placeholderTextColor={C.bodySoft}
            keyboardType="numeric"
          />

          <Text style={styles.fieldLabel}>File / download URL</Text>
          <TextInput
            style={styles.input}
            value={fileUrl}
            onChangeText={setFileUrl}
            placeholder="https://drive.google.com/file/d/…"
            placeholderTextColor={C.bodySoft}
            autoCapitalize="none"
            keyboardType="url"
          />
          <Text style={styles.fieldHint}>Only revealed to buyers after successful payment.</Text>

          <Text style={styles.fieldLabel}>Preview URL <Text style={{ color: C.bodySoft, fontFamily: Fonts.sans }}>(optional)</Text></Text>
          <TextInput
            style={styles.input}
            value={previewUrl}
            onChangeText={setPreviewUrl}
            placeholder="Free sample chapter or preview"
            placeholderTextColor={C.bodySoft}
            autoCapitalize="none"
            keyboardType="url"
          />
        </View>

        {/* Buyer list */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {copiesSold === 0 ? 'No buyers yet' : `${copiesSold} buyer${copiesSold !== 1 ? 's' : ''}`}
          </Text>

          {copiesSold === 0 ? (
            <View style={styles.emptyBuyers}>
              <Ionicons name="people-outline" size={32} color={C.stone} />
              <Text style={styles.emptyText}>Share your product to make your first sale.</Text>
            </View>
          ) : (
            buyers.map((b, i) => (
              <View key={b.id ?? i} style={styles.buyerRow}>
                <Avatar name={b.buyer_name ?? '?'} avatarUrl={b.buyer_avatar} size={36} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.buyerName}>{b.buyer_name ?? 'Anonymous'}</Text>
                  <Text style={styles.buyerDate}>{relativeTime(b.purchased_at)}</Text>
                </View>
                <Text style={styles.buyerAmount}>
                  {b.amount_paid > 0 ? fmtCurrency(b.amount_paid, 'NGN') : 'Free'}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(C: AppColors) { return StyleSheet.create({
  root:         { flex: 1, backgroundColor: C.bg },
  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingTop: 16, paddingBottom: 12, gap: 12, borderBottomWidth: 0.5, borderBottomColor: C.borderWarm },
  headerTitle:  { flex: 1, fontFamily: Fonts.serif, fontSize: 18, color: C.textInk },
  saveBtn:      { backgroundColor: C.spice, paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20, minWidth: 60, alignItems: 'center' },
  saveBtnText:  { fontFamily: Fonts.sansMedium, fontSize: 14, color: '#FFF' },

  statsRow:   { flexDirection: 'row', gap: 10 },
  statCard:   { flex: 1, backgroundColor: C.bgCard, borderRadius: Radius.md, padding: 14, borderWidth: 0.5, borderColor: C.borderWarm, ...Shadow.card, alignItems: 'center' },
  statValue:  { fontFamily: Fonts.serif, fontSize: 18, color: C.spice },
  statLabel:  { fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft, marginTop: 3, textAlign: 'center' },

  publishRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bgCard, borderRadius: Radius.md, padding: 16, borderWidth: 0.5, borderColor: C.borderWarm, ...Shadow.card },
  publishLabel: { fontFamily: Fonts.sansMedium, fontSize: 15, color: C.textInk },
  publishSub:   { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft, marginTop: 2 },

  section:      { gap: 8 },
  sectionTitle: { fontFamily: Fonts.sansMedium, fontSize: 15, color: C.textInk, marginBottom: 4 },
  fieldLabel:   { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.bodySoft, marginTop: 10 },
  fieldHint:    { fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft, marginTop: 3 },
  input:        { backgroundColor: C.bgCard, borderRadius: Radius.md, borderWidth: 1, borderColor: C.borderWarm, paddingHorizontal: 14, paddingVertical: 12, fontFamily: Fonts.sans, fontSize: 14, color: C.textInk },

  buyerRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: C.borderWarm },
  buyerName:    { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.textInk },
  buyerDate:    { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft, marginTop: 1 },
  buyerAmount:  { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.spice },

  emptyBuyers:  { alignItems: 'center', paddingVertical: 24, gap: 10 },
  emptyText:    { fontFamily: Fonts.sans, fontSize: 13, color: C.bodySoft, textAlign: 'center' },
}); }
