import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, Share, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { digitalProductsApi, type DigitalProduct } from '../../src/api/digitalProducts';
import { useAuth } from '../../src/context/AuthContext';
import { useFeedback } from '../../src/components/feedback';
import { Bone } from '../../src/components/ui/Skeleton';
import { Fonts, Spacing, Radius, Shadow, FontSize } from '../../src/constants/theme';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { fmtCurrency } from '../../src/utils/format';
import Avatar from '../../src/components/ui/Avatar';

const TYPE_ICONS: Record<string, string> = {
  recipe_book:      'book-outline',
  meal_plan:        'calendar-outline',
  cookbook:         'restaurant-outline',
  nutrition_guide:  'leaf-outline',
  shopping_list:    'cart-outline',
  kitchen_guide:    'flame-outline',
  other:            'document-outline',
};

const TYPE_LABELS: Record<string, string> = {
  recipe_book:      'Recipe Book',
  meal_plan:        'Meal Plan',
  cookbook:         'Cookbook',
  nutrition_guide:  'Nutrition Guide',
  shopping_list:    'Shopping List',
  kitchen_guide:    'Kitchen Guide',
  other:            'Digital Product',
};

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const feedback = useFeedback();

  const [product, setProduct] = useState<DigitalProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchased, setPurchased] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  const load = useCallback(async () => {
    try {
      const res = await digitalProductsApi.get(id!);
      setProduct(res.product);
      if (isAuthenticated) {
        digitalProductsApi.download(id!).then(r => {
          if (r?.download_url) setPurchased(true);
        }).catch(() => {});
      }
    } catch {
      feedback.error('Failed to load product');
    } finally {
      setLoading(false);
    }
  }, [id, isAuthenticated]);

  useEffect(() => { load(); }, [load]);

  const handlePurchase = async () => {
    if (!isAuthenticated) { router.push('/(auth)/phone' as any); return; }
    if (!product) return;

    if (product.price === 0) {
      // Free — direct claim then fetch download link
      setPurchasing(true);
      try {
        await digitalProductsApi.purchase(product.id, {});
        setPurchased(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        feedback.success('Got it!', 'Your download is ready.');
      } catch (e: any) {
        feedback.error('Error', e.error ?? 'Could not complete purchase');
      } finally {
        setPurchasing(false);
      }
      return;
    }

    // Paid — Flutterwave
    router.push({
      pathname: '/checkout',
      params: { mode: 'product', product_id: product.id, amount: product.price, title: product.title },
    } as any);
  };

  const handleDownload = async () => {
    setDownloading(true);
    setDownloadProgress(0);
    try {
      const { download_url } = await digitalProductsApi.download(id!);
      if (!download_url) throw new Error('No download available');

      const urlPath = download_url.split('?')[0];
      const rawName = urlPath.split('/').pop() ?? 'download';
      const ext = rawName.includes('.') ? '' : '.pdf';
      const localUri = FileSystem.cacheDirectory + rawName + ext;

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        const resumable = FileSystem.createDownloadResumable(
          download_url,
          localUri,
          {},
          ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
            if (totalBytesExpectedToWrite > 0) {
              setDownloadProgress(totalBytesWritten / totalBytesExpectedToWrite);
            }
          },
        );
        const result = await resumable.downloadAsync();
        if (!result?.uri) throw new Error('Download failed');
        setDownloadProgress(1);
        await Sharing.shareAsync(result.uri, { mimeType: 'application/pdf', dialogTitle: product?.title ?? 'Download' });
      } else {
        await Linking.openURL(download_url);
      }
    } catch {
      feedback.error('Error', 'Could not download file. Try again.');
    } finally {
      setDownloading(false);
      setDownloadProgress(0);
    }
  };

  const handleShare = async () => {
    if (!product) return;
    const BASE = 'https://foodsbyme-production.up.railway.app';
    const url = product.slug ? `${BASE}/product/${product.slug}` : `${BASE}/product/${product.id}`;
    await Share.share({ message: `Check out "${product.title}" on FOODSbyme: ${url}`, url });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, padding: Spacing.lg, gap: 14 }}>
          <Bone width="100%" height={220} radius={14} />
          <Bone width="65%" height={24} radius={6} />
          <Bone width="40%" height={18} radius={6} />
          <Bone width="100%" height={60} radius={10} />
          <Bone width="55%" height={44} radius={22} />
        </View>
      </SafeAreaView>
    );
  }

  if (!product) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.notFoundText}>Product not found</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const typeIcon = TYPE_ICONS[product.type] ?? 'document-outline';
  const typeLabel = TYPE_LABELS[product.type] ?? 'Digital Product';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleShare} style={styles.headerBtn}>
          <Ionicons name="share-outline" size={22} color={C.ink} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Cover */}
        {product.cover_image ? (
          <Image source={{ uri: product.cover_image }} style={styles.cover} resizeMode="cover" />
        ) : (
          <View style={[styles.cover, styles.coverPlaceholder]}>
            <Ionicons name={typeIcon as any} size={60} color={C.bodySoft} />
          </View>
        )}

        <View style={styles.body}>
          {/* Type badge */}
          <View style={styles.typeBadge}>
            <Ionicons name={typeIcon as any} size={14} color={C.spice} />
            <Text style={styles.typeLabel}>{typeLabel}</Text>
          </View>

          {/* Title + price */}
          <Text style={styles.title}>{product.title}</Text>
          <Text style={styles.price}>
            {product.price === 0 ? 'Free' : fmtCurrency(product.price, product.currency ?? 'NGN')}
          </Text>

          {/* Meta */}
          <View style={styles.metaRow}>
            {product.page_count && (
              <View style={styles.metaItem}>
                <Ionicons name="document-text-outline" size={14} color={C.bodySoft} />
                <Text style={styles.metaText}>{product.page_count} pages</Text>
              </View>
            )}
            {product.download_count > 0 && (
              <View style={styles.metaItem}>
                <Ionicons name="cloud-download-outline" size={14} color={C.bodySoft} />
                <Text style={styles.metaText}>{product.download_count} downloads</Text>
              </View>
            )}
          </View>

          {/* Creator */}
          {product.cook_name && (
            <TouchableOpacity
              style={styles.creatorCard}
              onPress={() => product.cook_id && router.push(`/cook/${product.cook_id}` as any)}
            >
              <Avatar name={product.cook_name} avatarUrl={product.cook_avatar} size={40} />
              <View style={{ flex: 1 }}>
                <Text style={styles.creatorLabel}>Creator</Text>
                <Text style={styles.creatorName}>{product.cook_name}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={C.bodySoft} />
            </TouchableOpacity>
          )}

          {/* Description */}
          {product.description && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About this product</Text>
              <Text style={styles.description}>{product.description}</Text>
            </View>
          )}

          {/* Preview */}
          {product.preview_url && (
            <TouchableOpacity
              style={styles.previewBtn}
              onPress={() => Linking.openURL(product.preview_url!)}
            >
              <Ionicons name="eye-outline" size={18} color={C.spice} />
              <Text style={styles.previewBtnText}>Preview sample pages</Text>
              <Ionicons name="open-outline" size={14} color={C.bodySoft} />
            </TouchableOpacity>
          )}

          {/* Tags */}
          {product.tags?.length > 0 && (
            <View style={styles.tagsRow}>
              {product.tags.map(t => (
                <View key={t} style={styles.tag}><Text style={styles.tagText}>{t}</Text></View>
              ))}
            </View>
          )}

          {/* What you get */}
          <View style={styles.whatYouGet}>
            <Text style={styles.sectionTitle}>What you get</Text>
            {[
              { icon: 'cloud-download-outline', text: 'Instant digital download' },
              { icon: 'phone-portrait-outline', text: 'Access on any device' },
              { icon: 'infinite-outline',       text: 'Lifetime access' },
            ].map((item, i) => (
              <View key={i} style={styles.perkRow}>
                <View style={styles.perkIcon}>
                  <Ionicons name={item.icon as any} size={16} color={C.spice} />
                </View>
                <Text style={styles.perkText}>{item.text}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Sticky CTA */}
      <View style={styles.stickyFooter}>
        {purchased ? (
          <View style={styles.purchasedRow}>
            <View style={styles.purchasedBadge}>
              <Ionicons name="checkmark-circle" size={18} color={C.successFg} />
              <Text style={styles.purchasedText}>Purchased</Text>
            </View>
            <TouchableOpacity
              style={[styles.downloadBtn, downloading && { opacity: 0.85 }]}
              onPress={handleDownload}
              disabled={downloading}
            >
              {downloading ? (
                <View style={{ flex: 1, gap: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <ActivityIndicator color={C.canvas} size="small" />
                    <Text style={styles.downloadBtnText}>
                      {downloadProgress > 0 ? `${Math.round(downloadProgress * 100)}%` : 'Preparing…'}
                    </Text>
                  </View>
                  {downloadProgress > 0 && (
                    <View style={{ height: 3, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2, overflow: 'hidden' }}>
                      <View style={{ height: '100%', width: `${Math.round(downloadProgress * 100)}%` as any, backgroundColor: C.canvas, borderRadius: 2 }} />
                    </View>
                  )}
                </View>
              ) : (
                <>
                  <Ionicons name="cloud-download-outline" size={18} color={C.canvas} />
                  <Text style={styles.downloadBtnText}>Download</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.buyBtn, purchasing && { opacity: 0.6 }]}
            onPress={handlePurchase}
            disabled={purchasing}
          >
            {purchasing ? <ActivityIndicator color={C.canvas} /> : (
              <>
                <Text style={styles.buyBtnText}>
                  {product.price === 0 ? 'Get for Free' : `Buy · ${fmtCurrency(product.price, product.currency ?? 'NGN')}`}
                </Text>
                <Ionicons name="arrow-forward" size={18} color={C.canvas} />
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
    notFoundText: { fontFamily: Fonts.sans, fontSize: FontSize.lg, color: C.body },
    backBtn: { backgroundColor: C.spice, borderRadius: Radius.full, paddingHorizontal: 20, paddingVertical: 10 },
    backBtnText: { fontFamily: Fonts.sansMedium, fontSize: FontSize.body, color: C.canvas },
    header: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
      position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
    },
    headerBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.bgCard, ...Shadow.card, alignItems: 'center', justifyContent: 'center' },
    cover: { width: '100%', height: 280 },
    coverPlaceholder: { backgroundColor: C.bgCook, alignItems: 'center', justifyContent: 'center' },
    body: { padding: Spacing.lg, gap: Spacing.md },
    typeBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.honey, borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 5, alignSelf: 'flex-start' },
    typeLabel: { fontFamily: Fonts.sansMedium, fontSize: FontSize.sm, color: C.spice },
    title: { fontFamily: Fonts.serif, fontSize: 26, color: C.ink, lineHeight: 33 },
    price: { fontFamily: Fonts.serif, fontSize: 28, color: C.spice },
    metaRow: { flexDirection: 'row', gap: 16 },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    metaText: { fontFamily: Fonts.sans, fontSize: FontSize.sm, color: C.bodySoft },
    creatorCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.bgCard, borderRadius: Radius.lg, borderWidth: 0.5, borderColor: C.borderWarm, padding: Spacing.md, ...Shadow.card },
    creatorLabel: { fontFamily: Fonts.sans, fontSize: FontSize.xs, color: C.bodySoft, textTransform: 'uppercase', letterSpacing: 0.8 },
    creatorName: { fontFamily: Fonts.sansMedium, fontSize: FontSize.body, color: C.ink },
    section: { gap: 10 },
    sectionTitle: { fontFamily: Fonts.sansMedium, fontSize: FontSize.lg, color: C.ink },
    description: { fontFamily: Fonts.sans, fontSize: FontSize.body, color: C.body, lineHeight: 24 },
    previewBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.bgCard, borderRadius: Radius.md, borderWidth: 1, borderColor: C.spice, paddingHorizontal: 14, paddingVertical: 12 },
    previewBtnText: { fontFamily: Fonts.sansMedium, fontSize: FontSize.body, color: C.spice, flex: 1 },
    tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    tag: { backgroundColor: C.bgCook, borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 0.5, borderColor: C.borderWarm },
    tagText: { fontFamily: Fonts.sans, fontSize: FontSize.sm, color: C.body },
    whatYouGet: { backgroundColor: C.bgCard, borderRadius: Radius.lg, padding: Spacing.md, gap: 10, borderWidth: 0.5, borderColor: C.borderWarm },
    perkRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    perkIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.honey, alignItems: 'center', justifyContent: 'center' },
    perkText: { fontFamily: Fonts.sans, fontSize: FontSize.body, color: C.body },
    stickyFooter: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.bg, borderTopWidth: 0.5, borderTopColor: C.borderWarm, padding: Spacing.lg, paddingBottom: 34 },
    buyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: C.ink, borderRadius: Radius.lg, paddingVertical: 16 },
    buyBtnText: { fontFamily: Fonts.sansMedium, fontSize: FontSize.lg, color: C.canvas },
    purchasedRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    purchasedBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.successBg, borderRadius: Radius.full, paddingHorizontal: 14, paddingVertical: 10 },
    purchasedText: { fontFamily: Fonts.sansMedium, fontSize: FontSize.sm, color: C.successFg },
    downloadBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.spice, borderRadius: Radius.lg, paddingVertical: 14 },
    downloadBtnText: { fontFamily: Fonts.sansMedium, fontSize: FontSize.body, color: C.canvas },
  });
}
