import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, ScrollView, Switch, Image,
  KeyboardAvoidingView, Platform, ActivityIndicator, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Fonts, Spacing, Radius } from '../../constants/theme';
import { useColors, type AppColors } from '../../context/ThemeContext';
import { currencySymbol, fmtCurrency } from '../../utils/format';
import { parseAmountInput } from '../../utils/fx';
import type { MyGalleryAlbum } from '../../api/gallery';

export interface DishOption { id: string; title: string; unit_price: number; currency_code: string; photo?: string }

export type PriceMode = 'none' | 'dish' | 'guide';

/** What the creator chose. album: null = loose, {id} = existing album, {name} = new album. */
export interface PhotoDetails {
  album: null | { id: string } | { name: string };
  priceMode: PriceMode;
  menuItemId: string | null;
  guidePrice: number | null;
}

interface Props {
  visible: boolean;
  /** 'add' shows the picked photos and an Add button; 'edit' edits one photo. */
  mode: 'add' | 'edit';
  previews: string[];
  albums: MyGalleryAlbum[];
  dishes: DishOption[];
  currency: string;
  initial?: Partial<PhotoDetails>;
  saving?: boolean;
  /** "Uploading 2 of 6" while saving in add mode. */
  progress?: string | null;
  onCancel: () => void;
  onSave: (d: PhotoDetails) => void;
}

/**
 * One sheet for the two questions a gallery photo asks: is it from one event
 * (an album), and what does it cost (a dish on the menu, a typed guide price,
 * or nothing). Kept short on purpose so creators aren't overwhelmed.
 */
