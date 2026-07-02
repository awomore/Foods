import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { Fonts, Spacing, Radius } from '../../src/constants/theme';
import { useFeedback } from '../../src/components/feedback';
import { digitalProductsApi } from '../../src/api/digitalProducts';
import { useTranslation } from 'react-i18next';

const PRODUCT_TYPE_KEYS = [
  { key: 'recipe_book',     icon: 'book-outline' },
  { key: 'meal_plan',       icon: 'leaf-outline' },
  { key: 'cookbook',        icon: 'restaurant-outline' },
  { key: 'nutrition_guide', icon: 'fitness-outline' },
  { key: 'shopping_list',   icon: 'list-outline' },
  { key: 'kitchen_guide',   icon: 'flame-outline' },
  { key: 'other',           icon: 'document-outline' },
] as const;

type ProductType = typeof PRODUCT_TYPE_KEYS[number]['key'];

export default function ProductCreateScreen() {
  const router = useRouter();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const feedback = useFeedback();
  const { t } = useTranslation();

  const PRODUCT_TYPES = PRODUCT_TYPE_KEYS.map(pt => ({
    ...pt,
    label: t(`product.type_${pt.key}`),
  }));

  const [type, setType]             = useState<ProductType>('recipe_book');
  const [title, setTitle]           = useState('');
  const [description, setDesc]      = useState('');
  const [price, setPrice]           = useState('');
  const [fileUrl, setFileUrl]       = useState('');
  const [fileName, setFileName]     = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [saving, setSaving]         = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);

  async function handlePickFile() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'application/epub+zip', 'application/zip',
             'application/vnd.ms-powerpoint',
             'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setUploadingFile(true);
    try {
      const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
      const mimeType = asset.mimeType ?? 'application/pdf';
      const dataUri = `data:${mimeType};base64,${base64}`;
      const { url } = await digitalProductsApi.uploadFile(dataUri);
      setFileUrl(url);
      setFileName(asset.name);
      feedback.success(t('product.create.file_uploaded'), asset.name);
    } catch (e: any) {
      feedback.error(t('product.create.upload_failed'), e.error ?? t('product.create.upload_failed_message'));
    } finally {
      setUploadingFile(false);
    }
  }

  async function handleSave(publish = false) {
    if (!title.trim()) return feedback.warn(t('product.create.title_required'));
    if (!fileUrl) return feedback.warn(t('product.create.file_required_title'), t('product.create.file_required_message'));
    const priceNum = parseFloat(price) || 0;

    setSaving(true);
    try {
      const { product } = await digitalProductsApi.create({
        type,
        title: title.trim(),
        description: description.trim() || undefined,
        price: priceNum,
        file_url: fileUrl,
        preview_url: previewUrl.trim() || undefined,
      });
      if (publish) {
        await digitalProductsApi.update(product.id, { is_published: true } as any);
      }
      feedback.success(publish ? t('product.create.published') : t('product.create.draft_saved'));
      router.replace({ pathname: '/product/[id]', params: { id: product.id } } as any);
    } catch (e: any) {
      feedback.error(t('common.error'), e.error ?? t('product.create.save_error'));
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

        <Text style={styles.label}>Product file</Text>
        <TouchableOpacity
          style={[styles.filePickBtn, uploadingFile && { opacity: 0.6 }]}
          onPress={handlePickFile}
          disabled={uploadingFile}
          activeOpacity={0.8}
        >
          {uploadingFile ? (
            <ActivityIndicator size="small" color={C.spice} />
          ) : (
            <Ionicons name={fileUrl ? 'checkmark-circle' : 'cloud-upload-outline'} size={22} color={fileUrl ? C.successFg : C.spice} />
          )}
          <View style={{ flex: 1 }}>
            <Text style={[styles.filePickBtnText, fileUrl && { color: C.successFg }]} numberOfLines={1}>
              {uploadingFile ? 'Uploading…' : fileName || (fileUrl ? 'File ready' : 'Upload PDF, EPUB, or ZIP')}
            </Text>
            {!fileUrl && !uploadingFile && (
              <Text style={styles.hint}>Buyers receive a secure link after payment</Text>
            )}
            {fileUrl && !uploadingFile && (
              <Text style={styles.hint}>Tap to replace · Never shown publicly</Text>
            )}
          </View>
          {!uploadingFile && (
            <Ionicons name="chevron-forward" size={16} color={C.bodySoft} />
          )}
        </TouchableOpacity>

        <Text style={styles.label}>Preview URL <Text style={styles.optLabel}>(optional)</Text></Text>
        <TextInput
          style={styles.input}
          value={previewUrl}
          onChangeText={setPreviewUrl}
          placeholder="Link to a sample chapter or preview page"
          placeholderTextColor={C.bodySoft}
          autoCapitalize="none"
          keyboardType="url"
        />
        <Text style={styles.hint}>Share a free excerpt so buyers can sample before purchasing.</Text>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.draftBtn, (saving || uploadingFile) && { opacity: 0.6 }]}
            onPress={() => handleSave(false)}
            disabled={saving || uploadingFile}
          >
            <Text style={styles.draftBtnText}>Save draft</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.publishBtn, (saving || uploadingFile) && { opacity: 0.6 }]}
            onPress={() => handleSave(true)}
            disabled={saving || uploadingFile}
          >
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
    optLabel:        { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft },
    hint:            { fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft, marginTop: 4 },
    input:           { backgroundColor: C.bgCard, borderRadius: Radius.md, borderWidth: 1, borderColor: C.borderWarm, paddingHorizontal: 14, paddingVertical: 12, fontFamily: Fonts.sans, fontSize: 15, color: C.textInk },
    typeRow:         { paddingBottom: 4, gap: 8 },
    typePill:        { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 40, borderWidth: 1, borderColor: C.borderWarm, backgroundColor: C.bgCard },
    typePillActive:  { backgroundColor: C.spice, borderColor: C.spice },
    typePillText:    { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.bodySoft },
    typePillTextActive: { color: C.canvas },
    filePickBtn:     { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.bgCard, borderRadius: Radius.md, borderWidth: 1.5, borderColor: C.spice + '60', paddingHorizontal: 14, paddingVertical: 16 },
    filePickBtnText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.spice },
    actionRow:       { flexDirection: 'row', gap: 10, marginTop: 28 },
    draftBtn:        { flex: 1, borderWidth: 1.5, borderColor: C.spice, borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center' },
    draftBtnText:    { fontFamily: Fonts.sansMedium, fontSize: 15, color: C.spice },
    publishBtn:      { flex: 1, backgroundColor: C.spice, borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center' },
    publishBtnText:  { fontFamily: Fonts.sansMedium, fontSize: 15, color: C.canvas },
  });
}
