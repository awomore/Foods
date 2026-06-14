import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { Fonts, Spacing, Radius } from '../../src/constants/theme';
import { useFeedback } from '../../src/components/feedback';
import { digitalProductsApi } from '../../src/api/digitalProducts';

const PRODUCT_TYPES = [
  { key: 'recipe_book',   label: 'Recipe Book',    icon: 'book-outline' },
  { key: 'meal_plan',     label: 'Meal Plan PDF',  icon: 'leaf-outline' },
  { key: 'cooking_guide', label: 'Cooking Guide',  icon: 'restaurant-outline' },
  { key: 'video_series',  label: 'Video Series',   icon: 'videocam-outline' },
  { key: 'other',         label: 'Other',           icon: 'document-outline' },
] as const;

type ProductType = typeof PRODUCT_TYPES[number]['key'];

export default function ProductCreateScreen() {
  const router = useRouter();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const feedback = useFeedback();

  const [type, setType]           = useState<ProductType>('recipe_book');
  const [title, setTitle]         = useState('');
  const [description, setDesc]    = useState('');
  const [price, setPrice]         = useState('');
  const [fileUrl, setFileUrl]     = useState('');
  const [saving, setSaving]       = useState(false);

  async function handleSave(publish = false) {
    if (!title.trim()) return feedback.warn('Title required');
    if (!fileUrl.trim()) return feedback.warn('File URL required', 'Paste a link to your downloadable file.');
    const priceNum = parseFloat(price) || 0;

    setSaving(true);
    try {
      const { product } = await digitalProductsApi.create({
        type,
        title: title.trim(),
        description: description.trim() || undefined,
        price: priceNum,
        file_url: fileUrl.trim(),
        is_published: publish,
      });
      feedback.success(publish ? 'Product published!' : 'Draft saved');
      router.replace({ pathname: '/product/[id]', params: { id: product.id } } as any);
    } catch (e: any) {
      feedback.error('Error', e.error ?? 'Could not save product');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <Text style={styles.title}>New Digital Product</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        <Text style={styles.label}>Product type</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeRow}>
          {PRODUCT_TYPES.map(t => (
            <TouchableOpacity
              key={t.key}
              style={[styles.typePill, type === t.key && styles.typePillActive]}
              onPress={() => setType(t.key)}
            >
              <Ionicons name={t.icon as any} size={14} color={type === t.key ? C.canvas : C.bodySoft} />
              <Text style={[styles.typePillText, type === t.key && styles.typePillTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. 30 Nigerian Breakfast Recipes"
          placeholderTextColor={C.bodySoft}
          maxLength={100}
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, { minHeight: 90, textAlignVertical: 'top' }]}
          value={description}
          onChangeText={setDesc}
          placeholder="What's included? Who is it for?"
          placeholderTextColor={C.bodySoft}
          multiline
          maxLength={500}
        />

        <Text style={styles.label}>Price (NGN) — leave 0 for free</Text>
        <TextInput
          style={styles.input}
          value={price}
          onChangeText={setPrice}
          placeholder="0"
          placeholderTextColor={C.bodySoft}
          keyboardType="numeric"
        />

        <Text style={styles.label}>File / download URL</Text>
        <TextInput
          style={styles.input}
          value={fileUrl}
          onChangeText={setFileUrl}
          placeholder="https://drive.google.com/..."
          placeholderTextColor={C.bodySoft}
          autoCapitalize="none"
          keyboardType="url"
        />
        <Text style={styles.hint}>Paste a Google Drive, Dropbox, or direct link to the downloadable file.</Text>

        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.draftBtn, saving && { opacity: 0.6 }]} onPress={() => handleSave(false)} disabled={saving}>
            <Text style={styles.draftBtnText}>Save draft</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.publishBtn, saving && { opacity: 0.6 }]} onPress={() => handleSave(true)} disabled={saving}>
            {saving
              ? <ActivityIndicator size="small" color={C.canvas} />
              : <Text style={styles.publishBtnText}>Publish</Text>
            }
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    root:            { flex: 1, backgroundColor: C.bg },
    header:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingTop: 16, paddingBottom: 12, gap: 8, borderBottomWidth: 0.5, borderBottomColor: C.borderWarm },
    backBtn:         { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    title:           { flex: 1, fontFamily: Fonts.serif, fontSize: 20, color: C.textInk, textAlign: 'center' },
    content:         { padding: Spacing.lg, gap: 4, paddingBottom: 50 },
    label:           { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.textInk, marginTop: 16, marginBottom: 6 },
    hint:            { fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft, marginTop: 4 },
    input:           { backgroundColor: C.bgCard, borderRadius: Radius.md, borderWidth: 1, borderColor: C.borderWarm, paddingHorizontal: 14, paddingVertical: 12, fontFamily: Fonts.sans, fontSize: 15, color: C.textInk },
    typeRow:         { paddingBottom: 4, gap: 8 },
    typePill:        { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 40, borderWidth: 1, borderColor: C.borderWarm, backgroundColor: C.bgCard },
    typePillActive:  { backgroundColor: C.spice, borderColor: C.spice },
    typePillText:    { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.bodySoft },
    typePillTextActive: { color: C.canvas },
    actionRow:       { flexDirection: 'row', gap: 10, marginTop: 28 },
    draftBtn:        { flex: 1, borderWidth: 1.5, borderColor: C.spice, borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center' },
    draftBtnText:    { fontFamily: Fonts.sansMedium, fontSize: 15, color: C.spice },
    publishBtn:      { flex: 1, backgroundColor: C.spice, borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center' },
    publishBtnText:  { fontFamily: Fonts.sansMedium, fontSize: 15, color: C.canvas },
  });
}
