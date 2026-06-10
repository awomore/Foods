import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { cooksApi, type CookCard, type MenuItem } from '../../src/api/cooks';
import { useCart } from '../../src/context/CartContext';
import { Fonts, Spacing, Radius, Shadow } from '../../src/constants/theme';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { fmtCurrency } from '../../src/utils/format';
import DishPhoto from '../../src/components/ui/DishPhoto';
import Avatar from '../../src/components/ui/Avatar';
import { Bone } from '../../src/components/ui/Skeleton';

interface DishEntry {
  dish: MenuItem;
  cook: CookCard;
}

function getRandom(arr: DishEntry[], exclude: number): number {
  if (arr.length <= 1) return 0;
  let next = Math.floor(Math.random() * arr.length);
  while (next === exclude) next = Math.floor(Math.random() * arr.length);
  return next;
}

export default function SpinScreen() {
  const router = useRouter();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const { addItem, items } = useCart();

  const [dishes, setDishes] = useState<DishEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [idx, setIdx] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [added, setAdded] = useState<Set<string>>(new Set());

  const fadeAnim = useRef(new Animated.Value(1)).current;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { cooks } = await cooksApi.list({ limit: 30 });
      const entries: DishEntry[] = cooks.flatMap(cook =>
        (cook.today_items ?? [])
          .filter(d => (d.slots_claimed < d.total_slots) && d.is_active)
          .map(dish => ({ dish, cook }))
      );
      setDishes(entries);
      if (entries.length > 0) {
        setIdx(Math.floor(Math.random() * entries.length));
      }
    } catch {
      // Silent fail — empty state handles it
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function handleSpin() {
    if (spinning || dishes.length < 2) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSpinning(true);

    let count = 0;
    const total = 5;
    const cycle = () => {
      Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => {
        setIdx(i => getRandom(dishes, i));
        count++;
        Animated.timing(fadeAnim, { toValue: 1, duration: 120, useNativeDriver: true }).start(() => {
          if (count < total) cycle();
          else { setSpinning(false); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }
        });
      });
    };
    cycle();
  }

  function handleAddToTray() {
    if (!current) return;
    const { dish, cook } = current;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    addItem({
      cookId: cook.id,
      cookName: cook.display_name,
      menuItemId: dish.id,
      dishTitle: dish.title,
      price: dish.unit_price,
      currencyCode: cook.currency_code ?? 'NGN',
      qty: 1,
      selectedSides: [],
      removedSides: [],
      allergenAcknowledged: false,
      matchedAllergens: [],
      matchedIngredients: [],
      deliveryWindow: '',
    });
    setAdded(a => new Set([...a, dish.id]));
  }

  const current = dishes[idx] ?? null;
  const isAdded = current ? added.has(current.dish.id) : false;
  const cartTotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const cartCount = items.reduce((s, i) => s + i.qty, 0);

  return (
    <View style={styles.root}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Explore</Text>
        </View>

        <View style={styles.body}>
          <Text style={styles.eyebrow}>Not sure what to eat?</Text>
          <Text style={styles.subCopy}>Let FOODS pick for you.</Text>

          {loading ? (
            <View style={styles.loadingCard}>
              <Bone width="100%" height={200} radius={0} />
              <View style={{ padding: 16, gap: 10 }}>
                <Bone width="40%" height={12} delay={60} />
                <Bone width="70%" height={20} delay={100} />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Bone width={60} height={14} delay={140} />
                  <Bone width={50} height={14} delay={170} />
                </View>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  <Bone width="48%" height={44} radius={12} delay={200} />
                  <Bone width="48%" height={44} radius={12} delay={230} />
                </View>
              </View>
            </View>
          ) : dishes.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={{ fontSize: 48 }}>🍽️</Text>
              <Text style={styles.emptyTitle}>No dishes available right now</Text>
              <Text style={styles.emptySub}>Check back soon — cooks are usually live from 11am onwards.</Text>
              <TouchableOpacity
                style={[styles.emptyBtn, { backgroundColor: C.spice }]}
                onPress={load}
              >
                <Ionicons name="refresh-outline" size={16} color={C.canvas} />
                <Text style={[styles.emptyBtnText, { color: C.canvas }]}>Refresh</Text>
              </TouchableOpacity>
            </View>
          ) : current ? (
            <Animated.View style={[styles.card, { opacity: fadeAnim }]}>
              <DishPhoto
                uri={current.dish.photos?.[0] ?? null}
                label={current.dish.title}
                height={200}
                radius={0}
                recyclingKey={current.dish.id}
              />

              <View style={styles.cardBody}>
                <TouchableOpacity
                  onPress={() => router.push(`/cook/${current.cook.id}` as any)}
                  style={styles.cookRow}
                >
                  <Avatar
                    name={current.cook.display_name}
                    avatarUrl={current.cook.avatar_url}
                    size={24}
                    isLive={current.cook.is_live}
                  />
                  <Text style={styles.cookName}>{current.cook.display_name}</Text>
                  {current.cook.location && (
                    <Text style={styles.cookArea}>· {current.cook.location}</Text>
                  )}
                </TouchableOpacity>

                <Text style={styles.dishTitle} numberOfLines={2}>{current.dish.title}</Text>
                <View style={styles.metaRow}>
                  <Text style={styles.dishPrice}>
                    {fmtCurrency(current.dish.unit_price, current.cook.currency_code ?? 'NGN')}
                  </Text>
                  <View style={styles.slotPill}>
                    <Text style={styles.slotText}>
                      {current.dish.total_slots - current.dish.slots_claimed} slots left
                    </Text>
                  </View>
                </View>

                <View style={styles.actions}>
                  <TouchableOpacity
                    onPress={handleSpin}
                    style={styles.spinAgainBtn}
                    activeOpacity={0.75}
                    disabled={spinning || dishes.length < 2}
                  >
                    <Ionicons name="dice-outline" size={16} color={C.spice} />
                    <Text style={styles.spinAgainLabel}>Spin again</Text>
                  </TouchableOpacity>

                  {isAdded ? (
                    <View style={styles.addedBtn}>
                      <Ionicons name="checkmark" size={16} color={C.successFg} />
                      <Text style={styles.addedLabel}>In your tray</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      onPress={handleAddToTray}
                      style={styles.addBtn}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="add" size={16} color={C.canvas} />
                      <Text style={styles.addLabel}>Add to tray</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </Animated.View>
          ) : null}

          {!loading && dishes.length > 1 && (
            <TouchableOpacity
              onPress={handleSpin}
              style={[styles.bigSpinBtn, spinning && styles.bigSpinBtnSpinning]}
              activeOpacity={0.85}
            >
              <Ionicons name="dice" size={26} color={C.ember} />
              <Text style={styles.bigSpinLabel}>{spinning ? 'Spinning…' : 'Spin'}</Text>
            </TouchableOpacity>
          )}
        </View>

        {cartCount > 0 && (
          <View style={styles.checkoutBar}>
            <TouchableOpacity
              onPress={() => router.push('/checkout')}
              style={styles.checkoutBtn}
              activeOpacity={0.85}
            >
              <Text style={styles.checkoutLabel}>
                Go to tray ({cartCount})
              </Text>
              <Text style={styles.checkoutTotal}>
                {fmtCurrency(cartTotal, items[0]?.currencyCode ?? 'NGN')}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

function makeStyles(C: AppColors) { return StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { paddingHorizontal: Spacing.lg, paddingTop: 16, paddingBottom: 8 },
  headerTitle: { fontFamily: Fonts.serif, fontSize: 24, color: C.textInk },
  body: { flex: 1, paddingHorizontal: Spacing.lg, paddingTop: 4 },
  eyebrow: { fontFamily: Fonts.sans, fontSize: 13, color: C.bodySoft },
  subCopy: { fontFamily: Fonts.sansMedium, fontSize: 15, color: C.textInk, marginBottom: 20 },

  loadingCard: { backgroundColor: C.bgCard, borderRadius: Radius.lg, overflow: 'hidden', borderWidth: 0.5, borderColor: C.borderWarm, ...Shadow.card },

  emptyCard: { alignItems: 'center', paddingVertical: 48, gap: 10, backgroundColor: C.bgCard, borderRadius: Radius.lg, padding: 24, borderWidth: 0.5, borderColor: C.borderWarm, ...Shadow.card },
  emptyTitle: { fontFamily: Fonts.sansMedium, fontSize: 16, color: C.textInk, textAlign: 'center' },
  emptySub: { fontFamily: Fonts.sans, fontSize: 13, color: C.bodySoft, textAlign: 'center', lineHeight: 20 },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 8, paddingHorizontal: 20, paddingVertical: 11, borderRadius: 40 },
  emptyBtnText: { fontFamily: Fonts.sansMedium, fontSize: 14 },

  card: {
    backgroundColor: C.bgCard, borderRadius: Radius.lg,
    borderWidth: 0.5, borderColor: C.borderWarm,
    overflow: 'hidden', ...Shadow.card, marginBottom: 20,
  },
  cardBody: { padding: 16 },
  cookRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  cookName: { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.textInk },
  cookArea: { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft },
  dishTitle: { fontFamily: Fonts.serif, fontSize: 18, color: C.textInk, lineHeight: 24, marginBottom: 8 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  dishPrice: { fontFamily: Fonts.serif, fontSize: 20, color: C.spice },
  slotPill: { backgroundColor: C.honey, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 40 },
  slotText: { fontFamily: Fonts.sans, fontSize: 11, color: C.warnFg },

  actions: { flexDirection: 'row', gap: 10 },
  spinAgainBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 11, borderRadius: Radius.md,
    borderWidth: 1, borderColor: C.borderWarm,
  },
  spinAgainLabel: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.spice },
  addBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 11, borderRadius: Radius.md, backgroundColor: C.ink,
  },
  addLabel: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.canvas },
  addedBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 11, borderRadius: Radius.md, backgroundColor: C.successBg,
  },
  addedLabel: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.successFg },

  bigSpinBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: C.ink, borderRadius: Radius.lg, paddingVertical: 18, ...Shadow.lift,
  },
  bigSpinBtnSpinning: { opacity: 0.7 },
  bigSpinLabel: { fontFamily: Fonts.sansMedium, fontSize: 17, color: C.canvas },

  checkoutBar: { padding: 16, paddingBottom: 0, borderTopWidth: 0.5, borderTopColor: C.borderWarm },
  checkoutBtn: {
    backgroundColor: C.spice, borderRadius: Radius.lg, paddingVertical: 14, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  checkoutLabel: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.canvas },
  checkoutTotal: { fontFamily: Fonts.serif, fontSize: 16, color: C.ember },
}); }
