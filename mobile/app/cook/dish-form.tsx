import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Switch,
  KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { pickImage, takePhoto, uploadImage } from '../../src/utils/imageUpload';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { menuApi } from '../../src/api/menu';
import { discountsApi, type CookDiscount, type DiscountType } from '../../src/api/discounts';
import { Fonts, Spacing, Radius, Shadow } from '../../src/constants/theme';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { useFeedback } from '../../src/components/feedback';
import { Bone } from '../../src/components/ui/Skeleton';
import type { Side } from '../../src/api/cooks';
import IngredientInput from '../../src/components/ui/IngredientInput';
import { deriveAllergens } from '../../src/utils/allergens';

type Mode = 'meals' | 'drinks' | 'bakery' | 'store';

const MODES: [Mode, string][] = [
  ['meals',  'Meals'],
  ['drinks', 'Drinks'],
  ['bakery', 'Bakery'],
  ['store',  'Store'],
];

const DIETARY_OPTIONS: { label: string; value: string; icon: string }[] = [
  { label: 'Vegan',         value: 'vegan',          icon: '🌱' },
  { label: 'Vegetarian',    value: 'vegetarian',      icon: '🥦' },
  { label: 'Halal',         value: 'halal',           icon: '☪️' },
  { label: 'Keto',          value: 'keto',            icon: '🥑' },
  { label: 'Gluten Free',   value: 'gluten_free',     icon: '🌾' },
  { label: 'High Protein',  value: 'high_protein',    icon: '💪' },
  { label: 'Low Carb',      value: 'low_carb',        icon: '📉' },
  { label: 'Diabetic Friendly', value: 'diabetic_friendly', icon: '🩺' },
  { label: 'Low Sugar',     value: 'low_sugar',       icon: '🍬' },
  { label: 'Dairy Free',    value: 'dairy_free',      icon: '🥛' },
];

function Field({
  label, value, onChangeText, placeholder, keyboardType, multiline, required,
}: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; keyboardType?: TextInput['props']['keyboardType'];
  multiline?: boolean; required?: boolean;
}) {
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}{required && <Text style={{ color: C.errorFg }}> *</Text>}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMulti]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.stone}
        keyboardType={keyboardType}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
      />
    </View>
  );
}

