import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { digitalProductsApi } from '../../src/api/digitalProducts';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { Fonts, Spacing, Radius, Shadow } from '../../src/constants/theme';
import { useFeedback } from '../../src/components/feedback';
import { fmtCurrency, relativeTime } from '../../src/utils/format';
import DishPhoto from '../../src/components/ui/DishPhoto';
import { useTranslation } from 'react-i18next';

const TYPE_ICONS: Record<string, string> = {
  recipe_book: 'book-outline', meal_plan: 'calendar-outline',
  cookbook: 'restaurant-outline', nutrition_guide: 'leaf-outline',
  shopping_list: 'cart-outline', kitchen_guide: 'flame-outline', other: 'document-outline',
};

export default function LibraryScreen() {
  const router = useRouter();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const feedback = useFeedback();
  const { t } = useTranslation();

  const TYPE_LABELS: Record<string, string> = {
    recipe_book: t('product.type_recipe_book'), meal_plan: t('product.type_meal_plan'), cookbook: t('product.type_cookbook'),
    nutrition_guide: t('product.type_nutrition_guide'), shopping_list: t('product.type_shopping_list'),
    kitchen_guide: t('product.type_kitchen_guide'), other: t('library.digital_product'),
  };

  const [purchases, setPurchases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { purchases: data } = await digitalProductsApi.myPurchases();
      setPurchases(data ?? []);
    } catch {
      feedback.error(t('library.load_error'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleDownload(productId: string, productTitle: string) {
    setDownloading(productId);
    setDownloadProgress(0);
    try {
      const { download_url } = await digitalProductsApi.download(productId);
      if (!download_url) throw new Error('No download available');

      const ext = download_url.includes('.epub') ? 'epub' : download_url.includes('.zip') ? 'zip' : 'pdf';
      const safeName = productTitle.replace(/[^a-z0-9]/gi, '_').slice(0, 40);
      const localUri = `${FileSystem.cacheDirectory}${safeName}.${ext}`;

      const resumable = FileSystem.createDownloadResumable(
        download_url,
        localUri,
        {},
        (p) => {
          if (p.totalBytesExpectedToWrite > 0) {
            setDownloadProgress(Math.round((p.totalBytesWritten / p.totalBytesExpectedToWrite) * 100));
          }
        }
      );
      const result = await resumable.downloadAsync();
      if (!result?.uri) throw new Error('Download failed');

      await Sharing.shareAsync(result.uri, {
        mimeType: ext === 'epub' ? 'application/epub+zip' : ext === 'zip' ? 'application/zip' : 'application/pdf',
        dialogTitle: `Open ${productTitle}`,
        UTI: ext === 'pdf' ? 'com.adobe.pdf' : 'public.data',
      });
    } catch (e: any) {
      feedback.error(t('library.download_failed'), e.message ?? t('library.download_error_body'));
    } finally {
      setDownloading(null);
      setDownloadProgress(0);
    }
  }

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={C.textInk} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('library.title')}</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={C.spice} />
        </View>
      ) : (
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} />}
          contentContainerStyle={{ padding: Spacing.lg, gap: 14, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {purchases.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="library-outline" size={48} color={C.stone} />
              <Text style={styles.emptyTitle}>{t('library.empty_title')}</Text>
              <Text style={styles.emptySub}>
                {t('library.empty_sub')}
              </Text>
              <TouchableOpacity
                style={styles.discoverBtn}
                onPress={() => router.push('/(customer)/discover' as any)}
              >
                <Text style={styles.discoverBtnText}>{t('library.explore_creators')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={styles.count}>{t('library.item_count', { count: purchases.length })}</Text>
              {purchases.map(p => (
                <View key={p.id} style={styles.card}>
                  <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                    {p.cover_image ? (
                      <DishPhoto
                        uri={p.cover_image}
                        label={p.title}
                        height={72} width={72} radius={10}
                        recyclingKey={`lib-${p.product_id}`}
                      />
                    ) : (
                      <View style={[styles.thumbPlaceholder, { backgroundColor: C.cream }]}>
                        <Ionicons name={TYPE_ICONS[p.type] as any ?? 'document-outline'} size={28} color={C.spice} />
                      </View>
                    )}

                    <View style={{ flex: 1, gap: 3 }}>
                      <View style={styles.typePill}>
                        <Text style={styles.typeText}>{TYPE_LABELS[p.type] ?? t('library.product')}</Text>
                      </View>
                      <Text style={styles.productTitle} numberOfLines={2}>{p.title}</Text>
                      <Text style={styles.cookName}>{t('library.by_cook', { name: p.cook_name })}</Text>
                      <Text style={styles.purchasedDate}>
                        {t('library.bought_ago', { time: relativeTime(p.purchased_at) })}
                        {p.amount_paid > 0 ? ` · ${fmtCurrency(p.amount_paid, 'NGN')}` : ` · ${t('library.free')}`}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      style={styles.viewBtn}
                      onPress={() => router.push({ pathname: '/product/[id]', params: { id: p.product_id } } as any)}
                    >
                      <Ionicons name="eye-outline" size={14} color={C.body} />
                      <Text style={styles.viewBtnText}>{t('library.view')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.downloadBtn, downloading === p.product_id && { opacity: 0.6 }]}
                      onPress={() => handleDownload(p.product_id, p.title ?? 'product')}
                      disabled={downloading === p.product_id}
                    >
                      {downloading === p.product_id
                        ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <ActivityIndicator size="small" color="#FFF" />
                            {downloadProgress > 0 && (
                              <Text style={styles.downloadBtnText}>{downloadProgress}%</Text>
                            )}
                          </View>
                        ) : (
                          <>
                            <Ionicons name="cloud-download-outline" size={14} color="#FFF" />
                            <Text style={styles.downloadBtnText}>{t('library.download')}</Text>
                          </>
                        )}
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function makeStyles(C: AppColors) { return StyleSheet.create({
  root:         { flex: 1, backgroundColor: C.bg },
  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingTop: 16, paddingBottom: 12, gap: 12, borderBottomWidth: 0.5, borderBottomColor: C.borderWarm },
  headerTitle:  { flex: 1, fontFamily: Fonts.serif, fontSize: 22, color: C.textInk, textAlign: 'center' },

  count:        { fontFamily: Fonts.sans, fontSize: 13, color: C.bodySoft },

  card:         { backgroundColor: C.bgCard, borderRadius: Radius.lg, padding: 14, borderWidth: 0.5, borderColor: C.borderWarm, ...Shadow.card, gap: 12 },
  thumbPlaceholder: { width: 72, height: 72, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  typePill:     { alignSelf: 'flex-start', backgroundColor: C.honey, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  typeText:     { fontFamily: Fonts.sansMedium, fontSize: 10, color: C.spice },
  productTitle: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.textInk, lineHeight: 19 },
  cookName:     { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft },
  purchasedDate:{ fontFamily: Fonts.sans, fontSize: 11, color: C.stone },

  cardActions:  { flexDirection: 'row', gap: 10 },
  viewBtn:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: C.borderWarm },
  viewBtnText:  { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.body },
  downloadBtn:  { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 12, backgroundColor: C.spice, minHeight: 40 },
  downloadBtnText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: '#FFF' },

  empty:        { alignItems: 'center', paddingTop: 60, gap: 14, paddingHorizontal: 24 },
  emptyTitle:   { fontFamily: Fonts.sansMedium, fontSize: 18, color: C.textInk },
  emptySub:     { fontFamily: Fonts.sans, fontSize: 14, color: C.bodySoft, textAlign: 'center', lineHeight: 21 },
  discoverBtn:  { marginTop: 4, backgroundColor: C.spice, paddingHorizontal: 28, paddingVertical: 13, borderRadius: 40 },
  discoverBtnText: { fontFamily: Fonts.sansMedium, fontSize: 15, color: '#FFF' },
}); }