export default function PhotoDetailsSheet({
  visible, mode, previews, albums, dishes, currency, initial, saving, progress, onCancel, onSave,
}: Props) {
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const [inAlbum, setInAlbum] = useState(false);
  const [albumId, setAlbumId] = useState<string | null>(null);
  const [albumName, setAlbumName] = useState('');
  const [priceMode, setPriceMode] = useState<PriceMode>('none');
  const [menuItemId, setMenuItemId] = useState<string | null>(null);
  const [priceText, setPriceText] = useState('');

  // Reset each time the sheet opens.
  useEffect(() => {
    if (!visible) return;
    const a = initial?.album ?? null;
    setInAlbum(!!a);
    setAlbumId(a && 'id' in a ? a.id : null);
    setAlbumName(a && 'name' in a ? a.name : '');
    setPriceMode(initial?.priceMode ?? 'none');
    setMenuItemId(initial?.menuItemId ?? null);
    setPriceText(initial?.guidePrice != null ? String(initial.guidePrice) : '');
  }, [visible]);

  const guidePrice = priceMode === 'guide' ? parseAmountInput(priceText, currency) : null;
  const albumValid = !inAlbum || !!albumId || albumName.trim().length > 0;
  const priceValid =
    priceMode === 'none' ||
    (priceMode === 'dish' && !!menuItemId) ||
    (priceMode === 'guide' && guidePrice != null && guidePrice > 0);
  const canSave = albumValid && priceValid && !saving;

  function save() {
    if (!canSave) return;
    onSave({
      album: !inAlbum ? null : albumId ? { id: albumId } : { name: albumName.trim() },
      priceMode,
      menuItemId: priceMode === 'dish' ? menuItemId : null,
      guidePrice: priceMode === 'guide' ? guidePrice : null,
    });
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={saving ? undefined : onCancel} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.md }]}>
          <View style={styles.handle} />
          <Text style={styles.title}>
            {mode === 'add' ? t('gallery.add_title', { count: previews.length }) : t('gallery.edit_title')}
          </Text>

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: Spacing.lg, paddingBottom: Spacing.md }}>
            {previews.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {previews.map((uri, i) => <Image key={uri + i} source={{ uri }} style={styles.preview} />)}
              </ScrollView>
            )}

            {/* Album */}
            <View style={styles.section}>
              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>{t('gallery.one_event')}</Text>
                  <Text style={styles.hint}>{t('gallery.one_event_hint')}</Text>
                </View>
                <Switch
                  value={inAlbum}
                  onValueChange={setInAlbum}
                  trackColor={{ true: C.spice, false: C.borderWarm }}
                  thumbColor={C.white}
                />
              </View>
              {inAlbum && (
                <View style={{ gap: 8 }}>
                  {albums.length > 0 && (
                    <View style={styles.chips}>
                      {albums.map((a) => (
                        <TouchableOpacity
                          key={a.id}
                          style={[styles.chip, albumId === a.id && styles.chipOn]}
                          onPress={() => { setAlbumId(albumId === a.id ? null : a.id); setAlbumName(''); }}
                        >
                          <Text style={[styles.chipText, albumId === a.id && styles.chipTextOn]} numberOfLines={1}>{a.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                  {!albumId && (
                    <TextInput
                      style={styles.input}
                      value={albumName}
                      onChangeText={setAlbumName}
                      placeholder={t('gallery.album_name_placeholder')}
                      placeholderTextColor={C.bodySoft}
                      maxLength={80}
                    />
                  )}
                </View>
              )}
            </View>

            {/* Price */}
            <View style={styles.section}>
              <Text style={styles.label}>{t('gallery.price')}</Text>
              <View style={styles.segment}>
                {(['none', 'dish', 'guide'] as PriceMode[]).map((m) => (
                  <TouchableOpacity key={m} style={[styles.segBtn, priceMode === m && styles.segBtnOn]} onPress={() => setPriceMode(m)}>
                    <Text style={[styles.segText, priceMode === m && styles.segTextOn]} numberOfLines={1}>
                      {t(`gallery.price_${m}`)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {priceMode === 'dish' && (
                dishes.length === 0 ? (
                  <Text style={styles.hint}>{t('gallery.no_dishes')}</Text>
                ) : (
                  <View style={{ gap: 6 }}>
                    {dishes.map((d) => (
                      <TouchableOpacity
                        key={d.id}
                        style={[styles.dishRow, menuItemId === d.id && styles.dishRowOn]}
                        onPress={() => setMenuItemId(d.id)}
                      >
                        {d.photo ? <Image source={{ uri: d.photo }} style={styles.dishThumb} /> : <View style={[styles.dishThumb, { backgroundColor: C.bgCook }]} />}
                        <Text style={styles.dishTitle} numberOfLines={1}>{d.title}</Text>
                        <Text style={styles.dishPrice}>{fmtCurrency(d.unit_price, d.currency_code)}</Text>
                        {menuItemId === d.id && <Ionicons name="checkmark-circle" size={18} color={C.spice} />}
                      </TouchableOpacity>
                    ))}
                  </View>
                )
              )}

              {priceMode === 'guide' && (
                <View style={{ gap: 6 }}>
                  <View style={styles.priceInputRow}>
                    <Text style={styles.from}>{t('gallery.from')}</Text>
                    <Text style={styles.symbol}>{currencySymbol(currency)}</Text>
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      value={priceText}
                      onChangeText={setPriceText}
                      keyboardType="decimal-pad"
                      placeholder="85,000"
                      placeholderTextColor={C.bodySoft}
                    />
                  </View>
                  <Text style={styles.hint}>{t('gallery.guide_hint')}</Text>
                </View>
              )}
            </View>
          </ScrollView>

          <TouchableOpacity style={[styles.saveBtn, !canSave && { opacity: 0.5 }]} disabled={!canSave} onPress={save}>
            {saving ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ActivityIndicator color={C.white} />
                {!!progress && <Text style={styles.saveText}>{progress}</Text>}
              </View>
            ) : (
              <Text style={styles.saveText}>
                {mode === 'add' ? t('gallery.add_button', { count: previews.length }) : t('common.save')}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
    sheet: {
      backgroundColor: C.bg, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
      paddingHorizontal: Spacing.lg, paddingTop: 8, maxHeight: '88%',
    },
    handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: C.borderWarm, marginBottom: 12 },
    title: { fontFamily: Fonts.serif, fontSize: 20, color: C.textInk, marginBottom: Spacing.md },
    preview: { width: 72, height: 72, borderRadius: Radius.md, backgroundColor: C.bgCook },
    section: { gap: 10 },
    switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    label: { fontFamily: Fonts.sansMedium, fontSize: 15, color: C.textInk },
    hint: { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft, lineHeight: 17 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 40, borderWidth: 1, borderColor: C.borderWarm, maxWidth: 200 },
    chipOn: { borderColor: C.spice, backgroundColor: C.spice + '18' },
    chipText: { fontFamily: Fonts.sans, fontSize: 13, color: C.body },
    chipTextOn: { color: C.textInk, fontFamily: Fonts.sansMedium },
    input: {
      borderWidth: 1, borderColor: C.borderWarm, borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 10,
      fontFamily: Fonts.sans, fontSize: 15, color: C.textInk, backgroundColor: C.bgCard,
    },
    segment: { flexDirection: 'row', backgroundColor: C.bgCook, borderRadius: 40, padding: 3 },
    segBtn: { flex: 1, paddingVertical: 8, borderRadius: 40, alignItems: 'center' },
    segBtnOn: { backgroundColor: C.bgCard },
    segText: { fontFamily: Fonts.sans, fontSize: 13, color: C.bodySoft },
    segTextOn: { fontFamily: Fonts.sansMedium, color: C.textInk },
    dishRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, borderRadius: Radius.md,
      borderWidth: 1, borderColor: C.borderWarm, backgroundColor: C.bgCard,
    },
    dishRowOn: { borderColor: C.spice },
    dishThumb: { width: 40, height: 40, borderRadius: 8 },
    dishTitle: { flex: 1, fontFamily: Fonts.sans, fontSize: 14, color: C.textInk },
    dishPrice: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.body },
    priceInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    from: { fontFamily: Fonts.sans, fontSize: 14, color: C.bodySoft },
    symbol: { fontFamily: Fonts.sansMedium, fontSize: 16, color: C.textInk },
    saveBtn: { backgroundColor: C.spice, borderRadius: 40, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
    saveText: { fontFamily: Fonts.sansMedium, fontSize: 15, color: C.white },
  });
}