export default function DishFormScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEditing = !!id;
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);

  const [title, setTitle]       = useState('');
  const [price, setPrice]       = useState('');
  const [desc, setDesc]         = useState('');
  const [cookNote, setCookNote] = useState('');
  const [mode, setMode]         = useState<Mode>('meals');
  const [date, setDate]         = useState('');
  const [slots, setSlots]       = useState('10');
  const [windowStart, setWindowStart] = useState('');
  const [windowEnd, setWindowEnd]     = useState('');
  const [isActive, setIsActive] = useState(true);

  const [ingredients, setIngredients] = useState<string[]>([]);
  const [dietaryLabels, setDietaryLabels] = useState<string[]>([]);

  const [sides, setSides] = useState<Side[]>([]);
  const [newSideName, setNewSideName]   = useState('');
  const [newSidePrice, setNewSidePrice] = useState('');
  const [newSideOpt, setNewSideOpt]     = useState(true);

  const [discountOn, setDiscountOn]       = useState(false);
  const [discountType, setDiscountType]   = useState<DiscountType>('general_pct');
  const [discountVal, setDiscountVal]     = useState('');
  const [discountEnd, setDiscountEnd]     = useState('');
  const [existingDiscount, setExistingDiscount] = useState<CookDiscount | null>(null);

  const [photos, setPhotos]               = useState<string[]>([]);
  const [photoUploading, setPhotoUploading] = useState(false);

  const feedback = useFeedback();
  const [saving, setSaving]   = useState(false);
  const [loading, setLoading] = useState(isEditing);

  const loadItem = useCallback(async () => {
    if (!id) return;
    try {
      const { item } = await menuApi.get(id);
      setTitle(item.title);
      setPrice(String(item.unit_price));
      setDesc(item.description ?? '');
      setCookNote(item.cook_note ?? '');
      setMode((item.mode as Mode) ?? 'meals');
      setDate(item.available_date ?? '');
      setSlots(String(item.total_slots));
      if (item.delivery_window_start) setWindowStart(item.delivery_window_start.slice(11, 16));
      if (item.delivery_window_end)   setWindowEnd(item.delivery_window_end.slice(11, 16));
      setIsActive(item.is_active);
      setIngredients(item.ingredients ?? []);
      setDietaryLabels((item as any).dietary_labels ?? []);
      setSides(item.sides ?? []);
      if (item.photos?.length) setPhotos(item.photos);
    } catch (e) {
      feedback.error('Error', 'Could not load dish');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadDiscount = useCallback(async () => {
    if (!id) return;
    try {
      const { discounts } = await discountsApi.list();
      const active = discounts.find(d => d.is_active && (!d.ends_at || d.ends_at > new Date().toISOString()));
      if (active) {
        setExistingDiscount(active);
        setDiscountOn(true);
        setDiscountType(active.type);
        setDiscountVal(String(active.discount_value ?? ''));
        setDiscountEnd(active.ends_at ? active.ends_at.slice(0, 10) : '');
      }
    } catch {}
  }, [id]);

  useEffect(() => {
    loadItem();
    if (isEditing) loadDiscount();
  }, [loadItem, loadDiscount, isEditing]);

  function handleAddPhoto() {
    feedback.actionSheet({
      title: 'Add photo',
      actions: [
        {
          label: 'Take photo',
          icon: 'camera-outline',
          onPress: async () => {
            const picked = await takePhoto();
            if (!picked) return;
            setPhotoUploading(true);
            try {
              const url = await uploadImage(picked, 'menu-items');
              setPhotos(prev => [...prev, url]);
            } catch { feedback.error('Upload failed', 'Could not upload photo. Try again.'); }
            finally { setPhotoUploading(false); }
          },
        },
        {
          label: 'Choose from library',
          icon: 'image-outline',
          onPress: async () => {
            const picked = await pickImage();
            if (!picked) return;
            setPhotoUploading(true);
            try {
              const url = await uploadImage(picked, 'menu-items');
              setPhotos(prev => [...prev, url]);
            } catch { feedback.error('Upload failed', 'Could not upload photo. Try again.'); }
            finally { setPhotoUploading(false); }
          },
        },
      ],
    });
  }

  function removePhoto(idx: number) {
    setPhotos(prev => prev.filter((_, i) => i !== idx));
  }

  function toggleDietary(value: string) {
    setDietaryLabels(prev =>
      prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
    );
  }

  function addSide() {
    if (!newSideName.trim()) return;
    setSides(prev => [...prev, {
      name: newSideName.trim(),
      optional: newSideOpt,
      included: !newSideOpt,
      price: newSidePrice ? parseFloat(newSidePrice) : undefined,
    }]);
    setNewSideName('');
    setNewSidePrice('');
  }

  function removeSide(i: number) {
    setSides(prev => prev.filter((_, idx) => idx !== i));
  }

  async function handleSave() {
    if (!title.trim()) { feedback.warn('Required', 'Dish title is required'); return; }
    const unitPrice = parseFloat(price);
    if (!price || isNaN(unitPrice) || unitPrice <= 0) { feedback.warn('Required', 'Enter a valid price'); return; }
    if (ingredients.length === 0) { feedback.warn('Required', 'Add at least one ingredient before publishing'); return; }
    if (photos.length === 0) { feedback.warn('Required', 'Add at least one photo before publishing'); return; }

    setSaving(true);
    try {
      const payload: Parameters<typeof menuApi.create>[0] = {
        title: title.trim(),
        unit_price: unitPrice,
        photos,
        mode,
        description: desc.trim() || undefined,
        cook_note: cookNote.trim() || undefined,
        ingredients,
        allergens: deriveAllergens(ingredients),
        dietary_labels: dietaryLabels,
        sides,
        total_slots: parseInt(slots) || 10,
        available_date: date || undefined,
      } as any;

      const d = date || new Date().toISOString().slice(0, 10);
      if (windowStart) (payload as any).delivery_window_start = `${d}T${windowStart}:00`;
      if (windowEnd)   (payload as any).delivery_window_end   = `${d}T${windowEnd}:00`;

      if (isEditing && id) {
        await menuApi.update(id, { ...payload, is_active: isActive } as any);
      } else {
        await menuApi.create(payload);
      }

      if (discountOn && discountVal) {
        const dv = parseFloat(discountVal);
        if (!isNaN(dv) && dv > 0) {
          if (existingDiscount) {
            await discountsApi.update(existingDiscount.id, {
              discount_value: dv,
              ends_at: discountEnd || undefined,
              is_active: true,
            });
          } else {
            await discountsApi.create({
              type: discountType,
              discount_value: dv,
              ends_at: discountEnd ? `${discountEnd}T23:59:59` : undefined,
            });
          }
        }
      } else if (!discountOn && existingDiscount) {
        await discountsApi.update(existingDiscount.id, { is_active: false });
      }

      router.back();
    } catch (e: any) {
      feedback.error('Error', e?.error ?? 'Could not save dish');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.root}>
        <SafeAreaView style={{ flex: 1, padding: Spacing.lg, gap: 14 }}>
          <Bone width="50%" height={22} radius={6} />
          <Bone width="100%" height={200} radius={14} />
          <Bone width="100%" height={48} radius={10} />
          <Bone width="100%" height={48} radius={10} />
          <Bone width="100%" height={48} radius={10} />
          <Bone width="60%" height={44} radius={22} />
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
          <Text style={styles.headerTitle}>{isEditing ? 'Edit dish' : 'Add dish'}</Text>
          <TouchableOpacity
            onPress={handleSave}
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator size="small" color={C.canvas} />
              : <Text style={styles.saveBtnText}>Save</Text>}
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: Spacing.lg, gap: 20, paddingBottom: 60 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Photo gallery */}
          <View style={styles.section}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={styles.sectionTitle}>
                Photos <Text style={{ color: C.errorFg }}>*</Text>
              </Text>
              <Text style={[styles.sectionSub, { marginTop: 0 }]}>{photos.length} added</Text>
            </View>
            <Text style={styles.sectionSub}>Show your dish from multiple angles</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }} contentContainerStyle={{ gap: 10 }}>
              {photos.map((uri, idx) => (
                <View key={idx} style={styles.photoThumb}>
                  <Image source={{ uri }} style={styles.photoThumbImg} resizeMode="cover" />
                  <TouchableOpacity style={styles.photoRemove} onPress={() => removePhoto(idx)}>
                    <Ionicons name="close" size={12} color={C.canvas} />
                  </TouchableOpacity>
                  {idx === 0 && (
                    <View style={styles.photoPrimaryBadge}>
                      <Text style={styles.photoPrimaryText}>Main</Text>
                    </View>
                  )}
                </View>
              ))}
              <TouchableOpacity
                style={styles.photoAddBtn}
                onPress={handleAddPhoto}
                disabled={photoUploading}
                activeOpacity={0.8}
              >
                {photoUploading
                  ? <ActivityIndicator color={C.spice} />
                  : <>
                      <Ionicons name="camera-outline" size={22} color={C.spice} />
                      <Text style={styles.photoAddText}>Add</Text>
                    </>}
              </TouchableOpacity>
            </ScrollView>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Dish details</Text>
            <Field label="Dish name" value={title} onChangeText={setTitle} placeholder="e.g. Jollof rice & plantain" required />
            <Field label="Price (₦)" value={price} onChangeText={setPrice} placeholder="2500" keyboardType="numeric" required />
            <Field label="Description" value={desc} onChangeText={setDesc} placeholder="What's in this dish?" multiline />
            <Field label="Cook's note" value={cookNote} onChangeText={setCookNote} placeholder="A personal message for your customers" multiline />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Category</Text>
            <View style={styles.modeRow}>
              {MODES.map(([m, label]) => (
                <TouchableOpacity
                  key={m}
                  onPress={() => setMode(m)}
                  style={[styles.modeBtn, mode === m && styles.modeBtnActive]}
                >
                  <Text style={[styles.modeBtnText, mode === m && styles.modeBtnTextActive]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Availability</Text>
            <Field label="Available date" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" />
            <Field label="Total portions" value={slots} onChangeText={setSlots} placeholder="10" keyboardType="numeric" />
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Field label="Window opens" value={windowStart} onChangeText={setWindowStart} placeholder="12:00" />
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Window closes" value={windowEnd} onChangeText={setWindowEnd} placeholder="15:00" />
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={styles.sectionTitle}>Ingredients <Text style={{ color: C.errorFg }}>*</Text></Text>
              <Text style={[styles.sectionSub, { marginTop: 0 }]}>{ingredients.length} added</Text>
            </View>
            <Text style={styles.sectionSub}>Customers see this. Allergens are derived automatically.</Text>
            <IngredientInput value={ingredients} onChange={setIngredients} />
          </View>

          {/* Dietary labels */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Dietary labels</Text>
            <Text style={styles.sectionSub}>Help customers with special dietary needs find this dish</Text>
            <View style={styles.labelGrid}>
              {DIETARY_OPTIONS.map(opt => {
                const selected = dietaryLabels.includes(opt.value);
                return (
                  <TouchableOpacity
                    key={opt.value}
                    onPress={() => toggleDietary(opt.value)}
                    style={[styles.labelChip, selected && styles.labelChipActive]}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.labelChipIcon}>{opt.icon}</Text>
                    <Text style={[styles.labelChipText, selected && styles.labelChipTextActive]}>
                      {opt.label}
                    </Text>
                    {selected && <Ionicons name="checkmark" size={12} color={C.canvas} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sides & add-ons</Text>
            {sides.map((s, i) => (
              <View key={i} style={styles.sideRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sideName}>{s.name}</Text>
                  <Text style={styles.sideMeta}>
                    {s.included ? 'Included' : 'Optional'}
                    {s.price ? ` · +₦${s.price.toLocaleString()}` : ''}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => removeSide(i)} style={styles.sideRemove}>
                  <Ionicons name="close" size={16} color={C.errorFg} />
                </TouchableOpacity>
              </View>
            ))}
            <View style={styles.addSideWrap}>
              <TextInput
                style={[styles.input, { flex: 2 }]}
                value={newSideName}
                onChangeText={setNewSideName}
                placeholder="Side name"
                placeholderTextColor={C.stone}
              />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={newSidePrice}
                onChangeText={setNewSidePrice}
                placeholder="₦"
                placeholderTextColor={C.stone}
                keyboardType="numeric"
              />
              <TouchableOpacity
                onPress={() => setNewSideOpt(p => !p)}
                style={[styles.optToggle, !newSideOpt && styles.optToggleActive]}
              >
                <Text style={[styles.optToggleText, !newSideOpt && { color: C.canvas }]}>
                  {newSideOpt ? 'Optional' : 'Included'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={addSide} style={styles.addSideBtn}>
                <Ionicons name="add" size={18} color={C.canvas} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.discountHeader}>
              <View>
                <Text style={styles.sectionTitle}>Discount</Text>
                <Text style={styles.sectionSub}>Shown to customers on your profile</Text>
              </View>
              <Switch
                value={discountOn}
                onValueChange={setDiscountOn}
                trackColor={{ true: C.spice }}
                thumbColor={C.canvas}
              />
            </View>

            {discountOn && (
              <>
                <View style={styles.discTypeRow}>
                  {([
                    ['general_pct', '% off menu'],
                    ['general_delivery', 'Free delivery'],
                    ['loyalty_pct', 'Loyalty %'],
                  ] as [DiscountType, string][]).map(([t, label]) => (
                    <TouchableOpacity
                      key={t}
                      onPress={() => setDiscountType(t)}
                      style={[styles.discTypeBtn, discountType === t && styles.discTypeBtnActive]}
                    >
                      <Text style={[styles.discTypeText, discountType === t && styles.discTypeTextActive]}>{label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {discountType !== 'general_delivery' && (
                  <Field
                    label={discountType === 'loyalty_pct' ? 'Percentage off (for repeat customers)' : 'Percentage off'}
                    value={discountVal}
                    onChangeText={setDiscountVal}
                    placeholder="e.g. 10"
                    keyboardType="numeric"
                  />
                )}
                <Field
                  label="Discount ends (optional)"
                  value={discountEnd}
                  onChangeText={setDiscountEnd}
                  placeholder="YYYY-MM-DD"
                />
              </>
            )}
          </View>

          {isEditing && (
            <View style={[styles.section, styles.row]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>Visible to customers</Text>
                <Text style={styles.sectionSub}>Turn off to hide this dish without deleting</Text>
              </View>
              <Switch
                value={isActive}
                onValueChange={setIsActive}
                trackColor={{ true: C.spice }}
                thumbColor={C.canvas}
              />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function makeStyles(C: AppColors) { return StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md,
    paddingTop: 8, paddingBottom: 12, gap: 12,
  },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.bgCook, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: Fonts.serif, fontSize: 20, color: C.textInk, flex: 1 },
  saveBtn: { backgroundColor: C.spice, borderRadius: 40, paddingHorizontal: 20, paddingVertical: 9, minWidth: 72, alignItems: 'center' },
  saveBtnText: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.canvas },

  section: { backgroundColor: C.bgCard, borderRadius: Radius.lg, padding: 16, borderWidth: 0.5, borderColor: C.borderWarm, ...Shadow.card, gap: 12 },
  sectionTitle: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.textInk },
  sectionSub: { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft, marginTop: 2 },
  row: { flexDirection: 'row', gap: 10 },

  field: { gap: 6 },
  fieldLabel: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.body },
  input: {
    backgroundColor: C.bg, borderRadius: Radius.md, borderWidth: 0.5, borderColor: C.borderWarm,
    paddingHorizontal: 12, paddingVertical: 10, fontFamily: Fonts.sans, fontSize: 14, color: C.textInk,
  },
  inputMulti: { minHeight: 80, textAlignVertical: 'top', paddingTop: 10 },

  modeRow: { flexDirection: 'row', gap: 8 },
  modeBtn: { flex: 1, paddingVertical: 10, borderRadius: Radius.md, borderWidth: 0.5, borderColor: C.borderWarm, alignItems: 'center', backgroundColor: C.bg },
  modeBtnActive: { backgroundColor: C.ink, borderColor: C.ink },
  modeBtnText: { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.bodySoft },
  modeBtnTextActive: { color: C.canvas },

  // Photo gallery
  photoThumb: { width: 90, height: 90, borderRadius: Radius.md, overflow: 'hidden', position: 'relative' },
  photoThumbImg: { width: '100%', height: '100%' },
  photoRemove: { position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  photoPrimaryBadge: { position: 'absolute', bottom: 4, left: 4, backgroundColor: C.spice, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  photoPrimaryText: { fontFamily: Fonts.sansMedium, fontSize: 9, color: C.canvas },
  photoAddBtn: { width: 90, height: 90, borderRadius: Radius.md, borderWidth: 1.5, borderColor: C.spice, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 4 },
  photoAddText: { fontFamily: Fonts.sansMedium, fontSize: 11, color: C.spice },

  // Dietary labels
  labelGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  labelChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 40,
    backgroundColor: C.bg, borderWidth: 0.5, borderColor: C.borderWarm,
  },
  labelChipActive: { backgroundColor: C.ink, borderColor: C.ink },
  labelChipIcon: { fontSize: 13 },
  labelChipText: { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.body },
  labelChipTextActive: { color: C.canvas },

  sideRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bg, borderRadius: Radius.md, padding: 10, borderWidth: 0.5, borderColor: C.borderWarm },
  sideName: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.textInk },
  sideMeta: { fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft, marginTop: 2 },
  sideRemove: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: C.errorBg },
  addSideWrap: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  optToggle: { paddingHorizontal: 10, paddingVertical: 9, borderRadius: Radius.md, borderWidth: 0.5, borderColor: C.borderWarm },
  optToggleActive: { backgroundColor: C.spice, borderColor: C.spice },
  optToggleText: { fontFamily: Fonts.sansMedium, fontSize: 11, color: C.spice },
  addSideBtn: { width: 38, height: 38, borderRadius: Radius.md, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' },

  discountHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  discTypeRow: { flexDirection: 'row', gap: 8 },
  discTypeBtn: { flex: 1, paddingVertical: 9, borderRadius: Radius.md, borderWidth: 0.5, borderColor: C.borderWarm, alignItems: 'center', backgroundColor: C.bg },
  discTypeBtnActive: { backgroundColor: C.spice, borderColor: C.spice },
  discTypeText: { fontFamily: Fonts.sansMedium, fontSize: 11, color: C.bodySoft },
  discTypeTextActive: { color: C.canvas },
}); }
