import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Image, RefreshControl,
  useWindowDimensions, Modal, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Fonts, Spacing, Radius } from '../../src/constants/theme';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { useAuth } from '../../src/context/AuthContext';
import { useCookCurrency } from '../../src/context/CurrencyContext';
import { useFeedback } from '../../src/components/feedback';
import { Bone } from '../../src/components/ui/Skeleton';
import { galleryApi, type MyGallery, type MyGalleryPhoto } from '../../src/api/gallery';
import { cooksApi } from '../../src/api/cooks';
import { pickImages, uploadImage, type PickResult } from '../../src/utils/imageUpload';
import { fmtCurrency } from '../../src/utils/format';
import PhotoDetailsSheet, { type DishOption, type PhotoDetails } from '../../src/components/gallery/PhotoDetailsSheet';

const COLS = 3;
const GAP = 4;

export default function CreatorGalleryScreen() {
  const router = useRouter();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const { t } = useTranslation();
  const cookCurrency = useCookCurrency();
  const { user } = useAuth();
  const feedback = useFeedback();
  const { width } = useWindowDimensions();
  const tile = Math.floor((width - Spacing.lg * 2 - GAP * (COLS - 1)) / COLS);

  const [data, setData] = useState<MyGallery | null>(null);
  const [dishes, setDishes] = useState<DishOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Add flow
  const [picked, setPicked] = useState<PickResult[]>([]);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  // Edit flow
  const [editing, setEditing] = useState<MyGalleryPhoto | null>(null);
  // Rename album
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const g = await galleryApi.mine();
      setData(g);
    } catch {
      feedback.error(t('gallery.load_failed'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
    if (user?.cook_id) {
      cooksApi.getMenu(user.cook_id)
        .then((r) => setDishes((r.items ?? []).map((d: any) => ({
          id: d.id, title: d.title, unit_price: Number(d.unit_price), currency_code: d.currency_code, photo: d.photos?.[0],
        }))))
        .catch(() => {});
    }
  }, [user?.cook_id]);

  useEffect(() => { load(); }, [load]);

  const currency = data?.currency_code ?? cookCurrency;
  const maxPerUpload = data?.limits.max_per_upload ?? 30;

  async function startAdd() {
    const room = (data?.limits.max_photos ?? 300) - (data?.photos.length ?? 0);
    if (room <= 0) { feedback.warn(t('gallery.full_title'), t('gallery.full_body')); return; }
    const imgs = await pickImages(Math.min(maxPerUpload, room));
    if (imgs.length) setPicked(imgs);
  }

  async function saveNew(d: PhotoDetails) {
    setSaving(true);
    const urls: { url: string; public_id?: string }[] = [];
    let failed = 0;
    for (let i = 0; i < picked.length; i++) {
      setProgress(t('gallery.uploading', { current: i + 1, total: picked.length }));
      try {
        const up = await uploadImage(picked[i], 'foodsbyme/gallery');
        urls.push({ url: up.url, public_id: up.public_id });
      } catch { failed++; }
    }
    setProgress(null);
    if (!urls.length) {
      setSaving(false);
      feedback.error(t('gallery.upload_failed'));
      return;
    }
    try {
      await galleryApi.addPhotos({
        urls,
        album_id: d.album && 'id' in d.album ? d.album.id : undefined,
        album_name: d.album && 'name' in d.album ? d.album.name : undefined,
        menu_item_id: d.menuItemId,
        guide_price: d.guidePrice,
      });
      setPicked([]);
      if (failed) feedback.warn(t('gallery.some_failed_title', { count: failed }), t('gallery.some_failed_body'));
      else feedback.success(t('gallery.added', { count: urls.length }));
      load();
    } catch (e: any) {
      feedback.error(t('gallery.save_failed'), e?.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(d: PhotoDetails) {
    if (!editing) return;
    setSaving(true);
    try {
      await galleryApi.updatePhoto(editing.id, {
        // An existing album, a new one by name, or loose.
        ...(d.album && 'name' in d.album
          ? { album_name: d.album.name }
          : { album_id: d.album && 'id' in d.album ? d.album.id : null }),
        menu_item_id: d.priceMode === 'dish' ? d.menuItemId : null,
        guide_price: d.priceMode === 'guide' ? d.guidePrice : null,
      });
      setEditing(null);
      load();
    } catch (e: any) {
      feedback.error(t('gallery.save_failed'), e?.message);
    } finally {
      setSaving(false);
    }
  }

  function photoActions(p: MyGalleryPhoto) {
    feedback.actionSheet({
      actions: [
        { label: t('gallery.edit_details'), icon: 'pricetag-outline', onPress: () => setEditing(p) },
        {
          label: t('gallery.show_first'), icon: 'arrow-up-outline',
          onPress: async () => {
            const ids = [p.id, ...(data?.photos ?? []).filter((x) => x.id !== p.id).map((x) => x.id)];
            try { await galleryApi.reorder(ids); load(); } catch { feedback.error(t('gallery.save_failed')); }
          },
        },
        {
          label: t('gallery.delete_photo'), icon: 'trash-outline', destructive: true,
          onPress: () => feedback.confirm({
            title: t('gallery.delete_photo_title'),
            danger: true,
            confirmLabel: t('common.delete'),
            onConfirm: async () => {
              try { await galleryApi.deletePhoto(p.id); load(); } catch { feedback.error(t('gallery.save_failed')); }
            },
          }),
        },
      ],
    });
  }

  function albumActions(a: { id: string; name: string }) {
    feedback.actionSheet({
      title: a.name,
      actions: [
        { label: t('gallery.rename_album'), icon: 'create-outline', onPress: () => setRenaming({ ...a }) },
        {
          label: t('gallery.delete_album'), icon: 'trash-outline', destructive: true,
          onPress: () => feedback.confirm({
            title: t('gallery.delete_album_title'),
            message: t('gallery.delete_album_body'),
            danger: true,
            confirmLabel: t('common.delete'),
            onConfirm: async () => {
              try { await galleryApi.deleteAlbum(a.id); load(); } catch { feedback.error(t('gallery.save_failed')); }
            },
          }),
        },
      ],
    });
  }

  function priceLabel(p: MyGalleryPhoto): string | null {
    if (p.menu_item_id && p.dish_price != null && p.dish_active) return fmtCurrency(p.dish_price, p.dish_currency ?? currency);
    if (p.guide_price != null) return t('gallery.from_price', { price: fmtCurrency(p.guide_price, currency) });
    return null;
  }

  if (loading) {
    return (
      <View style={styles.root}>
        <SafeAreaView style={{ flex: 1, padding: Spacing.lg, gap: 12 }}>
          <Bone width="40%" height={22} radius={6} />
          <Bone width="100%" height={52} radius={26} />
          <Bone width="100%" height={240} radius={14} />
        </SafeAreaView>
      </View>
    );
  }

  const photos = data?.photos ?? [];
  const albums = data?.albums ?? [];
  const dishPhotos = data?.dish_photos ?? [];
  const albumName = (id: string | null) => albums.find((a) => a.id === id)?.name;

  return (
    <View style={styles.root}>
      <SafeAreaView>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={C.textInk} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('gallery.title')}</Text>
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={{ padding: Spacing.lg, gap: Spacing.lg, paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.spice} />}
      >
        <Text style={styles.intro}>{t('gallery.intro')}</Text>

        <TouchableOpacity style={styles.addBtn} onPress={startAdd} activeOpacity={0.85}>
          <Ionicons name="images-outline" size={20} color={C.white} />
          <Text style={styles.addText}>{t('gallery.add_photos')}</Text>
        </TouchableOpacity>

        {albums.length > 0 && (
          <View style={{ gap: 8 }}>
            <Text style={styles.sectionTitle}>{t('gallery.albums')}</Text>
            <View style={styles.albumChips}>
              {albums.map((a) => (
                <TouchableOpacity key={a.id} style={styles.albumChip} onPress={() => albumActions(a)}>
                  <Ionicons name="albums-outline" size={14} color={C.body} />
                  <Text style={styles.albumChipText} numberOfLines={1}>{a.name}</Text>
                  <Text style={styles.albumCount}>{a.photo_count}</Text>
                  {a.is_hidden && <Ionicons name="eye-off-outline" size={14} color={C.errorFg} />}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {photos.length > 0 ? (
          <View style={{ gap: 8 }}>
            <Text style={styles.sectionTitle}>{t('gallery.your_photos', { count: photos.length })}</Text>
            <View style={styles.grid}>
              {photos.map((p) => {
                const price = priceLabel(p);
                const album = albumName(p.album_id);
                return (
                  <TouchableOpacity key={p.id} onPress={() => photoActions(p)} activeOpacity={0.8}>
                    <Image source={{ uri: p.url }} style={{ width: tile, height: tile, borderRadius: 6, backgroundColor: C.bgCook }} />
                    {(p.is_hidden || (p.album_id && albums.find((a) => a.id === p.album_id)?.is_hidden)) && (
                      <View style={styles.hiddenOverlay}>
                        <Ionicons name="eye-off-outline" size={16} color={C.white} />
                        <Text style={styles.hiddenText}>{t('gallery.hidden_by_review')}</Text>
                      </View>
                    )}
                    {(price || album) && (
                      <View style={styles.tileBadge}>
                        <Text style={styles.tileBadgeText} numberOfLines={1}>{price ?? album}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ) : (
          <View style={styles.empty}>
            <Ionicons name="images-outline" size={40} color={C.stone} />
            <Text style={styles.emptyTitle}>{t('gallery.empty_title')}</Text>
            <Text style={styles.emptyBody}>{t('gallery.empty_body')}</Text>
          </View>
        )}

        {dishPhotos.length > 0 && (
          <View style={{ gap: 8 }}>
            <Text style={styles.sectionTitle}>{t('gallery.from_menu')}</Text>
            <Text style={styles.intro}>{t('gallery.from_menu_hint')}</Text>
            <View style={styles.grid}>
              {dishPhotos.map((d) => (
                <View key={d.menu_item_id}>
                  <Image source={{ uri: d.url }} style={{ width: tile, height: tile, borderRadius: 6, backgroundColor: C.bgCook }} />
                  <View style={styles.tileBadge}>
                    <Text style={styles.tileBadgeText} numberOfLines={1}>{fmtCurrency(d.price, d.currency_code)}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      <PhotoDetailsSheet
        visible={picked.length > 0}
        mode="add"
        previews={picked.map((p) => p.uri)}
        albums={albums}
        dishes={dishes}
        currency={currency}
        saving={saving}
        progress={progress}
        onCancel={() => { if (!saving) setPicked([]); }}
        onSave={saveNew}
      />

      <PhotoDetailsSheet
        visible={!!editing}
        mode="edit"
        previews={editing ? [editing.url] : []}
        albums={albums}
        dishes={dishes}
        currency={currency}
        saving={saving}
        initial={editing ? {
          album: editing.album_id ? { id: editing.album_id } : null,
          priceMode: editing.menu_item_id ? 'dish' : editing.guide_price != null ? 'guide' : 'none',
          menuItemId: editing.menu_item_id,
          guidePrice: editing.guide_price,
        } : undefined}
        onCancel={() => { if (!saving) setEditing(null); }}
        onSave={saveEdit}
      />

      <Modal visible={!!renaming} transparent animationType="fade" onRequestClose={() => setRenaming(null)}>
        <View style={styles.dialogBackdrop}>
          <View style={styles.dialog}>
            <Text style={styles.sectionTitle}>{t('gallery.rename_album')}</Text>
            <TextInput
              style={styles.input}
              value={renaming?.name ?? ''}
              onChangeText={(name) => setRenaming((r) => (r ? { ...r, name } : r))}
              maxLength={80}
              autoFocus
            />
            <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'flex-end' }}>
              <TouchableOpacity onPress={() => setRenaming(null)} style={styles.dialogBtn}>
                <Text style={styles.dialogBtnText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={!renaming?.name.trim()}
                style={[styles.dialogBtn, styles.dialogBtnPrimary, !renaming?.name.trim() && { opacity: 0.5 }]}
                onPress={async () => {
                  if (!renaming) return;
                  try { await galleryApi.renameAlbum(renaming.id, renaming.name.trim()); setRenaming(null); load(); }
                  catch { feedback.error(t('gallery.save_failed')); }
                }}
              >
                <Text style={[styles.dialogBtnText, { color: C.white }]}>{t('common.save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingTop: 8, paddingBottom: 12, gap: 12 },
    backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.bgCook, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontFamily: Fonts.serif, fontSize: 20, color: C.textInk, flex: 1 },
    intro: { fontFamily: Fonts.sans, fontSize: 13, color: C.bodySoft, lineHeight: 19 },
    addBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      backgroundColor: C.spice, borderRadius: 40, paddingVertical: 14,
    },
    addText: { fontFamily: Fonts.sansMedium, fontSize: 15, color: C.white },
    sectionTitle: { fontFamily: Fonts.sansMedium, fontSize: 15, color: C.textInk },
    albumChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    albumChip: {
      flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '100%',
      paddingHorizontal: 12, paddingVertical: 8, borderRadius: 40, borderWidth: 1, borderColor: C.borderWarm, backgroundColor: C.bgCard,
    },
    albumChipText: { fontFamily: Fonts.sans, fontSize: 13, color: C.textInk, flexShrink: 1 },
    albumCount: { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
    tileBadge: {
      position: 'absolute', left: 4, bottom: 4, right: 4, alignSelf: 'flex-start',
      backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2,
    },
    tileBadgeText: { fontFamily: Fonts.sansMedium, fontSize: 10, color: '#FFFFFF' },
    hiddenOverlay: {
      ...StyleSheet.absoluteFillObject, borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center', justifyContent: 'center', gap: 2, padding: 4,
    },
    hiddenText: { fontFamily: Fonts.sans, fontSize: 10, color: '#FFFFFF', textAlign: 'center' },
    empty: { alignItems: 'center', paddingVertical: 40, gap: 8 },
    emptyTitle: { fontFamily: Fonts.serif, fontSize: 18, color: C.textInk },
    emptyBody: { fontFamily: Fonts.sans, fontSize: 13, color: C.bodySoft, textAlign: 'center', lineHeight: 19 },
    input: {
      borderWidth: 1, borderColor: C.borderWarm, borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 10,
      fontFamily: Fonts.sans, fontSize: 15, color: C.textInk, backgroundColor: C.bgCard,
    },
    dialogBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: Spacing.lg },
    dialog: { backgroundColor: C.bg, borderRadius: Radius.xl, padding: Spacing.lg, gap: 14 },
    dialogBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 40 },
    dialogBtnPrimary: { backgroundColor: C.spice },
    dialogBtnText: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.body },
  });
}
