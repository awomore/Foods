import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { menuApi } from '../../src/api/menu';
import { cooksApi, type CookDetail, type MenuItem } from '../../src/api/cooks';
import { useCart } from '../../src/context/CartContext';
import { useAuth } from '../../src/context/AuthContext';
import { Colors, Fonts, Spacing, Radius } from '../../src/constants/theme';
import Avatar from '../../src/components/ui/Avatar';
import StatusDot from '../../src/components/ui/StatusDot';
import DishPhoto from '../../src/components/ui/DishPhoto';

function fmtCurrency(amount: number, currency = 'NGN'): string {
  const symbols: Record<string, string> = { NGN: '₦', KES: 'KSh ', GHS: 'GH₵', ZAR: 'R', EGP: 'E£' };
  return (symbols[currency] ?? currency + ' ') + Number(amount).toLocaleString('en-NG', { maximumFractionDigits: 0 });
}

export default function ItemDetailScreen() {
  const router = useRouter();
  const { id, cookId } = useLocalSearchParams<{ id: string; cookId: string }>();
  const { addItem } = useCart();
  const { user } = useAuth();

  const [item, setItem] = useState<(MenuItem & { cook_name: string; cook_username: string; cook_location: string | null }) | null>(null);
  const [cook, setCook] = useState<CookDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [selectedSides, setSelectedSides] = useState<string[]>([]);
  const [allergenAcknowledged, setAllergenAcknowledged] = useState(false);

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
    });
    router.push('/checkout');
  }

  if (loading) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={Colors.spice} />
      </View>
    );
  }

  if (!item) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center', padding: 24 }]}>
        <Text style={{ fontFamily: Fonts.serif, fontSize: 20, color: Colors.textInk }}>Dish not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ fontFamily: Fonts.sans, color: Colors.spice }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const customerAllergens: string[] = [];
  const allergenMatch = (item.allergens ?? []).filter(a => customerAllergens.includes(a));
  const slotsLeft = item.total_slots - item.slots_claimed;
  const sides = (item as any).sides ?? [];

  return (
    <View style={styles.root}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Hero photo */}
        <View style={{ position: 'relative' }}>
          <DishPhoto tint="#C97A35" label={item.title} height={280} radius={0} />
          <SafeAreaView style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backPill}>
              <Ionicons name="chevron-back" size={18} color={Colors.textInk} />
            </TouchableOpacity>
          </SafeAreaView>
        </View>

        <View style={styles.content}>
          {/* Cook link */}
          <TouchableOpacity
            onPress={() => router.push(`/cook/${item.cook_id}`)}
            style={styles.cookRow}
          >
            <Avatar name={(item.cook_name ?? 'C').charAt(0)} avatarBg={Colors.ember} size={28} />
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
              <View style={[styles.slotPill, { backgroundColor: Colors.infoBg }]}>
                <Text style={[styles.slotText, { color: Colors.infoFg }]}>Food safety certified</Text>
              </View>
            )}
          </View>

          {/* Description */}
          {item.description && <Text style={styles.desc}>{item.description}</Text>}

          {/* Ingredients */}
          {item.ingredients?.length > 0 && (
            <View style={{ marginTop: 16 }}>
              <Text style={styles.sectionLabel}>Ingredients</Text>
              <Text style={{ fontFamily: Fonts.sans, fontSize: 13, color: Colors.body, lineHeight: 20, marginTop: 6 }}>
                {item.ingredients.join(', ')}
              </Text>
            </View>
          )}

          {/* Cook note */}
          {item.cook_note && (
            <View style={styles.noteBox}>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                <Avatar name={(item.cook_name ?? 'C').charAt(0)} avatarBg={Colors.ember} size={22} />
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
              <Ionicons name="warning-outline" size={16} color={Colors.errorFg} />
              <View style={{ flex: 1 }}>
                <Text style={styles.allergenTitle}>Allergen match</Text>
                <Text style={styles.allergenText}>
                  This dish contains {allergenMatch.join(', ')}, which is in your profile.
                </Text>
                <TouchableOpacity
                  style={{ flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 10 }}
                  onPress={() => setAllergenAcknowledged(a => !a)}
                >
                  <View style={[styles.sideCheck, allergenAcknowledged && styles.sideCheckActive]}>
                    {allergenAcknowledged && <Ionicons name="checkmark" size={12} color={Colors.canvas} />}
                  </View>
                  <Text style={{ fontFamily: Fonts.sans, fontSize: 12, color: Colors.errorFg }}>
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
                    {selectedSides.includes(s.name) && <Ionicons name="checkmark" size={12} color={Colors.canvas} />}
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
                <Ionicons name="remove" size={18} color={Colors.body} />
              </TouchableOpacity>
              <Text style={styles.qtyNum}>{qty}</Text>
              <TouchableOpacity
                onPress={() => setQty(q => Math.min(slotsLeft, q + 1))}
                style={[styles.qtyBtn, styles.qtyBtnActive]}
                disabled={qty >= slotsLeft}
              >
                <Ionicons name="add" size={18} color={Colors.canvas} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Sticky CTA */}
      <View style={styles.stickyBar}>
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  backPill: { margin: 16, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(250,246,240,0.88)', alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.lg },
  cookRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  cookLink: { fontFamily: Fonts.sans, fontSize: 12, color: Colors.bodySoft, flex: 1 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  title: { fontFamily: Fonts.serif, fontSize: 22, color: Colors.textInk, lineHeight: 28, flex: 1 },
  price: { fontFamily: Fonts.serif, fontSize: 24, color: Colors.spice, flexShrink: 0 },
  slotPill: { backgroundColor: Colors.honey, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 40 },
  slotPillLow: { backgroundColor: Colors.errorBg },
  slotText: { fontFamily: Fonts.sansMedium, fontSize: 11, color: '#5C3B16' },
  slotTextLow: { color: Colors.errorFg },
  desc: { fontFamily: Fonts.sans, fontSize: 14, color: Colors.body, lineHeight: 22, marginTop: 16 },
  noteBox: { backgroundColor: Colors.honey, borderRadius: 12, padding: 14, marginTop: 16 },
  noteAuthor: { fontFamily: Fonts.sansMedium, fontSize: 12, color: '#5C3B16', fontWeight: '600' },
  noteText: { fontFamily: Fonts.sans, fontSize: 12, color: '#5C3B16', lineHeight: 18, fontStyle: 'italic', marginTop: 4 },
  allergenBox: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: Colors.errorBg, borderRadius: 12, padding: 14, marginTop: 14, borderWidth: 0.5, borderColor: 'rgba(192,57,43,0.2)' },
  allergenTitle: { fontFamily: Fonts.sansMedium, fontSize: 13, color: Colors.errorFg, fontWeight: '600' },
  allergenText: { fontFamily: Fonts.sans, fontSize: 12, color: Colors.errorFg, opacity: 0.85, marginTop: 2, lineHeight: 18 },
  sidesSection: { marginTop: 20 },
  sectionLabel: { fontFamily: Fonts.sansMedium, fontSize: 14, color: Colors.textInk, fontWeight: '600', marginBottom: 10 },
  sideRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderBottomWidth: 0.5, borderBottomColor: Colors.borderWarm },
  sideCheck: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: Colors.borderWarm, alignItems: 'center', justifyContent: 'center' },
  sideCheckActive: { backgroundColor: Colors.spice, borderColor: Colors.spice },
  sideName: { fontFamily: Fonts.sans, fontSize: 13, color: Colors.body, flex: 1 },
  includedPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 40, backgroundColor: Colors.bgCook, borderWidth: 0.5, borderColor: Colors.borderWarm },
  includedText: { fontFamily: Fonts.sans, fontSize: 10, color: Colors.textInk },
  optionalText: { fontFamily: Fonts.sans, fontSize: 12, color: Colors.bodySoft },
  qtyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20 },
  qtyControls: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  qtyBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.bgCook, borderWidth: 0.5, borderColor: Colors.borderWarm, alignItems: 'center', justifyContent: 'center' },
  qtyBtnActive: { backgroundColor: Colors.ink, borderWidth: 0 },
  qtyNum: { fontFamily: Fonts.serif, fontSize: 22, color: Colors.spice, minWidth: 22, textAlign: 'center' },
  stickyBar: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, paddingBottom: 36, backgroundColor: Colors.bg, borderTopWidth: 0.5, borderTopColor: Colors.borderWarm },
  claimBtn: { backgroundColor: Colors.ink, borderRadius: Radius.lg, paddingVertical: 16, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  claimLabel: { fontFamily: Fonts.sansMedium, fontSize: 15, color: Colors.canvas, fontWeight: '600' },
  claimPrice: { fontFamily: Fonts.serif, fontSize: 18, color: Colors.ember },
});
