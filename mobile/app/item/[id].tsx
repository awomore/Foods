import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { menuApi } from '../../src/api/menu';
import { cooksApi, type CookDetail, type MenuItem } from '../../src/api/cooks';
import { cravingsApi } from '../../src/api/cravings';
import { feedApi } from '../../src/api/feed';
import { useCart } from '../../src/context/CartContext';
import { useAuth } from '../../src/context/AuthContext';
import { Fonts, Spacing, Radius } from '../../src/constants/theme';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { useFeedback } from '../../src/components/feedback';
import { fmtCurrency } from '../../src/utils/format';
import Avatar from '../../src/components/ui/Avatar';
import StatusDot from '../../src/components/ui/StatusDot';
import DishPhoto from '../../src/components/ui/DishPhoto';
import { useHealthProfile } from '../../src/hooks/useHealthProfile';
import { computeAllergenMatches } from '../../src/utils/allergens';

export default function ItemDetailScreen() {
  const router = useRouter();
  const { id, cookId } = useLocalSearchParams<{ id: string; cookId: string }>();
  const { addItem } = useCart();
  const { user } = useAuth();
  const { profile: healthProfile } = useHealthProfile();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);

  const [item, setItem] = useState<(MenuItem & { cook_name: string; cook_username: string; cook_location: string | null }) | null>(null);
  const [cook, setCook] = useState<CookDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [selectedSides, setSelectedSides] = useState<string[]>([]);
  const [allergenAcknowledged, setAllergenAcknowledged] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [craved, setCraved] = useState(false);
  const feedback = useFeedback();
  const [craving, setCraving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [{ item: i }, cookData] = await Promise.all([
        menuApi.get(id!),
        cookId ? cooksApi.get(cookId) : Promise.resolve(null),
      ]);
      setItem(i as any);
      if (cookData) setCook(cookData.cook);
      // Default: all included sides are selected
      const sides = (i as any).sides ?? [];
      setSelectedSides(sides.filter((s: any) => s.included).map((s: any) => s.name));
    } catch (e: any) {
      console.error('ItemDetail load error:', e);
    } finally {
      setLoading(false);
    }
  }, [id, cookId]);

  useEffect(() => { load(); }, [load]);

  async function handleLike() {
    if (!user) return;
    const next = !liked;
    setLiked(next);
    setLikeCount(n => next ? n + 1 : n - 1);
    try {
      await feedApi.likeMenuItem(id!);
    } catch {
      setLiked(!next);
      setLikeCount(n => next ? n - 1 : n + 1);
    }
  }

  async function handleCrave() {
    if (!user) {
      feedback.warn('Sign in required', 'Sign in to add to your cravings');
      return;
    }
    if (!item) return;
    if (craved) {
      feedback.info('Already craved', 'This dish is already in your cravings!');
      return;
    }
    setCraving(true);
    try {
      await cravingsApi.add({
        menu_item_id: item.id,
        cook_id: item.cook_id,
        dish_title: item.title,
        dish_price: item.unit_price,
        dish_photo: item.photos?.[0] ?? null,
        currency_code: item.currency_code,
      });
      setCraved(true);
      feedback.success('Added to cravings', 'Your friends can now see and gift this to you!');
    } catch (e: any) {
      feedback.error('Error', e.error ?? 'Could not add craving');
    }
    setCraving(false);
  }

  function toggleSide(name: string) {
    setSelectedSides(ss => ss.includes(name) ? ss.filter(x => x !== name) : [...ss, name]);
  }

  function handleClaim() {
    if (!item) return;
    const sides = (item as any).sides ?? [];
    const removed = sides.filter((s: any) => !selectedSides.includes(s.name) && s.included).map((s: any) => s.name);

    addItem({
      menuItemId: item.id,
      cookId: item.cook_id,
      cookName: item.cook_name ?? cook?.display_name ?? 'Cook',
      dishTitle: item.title,
      price: item.unit_price,
      currencyCode: item.currency_code,
      qty,
      selectedSides,
      removedSides: removed,
      allergenAcknowledged,
      matchedAllergens,
      matchedIngredients,
    });
    router.push('/checkout');
  }

  if (loading) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={C.spice} />
      </View>
    );
  }

  if (!item) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center', padding: 24 }]}>
        <Text style={{ fontFamily: Fonts.serif, fontSize: 20, color: C.textInk }}>Dish not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ fontFamily: Fonts.sans, color: C.spice }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const customerAllergens = healthProfile?.allergens ?? [];
  const { matchedAllergens, matchedIngredients } = computeAllergenMatches(
    customerAllergens,
    item.ingredients ?? [],
    item.allergens ?? [],
  );
  const allergenMatch = matchedAllergens;
  const slotsLeft = item.total_slots - item.slots_claimed;
  const sides = (item as any).sides ?? [];

  return (
    <View style={styles.root}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Hero photo */}
        <View style={{ position: 'relative' }}>
          <DishPhoto
            uri={item.photos?.[0] ?? null}
            label={item.title}
            height={280}
            radius={0}
            isSoldOut={slotsLeft <= 0}
            slotsLeft={slotsLeft}
          />
          <SafeAreaView style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backPill}>
              <Ionicons name="chevron-back" size={18} color={C.textInk} />
            </TouchableOpacity>
          </SafeAreaView>
        </View>

        <View style={styles.content}>
          {/* Cook link */}
          <TouchableOpacity
            onPress={() => router.push(`/cook/${item.cook_id}`)}
            style={styles.cookRow}
          >
            <Avatar name={(item.cook_name ?? 'C').charAt(0)} avatarUrl={cook?.avatar_url} avatarBg={C.ember} size={28} />
            <Text style={styles.cookLink}>
              From {item.cook_name ?? cook?.display_name} · {item.cook_location ?? cook?.location ?? ''}
            </Text>
            <StatusDot status={cook?.is_live ? 'cooking-now' : 'done'} />
          </TouchableOpacity>

          {/* Title + price */}
          <View style={styles.titleRow}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.price}>{fmtCurrency(item.unit_price, item.currency_code)}</Text>
          </View>

          {/* Slots + credentials */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
            <View style={[styles.slotPill, slotsLeft <= 2 && styles.slotPillLow]}>
              <Text style={[styles.slotText, slotsLeft <= 2 && styles.slotTextLow]}>
                {slotsLeft <= 0 ? 'Sold out' : slotsLeft <= 2 ? `Only ${slotsLeft} left` : `${slotsLeft} of ${item.total_slots} left`}
              </Text>
            </View>
            {cook?.food_safety_verified && (
              <View style={[styles.slotPill, { backgroundColor: C.infoBg }]}>
                <Text style={[styles.slotText, { color: C.infoFg }]}>Food safety certified</Text>
              </View>
            )}
            {(item.like_count ?? 0) > 0 && (
              <View style={[styles.slotPill, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                <Ionicons name="heart" size={11} color={C.errorFg} />
                <Text style={styles.slotText}>{item.like_count}</Text>
              </View>
            )}
            {(item.craving_count ?? 0) > 0 && (
              <View style={[styles.slotPill, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                <Ionicons name="bookmark" size={11} color={C.spice} />
                <Text style={styles.slotText}>{item.craving_count} craving{item.craving_count !== 1 ? 's' : ''}</Text>
              </View>
            )}
          </View>

          {/* Description */}
          {item.description && <Text style={styles.desc}>{item.description}</Text>}

          {/* Ingredients */}
          {item.ingredients?.length > 0 && (
            <View style={{ marginTop: 16 }}>
              <Text style={styles.sectionLabel}>Ingredients</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6, gap: 4 }}>
                {item.ingredients.map((ing, idx) => {
                  const isMatch = matchedIngredients.includes(ing);
                  return (
                    <Text
                      key={idx}
                      style={{
                        fontFamily: Fonts.sans,
                        fontSize: 13,
                        lineHeight: 20,
                        color: isMatch ? C.errorFg : C.body,
                        fontWeight: isMatch ? '600' : '400',
                      }}
                    >
                      {ing}{idx < item.ingredients.length - 1 ? ', ' : ''}
                    </Text>
                  );
                })}
              </View>
            </View>
          )}

          {/* Cook note */}
          {item.cook_note && (
            <View style={styles.noteBox}>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                <Avatar name={(item.cook_name ?? 'C').charAt(0)} avatarUrl={cook?.avatar_url} avatarBg={C.ember} size={22} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.noteAuthor}>{item.cook_name ?? cook?.display_name} says:</Text>
                  <Text style={styles.noteText}>{item.cook_note}</Text>
                </View>
              </View>
            </View>
          )}

          {/* Allergen warning */}
          {allergenMatch.length > 0 && (
            <View style={styles.allergenBox}>
              <Ionicons name="warning" size={16} color={C.errorFg} />
              <View style={{ flex: 1 }}>
                <Text style={styles.allergenTitle}>⚠ Contains ingredients you avoid</Text>
                <Text style={styles.allergenText}>
                  This dish contains{' '}
                  {matchedIngredients.length > 0
                    ? matchedIngredients.join(', ')
                    : allergenMatch.join(', ')}
                  {' '}({allergenMatch.join(', ')}).
                </Text>
                <TouchableOpacity
                  style={{ flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 10 }}
                  onPress={() => setAllergenAcknowledged(a => !a)}
                >
                  <View style={[styles.sideCheck, allergenAcknowledged && styles.sideCheckActive]}>
                    {allergenAcknowledged && <Ionicons name="checkmark" size={12} color={C.canvas} />}
                  </View>
                  <Text style={{ fontFamily: Fonts.sans, fontSize: 12, color: C.errorFg }}>
                    I understand and still want to order
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Sides */}
          {sides.length > 0 && (
            <View style={styles.sidesSection}>
              <Text style={styles.sectionLabel}>Comes with</Text>
              {sides.map((s: any) => (
                <TouchableOpacity
                  key={s.name}
                  onPress={() => s.optional && toggleSide(s.name)}
                  style={styles.sideRow}
                >
                  <View style={[styles.sideCheck, selectedSides.includes(s.name) && styles.sideCheckActive]}>
                    {selectedSides.includes(s.name) && <Ionicons name="checkmark" size={12} color={C.canvas} />}
                  </View>
                  <Text style={styles.sideName}>{s.name}</Text>
                  {!s.optional && (
                    <View style={styles.includedPill}><Text style={styles.includedText}>included</Text></View>
                  )}
                  {s.optional && !s.included && (
                    <Text style={styles.optionalText}>optional</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Qty */}
          <View style={styles.qtyRow}>
            <Text style={styles.sectionLabel}>Portions</Text>
            <View style={styles.qtyControls}>
              <TouchableOpacity onPress={() => setQty(q => Math.max(1, q - 1))} style={styles.qtyBtn}>
                <Ionicons name="remove" size={18} color={C.body} />
              </TouchableOpacity>
              <Text style={styles.qtyNum}>{qty}</Text>
              <TouchableOpacity
                onPress={() => setQty(q => Math.min(slotsLeft, q + 1))}
                style={[styles.qtyBtn, styles.qtyBtnActive]}
                disabled={qty >= slotsLeft}
              >
                <Ionicons name="add" size={18} color={C.canvas} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Sticky CTA */}
      <View style={styles.stickyBar}>
        <View style={styles.stickyActions}>
          <TouchableOpacity style={styles.iconAction} onPress={handleLike} activeOpacity={0.7}>
            <Ionicons name={liked ? 'heart' : 'heart-outline'} size={22} color={liked ? C.errorFg : C.bodySoft} />
            {likeCount > 0 && <Text style={styles.iconActionCount}>{likeCount}</Text>}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.craveBtn, craved && styles.craveBtnActive]}
            onPress={handleCrave}
            disabled={craving || craved}
            activeOpacity={0.8}
          >
            {craving
              ? <ActivityIndicator size="small" color={craved ? C.spice : C.canvas} />
              : <>
                  <Ionicons name={craved ? 'bookmark' : 'bookmark-outline'} size={15} color={craved ? C.spice : C.canvas} />
                  <Text style={[styles.craveBtnText, craved && { color: C.spice }]}>
                    {craved ? 'Craved' : 'Crave'}
                  </Text>
                </>}
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          onPress={handleClaim}
          style={[styles.claimBtn, (slotsLeft <= 0 || (allergenMatch.length > 0 && !allergenAcknowledged)) && { opacity: 0.5 }]}
          activeOpacity={0.85}
          disabled={slotsLeft <= 0 || (allergenMatch.length > 0 && !allergenAcknowledged)}
        >
          <Text style={styles.claimLabel}>
            {slotsLeft <= 0 ? "She's cooked for today" : `Claim ${qty > 1 ? `${qty} portions` : 'your portion'}`}
          </Text>
          <Text style={styles.claimPrice}>{fmtCurrency(item.unit_price * qty, item.currency_code)}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function makeStyles(C: AppColors) { return StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  backPill: { margin: 16, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(250,246,240,0.88)', alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.lg },
  cookRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  cookLink: { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft, flex: 1 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  title: { fontFamily: Fonts.serif, fontSize: 22, color: C.textInk, lineHeight: 28, flex: 1 },
  price: { fontFamily: Fonts.serif, fontSize: 24, color: C.spice, flexShrink: 0 },
  slotPill: { backgroundColor: C.honey, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 40 },
  slotPillLow: { backgroundColor: C.errorBg },
  slotText: { fontFamily: Fonts.sansMedium, fontSize: 11, color: '#5C3B16' },
  slotTextLow: { color: C.errorFg },
  desc: { fontFamily: Fonts.sans, fontSize: 14, color: C.body, lineHeight: 22, marginTop: 16 },
  noteBox: { backgroundColor: C.honey, borderRadius: 12, padding: 14, marginTop: 16 },
  noteAuthor: { fontFamily: Fonts.sansMedium, fontSize: 12, color: '#5C3B16' },
  noteText: { fontFamily: Fonts.sans, fontSize: 12, color: '#5C3B16', lineHeight: 18, fontStyle: 'italic', marginTop: 4 },
  allergenBox: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: C.errorBg, borderRadius: 12, padding: 14, marginTop: 14, borderWidth: 0.5, borderColor: 'rgba(192,57,43,0.2)' },
  allergenTitle: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.errorFg },
  allergenText: { fontFamily: Fonts.sans, fontSize: 12, color: C.errorFg, opacity: 0.85, marginTop: 2, lineHeight: 18 },
  sidesSection: { marginTop: 20 },
  sectionLabel: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.textInk, marginBottom: 10 },
  sideRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderBottomWidth: 0.5, borderBottomColor: C.borderWarm },
  sideCheck: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: C.borderWarm, alignItems: 'center', justifyContent: 'center' },
  sideCheckActive: { backgroundColor: C.spice, borderColor: C.spice },
  sideName: { fontFamily: Fonts.sans, fontSize: 13, color: C.body, flex: 1 },
  includedPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 40, backgroundColor: C.bgCook, borderWidth: 0.5, borderColor: C.borderWarm },
  includedText: { fontFamily: Fonts.sans, fontSize: 10, color: C.textInk },
  optionalText: { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft },
  qtyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20 },
  qtyControls: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  qtyBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.bgCook, borderWidth: 0.5, borderColor: C.borderWarm, alignItems: 'center', justifyContent: 'center' },
  qtyBtnActive: { backgroundColor: C.ink, borderWidth: 0 },
  qtyNum: { fontFamily: Fonts.serif, fontSize: 22, color: C.spice, minWidth: 22, textAlign: 'center' },
  stickyBar: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, paddingBottom: 36, backgroundColor: C.bg, borderTopWidth: 0.5, borderTopColor: C.borderWarm, gap: 10 },
  stickyActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconAction: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 8 },
  iconActionCount: { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.bodySoft },
  craveBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.ink, borderRadius: 40, paddingHorizontal: 16, paddingVertical: 9 },
  craveBtnActive: { backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.spice },
  craveBtnText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.canvas },
  claimBtn: { backgroundColor: C.ink, borderRadius: Radius.lg, paddingVertical: 16, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  claimLabel: { fontFamily: Fonts.sansMedium, fontSize: 15, color: C.canvas },
  claimPrice: { fontFamily: Fonts.serif, fontSize: 18, color: C.ember },
}); }
